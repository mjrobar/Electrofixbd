import assert from "node:assert/strict";
import { test } from "node:test";
import { scryptSync, randomUUID } from "node:crypto";
import { mkdtemp, rm, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import sharp from "sharp";
import { createApp } from "../server/app";
import { createStore } from "../server/store";
import { loadConfig } from "../server/config";
import { retainMedia } from "../scripts/media-retention";
import { applyBrowserLockdown } from "../scripts/secure-database";
import {
  normalizeImage,
  mediaRoot,
  uploadImage,
} from "../server/media-storage";
import { slugBase } from "../server/content-categories";
import { disposable, postgresOptions } from "./helpers/disposable-postgres";
const secret = "issue16-isolated-test-secret-".repeat(2);
test("ASCII slug fallback is deterministic for Bangla, accents and punctuation", () => {
  assert.equal(slugBase("Réfrigérateur Repair!"), "refrigerateur-repair");
  assert.match(slugBase("এসি মেরামত"), /^item-[a-f0-9]{12}$/);
  assert.equal(slugBase("এসি মেরামত"), slugBase("এসি মেরামত"));
  assert.notEqual(slugBase("ফ্রিজ মেরামত"), slugBase("এসি মেরামত"));
});
test("image normalization strips metadata and rejects unsafe bytes, MIME, dimensions and ephemeral configuration", async () => {
  const png = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "#004179" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const normalized = await normalizeImage(png, "image/png");
  const meta = await sharp(normalized.data).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
  for (const [data, mime] of [
    [png, "image/jpeg"],
    [Buffer.from('<svg onload="alert(1)"/>'), "image/png"],
    [Buffer.from("MZ executable"), "image/png"],
  ] as const)
    await assert.rejects(normalizeImage(data, mime));
  await assert.rejects(normalizeImage(Buffer.alloc(5242881), "image/png"));
  const huge = await sharp({
    create: { width: 6001, height: 1, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await assert.rejects(normalizeImage(huge, "image/png"));
  const config = loadConfig({ NODE_ENV: "test" });
  await assert.rejects(mediaRoot(config));
  // A POSIX /tmp path resolves to a normal drive path on Windows. Test its
  // rejection only where that production restriction applies; unsafe roots
  // and application directories must remain forbidden on every platform.
  for (const root of [
    parse(process.cwd()).root,
    process.cwd(),
    join(process.cwd(), "media"),
    ...(process.platform === "win32" ? [] : ["/tmp/media", "/var/tmp/media"]),
  ]) {
    await assert.rejects(
      mediaRoot(
        loadConfig({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://localhost/test",
          PUBLIC_ORIGIN: "https://example.com",
          MEDIA_ROOT: root,
          MEDIA_STORAGE_DURABLE: "true",
        }),
      ),
      { code: "MEDIA_UNAVAILABLE" },
      `Unsafe production media directory must be rejected: ${root}`,
    );
  }
  await assert.rejects(
    mediaRoot(loadConfig({ NODE_ENV: "test", MEDIA_ROOT: tmpdir() })),
    { code: "MEDIA_UNAVAILABLE" },
  );
  assert.throws(() =>
    loadConfig({
      VERCEL: "1",
      MEDIA_ROOT: "/var/lib/media",
      MEDIA_STORAGE_DURABLE: "true",
    }),
  );
  const root = await mkdtemp(join(tmpdir(), "efb-path-test-"));
  try {
    // Directory junctions do not require Windows Developer Mode/admin rights.
    await symlink(
      root,
      root + "-link",
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      mediaRoot(
        loadConfig({
          NODE_ENV: "test",
          MEDIA_ROOT: root + "-link",
          MEDIA_STORAGE_DURABLE: "true",
        }),
      ),
    );
  } finally {
    await rm(root + "-link");
    await rm(root, { recursive: true });
  }
});
test(
  "Phase 4C: durable uploads, dynamic categories, unique immutable slugs, pending reviews and moderation history",
  postgresOptions,
  () =>
    disposable(async (pool, url) => {
      const root = await mkdtemp(join(tmpdir(), "efb-issue16-test-"));
      const runtime = "efb_issue16_" + randomUUID().replaceAll("-", "");
      await pool.query(`CREATE ROLE ${runtime} LOGIN NOSUPERUSER NOBYPASSRLS`);
      await applyBrowserLockdown(
        url,
        runtime,
        "REVOKE BROWSER DATABASE ACCESS",
      );
      const restricted = new URL(url);
      restricted.username = runtime;
      const config = loadConfig({
        NODE_ENV: "test",
        DATABASE_URL: restricted.toString(),
        PUBLIC_ORIGIN: "http://localhost",
        ADMIN_USERNAME: "owner",
        ADMIN_PASSWORD_HASH:
          "test-salt:" +
          scryptSync("test-password", "test-salt", 64).toString("hex"),
        ADMIN_SESSION_SECRET: secret,
        MEDIA_ROOT: root,
        MEDIA_STORAGE_DURABLE: "true",
        API_RATE_LIMIT: "1000",
      });
      let store = createStore(config),
        app = createApp({ config, store }),
        server = app.listen(0, "127.0.0.1");
      await new Promise<void>((r) => server.once("listening", r));
      let base = "http://127.0.0.1:" + (server.address() as any).port,
        cookie = "";
      async function request(
        path: string,
        method = "GET",
        body?: unknown,
        admin = false,
        headers: Record<string, string> = {},
      ) {
        const response = await fetch(base + "/api" + path, {
          method,
          headers: {
            ...(method === "GET"
              ? {}
              : {
                  Origin: "http://localhost",
                  "Content-Type": Buffer.isBuffer(body)
                    ? "image/png"
                    : "application/json",
                }),
            ...(admin ? { Cookie: cookie, "X-Admin-Request": "1" } : {}),
            ...headers,
          },
          body:
            body === undefined
              ? undefined
              : Buffer.isBuffer(body)
                ? new Uint8Array(body)
                : JSON.stringify(body),
        });
        const type = response.headers.get("content-type") || "";
        return {
          status: response.status,
          headers: response.headers,
          body: type.includes("json")
            ? await response.json()
            : Buffer.from(await response.arrayBuffer()),
        };
      }
      async function login() {
        const result = await request(
          "/admin/login",
          "POST",
          { username: "owner", password: "test-password" },
          true,
        );
        assert.equal(result.status, 200);
        cookie = result.headers.get("set-cookie")!.split(";")[0];
      }
      async function stop() {
        await new Promise<void>((r, j) =>
          server.close((e) => (e ? j(e) : r())),
        );
        await app.locals.close();
        await store.close();
      }
      try {
        await login();
        const categories = await request(
          "/admin/service-categories",
          "GET",
          undefined,
          true,
        );
        assert.ok(
          categories.body.items.some((s: any) => s.id === "srv-ac-repair"),
        );
        assert.equal(
          (
            await request(
              "/admin/media",
              "POST",
              Buffer.from("invalid"),
              false,
              { "X-Admin-Request": "1" },
            )
          ).status,
          401,
        );
        const png = await sharp({
          create: { width: 30, height: 20, channels: 3, background: "#004179" },
        })
          .png()
          .toBuffer();
        const uploaded = await request("/admin/media", "POST", png, true);
        assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
        const media = uploaded.body.image;
        assert.equal(
          (await request(media.url.replace("/api", ""))).status,
          404,
        );
        assert.equal(
          (
            await request(
              "/admin/media/" + media.id + "/blob",
              "GET",
              undefined,
              true,
            )
          ).status,
          200,
        );
        assert.equal(
          (await request("/admin/media", "POST", Buffer.from("<svg/>"), true))
            .status,
          415,
        );
        assert.equal(
          (
            await request("/admin/media", "POST", png, true, {
              "Content-Type": "image/jpeg",
            })
          ).status,
          415,
        );
        assert.equal(
          (await request("/admin/media", "POST", Buffer.alloc(5242881), true))
            .status,
          413,
        );
        const serviceInput = {
          name: "নতুন সেবা",
          slug: "",
          short_description: "Short",
          full_description: "Full",
          common_problems: [],
          service_process: [],
          cover_image: media.url,
          is_active: false,
        };
        let created = await request(
          "/admin/content/services",
          "POST",
          serviceInput,
          true,
        );
        assert.equal(created.status, 201, JSON.stringify(created.body));
        let service = created.body.item;
        const originalSlug = service.slug;
        const second = await request(
          "/admin/content/services",
          "POST",
          serviceInput,
          true,
        );
        assert.equal(second.status, 201);
        assert.equal(second.body.item.slug, originalSlug + "-2");
        assert.equal(
          (
            await request(
              "/admin/content/services/" + service.id,
              "PUT",
              { ...serviceInput, slug: "new-url", revision: service.revision },
              true,
            )
          ).status,
          409,
        );
        let result = await request(
          "/admin/content/services/" + service.id + "/publish",
          "POST",
          { revision: service.revision },
          true,
        );
        assert.equal(result.status, 200);
        service = result.body.item;
        assert.equal(
          (
            await request("/admin/service-categories", "GET", undefined, true)
          ).body.items.some((s: any) => s.id === service.id),
          true,
        );
        assert.equal(
          (await request(media.url.replace("/api", ""))).status,
          200,
        );
        // Files and metadata survive a complete application restart.
        await stop();
        store = createStore(config);
        app = createApp({ config, store });
        server = app.listen(0, "127.0.0.1");
        await new Promise<void>((r) => server.once("listening", r));
        base = "http://127.0.0.1:" + (server.address() as any).port;
        assert.equal(
          (await request(media.url.replace("/api", ""))).status,
          200,
        );
        const work = {
          title: "এসি প্রকল্প",
          slug: "",
          service_id: service.id,
          service_type: "untrusted label",
          category: "untrusted",
          description: "Repair project",
          media_url: media.url,
          media_type: "image",
          is_featured: false,
          is_published: true,
        };
        let workResult = await request(
          "/admin/content/works",
          "POST",
          work,
          true,
        );
        assert.equal(workResult.status, 201, JSON.stringify(workResult.body));
        let item = workResult.body.item;
        assert.equal(item.service_type, service.name);
        const duplicateWork = await request(
          "/admin/content/works",
          "POST",
          work,
          true,
        );
        assert.equal(duplicateWork.body.item.slug, item.slug + "-2");
        assert.equal(
          (
            await request(
              "/admin/content/works",
              "POST",
              { ...work, service_id: "missing" },
              true,
            )
          ).status,
          400,
        );
        for (const action of ["publish", "unpublish", "archive", "restore"]) {
          result = await request(
            "/admin/content/works/" + item.id + "/" + action,
            "POST",
            { revision: item.revision },
            true,
          );
          assert.equal(result.status, 200);
          item = result.body.item;
        }
        assert.ok(
          (
            await request(
              "/admin/history/works/" + item.id,
              "GET",
              undefined,
              true,
            )
          ).body.items.length >= 4,
        );
        const image = await request("/review-images", "POST", png);
        assert.equal(image.status, 201);
        const attachment = image.body.image;
        assert.equal(
          (await request(attachment.url.replace("/api", ""))).status,
          404,
        );
        const review = {
          submission_key: randomUUID(),
          customer_name: "Test customer",
          address: "Mirpur, Dhaka",
          service_id: service.id,
          review: "Very professional repair service.",
          rating: 5,
          consent: true,
          image: { id: attachment.id, claim_token: attachment.claim_token },
        };
        assert.equal(
          (await request("/reviews", "POST", { ...review, consent: false }))
            .status,
          400,
        );
        assert.equal(
          (await request("/reviews", "POST", { ...review, is_published: true }))
            .status,
          400,
        );
        assert.equal(
          (
            await request("/reviews", "POST", {
              ...review,
              image: { ...review.image, claim_token: "a".repeat(64) },
            })
          ).status,
          400,
        );
        result = await request("/reviews", "POST", review);
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const reference = result.body.reference;
        assert.equal(result.body.status, "pending");
        assert.equal(
          (await request("/reviews", "POST", review)).body.reference,
          reference,
        );
        assert.equal(
          (
            await request("/reviews", "POST", {
              ...review,
              submission_key: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal(
          (await request("/testimonials")).body.testimonials.some(
            (t: any) => t.id === reference,
          ),
          false,
        );
        let pending = (
          await request(
            "/admin/content/testimonials?status=pending",
            "GET",
            undefined,
            true,
          )
        ).body.items.find((t: any) => t.id === reference);
        assert.ok(pending);
        assert.equal(pending.is_published, false);
        assert.ok(pending.consent_at);
        assert.equal(pending.address, review.address);
        const edit = {
          customer_name: pending.customer_name,
          address: "Dhaka",
          review: "Approved edited customer review.",
          service_id: pending.service_id,
          service_type: pending.service_type,
          rating: pending.rating,
          avatar_url: null,
          media_url: pending.media_url,
          media_type: pending.media_type,
          is_published: false,
        };
        result = await request(
          "/admin/content/testimonials/" + reference,
          "PUT",
          { ...edit, revision: pending.revision },
          true,
        );
        assert.equal(result.status, 200);
        pending = result.body.item;
        assert.equal(
          (await request("/testimonials")).body.testimonials.some(
            (t: any) => t.id === reference,
          ),
          false,
        );
        result = await request(
          "/admin/content/testimonials/" + reference + "/publish",
          "POST",
          { revision: pending.revision },
          true,
        );
        assert.equal(result.status, 200);
        pending = result.body.item;
        const card = (await request("/testimonials")).body.testimonials.find(
          (t: any) => t.id === reference,
        );
        assert.equal(card.address, "Dhaka");
        assert.equal(card.service_id, service.id);
        assert.equal(card.service_type, service.name);
        assert.equal(card.submission_key, undefined);
        assert.equal(card.consent_at, undefined);
        assert.equal(
          (await request(attachment.url.replace("/api", ""))).status,
          200,
        );
        assert.equal(
          (
            await request(
              "/admin/content/testimonials?status=pending",
              "GET",
              undefined,
              true,
            )
          ).body.items.some((t: any) => t.id === reference),
          false,
        );
        result = await request(
          "/admin/history/testimonials/" + reference + "/restore",
          "POST",
          { revision: pending.revision, source_revision: 0 },
          true,
        );
        assert.equal(result.status, 200);
        pending = result.body.item;
        assert.equal(pending.admin_draft.address, review.address);
        assert.equal(
          (await request("/testimonials")).body.testimonials.find(
            (t: any) => t.id === reference,
          ).address,
          "Dhaka",
        );
        for (const action of ["unpublish", "archive"]) {
          result = await request(
            "/admin/content/testimonials/" + reference + "/" + action,
            "POST",
            { revision: pending.revision },
            true,
          );
          assert.equal(result.status, 200);
          pending = result.body.item;
          assert.equal(
            (await request("/testimonials")).body.testimonials.some(
              (t: any) => t.id === reference,
            ),
            false,
          );
          assert.equal(
            (await request(attachment.url.replace("/api", ""))).status,
            404,
          );
        }
        // Legacy free text is retained without inferred category mapping.
        const legacy = randomUUID();
        await pool.query(
          "INSERT INTO testimonials(id,customer_name,review,service_type) VALUES($1,'Legacy','Historical text','Old custom category')",
          [legacy],
        );
        result = await request(
          "/admin/content/testimonials/" + legacy,
          "PUT",
          {
            ...edit,
            media_url: "https://images.example.com/legacy.jpg",
            service_id: null,
            service_type: "Old custom category",
            revision: 0,
          },
          true,
        );
        assert.equal(result.status, 200);
        assert.equal(result.body.item.service_type, "Old custom category");
        assert.equal(result.body.item.service_id, null);
        // Claim tokens cannot be reused or repurposed for another record.
        assert.equal(
          (
            await request("/reviews", "POST", {
              ...review,
              submission_key: randomUUID(),
              review: "Another distinct customer review.",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              "/admin/content/works",
              "POST",
              { ...work, media_url: attachment.url },
              true,
            )
          ).status,
          400,
        );
        // Failed PostgreSQL inserts must never acknowledge customer intake.
        await pool.query(
          "CREATE FUNCTION public.issue16_reject_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'sensitive synthetic driver failure'; END $$",
        );
        await pool.query(
          "CREATE TRIGGER issue16_reject BEFORE INSERT ON testimonials FOR EACH ROW EXECUTE FUNCTION public.issue16_reject_review()",
        );
        try {
          const failed = await request("/reviews", "POST", {
            ...review,
            image: undefined,
            submission_key: randomUUID(),
            review: "Database failure review fixture.",
          });
          assert.equal(failed.status, 503);
          assert.equal(failed.body.success, undefined);
          assert.ok(
            !JSON.stringify(failed.body).includes("sensitive synthetic"),
          );
          assert.equal(
            (
              await pool.query(
                "SELECT 1 FROM testimonials WHERE review='Database failure review fixture.'",
              )
            ).rowCount,
            0,
          );
        } finally {
          await pool.query("DROP TRIGGER issue16_reject ON testimonials");
          await pool.query("DROP FUNCTION public.issue16_reject_review()");
        }
        assert.equal(
          (
            await request("/reviews", "POST", review, false, {
              Origin: "https://evil.example",
            })
          ).status,
          403,
        );
        for (let i = 0; i < 6; i++)
          await request("/review-images", "POST", Buffer.from("invalid"));
        assert.equal(
          (await request("/review-images", "POST", png)).status,
          429,
        );
        const stored = await pool.query(
          "SELECT filename FROM media_assets WHERE id=$1",
          [media.id],
        );
        assert.ok(
          (await readFile(join(root, stored.rows[0].filename))).length > 0,
        );
      } finally {
        await stop();
        await pool.query(`DROP OWNED BY ${runtime}`);
        await pool.query(`DROP ROLE ${runtime}`);
        await rm(root, { recursive: true, force: true });
      }
    }),
);

test(
  "retention previews before deletion and preserves historical, attached and archived media",
  postgresOptions,
  () =>
    disposable(async (pool, url) => {
      const root = await mkdtemp(join(tmpdir(), "efb-retention-test-"));
      const config = loadConfig({
        NODE_ENV: "test",
        DATABASE_URL: url,
        MEDIA_ROOT: root,
        MEDIA_STORAGE_DURABLE: "true",
      });
      try {
        const png = await sharp({
          create: { width: 4, height: 4, channels: 3, background: "#fff" },
        })
          .png()
          .toBuffer();
        const orphan = await uploadImage(
          pool,
          config,
          png,
          "image/png",
          "review",
        );
        const historical = await uploadImage(
          pool,
          config,
          png,
          "image/png",
          "admin",
        );
        const attached = await uploadImage(
          pool,
          config,
          png,
          "image/png",
          "review",
        );
        const archivedReview = randomUUID();
        await pool.query(
          "INSERT INTO testimonials(id,customer_name,review,service_type,archived_at,is_published) VALUES($1,'Archived customer','Archived review','AC',now(),false)",
          [archivedReview],
        );
        await pool.query("UPDATE media_assets SET review_id=$1 WHERE id=$2", [
          archivedReview,
          attached.id,
        ]);
        await pool.query(
          "UPDATE media_assets SET created_at=now()-interval '3 days'",
        );
        await pool.query(
          "INSERT INTO content_history(entity,record_id,revision,snapshot) VALUES('services','old-record',0,$1)",
          [JSON.stringify({ cover_image: historical.url })],
        );
        assert.deepEqual(await retainMedia(pool, root), [orphan.id]);
        assert.ok((await readFile(join(root, orphan.id + ".webp"))).length);
        assert.deepEqual(await retainMedia(pool, root, true), [orphan.id]);
        await assert.rejects(readFile(join(root, orphan.id + ".webp")));
        assert.ok((await readFile(join(root, historical.id + ".webp"))).length);
        assert.ok((await readFile(join(root, attached.id + ".webp"))).length);
        assert.ok(
          (
            await pool.query(
              "SELECT deleted_at FROM media_assets WHERE id=$1",
              [orphan.id],
            )
          ).rows[0].deleted_at,
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }),
);
