import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { mkdtemp, realpath, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import sharp from "sharp";
import { createBrandingRouter } from "../server/branding";
import { loadConfig } from "../server/config";
import { errorHandler } from "../server/errors";
import { assertSiteMediaReferences, validate } from "../server/site-controls";
test("Branding uses existing settings validation and rejects unsafe media, oversized titles and review-owned images", async () => {
  const unchanged = validate("business_settings", {
    business_name: "Fixture name",
    phone: "01700000000",
  });
  assert.ok(unchanged.success);
  if (unchanged.success)
    assert.equal(
      (unchanged.data as Record<string, unknown>).favicon_url,
      undefined,
    );
  assert.equal(
    validate("business_settings", {
      business_name: "Fixture",
      favicon_url: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    validate("business_settings", { site_title: "x".repeat(151) }).success,
    false,
  );
  let reads = 0;
  const fake = {
    query: async () => {
      reads++;
      return { rows: [{ owner_type: "review", review_id: "not-owned" }] };
    },
  };
  await assert.rejects(
    assertSiteMediaReferences(fake as any, {
      favicon_url: "/api/media/" + randomUUID(),
    }),
  );
  assert.equal(reads, 1);
});
test("Published durable favicon yields real 48/192/512 PNGs and becomes inaccessible immediately on unpublish, including cached derivatives", async (t) => {
  const root = await realpath(
      await mkdtemp(join(tmpdir(), "efb-branding-unit-")),
    ),
    id = randomUUID(),
    config = loadConfig({
      NODE_ENV: "test",
      MEDIA_ROOT: root,
      MEDIA_STORAGE_DURABLE: "true",
    });
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    join(root, id + ".webp"),
    await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 4,
        background: { r: 0, g: 65, b: 121, alpha: 1 },
      },
    })
      .webp()
      .toBuffer(),
  );
  let published = true;
  const pool = {
    query: async (sql: string) => {
      assert.match(sql, /p.state='published'/);
      return { rows: published ? [{ id, filename: id + ".webp" }] : [] };
    },
  };
  const app = express();
  app.use("/api", createBrandingRouter(pool as any, config));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  const base =
    "http://127.0.0.1:" +
    (server.address() as any).port +
    "/api/branding/favicon/";
  for (const size of [48, 192, 512]) {
    const r = await fetch(base + size + ".png");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type")!, /image\/png/);
    const meta = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
    assert.equal(meta.width, size);
    assert.equal(meta.height, size);
    assert.equal(meta.format, "png");
  }
  assert.equal((await fetch(base + "32.png")).status, 404);
  published = false;
  assert.equal((await fetch(base + "48.png")).status, 404);
});
