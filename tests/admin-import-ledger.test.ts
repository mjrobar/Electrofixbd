import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import express from "express";
import type pg from "pg";
import { expectedMigrations } from "../scripts/lib/migration-ledger";
import manifest from "../server/db/migration-manifest.json";
import { nativeHistory, managedHistory } from "./helpers/migration-history";
import {
  fullPreview,
  applyFullImport,
  rollbackFullImport,
  createFullImportRouter,
  fullImportApproval,
} from "../server/full-content-import";
import { errorHandler } from "../server/errors";
const PUBLIC = "public.schema_migrations",
  MANAGED = "supabase_migrations.schema_migrations";
// All SQL goes into this in-memory protocol sink. No pg.Client/Pool is constructed.
function memoryDatabase(
  initial: Record<string, any[]> = { [MANAGED]: managedHistory },
  deny?: string,
) {
  const ledgers = structuredClone(initial),
    queries: string[] = [],
    tables: Record<string, any[]> = {},
    cursors = new Map<string, any[]>();
  let writes = 0;
  const json = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
  const client = {
    release() {},
    async query(sql: string, values: any[] = []): Promise<any> {
      queries.push(sql);
      const parameters = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      assert.equal(Math.max(0, ...parameters), values.length, sql);
      if (sql.includes("AS source FROM pg_catalog.pg_class"))
        return {
          rows: Object.keys(ledgers)
            .sort()
            .map((source) => ({ source })),
        };
      if (sql.startsWith("SELECT to_jsonb(m)")) {
        const source = Object.keys(ledgers).find((s) =>
          sql.includes("FROM " + s + " m"),
        )!;
        if (deny === source)
          throw Object.assign(
            Error("Sensitive database detail must not leak"),
            { code: "42501" },
          );
        return { rows: ledgers[source].map((entry) => ({ entry })) };
      }
      if (sql.startsWith("DECLARE")) {
        const cursor = sql.match(/^DECLARE (\S+)/)![1],
          relation = sql.match(/FROM (\S+) t$/)![1];
        assert.ok(
          relation in ledgers || !relation.endsWith("schema_migrations"),
          "Never read an absent native ledger",
        );
        cursors.set(
          cursor,
          structuredClone(
            ledgers[relation] ??
              tables[relation.replace(/^public\./, "")] ??
              [],
          ),
        );
        return { rows: [] };
      }
      if (sql.startsWith("FETCH")) {
        const cursor = sql.split(" ").at(-1)!,
          rows = cursors.get(cursor) ?? [];
        cursors.set(cursor, []);
        return {
          rowCount: rows.length,
          rows: rows.map((r) => ({ row_json: JSON.stringify(r) })),
        };
      }
      if (sql.startsWith("CLOSE")) {
        cursors.delete(sql.split(" ")[1]);
        return { rows: [] };
      }
      if (sql.startsWith("SELECT * FROM cms_import_runs"))
        return {
          rows: (tables.cms_import_runs ?? []).filter(
            (r) => r.id === values[0],
          ),
        };
      if (sql.startsWith("SELECT * FROM public.")) {
        const table = sql.match(/FROM public\.(\w+)/)![1];
        return {
          rows: (tables[table] ?? []).filter(
            (r) => (r.id ?? r.key) === values[0],
          ),
        };
      }
      if (sql.startsWith("INSERT")) {
        writes++;
        if (sql.startsWith("INSERT INTO admin_audit")) return { rows: [] };
        let table: string, row: any;
        if (sql.startsWith("INSERT INTO cms_import_runs")) {
          table = "cms_import_runs";
          row = {
            id: values[0],
            before_content: json(values[3]),
            after_revisions: json(values[4]),
            result: json(values[5]),
          };
        } else if (sql.startsWith("INSERT INTO cms_documents")) {
          table = "cms_documents";
          row = {
            id: values[0],
            title: values[1],
            source_path: values[2],
            draft: json(values[3]),
            published: {},
            publication_state: "uninitialized",
            revision: 1,
            mapping_version: values[4],
            source_ref: values[5],
          };
        } else if (sql.startsWith("INSERT INTO site_content")) {
          table = "site_content";
          row = {
            key: values[0],
            draft: json(values[1]),
            published: json(values[2]),
            revision: 1,
          };
        } else {
          const match = sql.match(/^INSERT INTO public\.(\w+)\(([^)]+)\)/)!;
          table = match[1];
          row = Object.fromEntries(
            match[2]
              .split(",")
              .map((name, i) => [
                name,
                ["admin_draft", "common_problems", "service_process"].includes(
                  name,
                )
                  ? json(values[i])
                  : values[i],
              ]),
          );
          row.revision = 1;
        }
        (tables[table] ??= []).push(row);
        return { rows: [row] };
      }
      if (sql.startsWith("UPDATE")) {
        writes++;
        const table = sql.match(/^UPDATE (?:public\.)?(\w+)/)![1];
        const idParameter = Number(sql.match(/WHERE (?:id|key)=\$(\d+)/)![1]);
        const id = values[idParameter - 1];
        const row = (tables[table] ?? []).find((r) => (r.id ?? r.key) === id);
        if (row) {
          row.revision = (row.revision ?? 0) + 1;
          if (table === "cms_import_runs") row.rolled_back_at = "fixture-time";
          else if (table === "site_content") row.draft = json(values[0]);
          else if (table === "cms_documents") {
            row.draft = json(values[0]);
            row.published = {};
            row.publication_state = values[3];
            row.archived_at = values[1] ? "fixture-time" : null;
          } else row.archived_at = "fixture-time";
        }
        return { rows: row ? [row] : [] };
      }
      if (/^(?:SELECT|BEGIN|SET |COMMIT|ROLLBACK|LOCK )/.test(sql))
        return { rows: [], rowCount: 0 };
      throw Error("Unexpected SQL in fixture: " + sql);
    },
  };
  return {
    pool: { connect: async () => client } as unknown as pg.Pool,
    ledgers,
    queries,
    tables,
    get writes() {
      return writes;
    },
  };
}
test("Runtime migration manifest matches all reviewed SQL sources, including both checkout line endings", async () => {
  assert.deepEqual(
    (await expectedMigrations()).map(({ checkout_sha256: _, ...m }) => m),
    manifest,
  );
  const runtime = await readFile(
    new URL("../server/db/migration-ledger.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    runtime.includes("node:fs"),
    false,
    "Runtime provenance must work in the bundled Node server without source SQL files.",
  );
  const windowsHistory = memoryDatabase({
    [PUBLIC]: manifest.map((m) => ({ name: m.name, checksum: m.crlf_sha256 })),
  });
  assert.equal(
    (await fullPreview(windowsHistory.pool)).migration_ledger
      .provenance_verified,
    true,
  );
  assert.equal(windowsHistory.writes, 0);
});
for (const source of [PUBLIC, MANAGED])
  test(`Admin workflow uses validated ${source} for preview, full backup, apply and rollback (memory only)`, async () => {
    const db = memoryDatabase({
      [source]: source === PUBLIC ? nativeHistory : managedHistory,
    });
    const preview = await fullPreview(db.pool);
    assert.equal(preview.migration_ledger.source, source);
    assert.equal(preview.migration_ledger.provenance_verified, true);
    assert.equal(preview.backup.lossless_rows!.schema_migrations.length, 6);
    assert.equal(db.writes, 0);
    const result = await applyFullImport(db.pool, preview.preview_digest);
    assert.equal(result.totals.imported, 50);
    assert.equal(result.migration_ledger.source, source);
    assert.equal((await fullPreview(db.pool)).totals.skipped, 50);
    assert.equal(
      (await rollbackFullImport(db.pool, result.run_id)).restored,
      50,
    );
    assert.equal(
      (await rollbackFullImport(db.pool, result.run_id)).already_rolled_back,
      true,
    );
    assert.equal(
      db.tables.cms_documents.filter((r) => r.archived_at).length,
      19,
    );
    assert.ok(
      db.tables.site_content.every(
        (r) =>
          JSON.stringify(r.draft) ===
          (r.key === "business_settings" ? "{}" : "[]"),
      ),
    );
    assert.ok(
      db.queries.some(
        (q) => q.startsWith("DECLARE") && q.includes("FROM " + source + " t"),
      ),
    );
    assert.equal(
      db.queries.some((q) => /^(CREATE|ALTER|DROP|GRANT|REVOKE)/.test(q)),
      false,
    );
    assert.equal(
      db.queries.some((q) =>
        /^(INSERT INTO|UPDATE) (?:public\.)?(?:supabase_migrations|schema_migrations|bookings|contact_messages)/.test(
          q,
        ),
      ),
      false,
    );
  });
test("Both valid ledgers are validated and retained in full backup; conflicts never fall back", async () => {
  const db = memoryDatabase({
    [PUBLIC]: nativeHistory,
    [MANAGED]: managedHistory,
  });
  const preview = await fullPreview(db.pool);
  assert.equal(preview.migration_ledger.source, PUBLIC);
  assert.equal(preview.backup.rows[MANAGED].length, 6);
  db.ledgers[PUBLIC][0].checksum = "0".repeat(64);
  await assert.rejects(fullPreview(db.pool), {
    code: "MIGRATION_HISTORY_INVALID",
  });
  assert.equal(db.writes, 0);
});
test("Missing, unknown, modified or unverified history blocks every workflow before any content mutation", async () => {
  for (const rows of [
    null,
    managedHistory.slice(0, 5),
    [...managedHistory, { version: "20261020000000", name: "unknown" }],
    managedHistory.map((r) => ({ ...r, statements: [] })),
    managedHistory.map((r, i) => ({
      ...r,
      statements: i === 2 ? ["SELECT 1;"] : r.statements,
    })),
  ]) {
    const db = memoryDatabase(rows ? { [MANAGED]: rows } : {});
    await assert.rejects(fullPreview(db.pool));
    await assert.rejects(applyFullImport(db.pool, "stale"));
    await assert.rejects(
      rollbackFullImport(db.pool, "00000000-0000-4000-a000-000000000000"),
    );
    assert.equal(db.writes, 0);
  }
});
test("Ledger binding rejects source changes after backup and changed/unbound rollback runs", async () => {
  const db = memoryDatabase();
  const preview = await fullPreview(db.pool);
  db.ledgers[PUBLIC] = structuredClone(nativeHistory);
  await assert.rejects(
    applyFullImport(db.pool, preview.preview_digest),
    /Content changed after backup/,
  );
  assert.equal(db.writes, 0);
  delete db.ledgers[PUBLIC];
  const result = await applyFullImport(db.pool, preview.preview_digest);
  const before = db.writes;
  db.ledgers[PUBLIC] = structuredClone(nativeHistory);
  await assert.rejects(
    rollbackFullImport(db.pool, result.run_id),
    /Migration history changed/,
  );
  assert.equal(db.writes, before);
  delete db.ledgers[PUBLIC];
  delete db.tables.cms_import_runs[0].result.migration_ledger;
  await assert.rejects(
    rollbackFullImport(db.pool, result.run_id),
    /legacy run/,
  );
  assert.equal(db.writes, before);
});
test("Permission errors are sanitized and never select an alternate ledger", async () => {
  const db = memoryDatabase(
    { [PUBLIC]: nativeHistory, [MANAGED]: managedHistory },
    PUBLIC,
  );
  await assert.rejects(
    fullPreview(db.pool),
    (error: any) =>
      error.code === "MIGRATION_HISTORY_UNAVAILABLE" &&
      !error.message.includes("Sensitive"),
  );
  assert.equal(
    db.queries.some(
      (q) => q.startsWith("SELECT to_jsonb(m)") && q.includes(MANAGED),
    ),
    false,
  );
  assert.equal(db.writes, 0);
});
test("Real import router preview/backup/apply/rollback succeeds with managed-only history and preserves approval guards (HTTP + memory)", async () => {
  const db = memoryDatabase(),
    app = express();
  app.use(express.json());
  app.use(
    "/api/admin",
    createFullImportRouter(db.pool, "private-fixture-secret", {
      enabled: true,
      label: "Synthetic unit fixture — no DB",
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  try {
    const request = async (path: string, body?: any) => {
      const r = await fetch(
        "http://127.0.0.1:" +
          (server.address() as any).port +
          "/api/admin/full-content-import/" +
          path,
        body
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
          : undefined,
      );
      return { status: r.status, body: await r.json() };
    };
    const preview = await request("preview");
    assert.equal(preview.status, 200);
    assert.equal(preview.body.migration_ledger.source, MANAGED);
    assert.equal(preview.body.backup, undefined);
    assert.equal(db.writes, 0);
    const backup = await request("backup");
    assert.equal(backup.status, 200);
    assert.equal(backup.body.backup.rows.schema_migrations.length, 6);
    assert.ok(backup.body.approval_token);
    assert.equal(
      (
        await request("apply", {
          approval: fullImportApproval,
          approval_token: backup.body.approval_token,
          acknowledge_conflicts: false,
        })
      ).status,
      400,
    );
    assert.equal(db.writes, 0);
    const applied = await request("apply", {
      approval: fullImportApproval,
      approval_token: backup.body.approval_token,
      acknowledge_conflicts: true,
    });
    assert.equal(applied.status, 200);
    assert.equal(applied.body.totals.imported, 50);
    assert.equal(
      (
        await request("runs/" + applied.body.run_id + "/rollback", {
          approval: "ROLL BACK UNEDITED IMPORT DRAFTS",
        })
      ).status,
      200,
    );
    const writesBeforeInvalidHistory = db.writes;
    db.ledgers[MANAGED][0].statements = ["SELECT 1;"];
    for (const path of ["preview", "backup"]) {
      const refused = await request(path);
      assert.equal(refused.status, 409);
      assert.equal(refused.body.code, "MIGRATION_HISTORY_INVALID");
      assert.equal(refused.body.approval_token, undefined);
    }
    const refusedApply = await request("apply", {
      approval: fullImportApproval,
      approval_token: backup.body.approval_token,
      acknowledge_conflicts: true,
    });
    assert.equal(refusedApply.status, 409);
    assert.equal(refusedApply.body.code, "MIGRATION_HISTORY_INVALID");
    assert.equal(db.writes, writesBeforeInvalidHistory);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
