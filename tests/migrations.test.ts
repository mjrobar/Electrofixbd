import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import { migrate } from "../scripts/migrate";
import { createStore } from "../server/store";
import { loadConfig } from "../server/config";

const base = process.env.TEST_DATABASE_URL;
const options = {
  skip: !base
    ? "Set TEST_DATABASE_URL to a disposable local PostgreSQL cluster."
    : false,
};
async function disposable(
  run: (url: string, client: pg.Client) => Promise<void>,
) {
  const target = new URL(base!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /test/);
  const admin = new pg.Client({ connectionString: target.toString() });
  await admin.connect();
  const name = `efb_test_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${name}`);
  target.pathname = "/" + name;
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  try {
    await run(target.toString(), client);
  } finally {
    await client.end();
    // Only this helper's random, newly-created disposable test DB is removed.
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
}
async function legacy(client: pg.Client) {
  const sql = await readFile(
    new URL("../supabase-schema.sql", import.meta.url),
    "utf8",
  );
  // Model the checked-in legacy DDL without creating Supabase roles or invoking
  // any service. Same tables/defaults/constraints; database is disposable only.
  await client.query(sql.slice(0, sql.indexOf("-- Enable Row Level Security")));
  for (const table of [
    "services",
    "bookings",
    "contact_messages",
    "works",
    "testimonials",
  ])
    await client.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
  await client.query(
    "INSERT INTO services(id,slug,name,short_description,full_description) VALUES ('legacy-id','legacy-service','Original service','Original short','Original full')",
  );
  await client.query(
    "INSERT INTO bookings(booking_number,service_id,service_name,customer_name,phone,address,notes) VALUES ('EFB-20261016-12345','legacy-id','Original service','Original customer','01700000000','Original address',NULL)",
  );
  await client.query(
    "INSERT INTO contact_messages(name,phone,message) VALUES ('Original contact','01700000000','Original message')",
  );
  await client.query(
    "INSERT INTO works(title,slug,service_type,category,description,media_url,media_type,is_featured) VALUES ('Original work','original-work','Original service','ac','Original description','https://example.test/video.mp4','video',true)",
  );
  await client.query(
    "INSERT INTO testimonials(customer_name,review,service_type,rating,avatar_url,is_published) VALUES ('Original reviewer','Original review','Original service',4,'https://example.test/avatar.jpg',false)",
  );
}
async function snapshot(client: pg.Client) {
  const result: Record<string, unknown> = {};
  for (const table of [
    "services",
    "bookings",
    "contact_messages",
    "works",
    "testimonials",
  ]) {
    // Newly-added optional fields are compared separately; every original
    // column and row remains in this JSON snapshot, including nulls and IDs.
    const rows = await client.query(
      `SELECT to_jsonb(t) - 'media_url' - 'media_type' - 'is_published' AS row FROM public.${table} t ORDER BY id`,
    );
    result[table] = rows.rows;
  }
  return result;
}
test(
  "fresh install includes all five tables, preserves ratings/media/publication constraints",
  options,
  async () =>
    disposable(async (url, db) => {
      await migrate(url);
      await migrate(url);
      assert.equal(
        Number(
          (await db.query("SELECT count(*) FROM schema_migrations")).rows[0]
            .count,
        ),
        2,
      );
      for (const table of [
        "services",
        "bookings",
        "contact_messages",
        "works",
        "testimonials",
      ])
        assert.equal(
          (
            await db.query("SELECT to_regclass($1) AS name", [
              `public.${table}`,
            ])
          ).rows[0].name,
          table,
        );
      await assert.rejects(
        db.query(
          "INSERT INTO testimonials(id,customer_name,review,service_type,rating) VALUES ($1,'Bad','Bad','AC',6)",
          [randomUUID()],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        db.query(
          "INSERT INTO works(id,title,slug,service_type,category,description,media_url,media_type) VALUES ($1,'Bad','bad','AC','ac','Bad','file','executable')",
          [randomUUID()],
        ),
        { code: "23514" },
      );
    }),
);
test(
  "existing Phase 2 ledger upgrades without changing 001 or service records",
  options,
  async () =>
    disposable(async (url, db) => {
      const sql = await readFile(
        new URL("../db/migrations/001_backend_foundation.sql", import.meta.url),
        "utf8",
      );
      const { createHash } = await import("node:crypto");
      await db.query(sql);
      await db.query(
        "CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
      );
      await db.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)",
        [
          "001_backend_foundation.sql",
          createHash("sha256").update(sql).digest("hex"),
        ],
      );
      await db.query(
        "UPDATE services SET name='Operator edited service' WHERE id='srv-ac-repair'",
      );
      await migrate(url);
      assert.equal(
        (await db.query("SELECT name FROM services WHERE id='srv-ac-repair'"))
          .rows[0].name,
        "Operator edited service",
      );
      assert.equal(
        (await db.query("SELECT to_regclass('public.works') AS name")).rows[0]
          .name,
        "works",
      );
    }),
);
test(
  "legacy adoption requires explicit opt-in and preserves all rows, defaults, IDs, FKs and RLS",
  options,
  async () =>
    disposable(async (url, db) => {
      await legacy(db);
      // Existing additional media/publication fields are retained exactly.
      await db.query(
        "ALTER TABLE works ADD COLUMN is_published BOOLEAN DEFAULT true",
      );
      await db.query(
        "ALTER TABLE testimonials ADD COLUMN media_url TEXT, ADD COLUMN media_type TEXT",
      );
      await db.query(
        "UPDATE works SET is_published=false; UPDATE testimonials SET media_url='https://example.test/review.mp4',media_type='video'",
      );
      await db.query("ALTER TABLE bookings ENABLE ROW LEVEL SECURITY");
      await db.query(
        "CREATE POLICY legacy_read ON bookings FOR SELECT USING (true)",
      );
      const before = await snapshot(db);
      const originalWorks = (await db.query("SELECT * FROM works")).rows;
      const originalTestimonials = (
        await db.query("SELECT * FROM testimonials")
      ).rows;
      const defaults = (
        await db.query(
          "SELECT table_name,column_name,column_default,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name",
        )
      ).rows;
      await assert.rejects(migrate(url), /adopt-existing/);
      assert.equal(
        (
          await db.query(
            "SELECT to_regclass('public.schema_migrations') AS name",
          )
        ).rows[0].name,
        null,
      );
      await migrate(url, { adoptExisting: true });
      await migrate(url);
      assert.equal(
        (
          await db.query(
            "SELECT adopted FROM schema_migrations WHERE name='001_backend_foundation.sql'",
          )
        ).rows[0].adopted,
        true,
      );
      assert.deepEqual(await snapshot(db), before);
      assert.deepEqual(
        (await db.query("SELECT * FROM works")).rows,
        originalWorks,
      );
      assert.deepEqual(
        (await db.query("SELECT * FROM testimonials")).rows,
        originalTestimonials,
      );
      const afterDefaults = (
        await db.query(
          "SELECT table_name,column_name,column_default,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name <> 'schema_migrations' ORDER BY table_name,column_name",
        )
      ).rows;
      assert.deepEqual(afterDefaults, defaults);
      assert.equal(
        (
          await db.query(
            "SELECT relrowsecurity FROM pg_class WHERE oid='bookings'::regclass",
          )
        ).rows[0].relrowsecurity,
        true,
      );
      assert.equal(
        (
          await db.query(
            "SELECT qual FROM pg_policies WHERE policyname='legacy_read'",
          )
        ).rows[0].qual,
        "true",
      );
      assert.equal(
        Number((await db.query("SELECT count(*) FROM services")).rows[0].count),
        1,
      ); // No fresh-install seeds ran.
      const store = createStore(
        loadConfig({ NODE_ENV: "test", DATABASE_URL: url }),
      );
      try {
        const record = await store.createBooking({
          customer_name: "After adoption",
          phone: "01700000000",
          address: "Dhaka test",
          notes: "",
          service_id: "legacy-id",
        });
        await store.createContact({
          name: "After adoption",
          phone: "01700000000",
          message: "Durable legacy test",
        });
        assert.equal(
          (await store.getBooking(record.booking_number))?.service_name,
          "Original service",
        );
        const fk = (
          await db.query(
            "SELECT service_id FROM bookings WHERE booking_number=$1",
            [record.booking_number],
          )
        ).rows[0];
        assert.equal(fk.service_id, "legacy-id");
      } finally {
        await store.close();
      }
    }),
);
test(
  "checked-in legacy schema receives only additive content columns",
  options,
  async () =>
    disposable(async (url, db) => {
      await legacy(db);
      const before = await snapshot(db);
      const mediaBefore = (
        await db.query("SELECT media_url,media_type,is_featured FROM works")
      ).rows;
      const publicationBefore = (
        await db.query(
          "SELECT rating,avatar_url,is_published FROM testimonials",
        )
      ).rows;
      await migrate(url, { adoptExisting: true });
      assert.deepEqual(await snapshot(db), before);
      assert.deepEqual(
        (await db.query("SELECT media_url,media_type,is_featured FROM works"))
          .rows,
        mediaBefore,
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT rating,avatar_url,is_published FROM testimonials",
          )
        ).rows,
        publicationBefore,
      );
      assert.equal(
        (await db.query("SELECT media_url FROM testimonials")).rows[0]
          .media_url,
        null,
      );
    }),
);
test(
  "incompatible existing schema fails before ledger creation or data changes",
  options,
  async () =>
    disposable(async (url, db) => {
      await legacy(db);
      await db.query(
        "ALTER TABLE works ALTER COLUMN media_url TYPE varchar(500)",
      );
      const before = await snapshot(db);
      await assert.rejects(
        migrate(url, { adoptExisting: true }),
        /works.media_url/,
      );
      assert.deepEqual(await snapshot(db), before);
      assert.equal(
        (await db.query("SELECT to_regclass('schema_migrations') AS name"))
          .rows[0].name,
        null,
      );
    }),
);
test(
  "checksum mismatch and missing foreign keys fail safely",
  options,
  async () =>
    disposable(async (url, db) => {
      await migrate(url);
      await db.query(
        "UPDATE schema_migrations SET checksum='tampered' WHERE name='001_backend_foundation.sql'",
      );
      await assert.rejects(migrate(url), /migration has changed/);
      await db.query(
        "ALTER TABLE bookings DROP CONSTRAINT bookings_service_id_fkey",
      );
      await assert.rejects(migrate(url), /service_id must reference/);
    }),
);

test(
  "concurrent migrators serialize and leave one complete five-table baseline",
  options,
  async () =>
    disposable(async (url, db) => {
      await Promise.all([migrate(url), migrate(url)]);
      assert.equal(
        Number(
          (await db.query("SELECT count(*) FROM schema_migrations")).rows[0]
            .count,
        ),
        2,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "SELECT count(*) FROM services WHERE id='srv-ac-repair'",
            )
          ).rows[0].count,
        ),
        1,
      );
    }),
);
test(
  "anonymous-style RLS policy exposes private bookings; revoking access blocks it on disposable DB only",
  options,
  async () =>
    disposable(async (_url, db) => {
      await legacy(db);
      const role = `efb_anon_test_${randomUUID().replaceAll("-", "")}`;
      try {
        await db.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
        await db.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
        await db.query(`GRANT SELECT ON bookings TO ${role}`);
        await db.query("ALTER TABLE bookings ENABLE ROW LEVEL SECURITY");
        await db.query(
          `CREATE POLICY vulnerable_lookup ON bookings FOR SELECT TO ${role} USING (true)`,
        );
        await db.query(`SET ROLE ${role}`);
        const exposed = await db.query(
          "SELECT customer_name,phone,address FROM bookings",
        );
        assert.equal(exposed.rows[0].phone, "01700000000");
        await db.query("RESET ROLE");
        // Rehearsal of the documented correction, never run by application migrations.
        await db.query(`REVOKE ALL ON bookings FROM ${role}`);
        await db.query(`SET ROLE ${role}`);
        await assert.rejects(db.query("SELECT phone FROM bookings"), {
          code: "42501",
        });
        await db.query("RESET ROLE");
      } finally {
        await db.query("RESET ROLE");
        await db.query("DROP POLICY IF EXISTS vulnerable_lookup ON bookings");
        await db.query(`DROP OWNED BY ${role}`);
        await db.query(`DROP ROLE ${role}`);
      }
    }),
);

test(
  "adoption rejects extra required write columns without silently supplying or rewriting values",
  options,
  async () =>
    disposable(async (url, db) => {
      await legacy(db);
      await db.query(
        "ALTER TABLE bookings ADD COLUMN legacy_source TEXT NOT NULL DEFAULT 'original'",
      );
      await db.query(
        "ALTER TABLE bookings ALTER COLUMN legacy_source DROP DEFAULT",
      );
      const before = await snapshot(db);
      await assert.rejects(
        migrate(url, { adoptExisting: true }),
        /legacy_source requires/,
      );
      assert.deepEqual(await snapshot(db), before);
      assert.equal(
        (await db.query("SELECT to_regclass('schema_migrations') AS name"))
          .rows[0].name,
        null,
      );
    }),
);
