import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { inspectTables, validateSchema } from "../server/db/schema";

export async function migrate(
  connectionString: string,
  options: { adoptExisting?: boolean } = {},
) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(284102)");
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const directory = path.resolve(import.meta.dirname, "../db/migrations");
    const tables = await inspectTables(client);
    const ledger = await client.query(
      "SELECT to_regclass('public.schema_migrations') AS name",
    );
    const existing = tables.length > 0;
    if (existing) await validateSchema(client);
    let adopt = false;
    if (existing) {
      const tracked = ledger.rows[0].name
        ? await client.query(
            "SELECT name FROM public.schema_migrations WHERE name = '001_backend_foundation.sql'",
          )
        : { rows: [] };
      if (!tracked.rows.length) {
        if (!options.adoptExisting)
          throw new Error(
            "Existing database requires explicit --adopt-existing after schema review and backup.",
          );
        adopt = true;
      }
    }

    await client.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    await client.query(
      "ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS adopted BOOLEAN NOT NULL DEFAULT false",
    );
    for (const name of (await readdir(directory))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort()) {
      const sql = await readFile(path.join(directory, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        "SELECT checksum FROM public.schema_migrations WHERE name = $1",
        [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error("An applied migration has changed.");
        continue;
      }
      // Verified adoption records the immutable 001 checksum without executing
      // its CREATE statements or seeds against existing customer tables.
      if (!(adopt && name === "001_backend_foundation.sql"))
        await client.query(sql);
      await client.query(
        "INSERT INTO public.schema_migrations (name,checksum,adopted) VALUES ($1,$2,$3)",
        [name, checksum, adopt && name === "001_backend_foundation.sql"],
      );
    }
    await validateSchema(client, true);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Set MIGRATION_DATABASE_URL or DATABASE_URL for the explicitly approved target.",
    );
  migrate(url, {
    adoptExisting: process.argv.includes("--adopt-existing"),
  }).catch(() => {
    console.error(
      "Migration failed; changes rolled back. Inspect the target schema and approved baseline before retrying.",
    );
    process.exitCode = 1;
  });
}
