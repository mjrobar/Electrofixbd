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
  "legacy partial importer stays disabled at both HTTP and function boundaries",
  { skip: !base },
  async () => {
    const { disposable } = await import("./helpers/disposable-postgres");
    await disposable(async (pool) => {
      const before = await readImportPreview(pool);
      await assert.rejects(
        applyContentImport(pool, before.preview_digest),
        ImportConflict,
      );
      assert.deepEqual((await readImportPreview(pool)).backup, before.backup);
    });
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
