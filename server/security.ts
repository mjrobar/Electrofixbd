import type pg from "pg";
const tables = [
  "bookings",
  "contact_messages",
  "services",
  "works",
  "testimonials",
  "site_content",
  "admin_sessions",
  "content_history",
  "admin_audit",
  "media_assets",
  "review_quotas",
];
export async function databaseSecurityReady(db: Pick<pg.Pool, "query">) {
  try {
    const role = await db.query(
      "SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication AS privileged FROM pg_roles WHERE rolname=current_user",
    );
    if (role.rows[0]?.privileged) return false;
    const guard = await db.query(
      "SELECT count(*)=11 AND bool_and(c.relrowsecurity) AS locked FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1)",
      [tables],
    );
    if (!guard.rows[0]?.locked) return false;
    const exposed = await db.query(
      "SELECT 1 FROM pg_roles r CROSS JOIN unnest($1::text[]) t WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid,'public.'||t,'SELECT') OR has_table_privilege(r.oid,'public.'||t,'INSERT') OR has_table_privilege(r.oid,'public.'||t,'UPDATE') OR has_table_privilege(r.oid,'public.'||t,'DELETE')) LIMIT 1",
      [tables],
    );
    if (exposed.rowCount) return false;
    const dangerous = await db.query(
      "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r WHERE n.nspname='public' AND p.prosecdef AND r.rolname IN ('anon','authenticated') AND has_function_privilege(r.oid,p.oid,'EXECUTE') LIMIT 1",
    );
    if (dangerous.rowCount) return false;
    const views = await db.query(
      "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_rewrite rw ON rw.ev_class=c.oid JOIN pg_depend d ON d.objid=rw.oid JOIN pg_class b ON b.oid=d.refobjid JOIN pg_namespace bn ON bn.oid=b.relnamespace CROSS JOIN pg_roles r WHERE n.nspname='public' AND bn.nspname='public' AND c.relkind IN ('v','m') AND b.relname=ANY($1) AND r.rolname IN ('anon','authenticated') AND has_table_privilege(r.oid,c.oid,'SELECT') LIMIT 1",
      [tables],
    );
    if (views.rowCount) return false;
    const owner = await db.query(
      "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) AND pg_has_role(current_user,c.relowner,'MEMBER') LIMIT 1",
      [tables],
    );
    return !owner.rowCount;
  } catch {
    return false;
  }
}
