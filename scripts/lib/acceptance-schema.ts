/** Read-only structural prerequisites for the complete CMS and application APIs. */
import type pg from "pg";
import { validateSchema } from "../../server/db/schema";
export const acceptanceColumns: Record<string, Record<string, string>> = {
  services: {
    sort_order: "int4",
    revision: "int4",
    admin_draft: "jsonb",
    archived_at: "timestamptz",
  },
  works: {
    service_id: "text",
    legacy_source_id: "text",
    display_date: "text",
    sort_order: "int4",
    revision: "int4",
    admin_draft: "jsonb",
    archived_at: "timestamptz",
  },
  testimonials: {
    service_id: "text",
    address: "text",
    submission_source: "text",
    moderation_status: "text",
    consent_at: "timestamptz",
    submission_key: "uuid",
    submission_digest: "text",
    legacy_source_id: "text",
    display_date: "text",
    display_time: "text",
    source_created_at: "text",
    sort_order: "int4",
    revision: "int4",
    admin_draft: "jsonb",
    archived_at: "timestamptz",
  },
  bookings: { revision: "int4", admin_notes: "text" },
  contact_messages: { revision: "int4", admin_notes: "text" },
  site_content: {
    key: "text",
    draft: "jsonb",
    published: "jsonb",
    revision: "int4",
    updated_at: "timestamptz",
  },
  admin_sessions: {
    token_hash: "text",
    credential_version: "text",
    created_at: "timestamptz",
    last_seen_at: "timestamptz",
    expires_at: "timestamptz",
  },
  content_history: {
    entity: "text",
    record_id: "text",
    revision: "int4",
    snapshot: "jsonb",
    saved_at: "timestamptz",
  },
  admin_audit: {
    id: "int8",
    entity: "text",
    record_id: "text",
    action: "text",
    revision: "int4",
    created_at: "timestamptz",
  },
  media_assets: {
    id: "uuid",
    filename: "text",
    mime_type: "text",
    bytes: "int4",
    width: "int4",
    height: "int4",
    owner_type: "text",
    claim_hash: "text",
    review_id: "uuid",
    created_at: "timestamptz",
    deleted_at: "timestamptz",
  },
  review_quotas: {
    bucket: "text",
    day: "date",
    submissions: "int4",
    uploads: "int4",
  },
  cms_documents: {
    id: "text",
    title: "text",
    source_path: "text",
    mapping_version: "int4",
    source_ref: "text",
    draft: "jsonb",
    published: "jsonb",
    publication_state: "text",
    revision: "int4",
    archived_at: "timestamptz",
    created_at: "timestamptz",
    updated_at: "timestamptz",
  },
  cms_import_runs: {
    id: "uuid",
    mapping_version: "int4",
    snapshot_digest: "text",
    preview_digest: "text",
    before_content: "jsonb",
    after_revisions: "jsonb",
    result: "jsonb",
    created_at: "timestamptz",
    rolled_back_at: "timestamptz",
  },
  cms_publication_state: {
    key: "text",
    state: "text",
    updated_at: "timestamptz",
  },
};
const keys: Record<string, string[]> = {
  site_content: ["key"],
  admin_sessions: ["token_hash"],
  content_history: ["entity", "record_id", "revision"],
  admin_audit: ["id"],
  media_assets: ["id"],
  review_quotas: ["bucket", "day"],
  cms_documents: ["id"],
  cms_import_runs: ["id"],
  cms_publication_state: ["key"],
};
export async function inspectAcceptanceSchema(db: Pick<pg.Pool, "query">) {
  const errors: string[] = [];
  try {
    await validateSchema(db, true);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.startsWith("Incompatible schema:"))
      throw e;
    errors.push(e.message);
  }
  const columns = (
    await db.query(
      "SELECT table_name,column_name,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1)",
      [Object.keys(acceptanceColumns)],
    )
  ).rows;
  for (const [table, fields] of Object.entries(acceptanceColumns))
    for (const [column, type] of Object.entries(fields)) {
      if (
        !columns.some(
          (c) =>
            c.table_name === table &&
            c.column_name === column &&
            c.udt_name === type,
        )
      )
        errors.push(
          `Incompatible schema: public.${table}.${column} must be ${type}.`,
        );
    }
  // Migration 003's identity equivalence also depends on its real defaults and
  // nullability, independently of the stored SQL evidence.
  for (const [column, expectedDefault] of Object.entries({
    key: null,
    draft: "'[]'::jsonb",
    published: "'[]'::jsonb",
    revision: "0",
    updated_at: "now()",
  })) {
    const actual = columns.find(
      (c) => c.table_name === "site_content" && c.column_name === column,
    );
    if (
      !actual ||
      actual.is_nullable !== "NO" ||
      actual.column_default !== expectedDefault
    )
      errors.push(
        `Incompatible schema: public.site_content.${column} nullability/default differs from Migration 003.`,
      );
  }
  const constraints = (
    await db.query(
      `SELECT t.relname AS table_name,c.contype,c.convalidated,c.condeferrable,pg_get_constraintdef(c.oid) AS definition,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname=ANY($1)`,
      [Object.keys(acceptanceColumns)],
    )
  ).rows;
  const siteKeyCheck =
    "CHECK((key=ANY(ARRAY['hero_slides'::text,'faqs'::text,'business_settings'::text,'page_sections'::text])))";
  if (
    !constraints.some(
      (c) =>
        c.table_name === "site_content" &&
        c.contype === "c" &&
        c.convalidated &&
        JSON.stringify(c.columns) === JSON.stringify(["key"]) &&
        c.definition.replace(/\s+/g, "") === siteKeyCheck,
    )
  )
    errors.push(
      "Incompatible schema: public.site_content requires Migration 003's exact validated four-key constraint.",
    );
  for (const [table, cols] of Object.entries(keys))
    if (
      !constraints.some(
        (c) =>
          c.table_name === table &&
          c.contype === "p" &&
          !c.condeferrable &&
          JSON.stringify(c.columns) === JSON.stringify(cols),
      )
    )
      errors.push(
        `Incompatible schema: public.${table} primary key must be (${cols.join(",")}).`,
      );
  for (const [table, cols] of [
    ["works", ["legacy_source_id"]],
    ["testimonials", ["legacy_source_id"]],
    ["testimonials", ["submission_key"]],
    ["testimonials", ["submission_digest"]],
    ["media_assets", ["filename"]],
  ] as const)
    if (
      !constraints.some(
        (c) =>
          c.table_name === table &&
          c.contype === "u" &&
          !c.condeferrable &&
          JSON.stringify(c.columns) === JSON.stringify(cols),
      )
    )
      errors.push(
        `Incompatible schema: public.${table}.${cols.join(",")} requires uniqueness.`,
      );
  for (const [table, column, values] of [
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
    if (
      !constraints.some(
        (c) =>
          c.table_name === table &&
          c.contype === "c" &&
          c.convalidated &&
          c.columns.includes(column) &&
          values.every((v) => c.definition.includes("'" + v + "'")),
      )
    )
      errors.push(
        `Incompatible schema: public.${table}.${column} requires its validated CMS/moderation constraint.`,
      );
  const triggers = (
    await db.query(
      `SELECT t.relname AS table_name,g.tgenabled,g.tgtype,p.prosecdef,p.prosrc FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_proc p ON p.oid=g.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='public' AND pn.nspname='public' AND p.proname='efb_track_change' AND NOT g.tgisinternal`,
    )
  ).rows;
  for (const table of [
    "services",
    "works",
    "testimonials",
    "site_content",
    "bookings",
    "contact_messages",
    "cms_documents",
  ])
    if (
      !triggers.some(
        (t) =>
          t.table_name === table &&
          ["O", "A"].includes(t.tgenabled) &&
          (t.tgtype & 19) === 19 &&
          !t.prosecdef &&
          t.prosrc.includes("cms_documents") &&
          t.prosrc.includes("content_history") &&
          t.prosrc.includes("admin_audit"),
      )
    )
      errors.push(
        `Incompatible schema: public.${table} requires enabled invoker CMS revision/history trigger (006).`,
      );
  return {
    valid: !errors.length,
    errors,
    checked:
      "core compatibility, 003 site-content defaults/nullability/four-key constraint, plus 004–006 column types, keys, source identity uniqueness, CMS/moderation constraints and revision triggers",
  };
}
