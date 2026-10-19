import { nativeMigrationResponse } from "./helpers/migration-history";
import { assertSecondaryTarget } from "../scripts/secondary-content-acceptance";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import catalog from "../server/full-content-catalog.json";
import { buildFullCatalog } from "../scripts/build-full-content-catalog";
import { documentSchema } from "../server/cms-contract";
import {
  applyFullImport,
  buildFullPreview,
  coverageSummary,
  staticRecords,
  sourceUuid,
  readFullPreview,
} from "../server/full-content-import";
import {
  projectStaticRecords,
  renderSiteSource,
  renderDocument,
  renderCollectionRow,
} from "../server/cms-projection";
import { assertSourceProvenance } from "./helpers/catalog-provenance";
import { canonical } from "../server/content-import";
test("full source inventory reproduces pinned public source, every leaf and classification", async () => {
  assert.deepEqual(await buildFullCatalog(), catalog);
  for (const source of catalog.sources)
    assertSourceProvenance(
      source,
      await readFile(new URL("../" + source.path, import.meta.url), "utf8"),
      catalog.source_ref,
    );
  assert.equal(catalog.sources.length, 25);
  assert.equal(catalog.documents.length, 19);
  const fields = new Map<string, unknown>();
  for (const d of catalog.documents) {
    assert.ok(documentSchema.safeParse(d).success, d.id);
    for (const g of d.groups)
      for (const i of g.items)
        for (const f of i.fields) fields.set(f.id, f.value);
  }
  for (const entry of catalog.inventory as any[]) {
    if (entry.target?.document)
      assert.deepEqual(fields.get(entry.target.field), entry.value, entry.id);
    else if (entry.target?.collection) {
      const value = entry.target.path.reduce(
        (v: any, k: any) => v[k],
        (catalog.static_values as any)[entry.target.collection],
      );
      assert.deepEqual(value, entry.value, entry.id);
    } else assert.ok(entry.reason, entry.id);
  }
  assert.equal(coverageSummary().complete, true);
  assert.deepEqual(coverageSummary().outstanding, []);
  assert.equal(coverageSummary().original_ai_studio_reconciled, false);
  assert.equal(
    catalog.sources.some((s) => s.path.endsWith("Navbar.tsx")),
    true,
  );
  assert.equal(
    catalog.sources.some((s) => s.path.endsWith("Footer.tsx")),
    true,
  );
});
test("every source record round trips without losing localized dates, flags, IDs, media, arrays or order", () => {
  const rows: Record<string, any[]> = {
    services: [],
    works: [],
    testimonials: [],
  };
  for (const record of staticRecords())
    rows[record.kind].push({
      ...record.data,
      id: record.id,
      legacy_source_id: record.source_id,
    });
  const projected = projectStaticRecords(JSON.parse(canonical(rows)));
  for (const key of [
    "SERVICES_DATA",
    "WORKS_DATA",
    "TESTIMONIALS_DATA",
  ] as const)
    assert.deepEqual(projected[key], catalog.static_values[key]);
  assert.deepEqual(
    renderSiteSource(catalog.site_content),
    Object.fromEntries(
      ["BUSINESS_CONFIG", "FAQ_DATA", "slides"].map((key) => [
        key,
        (catalog.static_values as any)[key],
      ]),
    ),
  );
  for (const doc of catalog.documents) {
    const output = renderDocument(JSON.parse(canonical(doc)));
    assert.equal(output.id, doc.id);
    assert.equal(output.actions.length, doc.actions.length);
    assert.equal(output.groups.length, doc.groups.length);
    for (let g = 0; g < doc.groups.length; g++)
      for (let i = 0; i < doc.groups[g].items.length; i++)
        for (const f of doc.groups[g].items[i].fields)
          assert.deepEqual(
            output.groups[g].items[i].fields[f.id].value,
            f.value,
          );
  }
  assert.equal(sourceUuid("works", "work-1"), sourceUuid("works", "work-1"));
  assert.notEqual(
    sourceUuid("works", "work-1"),
    sourceUuid("testimonials", "work-1"),
  );
});
test("complete preview is exact, deterministic and preserves every edit/publication and legacy collision", () => {
  const fresh = buildFullPreview({
    format: "test",
    schema_version: 6,
    rows: {},
  });
  assert.equal(fresh.totals.imported, 50);
  assert.equal(fresh.totals.conflicted, 0);
  const rows: Record<string, any[]> = {
    cms_documents: [
      {
        id: catalog.documents[0].id,
        draft: { owner: "edited" },
        revision: 3,
        publication_state: "published",
      },
    ],
    site_content: [{ key: "faqs", draft: [], published: [], revision: 2 }],
    services: [
      {
        id: "srv-ac-repair",
        slug: "ac-repair",
        name: "Authored service",
        revision: 0,
        admin_draft: null,
      },
    ],
    works: [
      { id: "existing", slug: catalog.collections.works[0].slug, revision: 0 },
    ],
    testimonials: [],
  };
  const before = structuredClone(rows),
    preview = buildFullPreview({ format: "test", schema_version: 6, rows });
  assert.deepEqual(rows, before);
  assert.equal(preview.totals.conflicted, 4);
  assert.ok(
    preview.entries
      .filter((e) => e.action === "conflict")
      .every((e) => e.reason.includes("preserved")),
  );
  const reversed = Object.fromEntries(Object.entries(rows).reverse());
  assert.equal(
    buildFullPreview({ format: "test", schema_version: 6, rows: reversed })
      .preview_digest,
    preview.preview_digest,
  );
  const imported: any = {};
  for (const e of fresh.entries) {
    (imported[e.kind] ??= []).push(
      e.kind === "site_content"
        ? { key: e.id, draft: e.data, published: [], revision: 1 }
        : e.kind === "cms_documents"
          ? { id: e.id, draft: e.data, revision: 1 }
          : { id: e.id, admin_draft: e.data, revision: 0 },
    );
  }
  const retry = buildFullPreview({
    format: "test",
    schema_version: 6,
    rows: imported,
  });
  assert.equal(retry.totals.imported, 0);
  assert.equal(retry.totals.skipped, 50);
});
test("typed documents reject script links, unknown fields, binding tampering and broken placeholders", () => {
  const nav = structuredClone(
    catalog.documents.find((d) => d.title === "Navbar")!,
  ) as any;
  nav.groups[0].items[0].fields[0].extra = "lost";
  assert.equal(documentSchema.safeParse(nav).success, false);
  const first = structuredClone(
    catalog.documents.find((d) => d.title === "Navbar")!,
  ) as any;
  first.actions[0].binding = "evil()";
  assert.equal(documentSchema.safeParse(first).success, false);
  const templateDoc = structuredClone(
    catalog.documents.find((d) =>
      d.groups.some((g) =>
        g.items.some((i) => i.fields.some((f) => f.kind === "template")),
      ),
    )!,
  ) as any;
  const template = templateDoc.groups
    .flatMap((g: any) => g.items)
    .flatMap((i: any) => i.fields)
    .find((f: any) => f.kind === "template");
  template.value += "{{binding99}}";
  assert.equal(documentSchema.safeParse(templateDoc).success, false);
  const mediaDoc = structuredClone(
    catalog.documents.find((d) =>
      d.groups.some((g) =>
        g.items.some((i) => i.fields.some((f) => f.kind === "media")),
      ),
    )!,
  ) as any;
  mediaDoc.groups
    .flatMap((g: any) => g.items)
    .flatMap((i: any) => i.fields)
    .find((f: any) => f.kind === "media").value = "javascript:alert(1)";
  assert.equal(documentSchema.safeParse(mediaDoc).success, false);
  const app = structuredClone(
    catalog.documents.find((d) => d.id === "ui_app")!,
  ) as any;
  app.groups.find((g: any) => g.id === "layout_home").items[0].fields[0].value =
    "arbitrary-script-component";
  assert.equal(documentSchema.safeParse(app).success, false);
});

test("Secondary acceptance tools reject Primary, unspecified targets and unsafe connection identity", () => {
  const env = {
    SECONDARY_PROJECT_NAME: "Electrofixbd.Test Project",
    SECONDARY_PROJECT_REF: "secondaryabcdefghijk",
    PRIMARY_PROJECT_REF: "primaryabcdefghijk",
    SECONDARY_DATABASE_URL:
      "postgresql://postgres@db.secondaryabcdefghijk.supabase.co/postgres",
  };
  assert.equal(assertSecondaryTarget(env), env.SECONDARY_DATABASE_URL);
  for (const patch of [
    {
      SECONDARY_DATABASE_URL:
        "postgresql://postgres@db.primaryabcdefghijk.supabase.co/postgres",
    },
    { SECONDARY_PROJECT_REF: env.PRIMARY_PROJECT_REF },
    { PRIMARY_PROJECT_REF: "" },
    {
      SECONDARY_DATABASE_URL:
        "postgresql://postgres@unapproved.example/postgres",
    },
    {
      SECONDARY_DATABASE_URL: env.SECONDARY_DATABASE_URL + "?sslmode=no-verify",
    },
  ])
    assert.throws(() => assertSecondaryTarget({ ...env, ...patch }));
});

test("source-shaped public projection preserves imported Work captions and review dates without private fields", () => {
  for (const record of staticRecords()) {
    const row = {
      ...record.data,
      id: record.id,
      legacy_source_id:
        record.kind === "services" ? undefined : record.source_id,
      submission_digest: "private",
      consent_at: "private",
      admin_draft: { private: true },
      created_at: "2026-10-01T00:00:00.000Z",
    };
    const projected = renderCollectionRow(record.kind, row) as any;
    assert.equal(projected.submission_digest, undefined);
    assert.equal(projected.consent_at, undefined);
    assert.equal(projected.admin_draft, undefined);
    if (record.kind === "works")
      assert.equal(projected.createdAt, (record.data as any).display_date);
    if (record.kind === "testimonials") {
      assert.equal(projected.date, (record.data as any).display_date);
      assert.equal(projected.time, (record.data as any).display_time);
    }
  }
});

test("backup retains exact PostgreSQL row JSON for microsecond timestamps and large numeric values", async () => {
  const raw =
    '{"id":9223372036854775807,"created_at":"2026-10-19T03:04:05.123456+00:00","label":"বাংলা"}';
  const seen = new Set<string>();
  const database = {
    query: async (sql: string) => {
      const migration = nativeMigrationResponse(sql);
      if (migration) return migration;
      if (
        sql.startsWith("FETCH") &&
        sql.includes("efb_backup_bookings") &&
        !seen.has("bookings")
      ) {
        seen.add("bookings");
        return { rowCount: 1, rows: [{ row_json: raw }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
  const preview = await readFullPreview(database as any);
  assert.equal(preview.backup.lossless_rows!.bookings[0], raw);
  assert.equal(
    preview.backup.rows.bookings[0].created_at,
    "2026-10-19T03:04:05.123456+00:00",
  );
  assert.ok(JSON.stringify(preview.backup).includes("9223372036854775807"));
});

// A query sink exercises transaction construction; it is not a PostgreSQL integration test.
test("full importer transaction binds every source draft correctly without a database", async () => {
  const inserted: string[] = [];
  const client = {
    release() {},
    async query(sql: string, values: any[] = []) {
      const parameters = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      assert.equal(Math.max(0, ...parameters), values.length, sql);
      const migration = nativeMigrationResponse(sql);
      if (migration) return migration;
      if (
        sql.startsWith("INSERT INTO public.") ||
        sql.startsWith("INSERT INTO cms_documents") ||
        sql.startsWith("INSERT INTO site_content")
      ) {
        inserted.push(sql);
        if (sql.startsWith("INSERT INTO public.testimonials")) {
          assert.match(sql, /legacy_source_id,created_at,admin_draft/);
          assert.match(values.at(-2), /^202[0-9]-/);
        }
        return { rows: [{ revision: 1 }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
  const initial = await readFullPreview(client as any);
  const result = await applyFullImport(
    { connect: async () => client } as any,
    initial.preview_digest,
  );
  assert.equal(result.totals.imported, 50);
  assert.equal(inserted.length, 50);
  assert.equal(
    inserted.filter((s) => s.startsWith("INSERT INTO public.testimonials"))
      .length,
    9,
  );
});
