/** Read-only secondary preflight and field verification. No migration/import mode. */
import pg from "pg";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import catalog from "../server/full-content-catalog.json";
import { backupTables, readFullPreview } from "../server/full-content-import";
import { digest } from "../server/content-import";
export function assertSecondaryTarget(env: NodeJS.ProcessEnv) {
  if (env.SECONDARY_PROJECT_NAME !== "Electrofixbd.Test Project")
    throw Error("Confirm exact Secondary project name.");
  const ref = env.SECONDARY_PROJECT_REF,
    primary = env.PRIMARY_PROJECT_REF,
    url = env.SECONDARY_DATABASE_URL;
  if (
    !ref ||
    !primary ||
    ref === primary ||
    !url ||
    !/^[a-z0-9]{10,40}$/.test(ref) ||
    !/^[a-z0-9]{10,40}$/.test(primary)
  )
    throw Error(
      "Explicit distinct Secondary/Primary project references and Secondary URL are required. No DATABASE_URL fallback.",
    );
  const parsed = new URL(url),
    username = decodeURIComponent(parsed.username);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.searchParams.get("sslmode") === "no-verify" ||
    parsed.hostname.includes(primary) ||
    username.includes(primary)
  )
    throw Error("Target rejected.");
  if (!(
    parsed.hostname === `db.${ref}.supabase.co` ||
    (/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(parsed.hostname) &&
      username.endsWith("." + ref))
  ))
    throw Error(
      "URL does not match the explicitly approved Secondary reference.",
    );
  return url;
}
export async function secondaryReport(pool: pg.Pool, verify = false) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const present = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1)",
        [backupTables],
      )
    ).rows.map((r) => r.tablename);
    const missing = backupTables.filter((t) => !present.includes(t));
    const result: any = {
      mode: verify ? "field-verification" : "read-only-preflight",
      expected: {
        schema_version: 6,
        records: 50,
        documents: 19,
        services: 6,
        works: 12,
        testimonials: 9,
        hero_slides: 3,
        faqs: 8,
        page_sections: 6,
        business_settings: 1,
      },
      snapshot_digest: catalog.snapshot_digest,
      source_ref: catalog.source_ref,
      missing_tables: missing,
      counts: {},
      migrations: present.includes("schema_migrations")
        ? (
            await client.query(
              "SELECT name,checksum FROM schema_migrations ORDER BY name",
            )
          ).rows
        : [],
    };
    for (const table of present)
      result.counts[table] = Number(
        (await client.query(`SELECT count(*) AS total FROM public.${table}`))
          .rows[0].total,
      );
    if (verify) {
      if (missing.length)
        throw Error(
          "Migration prerequisites missing. No migration will be run.",
        );
      const preview = await readFullPreview(client);
      result.totals = preview.totals;
      result.entries = preview.entries.map((e) => ({
        kind: e.kind,
        id: e.id,
        source_id: e.source_id,
        status: e.action === "skip" ? "exact-draft-match" : e.action,
        field_differences: e.differences,
      }));
      result.complete_draft_match = preview.totals.skipped === 50;
    }
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const target = assertSecondaryTarget(process.env),
    output = process.argv[2];
  if (!output || output.startsWith("--"))
    throw Error("Pass a new private output filename.");
  const pool = new pg.Pool({
    connectionString: target,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    options: "-c default_transaction_read_only=on",
  });
  try {
    const report = await secondaryReport(
      pool,
      process.argv.includes("--verify"),
    );
    await writeFile(
      output,
      JSON.stringify({ ...report, report_digest: digest(report) }, null, 2) +
        "\n",
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        output,
        mode: report.mode,
        missing_tables: report.missing_tables,
        complete_draft_match: report.complete_draft_match ?? null,
      }),
    );
  } finally {
    await pool.end();
  }
}
