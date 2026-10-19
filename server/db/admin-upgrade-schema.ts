/** Metadata-only prerequisites for optional 007; no DDL, data reads or repairs. */
import type pg from "pg";
export const upgradeColumns: Record<string, Record<string, string>> = {
  admin_owner: {
    singleton: "bool",
    username: "text",
    password_hash: "text",
    credential_revision: "int4",
    verified_email: "text?",
    email_verified_at: "timestamptz?",
    updated_at: "timestamptz",
  },
  admin_account_tokens: {
    token_hash: "text",
    purpose: "text",
    email: "text",
    credential_version: "text",
    created_at: "timestamptz",
    expires_at: "timestamptz",
    used_at: "timestamptz?",
  },
  admin_notification_state: {
    singleton: "bool",
    seen_at: "timestamptz",
    seen_booking: "text",
    seen_total: "int4",
    updated_at: "timestamptz",
  },
  admin_delivery_outbox: {
    id: "uuid",
    dedupe_key: "text",
    channel: "text",
    payload: "text?",
    state: "text",
    attempts: "int4",
    available_at: "timestamptz",
    expires_at: "timestamptz",
    locked_at: "timestamptz?",
    provider_id: "text?",
    last_code: "text?",
    created_at: "timestamptz",
    updated_at: "timestamptz",
  },
};
export async function inspectAdminUpgradeSchema(
  db: Pick<pg.Pool, "query">,
  required = false,
) {
  const tables = Object.keys(upgradeColumns),
    columns = (
      await db.query(
        "SELECT table_name,column_name,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1) /* admin upgrade schema */",
        [tables],
      )
    ).rows.filter((c) => tables.includes(c.table_name));
  const security = (
    await db.query(
      "SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) /* admin upgrade RLS */",
      [tables],
    )
  ).rows.filter((s) => tables.includes(s.relname));
  if (!columns.length && !security.length && !required)
    return { present: false, compatible: true, errors: [] as string[] };
  const errors: string[] = [];
  for (const [table, fields] of Object.entries(upgradeColumns))
    for (const [column, expected] of Object.entries(fields)) {
      const found = columns.find(
          (c) => c.table_name === table && c.column_name === column,
        ),
        type = expected.replace(/\?$/, ""),
        nullable = expected.endsWith("?");
      if (
        !found ||
        found.udt_name !== type ||
        found.is_nullable !== (nullable ? "YES" : "NO")
      )
        errors.push(
          `Optional 007 incompatible column: public.${table}.${column}`,
        );
    }
  const constraints = (
    await db.query(
      "SELECT c.relname AS table_name,con.contype,con.convalidated,pg_get_constraintdef(con.oid) AS definition,ARRAY(SELECT a.attname FROM unnest(con.conkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum ORDER BY k.ord) AS columns FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) /* admin upgrade constraints */",
      [tables],
    )
  ).rows;
  for (const [table, key] of Object.entries({
    admin_owner: "singleton",
    admin_account_tokens: "token_hash",
    admin_notification_state: "singleton",
    admin_delivery_outbox: "id",
  }))
    if (
      !constraints.some(
        (c) =>
          c.table_name === table &&
          c.contype === "p" &&
          JSON.stringify(c.columns) === JSON.stringify([key]),
      )
    )
      errors.push(`Optional 007 missing primary key: ${table}`);
  if (
    !constraints.some(
      (c) =>
        c.table_name === "admin_delivery_outbox" &&
        c.contype === "u" &&
        JSON.stringify(c.columns) === JSON.stringify(["dedupe_key"]),
    )
  )
    errors.push("Optional 007 missing delivery idempotence constraint.");
  const compact = (s: string) =>
    s
      .split(/('(?:''|[^'])*')/)
      .map((part, i) =>
        i % 2 ? part : part.replace(/::text\b/g, "").replace(/[\s()]/g, ""),
      )
      .join("");
  for (const table of ["admin_owner", "admin_notification_state"])
    if (
      !constraints.some(
        (c) =>
          c.table_name === table &&
          c.contype === "c" &&
          c.convalidated &&
          compact(c.definition) === "CHECKsingleton",
      )
    )
      errors.push(`Optional 007 missing singleton constraint: ${table}`);
  for (const [table, column, values] of [
    ["admin_account_tokens", "purpose", ["verify_email", "reset_password"]],
    ["admin_delivery_outbox", "channel", ["email", "whatsapp"]],
    [
      "admin_delivery_outbox",
      "state",
      [
        "queued",
        "processing",
        "retry",
        "sent",
        "failed",
        "uncertain",
        "cancelled",
      ],
    ],
  ] as const) {
    const expected =
      "CHECK" +
      column +
      "=ANYARRAY[" +
      values.map((v) => "'" + v + "'").join(",") +
      "]";
    if (
      !constraints.some(
        (c) =>
          c.table_name === table &&
          c.contype === "c" &&
          c.convalidated &&
          compact(c.definition) === expected,
      )
    )
      errors.push(`Optional 007 incompatible ${table}.${column} constraint.`);
  }
  if (
    security.length !== tables.length ||
    security.some((s) => !s.relrowsecurity)
  )
    errors.push("Optional 007 private tables require enabled RLS.");
  const exposed = await db.query(
    "SELECT 1 FROM pg_roles r CROSS JOIN unnest($1::text[]) t WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid,'public.'||t,'SELECT') OR has_table_privilege(r.oid,'public.'||t,'INSERT') OR has_table_privilege(r.oid,'public.'||t,'UPDATE') OR has_table_privilege(r.oid,'public.'||t,'DELETE')) LIMIT 1 /* admin upgrade browser ACL */",
    [security.map((s) => s.relname)],
  );
  if (exposed.rowCount)
    errors.push("Optional 007 private tables expose browser role privileges.");
  return {
    present: columns.length > 0 || security.length > 0,
    compatible: !errors.length,
    errors,
  };
}
