import assert from "node:assert/strict";
import { createHmac, randomUUID, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import pg from "pg";
import { assertSourceProvenance } from "./helpers/catalog-provenance";
import catalog from "../server/existing-content-catalog.json";
import {
  applyContentImport,
  buildImportPreview,
  canonical,
  digest,
  importApproval,
  ImportConflict,
  readImportPreview,
  type ContentRow,
} from "../server/content-import";
import { createAdminRouter } from "../server/admin";
import {
  createPublicSiteControlsRouter,
  validate,
} from "../server/site-controls";
import { loadConfig } from "../server/config";
import { migrate } from "../scripts/migrate";

function placeholders(): ContentRow[] {
  return ["hero_slides", "faqs", "business_settings", "page_sections"].map(
    (key) => ({
      key: key as ContentRow["key"],
      draft: key === "business_settings" ? {} : [],
      published: key === "business_settings" ? {} : [],
      revision: 0,
      updated_at: "2026-10-17T00:00:00.000Z",
    }),
  );
}
test("catalog has verifiable source provenance and explicitly partial mappings", async () => {
  for (const source of catalog.sources) {
    const text = await readFile(
      new URL("../" + source.path, import.meta.url),
      "utf8",
    );
    assertSourceProvenance(source, text, catalog.source_ref);
  }
  assert.equal(catalog.data.hero_slides.length, 3);
  assert.equal(catalog.data.faqs.length, 8);
  assert.equal(catalog.data.page_sections.length, 6);
  for (const hero of catalog.data.hero_slides) {
    assert.ok(!("button_url" in hero));
    assert.ok(hero.subtitle);
  }
  assert.ok(!("email" in catalog.data.business_settings));
  assert.ok(!("logo_url" in catalog.data.business_settings));
  assert.equal(catalog.data.business_settings.address, "Dhaka, Bangladesh");
  for (const module of buildImportPreview(placeholders()).modules)
    assert.equal(module.action, "import-draft");
  assert.equal(
    (
      buildImportPreview(placeholders()).modules.find(
        (m) => m.key === "business_settings",
      )!.data as Record<string, unknown>
    )["email"],
    "",
  );
  assert.equal(
    validate("faqs", [
      { id: "same", question: "Test?", answer: "Yes" },
      { id: "same", question: "Test?", answer: "Yes" },
    ]).success,
    false,
  );
});
test("source provenance accepts checkout line endings without accepting source or catalogue edits", async () => {
  for (const source of catalog.sources) {
    const lf = (
      await readFile(new URL("../" + source.path, import.meta.url), "utf8")
    ).replace(/\r\n/g, "\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    let newline = 0;
    const mixed = lf.replace(/\n/g, () => (newline++ % 2 ? "\r\n" : "\n"));
    for (const text of [lf, crlf, mixed])
      assertSourceProvenance(source, text, catalog.source_ref);
    assert.throws(
      () =>
        assertSourceProvenance(
          { ...source, sha256: "0".repeat(64) },
          crlf,
          catalog.source_ref,
        ),
      /Review source mappings and imported values/,
    );
    for (const changed of [lf + " ", "\uFEFF" + lf, lf.replace(/\n/, "\r")]) {
      assert.throws(
        () => assertSourceProvenance(source, changed, catalog.source_ref),
        /after CRLF-to-LF normalization/,
      );
    }
  }
  const hero = catalog.sources.find((source) =>
    source.path.endsWith("/HeroSlider.tsx"),
  )!;
  const original = await readFile(
    new URL("../" + hero.path, import.meta.url),
    "utf8",
  );
  const title = catalog.data.hero_slides[0].title;
  assert.ok(original.includes(title));
  const changed = original.replace(
    title,
    "Changed headline requiring source review",
  );
  assert.throws(
    () => assertSourceProvenance(hero, changed, catalog.source_ref),
    /Raw SHA-256:.*LF SHA-256:.*recorded SHA-256:/,
  );
  assert.throws(
    () =>
      assertSourceProvenance(
        hero,
        changed.replace(/\r?\n/g, "\r\n"),
        catalog.source_ref,
      ),
    /Review source mappings and imported values/,
  );
});
test("preview is deterministic, additive and preserves authored or intentionally empty records", () => {
  const rows = placeholders();
  rows[0].draft = [{ id: "existing" }];
  rows[1].published = [{ id: "published" }];
  rows[2].revision = 1;
  const before = structuredClone(rows);
  const preview = buildImportPreview(rows);
  assert.deepEqual(rows, before);
  assert.deepEqual(
    preview.modules.map((m) => m.action),
    ["skip", "skip", "skip", "import-draft"],
  );
  assert.equal(
    preview.preview_digest,
    buildImportPreview([...rows].reverse()).preview_digest,
  );
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
  assert.equal(
    canonical(new Date("2026-10-17T00:00:00Z")),
    JSON.stringify("2026-10-17T00:00:00.000Z"),
  );
});

const base = process.env.TEST_DATABASE_URL;
test(
  "disposable PostgreSQL: import approval, backup, idempotency, concurrency, admin revisions and published-only API",
  {
    skip: !base
      ? "Set TEST_DATABASE_URL to a disposable local PostgreSQL cluster."
      : false,
  },
  async () => {
    const target = new URL(base!);
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
    assert.match(target.pathname, /test/);
    const admin = new pg.Client({ connectionString: base });
    await admin.connect();
    const name = "efb_import_test_" + randomUUID().replaceAll("-", "");
    await admin.query(`CREATE DATABASE ${name}`);
    target.pathname = "/" + name;
    const pool = new pg.Pool({ connectionString: target.toString() });
    let server: ReturnType<express.Express["listen"]> | undefined;
    try {
      await migrate(target.toString());
      const secret = "test-session-secret-".repeat(3),
        password = "local-test-password";
      const config = loadConfig({
        NODE_ENV: "test",
        DATABASE_URL: target.toString(),
        PUBLIC_ORIGIN: "http://localhost",
        ADMIN_SESSION_SECRET: secret,
        ADMIN_USERNAME: "test-admin",
        ADMIN_PASSWORD_HASH:
          "test-salt:" + scryptSync(password, "test-salt", 64).toString("hex"),
      });
      const app = express();
      app.use("/api/admin", createAdminRouter(config, pool));
      app.use("/api/site-content", createPublicSiteControlsRouter(pool));
      server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const origin = `http://127.0.0.1:${address.port}`;
      let cookie = "";
      async function req(
        path: string,
        method = "GET",
        body?: unknown,
        authenticated = true,
        csrf = true,
      ) {
        const response = await fetch(origin + path, {
          method,
          headers: {
            ...(authenticated && cookie ? { cookie } : {}),
            ...(csrf
              ? { Origin: "http://localhost", "X-Admin-Request": "1" }
              : {}),
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return {
          status: response.status,
          body: await response.json(),
          headers: response.headers,
        };
      }
      const endpoint = "/api/admin/site-content-import/";
      for (const path of [
        endpoint + "preview",
        endpoint + "backup",
        "/api/admin/site-content/faqs",
      ])
        assert.equal((await req(path, "GET", undefined, false)).status, 401);
      assert.equal(
        (await req(endpoint + "apply", "POST", {}, false)).status,
        401,
      );
      assert.equal(
        (
          await req(
            "/api/admin/site-content/faqs/draft",
            "PUT",
            { data: [], revision: 0 },
            false,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await req(
            "/api/admin/site-content/faqs/publish",
            "POST",
            { revision: 0 },
            false,
          )
        ).status,
        401,
      );
      assert.equal(
        (await req(endpoint + "apply", "POST", {}, false, false)).status,
        403,
      );
      const login = await req("/api/admin/login", "POST", {
        username: "test-admin",
        password,
      });
      assert.equal(login.status, 200);
      cookie = login.headers.get("set-cookie")!.split(";")[0];
      const unrelatedBefore = (
        await pool.query(
          "SELECT (SELECT jsonb_agg(t) FROM services t) AS services,(SELECT jsonb_agg(t) FROM bookings t) AS bookings,(SELECT jsonb_agg(t) FROM works t) AS works,(SELECT jsonb_agg(t) FROM testimonials t) AS testimonials,(SELECT jsonb_agg(t) FROM contact_messages t) AS contacts",
        )
      ).rows;
      const before = await readImportPreview(pool);
      const preview = await req(endpoint + "preview");
      assert.equal(preview.status, 200);
      assert.ok(!preview.body.approval_token);
      assert.equal(preview.body.preview_digest, before.preview_digest);
      assert.equal(
        (
          await req("/api/admin/site-content/faqs/publish", "POST", {
            revision: 0,
          })
        ).status,
        409,
      );
      const backup = await req(endpoint + "backup");
      assert.equal(backup.status, 200);
      assert.match(backup.headers.get("content-disposition")!, /attachment/);
      assert.deepEqual(
        backup.body.backup,
        JSON.parse(JSON.stringify(before.backup)),
      );
      assert.equal(digest(backup.body.backup), backup.body.backup_digest);
      const token = backup.body.approval_token;
      const apply = (approval_token = token, approval = importApproval) =>
        req(endpoint + "apply", "POST", { approval_token, approval });
      assert.equal((await apply(token, "yes")).status, 400);
      assert.equal((await apply(token + "tamper")).status, 409);
      const payload = `${before.preview_digest}.1`;
      assert.equal(
        (
          await apply(
            payload +
              "." +
              createHmac("sha256", secret).update(payload).digest("hex"),
          )
        ).status,
        409,
      );
      assert.equal(
        (await readImportPreview(pool)).preview_digest,
        before.preview_digest,
      );
      const applied = await apply();
      assert.equal(applied.status, 200);
      assert.equal(applied.body.imported.length, 4);
      const imported = await readImportPreview(pool);
      assert.ok(imported.modules.every((m) => m.action === "skip"));
      assert.ok(imported.backup.rows.every((row) => row.revision === 1));
      assert.deepEqual(
        imported.backup.rows.map((row) => row.published),
        before.backup.rows.map((row) => row.published),
      );
      const publicEmpty = await req("/api/site-content/faqs");
      assert.deepEqual(publicEmpty.body.data, []);
      assert.ok(!("draft" in publicEmpty.body));
      assert.equal((await apply()).status, 409); // Stale backup cannot be replayed after import.
      const fresh = await req(endpoint + "backup");
      assert.deepEqual(
        (await apply(fresh.body.approval_token)).body.imported,
        [],
      );
      assert.deepEqual((await readImportPreview(pool)).backup, imported.backup); // No revision/timestamp churn.
      const draft = [
        {
          id: "custom-faq",
          question: "Changed question?",
          answer: "Changed answer",
          category: "General",
          is_active: true,
        },
      ];
      let result = await req("/api/admin/site-content/faqs/draft", "PUT", {
        data: draft,
        revision: 1,
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.item.revision, 2);
      assert.equal(
        (
          await req("/api/admin/site-content/faqs/publish", "POST", {
            revision: 1,
          })
        ).status,
        409,
      );
      assert.deepEqual((await req("/api/site-content/faqs")).body.data, []);
      result = await req("/api/admin/site-content/faqs/publish", "POST", {
        revision: 2,
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.item.revision, 3);
      assert.deepEqual(result.body.item.draft, draft);
      assert.deepEqual((await req("/api/site-content/faqs")).body.data, draft);
      const competing = await Promise.all([
        req("/api/admin/site-content/faqs/draft", "PUT", {
          data: [{ ...draft[0], answer: "First contender" }],
          revision: 3,
        }),
        req("/api/admin/site-content/faqs/draft", "PUT", {
          data: [{ ...draft[0], answer: "Second contender" }],
          revision: 3,
        }),
      ]);
      assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
      assert.deepEqual((await req("/api/site-content/faqs")).body.data, draft);
      const largeDraft = Array.from({ length: 3 }, (_, i) => ({
        ...draft[0],
        id: "large-" + i,
        answer: "x".repeat(3000),
      }));
      assert.equal(
        (
          await req("/api/admin/site-content/faqs/draft", "PUT", {
            data: largeDraft,
            revision: 4,
          })
        ).status,
        200,
      ); // More than the old 8 KB parser limit.
      const writer = await pool.connect();
      try {
        await writer.query("BEGIN");
        await writer.query(
          "UPDATE site_content SET draft='[{}]'::jsonb,revision=6 WHERE key='faqs'",
        );
        const publishing = req("/api/admin/site-content/faqs/publish", "POST", {
          revision: 6,
        });
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const activity = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%public.site_content%'",
            [name],
          );
          if (activity.rowCount) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(waiting, "Publisher must wait for the concurrent writer");
        await writer.query("COMMIT");
        assert.equal((await publishing).status, 409); // Validate the actual locked draft.
        assert.deepEqual(
          (await req("/api/site-content/faqs")).body.data,
          draft,
        );
      } finally {
        await writer.query("ROLLBACK");
        writer.release();
      }
      const stale = await req(endpoint + "backup");
      await pool.query(
        "UPDATE site_content SET revision=revision+1 WHERE key='hero_slides'",
      );
      assert.equal((await apply(stale.body.approval_token)).status, 409);
      const unrelatedAfter = (
        await pool.query(
          "SELECT (SELECT jsonb_agg(t) FROM services t) AS services,(SELECT jsonb_agg(t) FROM bookings t) AS bookings,(SELECT jsonb_agg(t) FROM works t) AS works,(SELECT jsonb_agg(t) FROM testimonials t) AS testimonials,(SELECT jsonb_agg(t) FROM contact_messages t) AS contacts",
        )
      ).rows;
      assert.deepEqual(unrelatedAfter, unrelatedBefore);
      // A partially authored database is preserved module-by-module, including revision-0 content.
      await pool.query(
        "DELETE FROM site_content WHERE key IN ('hero_slides','faqs','page_sections'); INSERT INTO site_content(key) VALUES ('hero_slides'),('faqs'),('page_sections')",
      );
      await pool.query(
        "UPDATE site_content SET draft=$1::jsonb WHERE key='faqs'",
        [JSON.stringify(draft)],
      );
      await pool.query("DELETE FROM site_content WHERE key='hero_slides'");
      const partial = await readImportPreview(pool);
      assert.equal(
        partial.modules.find((m) => m.key === "faqs")!.action,
        "skip",
      );
      const outcomes = await Promise.allSettled([
        applyContentImport(pool, partial.preview_digest),
        applyContentImport(pool, partial.preview_digest),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.ok(
        outcomes.some(
          (r) => r.status === "rejected" && r.reason instanceof ImportConflict,
        ),
      );
      assert.deepEqual(
        (await pool.query("SELECT draft FROM site_content WHERE key='faqs'"))
          .rows[0].draft,
        draft,
      );
      // Force a late write failure to prove every earlier module write is rolled back.
      await pool.query(
        "DELETE FROM site_content; INSERT INTO site_content(key,draft,published) VALUES ('hero_slides','[]','[]'),('faqs','[]','[]'),('page_sections','[]','[]'),('business_settings','{}','{}')",
      );
      await pool.query(
        "ALTER TABLE site_content ADD CONSTRAINT test_reject_import CHECK (key<>'page_sections' OR revision=0)",
      );
      const rollbackBefore = await readImportPreview(pool);
      await assert.rejects(
        applyContentImport(pool, rollbackBefore.preview_digest),
      );
      assert.deepEqual(
        (await readImportPreview(pool)).backup,
        rollbackBefore.backup,
      );
      await pool.query(
        "ALTER TABLE site_content DROP CONSTRAINT test_reject_import",
      );
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve())),
        );
      }
      await pool.end();
      await admin.query(`DROP DATABASE ${name}`);
      await admin.end();
    }
  },
);

test("login retains its throttle without exhausting normal admin request allowance", async () => {
  const app = express();
  app.use(
    "/api/admin",
    createAdminRouter(
      loadConfig({ NODE_ENV: "test", PUBLIC_ORIGIN: "http://localhost" }),
    ),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await fetch(origin + "/api/admin/login", {
        method: "POST",
        headers: {
          Origin: "http://localhost",
          "X-Admin-Request": "1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: "invalid", password: "invalid" }),
      });
      assert.equal(response.status, 401);
      await response.text();
    }
    const throttled = await fetch(origin + "/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        "X-Admin-Request": "1",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(throttled.status, 429);
    await throttled.text();
    const normal = await fetch(
      origin + "/api/admin/site-content-import/preview",
    );
    assert.equal(normal.status, 401);
    await normal.text();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
