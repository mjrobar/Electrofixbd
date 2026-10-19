import pg from "pg";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const securityTables = [
  "services",
  "works",
  "testimonials",
  "bookings",
  "contact_messages",
  "site_content",
  "admin_sessions",
  "content_history",
  "admin_audit",
  "media_assets",
  "review_quotas",
  "cms_documents",
  "cms_import_runs",
  "cms_publication_state",
  "schema_migrations",
  "admin_owner",
  "admin_account_tokens",
  "admin_notification_state",
  "admin_delivery_outbox",
];
export async function securityPreview(db: Pick<pg.Pool, "query">) {
  const tables = await db.query(
    "SELECT c.relname AS table_name,c.relrowsecurity AS rls,c.relacl::text AS grants FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) ORDER BY c.relname",
    [securityTables],
  );
  const policies = await db.query(
    "SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1) ORDER BY tablename,policyname",
    [securityTables],
  );
  const views = await db.query(
    "SELECT c.relname,c.relkind,c.relacl::text AS grants FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m') ORDER BY c.relname",
  );
  const definers = await db.query(
    "SELECT p.oid::regprocedure::text AS function,p.proacl::text AS grants FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef",
  );
  return {
    tables: tables.rows,
    policies: policies.rows,
    views: views.rows,
    definers: definers.rows,
  };
}
export async function applyBrowserLockdown(
  url: string,
  runtimeRole: string,
  approval: string,
) {
  if (approval !== "REVOKE BROWSER DATABASE ACCESS")
    throw Error("Explicit browser-access approval required.");
  const db = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(284102)");
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SELECT set_config('efb.runtime_role',$1,true)", [
      runtimeRole,
    ]);
    await db.query(
      await readFile(
        new URL(
          "../db/security/001_browser_access_lockdown.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const url = process.env.SECURITY_DATABASE_URL;
  if (!url) {
    console.error(
      "Set SECURITY_DATABASE_URL explicitly. No DATABASE_URL fallback is used.",
    );
    process.exitCode = 1;
  } else {
    const pool = new pg.Pool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 5000,
    });
    try {
      if (process.argv.includes("--apply")) {
        if (!process.argv.includes("--backup-reviewed"))
          throw Error("Full backup and preview review required.");
        await applyBrowserLockdown(
          url,
          process.env.RUNTIME_DATABASE_ROLE || "",
          process.env.SECURITY_APPROVAL || "",
        );
        console.log(
          "Browser-access lockdown committed. Verify the runtime connection before serving traffic.",
        );
      } else console.log(JSON.stringify(await securityPreview(pool), null, 2));
    } catch {
      console.error(
        "Security operation failed. No approval or a database prerequisite is missing; inspect the reviewed preview locally.",
      );
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}
