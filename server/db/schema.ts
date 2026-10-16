import type pg from "pg";

// Physical compatibility, not a claim that the legacy DB is production-secure.
const core = {
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
};
const content = {
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
    created_at: "timestamptz",
  },
};
export const applicationTables = [
  ...Object.keys(core),
  ...Object.keys(content),
];
export async function inspectTables(client: Pick<pg.Client, "query">) {
  const result = await client.query<{
    table_name: string;
    column_name: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
    is_identity: string;
    is_generated: string;
  }>(
    `SELECT table_name, column_name, udt_name, is_nullable, column_default, is_identity, is_generated FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [applicationTables],
  );
  return result.rows;
}
export async function validateSchema(
  client: Pick<pg.Client, "query">,
  requireContent = false,
) {
  const rows = await inspectTables(client);
  const present = new Set(rows.map((row) => row.table_name));
  const supplied: Record<string, string[]> = {
    bookings: [
      "id",
      "booking_number",
      "service_id",
      "service_name",
      "customer_name",
      "phone",
      "address",
      "notes",
      "status",
    ],
    contact_messages: ["id", "name", "phone", "message", "status"],
  };
  for (const row of rows) {
    if (
      supplied[row.table_name] &&
      !supplied[row.table_name].includes(row.column_name) &&
      row.is_nullable === "NO" &&
      row.column_default === null &&
      row.is_identity !== "YES" &&
      row.is_generated === "NEVER"
    )
      throw new Error(
        `Incompatible schema: public.${row.table_name}.${row.column_name} requires an unsupported insert value or a reviewed default.`,
      );
  }

  const required: Record<string, Record<string, string>> = {
    ...core,
    ...content,
  };
  for (const [table, columns] of Object.entries(required)) {
    if (!present.has(table)) {
      if (table in core || requireContent)
        throw new Error(`Incompatible schema: missing public.${table}.`);
      continue;
    }
    for (const [column, type] of Object.entries(columns)) {
      if (
        !rows.some(
          (row) =>
            row.table_name === table &&
            row.column_name === column &&
            row.udt_name === type,
        )
      )
        throw new Error(
          `Incompatible schema: public.${table}.${column} must be ${type}.`,
        );
    }
    for (const [column, type] of Object.entries(
      table === "works"
        ? { is_published: "bool" }
        : table === "testimonials"
          ? { media_url: "text", media_type: "text" }
          : {},
    )) {
      const actual = rows.find(
        (row) => row.table_name === table && row.column_name === column,
      );
      if ((actual && actual.udt_name !== type) || (requireContent && !actual))
        throw new Error(
          `Incompatible schema: public.${table}.${column} must be ${type}.`,
        );
    }
    // PK and unique constraints used by INSERT/lookup must really exist.
    const constraints = await client.query<{
      contype: string;
      condeferrable: boolean;
      columns: string[];
    }>(
      `SELECT c.contype,c.condeferrable,
       ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
       JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns
       FROM pg_constraint c WHERE c.conrelid = $1::regclass`,
      [`public.${table}`],
    );
    if (
      !constraints.rows.some(
        (row) => row.contype === "p" && row.columns.join(",") === "id",
      )
    )
      throw new Error(
        `Incompatible schema: public.${table} needs an id primary key.`,
      );
    const unique =
      table === "services" || table === "works"
        ? "slug"
        : table === "bookings"
          ? "booking_number"
          : null;
    if (
      unique &&
      !constraints.rows.some(
        (row) =>
          ["p", "u"].includes(row.contype) &&
          !row.condeferrable &&
          row.columns.join(",") === unique,
      )
    )
      throw new Error(
        `Incompatible schema: public.${table}.${unique} needs a unique constraint.`,
      );
  }
  const foreignKeys = await client.query(`SELECT 1 FROM pg_constraint c
    JOIN pg_attribute source ON source.attrelid=c.conrelid AND source.attnum=c.conkey[1]
    JOIN pg_attribute target ON target.attrelid=c.confrelid AND target.attnum=c.confkey[1]
    WHERE c.contype='f' AND c.conrelid='public.bookings'::regclass
      AND c.confrelid='public.services'::regclass AND cardinality(c.conkey)=1
      AND c.convalidated AND source.attname='service_id' AND target.attname='id' AND c.confdeltype='n'`);
  if (!foreignKeys.rows.length)
    throw new Error(
      "Incompatible schema: bookings.service_id must reference services.id ON DELETE SET NULL.",
    );
}
