import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  expectedMigrations,
  validateLedger,
  sqlEvidence,
  statementEvidence,
  type LedgerSource,
} from "../scripts/lib/migration-ledger";
import { acceptanceColumns } from "../scripts/lib/acceptance-schema";
import { secondaryReport } from "../scripts/secondary-content-acceptance";
import { backupTables } from "../server/full-content-import";
import historical003 from "./fixtures/provenance/site-content-20261017052646.json";
const artifacts = await expectedMigrations();
const sql = await Promise.all(
  artifacts.map((a) =>
    readFile(new URL("../db/migrations/" + a.name, import.meta.url), "utf8"),
  ),
);
const managed = () =>
  artifacts.map((a, i) => ({
    version: `2026101900000${i + 1}`,
    name: a.name.slice(0, -4),
    statements: [sql[i]],
  }));
const native = () =>
  artifacts.map((a) => ({ name: a.name, checksum: a.sha256 }));
const supabase: LedgerSource = "supabase_migrations.schema_migrations";
function fixture(
  options: {
    ledgers?: Partial<Record<LedgerSource, any[]>>;
    missingColumn?: string;
    missingTable?: string;
    badTrigger?: boolean;
    permissionError?: boolean;
    siteContentDrift?: "default" | "nullable" | "keys";
  } = {},
) {
  const ledgers = options.ledgers ?? { [supabase]: managed() },
    statements: string[] = [];
  const core: Record<string, Record<string, string>> = {
    services: {
      id: "text",
      slug: "text",
      name: "text",
      short_description: "text",
      full_description: "text",
      common_problems: "jsonb",
      service_process: "jsonb",
      cover_image: "text",
      is_active: "bool",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    bookings: {
      id: "uuid",
      booking_number: "text",
      service_id: "text",
      service_name: "text",
      customer_name: "text",
      phone: "text",
      address: "text",
      notes: "text",
      status: "text",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    contact_messages: {
      id: "uuid",
      name: "text",
      phone: "text",
      message: "text",
      status: "text",
      created_at: "timestamptz",
    },
    works: {
      id: "uuid",
      title: "text",
      slug: "text",
      service_type: "text",
      category: "text",
      description: "text",
      media_url: "text",
      media_type: "text",
      is_featured: "bool",
      is_published: "bool",
      created_at: "timestamptz",
    },
    testimonials: {
      id: "uuid",
      customer_name: "text",
      review: "text",
      service_type: "text",
      rating: "int4",
      avatar_url: "text",
      is_published: "bool",
      media_url: "text",
      media_type: "text",
      created_at: "timestamptz",
    },
  };
  const columns = Object.entries(acceptanceColumns)
    .flatMap(([table, extra]) =>
      Object.entries({ ...core[table], ...extra }).map(([column, type]) => ({
        table_name: table,
        column_name: column,
        udt_name: type,
        is_nullable: "YES",
        column_default: null as string | null,
        is_identity: "NO",
        is_generated: "NEVER",
      })),
    )
    .filter(
      (c) =>
        c.table_name + "." + c.column_name !== options.missingColumn &&
        c.table_name !== options.missingTable,
    );
  for (const c of columns.filter((c) => c.table_name === "site_content")) {
    Object.assign(
      c,
      historical003.columns.find(
        (original) => original.column_name === c.column_name,
      ),
    );
    if (c.column_name === "draft" && options.siteContentDrift === "default")
      c.column_default = "'{}'::jsonb";
    if (c.column_name === "revision" && options.siteContentDrift === "nullable")
      c.is_nullable = "YES";
  }
  const pk: Record<string, string[]> = {
    site_content: ["key"],
    admin_sessions: ["token_hash"],
    content_history: ["entity", "record_id", "revision"],
    review_quotas: ["bucket", "day"],
    cms_publication_state: ["key"],
  };
  const constraint = (
    table: string,
    contype: string,
    cols: string[],
    definition = "",
  ) => ({
    table_name: table,
    contype,
    columns: cols,
    definition,
    convalidated: true,
    condeferrable: false,
  });
  const constraints = Object.keys(acceptanceColumns).map((t) =>
    constraint(t, "p", pk[t] ?? ["id"]),
  );
  constraints.push(
    constraint(
      "site_content",
      "c",
      ["key"],
      historical003.constraints.find((c) => c.type === "c")!.definition +
        (options.siteContentDrift === "keys" ? " OR true" : ""),
    ),
  );
  for (const t of ["services", "works"])
    constraints.push(constraint(t, "u", ["slug"]));
  constraints.push(constraint("bookings", "u", ["booking_number"]));
  for (const [t, c] of [
    ["works", "legacy_source_id"],
    ["testimonials", "legacy_source_id"],
    ["testimonials", "submission_key"],
    ["testimonials", "submission_digest"],
    ["media_assets", "filename"],
  ])
    constraints.push(constraint(t, "u", [c]));
  for (const [t, c, values] of [
    [
      "cms_documents",
      "publication_state",
      ["uninitialized", "published", "unpublished"],
    ],
    [
      "cms_publication_state",
      "state",
      ["uninitialized", "published", "unpublished"],
    ],
    [
      "content_history",
      "entity",
      ["services", "works", "testimonials", "site_content", "cms_documents"],
    ],
    ["testimonials", "moderation_status", ["editorial", "pending", "reviewed"]],
  ] as const)
    constraints.push(
      constraint(t, "c", [c], values.map((v) => "'" + v + "'").join(",")),
    );
  const fetched = new Set<string>();
  const client = {
    release() {},
    async query(query: string, params: any[] = []): Promise<any> {
      statements.push(query);
      assert.match(
        query,
        /^(?:SELECT|BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|COMMIT|ROLLBACK|DECLARE|FETCH|CLOSE)\b/,
        "No writes, DDL, migration repair or import SQL may reach a connection.",
      );
      if (query.includes("FROM pg_tables"))
        return {
          rows: backupTables
            .filter(
              (t) =>
                t !== options.missingTable &&
                (t !== "schema_migrations" ||
                  ledgers["public.schema_migrations"]),
            )
            .map((tablename) => ({ tablename })),
        };
      if (query.includes("AS source FROM pg_catalog.pg_class"))
        return { rows: Object.keys(ledgers).map((source) => ({ source })) };
      if (query.startsWith("SELECT to_jsonb(m)")) {
        if (options.permissionError)
          throw Object.assign(Error("Ledger not readable"), { code: "42501" });
        const source = Object.keys(ledgers).find((s) =>
          query.includes("FROM " + s + " m"),
        )! as LedgerSource;
        return { rows: ledgers[source]!.map((entry) => ({ entry })) };
      }
      if (query.includes("information_schema.columns"))
        return {
          rows: columns.filter((c) => params[0].includes(c.table_name)),
        };
      if (query.includes("c.conrelid = $1::regclass"))
        return {
          rows: constraints.filter((c) => c.table_name === params[0].slice(7)),
        };
      if (query.includes("confdeltype='n'")) return { rows: [{}] };
      if (query.includes("FROM pg_constraint c JOIN pg_class t"))
        return { rows: constraints };
      if (query.includes("FROM pg_trigger g"))
        return {
          rows: [
            "services",
            "works",
            "testimonials",
            "site_content",
            "bookings",
            "contact_messages",
            ...(options.badTrigger ? [] : ["cms_documents"]),
          ].map((table_name) => ({
            table_name,
            tgenabled: "O",
            tgtype: 19,
            prosecdef: false,
            prosrc: "cms_documents content_history admin_audit",
          })),
        };
      if (query.startsWith("SELECT count(*)")) return { rows: [{ total: 0 }] };
      if (
        query.startsWith("DECLARE") &&
        query.includes("efb_backup_schema_migrations")
      )
        assert.ok(query.includes(Object.keys(ledgers)[0]));
      if (
        query.startsWith("FETCH") &&
        query.includes("efb_backup_schema_migrations") &&
        !fetched.has("ledger")
      ) {
        fetched.add("ledger");
        return {
          rowCount: 6,
          rows: (Object.values(ledgers)[0] ?? []).map((r) => ({
            row_json: JSON.stringify(r),
          })),
        };
      }
      if (
        /^(BEGIN|COMMIT|ROLLBACK|DECLARE|FETCH|CLOSE)/.test(query) ||
        query.startsWith("SELECT")
      )
        return { rowCount: 0, rows: [] };
      throw Error("Unrecognized fixture query");
    },
  };
  return { pool: { connect: async () => client } as any, statements };
}
test("Secondary preflight accepts a validated Supabase-only ledger without demanding or creating public history", async () => {
  const f = fixture();
  const report = await secondaryReport(f.pool);
  assert.equal(report.compatible, true);
  assert.deepEqual(report.missing_tables, []);
  assert.equal(report.migration_validation.selected, supabase);
  assert.equal(report.migration_validation.provenance_verified, true);
  assert.equal(report.migrations.length, 6);
  assert.equal(report.counts[supabase], 6);
  assert.equal(
    f.statements[0],
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  assert.equal(f.statements.at(-1), "COMMIT");
  assert.ok(
    !f.statements.some((s) => s.includes("FROM public.schema_migrations")),
  );
});
test("Native ledger checksums remain mandatory, and both available histories must agree", async () => {
  const good = await secondaryReport(
    fixture({ ledgers: { "public.schema_migrations": native() } }).pool,
  );
  assert.equal(good.compatible, true);
  const bad = native();
  bad[5].checksum = "0".repeat(64);
  const report = await secondaryReport(
    fixture({
      ledgers: { "public.schema_migrations": bad, [supabase]: managed() },
    }).pool,
  );
  assert.equal(report.compatible, false);
  assert.match(report.migration_validation.errors.join(), /Checksum mismatch/);
  const noChecksum = native().map(({ name }) => ({ name }));
  assert.equal(
    validateLedger("public.schema_migrations", noChecksum, artifacts).valid,
    false,
  );
});
test("Missing, duplicated, unknown, misordered and modified migration evidence fail closed", () => {
  const check = (rows: any[]) =>
    assert.equal(validateLedger(supabase, rows, artifacts).valid, false);
  check(managed().slice(0, 5));
  check([...managed(), managed()[0]]);
  check([...managed(), { version: "007", name: "unknown" }]);
  const modified = managed();
  modified[5].statements[0] += "\nDELETE FROM public.bookings;";
  check(modified);
  const wrongVersion = managed();
  wrongVersion[0].version = "006";
  check(wrongVersion);
  const wrongOrder = managed();
  [wrongOrder[0].version, wrongOrder[1].version] = [
    wrongOrder[1].version,
    wrongOrder[0].version,
  ];
  check(wrongOrder);
  const checksum = managed().map((r) => ({ ...r, checksum: "0".repeat(64) }));
  check(checksum);
});
test("Supabase version-only histories report unavailable provenance rather than inventing checksums", async () => {
  const rows = artifacts.map((a) => ({
    version: String(a.version).padStart(3, "0"),
  }));
  const report = await secondaryReport(
    fixture({ ledgers: { [supabase]: rows } }).pool,
  );
  assert.equal(report.compatible, true);
  assert.equal(report.migration_validation.provenance_verified, false);
  assert.equal(report.migration_validation.warnings.length, 6);
  assert.equal(
    validateLedger(
      supabase,
      rows.map((_, i) => ({ version: `2026101900000${i + 1}` })),
      artifacts,
    ).valid,
    false,
  );
});
test("Stored SQL comparison preserves quoted values, function bodies, delimiters and source identity", () => {
  assert.equal(
    sqlEvidence("SELECT 'Bangla বাংলা'; -- trailing"),
    statementEvidence([" SELECT 'Bangla বাংলা' -- trailing"]),
  );
  assert.equal(
    sqlEvidence("SELECT 1; SELECT 'x';"),
    statementEvidence(["SELECT 1; -- a", "SELECT 'x'; /* b */"]),
  );
  assert.notEqual(sqlEvidence("SELECT 'Case'"), sqlEvidence("SELECT 'case'"));
  assert.notEqual(sqlEvidence("SELECT 'a b'"), sqlEvidence("SELECT 'a  b'"));
  assert.notEqual(
    sqlEvidence("DO $$ BEGIN NULL; END $$;"),
    sqlEvidence("DO $$ BEGIN DELETE FROM bookings; END $$;"),
  );
  const arbitraryNames = managed().map((r) => ({
    ...r,
    name: "owner_reviewed_name",
  }));
  assert.equal(validateLedger(supabase, arbitraryNames, artifacts).valid, true);
});
test("A present ledger never substitutes for missing real schema or the 006 history trigger", async () => {
  for (const options of [
    { missingTable: "cms_documents" },
    { missingColumn: "cms_documents.source_ref" },
    { missingColumn: "testimonials.legacy_source_id" },
    { badTrigger: true },
  ]) {
    const report = await secondaryReport(fixture(options).pool);
    assert.equal(report.compatible, false);
    assert.equal(report.migration_validation.valid, true);
    assert.equal(report.schema_validation.valid, false);
  }
  assert.equal(
    (await secondaryReport(fixture({ ledgers: {} }).pool)).compatible,
    false,
  );
  await assert.rejects(
    secondaryReport(fixture({ permissionError: true }).pool),
    /not readable/,
  );
});
test("Read-only verification and backup read the actual managed history and retain its source", async () => {
  const f = fixture();
  const report = await secondaryReport(f.pool, true, true);
  assert.equal(report.compatible, true);
  assert.equal(report.preview.backup.schema.migration_ledger_source, supabase);
  assert.equal(report.preview.backup.rows.schema_migrations.length, 6);
  assert.ok(
    f.statements.some(
      (s) =>
        s.startsWith("DECLARE") &&
        s.includes("FROM supabase_migrations.schema_migrations t"),
    ),
  );
  assert.equal(report.complete_draft_match, false); // No content import was simulated or performed.
});

function historicallyRecorded() {
  const versions = [
    "20261016090000",
    "20261016100000",
    "20261017052646",
    "20261017100000",
    "20261018090000",
    "20261019000006",
  ];
  const rows = managed().map((row, i) => ({ ...row, version: versions[i] }));
  rows[2] = structuredClone(historical003.migration);
  return rows;
}
test("Actual Secondary 003 is accepted only by its reviewed version/name and both pinned source hashes", async () => {
  const rows = historicallyRecorded();
  assert.notEqual(
    statementEvidence(rows[2].statements),
    artifacts[2].sql_evidence,
    "Regression reproduces opaque DO-body formatting mismatch.",
  );
  const applied = rows[2].statements[0];
  const originalBody = applied.match(/DO \$\$([\s\S]*?)\$\$;/)![1];
  const localBody = sql[2].match(/DO \$\$([\s\S]*?)\$\$;/)![1];
  assert.equal(
    sqlEvidence(originalBody),
    sqlEvidence(localBody),
    "Reviewed PL/pgSQL tokens retain the same conditions, roles and revokes.",
  );
  assert.equal(
    sqlEvidence(applied.replace(originalBody, "REVIEWED_BODY")),
    sqlEvidence(sql[2].replace(localBody, "REVIEWED_BODY")),
    "All outer SQL statements, defaults, seeds, conflict action and PUBLIC revoke match.",
  );
  const report = await secondaryReport(
    fixture({ ledgers: { [supabase]: rows } }).pool,
  );
  assert.equal(report.compatible, true);
  assert.equal(report.migration_validation.provenance_verified, true);
  const mapped = report.migrations.find(
    (m: any) => m.identity === "20261017052646",
  );
  assert.equal(mapped.name, "003_site_content.sql");
  assert.equal(mapped.statements, "verified-historical-variant");
  assert.equal(
    mapped.identity_mapping,
    "secondary-site-content-003-20261017052646-v1",
  );
  assert.equal(
    mapped.stored_statements_sha256,
    "a4ff51b5ca4185452bd10ba92200bc81d7fd29c57d7cd7ae823d96fcdbe711e1",
  );
});
test("Reviewed 003 mapping never accepts missing/changed SQL, copied identity or a changed canonical migration", () => {
  const reject = (change: (row: any) => void) => {
    const rows = historicallyRecorded();
    change(rows[2]);
    assert.equal(validateLedger(supabase, rows, artifacts).valid, false);
  };
  reject((row) => delete row.statements);
  reject((row) => (row.statements = []));
  reject((row) => (row.statements = ["SELECT 1;"]));
  reject(
    (row) =>
      (row.statements[0] = row.statements[0].replace(
        "REVOKE ALL ON public.site_content FROM anon",
        "GRANT SELECT ON public.site_content TO anon",
      )),
  );
  reject(
    (row) =>
      (row.statements[0] = row.statements[0].replace(
        "'{}'::jsonb",
        "'[]'::jsonb",
      )),
  );
  reject((row) => (row.statements[0] += " DELETE FROM public.bookings;"));
  reject((row) => (row.name = "unreviewed_alias"));
  reject((row) => (row.version = "20261017052647"));
  const local = structuredClone(artifacts);
  local[2].sha256 = "0".repeat(64);
  assert.equal(
    validateLedger(supabase, historicallyRecorded(), local).valid,
    false,
  );
  const checksum = historicallyRecorded().map((r) => ({
    ...r,
    checksum: "0".repeat(64),
  }));
  assert.equal(validateLedger(supabase, checksum, artifacts).valid, false);
  const crlf = historicallyRecorded();
  crlf[2].statements = crlf[2].statements.map((s) => s.replace(/\n/g, "\r\n"));
  assert.equal(validateLedger(supabase, crlf, artifacts).valid, true);
});
test("Verified 003 SQL provenance cannot conceal actual default, nullability or key-constraint drift", async () => {
  for (const siteContentDrift of ["default", "nullable", "keys"] as const) {
    const report = await secondaryReport(
      fixture({
        ledgers: { [supabase]: historicallyRecorded() },
        siteContentDrift,
      }).pool,
    );
    assert.equal(report.migration_validation.provenance_verified, true);
    assert.equal(report.schema_validation.valid, false);
    assert.equal(report.compatible, false);
    assert.match(report.schema_validation.errors.join(), /site_content/);
  }
});
