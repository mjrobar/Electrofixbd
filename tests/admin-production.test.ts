import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { scryptSync, randomUUID } from "node:crypto";
import express from "express";
import pg from "pg";
import { errorHandler } from "../server/errors";
import { createAdminRouter } from "../server/admin";
import { createStore } from "../server/store";
import { createApp } from "../server/app";
import { loadConfig } from "../server/config";
import { validate } from "../server/site-controls";
import { safeMediaUrl } from "../server/media";
import {
  applyBrowserLockdown,
  securityPreview,
} from "../scripts/secure-database";
import { disposable, postgresOptions } from "./helpers/disposable-postgres";

const password = "test-password",
  secret = "test-owner-secret-".repeat(3),
  encoded =
    "test-salt:" + scryptSync(password, "test-salt", 64).toString("hex");
test("media and proxy validation reject unsafe destinations and trust-all topologies", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:image/svg+xml,evil",
    "http://example.com/a",
    "https://user:pass@example.com/a",
    "//evil.com",
    "/\\evil.com",
    "https://127.0.0.1/a",
    "https://169.254.169.254/a",
    "https://[::1]/a",
    "https://example.local/a",
    "https://example.com:8443/a",
  ])
    assert.equal(safeMediaUrl(value), false, value);
  for (const value of [
    "https://images.unsplash.com/photo-1",
    "/assets/a.png",
    "",
  ])
    assert.equal(safeMediaUrl(value), true);
  for (const value of [
    "true",
    "1",
    "0.0.0.0/0",
    "::/0",
    "any",
    "proxy.example.com",
  ])
    assert.throws(() => loadConfig({ NODE_ENV: "test", TRUST_PROXY: value }));
  const legacyHero = validate("hero_slides", [{ id: "legacy-hero-1" }]);
  assert.ok(legacyHero.success);
  assert.equal(
    (legacyHero.data as { actions_configured: boolean }[])[0]
      .actions_configured,
    false,
  );
  assert.equal(
    validate("hero_slides", [
      {
        id: "new",
        actions_configured: true,
        primary_action: "navigate",
        button_url: "/works",
      },
    ]).success,
    true,
  );
  assert.equal(
    validate("hero_slides", [
      { id: "new", actions_configured: true, primary_action: "navigate" },
    ]).success,
    false,
  );
  assert.equal(
    loadConfig({ NODE_ENV: "test", TRUST_PROXY: "127.0.0.1/32,::1/128" })
      .TRUST_PROXY,
    "127.0.0.1/32,::1/128",
  );
});

test(
  "admin lifecycle, secure sessions, private operations, history and public compatibility",
  postgresOptions,
  () =>
    disposable(async (pool, url) => {
      const config = loadConfig({
        NODE_ENV: "test",
        DATABASE_URL: url,
        PUBLIC_ORIGIN: "http://localhost",
        ADMIN_USERNAME: "owner",
        ADMIN_PASSWORD_HASH: encoded,
        ADMIN_SESSION_SECRET: secret,
      });
      const router = createAdminRouter(config, pool),
        app = express();
      app.use("/api/admin", router);
      app.use(errorHandler);
      const server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const origin = `http://127.0.0.1:${address.port}`;
      let cookie = "";
      const store = createStore(config);
      async function request(
        path: string,
        method = "GET",
        body?: unknown,
        auth = true,
        csrf = true,
      ) {
        const response = await fetch(origin + "/api/admin" + path, {
          method,
          headers: {
            ...(auth && cookie ? { cookie } : {}),
            ...(csrf
              ? { Origin: "http://localhost", "X-Admin-Request": "1" }
              : {}),
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return {
          status: response.status,
          headers: response.headers,
          body: await response.json(),
        };
      }
      async function login() {
        const result = await request("/login", "POST", {
          username: "owner",
          password,
        });
        assert.equal(result.status, 200);
        cookie = result.headers.get("set-cookie")!.split(";")[0];
        return cookie;
      }
      try {
        for (const path of [
          "/overview",
          "/bookings",
          "/contacts",
          "/content/services",
          "/site-content/faqs",
          "/history/services/id",
          "/audit",
          "/sessions",
        ])
          assert.equal((await request(path)).status, 401, path);
        assert.equal(
          (
            await request(
              "/login",
              "POST",
              { username: "owner", password },
              false,
              false,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request("/login", "POST", {
              username: "owner",
              password: "wrong",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/login", "POST", {
              username: "x".repeat(9000),
              password,
            })
          ).status,
          413,
        );
        const first = await login();
        assert.match(first, /efb_admin_session=[a-f0-9]{64}$/);
        const rows = (await pool.query("SELECT * FROM admin_sessions")).rows;
        assert.equal(rows.length, 1);
        assert.ok(!JSON.stringify(rows).includes(first.split("=")[1]));
        const productionRouter = createAdminRouter(
            { ...config, NODE_ENV: "production" },
            pool,
          ),
          secureApp = express();
        secureApp.use("/api/admin", productionRouter);
        const secureServer = secureApp.listen(0, "127.0.0.1");
        await once(secureServer, "listening");
        const secureAddress = secureServer.address();
        assert.ok(secureAddress && typeof secureAddress !== "string");
        try {
          const result = await fetch(
            `http://127.0.0.1:${secureAddress.port}/api/admin/login`,
            {
              method: "POST",
              headers: {
                Origin: "http://localhost",
                "X-Admin-Request": "1",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ username: "owner", password }),
            },
          );
          assert.equal(result.status, 200);
          assert.match(result.headers.get("set-cookie")!, /HttpOnly/);
          assert.match(result.headers.get("set-cookie")!, /Secure/);
          assert.match(result.headers.get("set-cookie")!, /SameSite=Strict/);
        } finally {
          secureServer.closeAllConnections();
          await new Promise<void>((resolve) =>
            secureServer.close(() => resolve()),
          );
        }
        const inputs = {
          services: {
            slug: "stable-service",
            name: "Stable service",
            short_description: "Short",
            full_description: "Details",
            common_problems: ["One", "Two"],
            service_process: ["Inspect", "Repair"],
            cover_image: "https://cdn.example.com/a.jpg",
            is_active: true,
          },
          works: {
            title: "Safe work",
            slug: "stable-work",
            service_type: "AC",
            category: "AC",
            description: "Details",
            media_url: "https://cdn.example.com/a.mp4",
            media_type: "video",
            is_featured: true,
            is_published: true,
          },
          testimonials: {
            customer_name: "Consented reviewer",
            review: "Reviewed text",
            service_type: "AC",
            rating: 5,
            avatar_url: "",
            media_url: "",
            media_type: null,
            is_published: true,
          },
        };
        for (const kind of ["services", "works", "testimonials"] as const) {
          const base = "/content/" + kind;
          let result = await request(base, "POST", inputs[kind]);
          assert.equal(result.status, 201, JSON.stringify(result.body));
          let item = result.body.item;
          const id = item.id;
          assert.equal(
            item[kind === "services" ? "is_active" : "is_published"],
            false,
          );
          assert.equal(
            (await request(base, "POST", inputs[kind], false)).status,
            401,
          );
          const visible = () =>
            kind === "services"
              ? store.listServices({ offset: 0, limit: 100 })
              : kind === "works"
                ? store.listWorks({ offset: 0, limit: 100 })
                : store.listTestimonials({ offset: 0, limit: 100 });
          assert.ok(!(await visible()).some((row) => row.id === id));
          result = await request(
            base + "/" + id + "/publish",
            "POST",
            { revision: item.revision },
            true,
            false,
          );
          assert.equal(result.status, 403);
          result = await request(base + "/" + id + "/publish", "POST", {
            revision: item.revision,
          });
          assert.equal(result.status, 200, JSON.stringify(result.body));
          item = result.body.item;
          assert.ok((await visible()).some((row) => row.id === id));
          const changed = {
            ...inputs[kind],
            ...(kind === "services"
              ? { name: "Draft title" }
              : kind === "works"
                ? { title: "Draft title" }
                : { review: "Draft text" }),
          };
          result = await request(base + "/" + id, "PUT", {
            ...changed,
            revision: item.revision,
          });
          assert.equal(result.status, 200, JSON.stringify(result.body));
          item = result.body.item;
          const pub = (await visible()).find((row) => row.id === id)!;
          assert.ok(!JSON.stringify(pub).includes("Draft title"));
          assert.ok(!JSON.stringify(pub).includes("Draft text"));
          assert.ok(!("admin_draft" in pub));
          const racing = await Promise.all([
            request(base + "/" + id, "PUT", {
              ...changed,
              revision: item.revision,
            }),
            request(base + "/" + id, "PUT", {
              ...changed,
              revision: item.revision,
            }),
          ]);
          assert.deepEqual(racing.map((r) => r.status).sort(), [200, 409]);
          item = racing.find((r) => r.status === 200)!.body.item;
          if (kind !== "testimonials")
            assert.equal(
              (
                await request(base + "/" + id, "PUT", {
                  ...changed,
                  slug: "changed-url",
                  revision: item.revision,
                })
              ).status,
              409,
            );
          const history = await request("/history/" + kind + "/" + id);
          assert.equal(history.status, 200);
          assert.ok(history.body.items.length >= 2);
          result = await request(
            "/history/" + kind + "/" + id + "/restore",
            "POST",
            {
              revision: item.revision,
              source_revision: history.body.items.at(-1).revision,
            },
          );
          assert.equal(result.status, 200);
          item = result.body.item;
          assert.ok((await visible()).some((row) => row.id === id));
          result = await request(base + "/" + id + "/unpublish", "POST", {
            revision: item.revision,
          });
          item = result.body.item;
          assert.ok(!(await visible()).some((row) => row.id === id));
          result = await request(base + "/" + id + "/archive", "POST", {
            revision: item.revision,
          });
          assert.equal(result.status, 200);
          item = result.body.item;
          assert.ok(item.archived_at);
          assert.equal(
            (
              await request(
                base +
                  "?status=archived&q=" +
                  encodeURIComponent(
                    kind === "testimonials" ? "Consented" : "stable",
                  ),
              )
            ).body.total,
            1,
          );
          result = await request(base + "/" + id + "/restore", "POST", {
            revision: item.revision,
          });
          assert.equal(result.status, 200);
          item = result.body.item;
          assert.equal(item.archived_at, null);
          assert.equal(
            item[kind === "services" ? "is_active" : "is_published"],
            false,
          );
        }
        assert.equal(
          (
            await request("/content/works", "POST", {
              ...inputs.works,
              slug: "unsafe",
              media_url: "javascript:alert(1)",
            })
          ).status,
          400,
        );
        assert.equal(
          (await request("/content/services", "POST", inputs.services)).status,
          409,
        );
        assert.equal(
          (await request("/content/services?status=arbitrary")).status,
          400,
        );
        let site = (await request("/site-content/faqs")).body.item;
        site = (
          await request("/site-content/faqs/draft", "PUT", {
            revision: site.revision,
            data: [{ id: "faq", question: "Question?", answer: "Answer" }],
          })
        ).body.item;
        site = (
          await request("/site-content/faqs/publish", "POST", {
            revision: site.revision,
          })
        ).body.item;
        const faqPublication = site.published;
        site = (
          await request("/site-content/faqs/draft", "PUT", {
            revision: site.revision,
            data: [{ id: "faq", question: "Changed?", answer: "New answer" }],
          })
        ).body.item;
        const version = (
          await request("/history/site_content/faqs")
        ).body.items.find((v: { snapshot: { draft: unknown } }) =>
          JSON.stringify(v.snapshot.draft).includes("Question?"),
        );
        assert.ok(version);
        const restored = await request(
          "/history/site_content/faqs/restore",
          "POST",
          { revision: site.revision, source_revision: version.revision },
        );
        assert.equal(restored.status, 200);
        assert.deepEqual(restored.body.item.published, faqPublication);
        assert.equal(restored.body.item.draft[0].question, "Question?");
        const unchangedPublication = restored.body.item.published;
        const emptyDraft = await request("/site-content/faqs/draft", "PUT", {
          revision: restored.body.item.revision,
          data: [],
        });
        assert.equal(
          (
            await request("/site-content/faqs/publish", "POST", {
              revision: emptyDraft.body.item.revision,
            })
          ).status,
          409,
        );
        assert.deepEqual(
          (await request("/site-content/faqs")).body.item.published,
          unchangedPublication,
        );
        const booking = await store.createBooking({
          customer_name: "Private customer",
          phone: "01700000000",
          address: "Private address",
          notes: "Customer note",
          service_id: "srv-general",
        });
        await store.createContact({
          name: "Private sender",
          phone: "01700000000",
          message: "Sensitive message",
        });
        let b = (await request("/bookings?q=" + booking.booking_number)).body
          .items[0];
        assert.equal(b.revision, 0);
        assert.equal(
          (
            await request("/bookings/" + b.booking_number, "PATCH", {
              revision: b.revision,
              status: "completed",
            })
          ).status,
          409,
        );
        const competing = await Promise.all([
          request("/bookings/" + b.booking_number, "PATCH", {
            revision: b.revision,
            status: "contacted",
          }),
          request("/bookings/" + b.booking_number, "PATCH", {
            revision: b.revision,
            status: "confirmed",
          }),
        ]);
        assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
        b = competing.find((r) => r.status === 200)!.body.item;
        b = (
          await request("/bookings/" + b.booking_number, "PATCH", {
            revision: b.revision,
            admin_notes: "Private internal notes",
          })
        ).body.item;
        assert.equal(b.admin_notes, "Private internal notes");
        assert.ok(
          !JSON.stringify(await store.getBooking(b.booking_number)).includes(
            "Private",
          ),
        );
        const c = (await request("/contacts?q=Private")).body.items[0];
        assert.equal(
          (
            await request("/contacts/" + c.id, "PATCH", {
              revision: c.revision,
              status: "replied",
              admin_notes: "Follow up",
            })
          ).status,
          200,
        );
        assert.equal((await request("/contacts?offset=-1")).status, 400);
        assert.equal((await request("/bookings?q=%25")).body.total, 0);
        const overview = await request("/overview");
        assert.equal(overview.status, 200);
        assert.equal(overview.body.bookings.total, 1);
        assert.ok(overview.body.days.length);
        assert.ok(!JSON.stringify(overview.body).includes("Private"));
        const audit = JSON.stringify((await request("/audit")).body);
        for (const value of [
          "Private customer",
          "Private address",
          "Sensitive message",
          "Private internal notes",
          "01700000000",
        ])
          assert.ok(!audit.includes(value));
        const sessions = await request("/sessions");
        assert.equal(sessions.status, 200);
        assert.ok(
          sessions.body.items.every(
            (s: Record<string, unknown>) =>
              !("token_hash" in s) && !("credential_version" in s),
          ),
        );
        const old = await login();
        assert.equal((await request("/logout", "POST", {})).status, 200);
        cookie = old;
        assert.equal((await request("/me")).status, 401);
        await login();
        await pool.query(
          "UPDATE admin_sessions SET last_seen_at=now()-interval '31 minutes'",
        );
        assert.equal((await request("/me")).status, 401);
        await login();
        await pool.query(
          "UPDATE admin_sessions SET expires_at=now()-interval '1 second'",
        );
        assert.equal((await request("/me")).status, 401);
        await login();
        await pool.query(
          "UPDATE admin_sessions SET credential_version='revoked'",
        );
        assert.equal((await request("/me")).status, 401);
        await login();
        assert.equal((await request("/logout-all", "POST", {})).status, 200);
        assert.equal((await request("/me")).status, 401);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await store.close();
      }
    }),
);

test(
  "gated lockdown removes legacy browser access while least-privilege Node persistence works",
  postgresOptions,
  () =>
    disposable(async (pool, url) => {
      const role = "efb_runtime_" + randomUUID().replaceAll("-", "");
      await pool.query(`CREATE ROLE ${role} LOGIN`);
      for (const name of ["anon", "authenticated"])
        await pool.query(
          `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${name}') THEN CREATE ROLE ${name} NOLOGIN; END IF; END $$`,
        );
      await pool.query(
        "ALTER TABLE bookings ENABLE ROW LEVEL SECURITY; CREATE POLICY test_legacy_exposure ON bookings FOR SELECT TO PUBLIC USING(true); GRANT SELECT ON bookings TO anon",
      );
      await pool.query(
        "INSERT INTO contact_messages(id,name,phone,message) VALUES($1,'Never expose','01700000000','Private')",
        [randomUUID()],
      );
      const before = await pool.query(
        "SELECT to_jsonb(t) AS row FROM contact_messages t",
      );
      assert.ok(
        (await securityPreview(pool)).policies.some(
          (p) => p.policyname === "test_legacy_exposure",
        ),
      );
      await assert.rejects(applyBrowserLockdown(url, role, "no approval"));
      try {
        await pool.query(
          "CREATE VIEW public.test_private_view AS SELECT * FROM contact_messages; GRANT SELECT ON test_private_view TO anon; CREATE FUNCTION public.test_danger() RETURNS SETOF public.contact_messages LANGUAGE sql SECURITY DEFINER AS 'SELECT * FROM public.contact_messages'",
        );
        await assert.rejects(
          applyBrowserLockdown(url, role, "REVOKE BROWSER DATABASE ACCESS"),
        );
        assert.equal(
          (
            await pool.query(
              "SELECT has_table_privilege('anon','bookings','SELECT') AS exposed",
            )
          ).rows[0].exposed,
          true,
        );
        await pool.query("DROP FUNCTION public.test_danger()");
        await applyBrowserLockdown(url, role, "REVOKE BROWSER DATABASE ACCESS");
        await applyBrowserLockdown(url, role, "REVOKE BROWSER DATABASE ACCESS");
        assert.deepEqual(
          (
            await pool.query(
              "SELECT to_jsonb(t) AS row FROM contact_messages t",
            )
          ).rows,
          before.rows,
        );
        const browser = await pool.connect();
        try {
          await browser.query("SET ROLE anon");
          for (const table of [
            "bookings",
            "contact_messages",
            "admin_sessions",
            "content_history",
            "site_content",
            "test_private_view",
          ])
            await assert.rejects(browser.query("SELECT * FROM " + table), {
              code: "42501",
            });
        } finally {
          await browser.query("RESET ROLE");
          browser.release();
        }
        const target = new URL(url);
        target.username = role;
        target.password = "";
        const runtime = new pg.Pool({ connectionString: target.toString() });
        const store = createStore(
          loadConfig({
            NODE_ENV: "production",
            DATABASE_URL: target.toString(),
            PUBLIC_ORIGIN: "https://example.com",
          }),
        );
        try {
          assert.equal(await store.ready(), true);
          await store.createContact({
            name: "Runtime",
            phone: "01700000000",
            message: "Durable",
          });
          const booking = await store.createBooking({
            customer_name: "Runtime",
            phone: "01700000000",
            address: "Dhaka",
            notes: "",
            service_id: "srv-general",
          });
          assert.equal(
            (await store.getBooking(booking.booking_number))!.status,
            "pending",
          );
          await runtime.query(
            "UPDATE bookings SET status='contacted' WHERE booking_number=$1",
            [booking.booking_number],
          );
          assert.ok(
            (await runtime.query("SELECT * FROM admin_audit")).rowCount,
          );
          await runtime.query(
            "UPDATE site_content SET draft='[]' WHERE key='faqs'",
          );
          assert.ok(
            (await runtime.query("SELECT * FROM content_history")).rowCount,
          );
          await assert.rejects(runtime.query("DELETE FROM bookings"), {
            code: "42501",
          });
        } finally {
          await store.close();
          await runtime.end();
        }
      } finally {
        await pool.query(`DROP OWNED BY ${role}`);
        await pool.query(`DROP ROLE ${role}`);
      }
    }),
);

test("trusted reverse-proxy identities rate limit independently; spoofed headers are rejected", async () => {
  for (const trust of ["false", "loopback"]) {
    const config = loadConfig({
        NODE_ENV: "test",
        TRUST_PROXY: trust,
        API_RATE_LIMIT: "2",
      }),
      store = createStore(config),
      app = createApp({ config, store }),
      server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/health`;
    try {
      if (trust === "false") {
        const response = await fetch(url, {
          headers: { "X-Forwarded-For": "203.0.113.1" },
        });
        assert.equal(response.status, 400);
        await response.text();
      } else {
        for (let i = 0; i < 3; i++) {
          const response = await fetch(url, {
            headers: { "X-Forwarded-For": "203.0.113.1" },
          });
          assert.equal(response.status, i === 2 ? 429 : 200);
          await response.text();
        }
        const other = await fetch(url, {
          headers: { "X-Forwarded-For": "203.0.113.2" },
        });
        assert.equal(other.status, 200);
        await other.text();
      }
      const malformed = await fetch(url, {
        headers: { "X-Forwarded-For": "not-an-ip" },
      });
      assert.equal(malformed.status, 400);
      await malformed.text();
      const unsupported = await fetch(url, {
        headers: { Forwarded: "for=203.0.113.1" },
      });
      assert.equal(unsupported.status, 400);
      await unsupported.text();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await store.close();
      await app.locals.close();
    }
  }
});
