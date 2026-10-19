import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import express from "express";
import type pg from "pg";
import {
  createObservationRouter,
  encodeBookingCursor,
} from "../server/admin-observation";
import { loadConfig } from "../server/config";
import { errorHandler } from "../server/errors";
import {
  expectedMigrations,
  expectedOptionalMigrations,
  validateLedger,
} from "../scripts/lib/migration-ledger";
import {
  inspectAdminUpgradeSchema,
  upgradeColumns,
} from "../server/db/admin-upgrade-schema";
import { createAdminRouter } from "../server/admin";
import { adminMemory } from "./helpers/admin-upgrade-memory";
const config = loadConfig({
  NODE_ENV: "test",
  ADMIN_SESSION_SECRET: "private-test-session-secret-".repeat(2),
});
test("Read-only analytics use explicit bounded Bangladesh calendar series; notification snapshots and receipts do not write customer data", async (t) => {
  const queries: string[] = [],
    items = [
      {
        booking_number: "EFB-20261019-12345",
        created_at: "2026-10-19T01:00:00.123456Z",
      },
    ];
  const db = {
    release() {},
    async query(sql: string, values: any[] = []): Promise<any> {
      queries.push(sql);
      if (/^(BEGIN|SET|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
      if (sql.startsWith("WITH bounds"))
        return { rows: [{ day: "2026-10-19", bookings: 1 }] };
      if (sql.startsWith("SELECT booking_number,to_char"))
        return { rows: items };
      if (sql === "SELECT count(*)::int AS total FROM public.bookings")
        return { rows: [{ total: 1 }] };
      if (sql.includes("AS last_contact"))
        return {
          rows: [
            {
              audit: "1",
              contacts: 0,
              last_contact: null,
              server_time: "2026-10-19T01:10:00Z",
            },
          ],
        };
      if (sql.startsWith("SELECT booking_number,service_name"))
        return {
          rows: [
            {
              ...items[0],
              service_name: "Fixture service",
              customer_name: "Synthetic customer",
              phone: "01700000000",
              address: "Synthetic address",
              notes: "Fixture note",
              status: "pending",
            },
          ],
        };
      throw Error("Unexpected observation query: " + sql);
    },
  };
  const pool = {
      query: db.query,
      connect: async () => db,
    } as unknown as pg.Pool,
    app = express();
  app.use(express.json());
  app.use("/api/admin", createObservationRouter(pool, config));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  const base =
    "http://127.0.0.1:" + (server.address() as any).port + "/api/admin";
  for (const period of ["day", "week", "month", "year"]) {
    const r = await fetch(base + "/analytics?period=" + period),
      data = await r.json();
    assert.equal(r.status, 200);
    assert.equal(data.time_zone, "Asia/Dhaka");
    assert.equal(data.period, period);
    assert.ok(data.range_label);
  }
  assert.match(
    queries.find((q) => q.includes("date_trunc('week'"))!,
    /11 weeks/,
  );
  assert.match(
    queries.find((q) => q.includes("date_trunc('year'"))!,
    /4 years/,
  );
  assert.ok(
    queries
      .filter((q) => q.startsWith("WITH bounds"))
      .every(
        (q) =>
          q.includes("generate_series") &&
          q.includes("AT TIME ZONE 'Asia/Dhaka'"),
      ),
  );
  const count = queries.length;
  assert.equal(
    (await fetch(base + "/analytics?period=day%27%3BDROP")).status,
    400,
  );
  assert.equal(queries.length, count);
  const first = await (await fetch(base + "/updates")).json();
  assert.equal(first.unread, 1);
  assert.equal(first.read_state, "this-browser");
  assert.ok(first.latest_cursor);
  assert.equal(first.items[0].customer_name, undefined);
  const next = await (
    await fetch(
      base + "/updates?seen=" + encodeURIComponent(first.latest_cursor),
    )
  ).json();
  assert.equal(next.unread, 0);
  assert.equal(next.change_token, first.change_token);
  assert.equal((await fetch(base + "/updates?seen=tampered")).status, 400);
  const receipt = await (
    await fetch(base + "/booking-receipts/" + items[0].booking_number)
  ).json();
  assert.equal(receipt.mode, "manual");
  assert.equal(receipt.text.includes("01700000000"), false);
  const full = await (
    await fetch(
      base + "/booking-receipts/" + items[0].booking_number + "?details=true",
    )
  ).json();
  assert.ok(full.text.includes("Synthetic address"));
  assert.equal(
    queries.some((q) => /^(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)/.test(q)),
    false,
  );
});
test("New operational/settings endpoints remain behind existing session authorization", async (t) => {
  const memory = adminMemory(null),
    cfg = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://unreachable.invalid/test",
      PUBLIC_ORIGIN: "http://localhost",
      ADMIN_USERNAME: "owner",
      ADMIN_PASSWORD_HASH: "test-salt:" + "00".repeat(64),
      ADMIN_SESSION_SECRET: "private-test-session-secret-".repeat(2),
    }),
    app = express();
  app.use("/api/admin", createAdminRouter(cfg, memory.pool));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  for (const path of [
    "/updates",
    "/analytics",
    "/account",
    "/integrations",
    "/booking-receipts/EFB-20261019-12345",
  ])
    assert.equal(
      (
        await fetch(
          "http://127.0.0.1:" +
            (server.address() as any).port +
            "/api/admin" +
            path,
        )
      ).status,
      401,
      path,
    );
  assert.equal(
    memory.queries.length,
    0,
    "Unauthenticated requests must not read customer data",
  );
});
test("Optional 007 provenance is exact and independent: baseline six migrations stay valid; changed/duplicate upgrade evidence fails", async () => {
  const expected = await expectedMigrations(),
    optional = (await expectedOptionalMigrations())[0],
    stored = JSON.parse(
      await readFile(
        new URL(
          "../server/db/optional-migration-manifest.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  assert.deepEqual(stored, [optional]);
  const native = expected.map((m) => ({ name: m.name, checksum: m.sha256 }));
  assert.equal(
    validateLedger("public.schema_migrations", native, expected)
      .provenance_verified,
    true,
  );
  assert.equal(
    validateLedger(
      "public.schema_migrations",
      [...native, { name: optional.name, checksum: optional.sha256 }],
      expected,
    ).provenance_verified,
    true,
  );
  assert.equal(
    validateLedger(
      "public.schema_migrations",
      [...native, { name: optional.name, checksum: "0".repeat(64) }],
      expected,
    ).valid,
    false,
  );
  assert.equal(
    validateLedger(
      "public.schema_migrations",
      [
        ...native,
        { name: optional.name, checksum: optional.sha256 },
        { name: optional.name, checksum: optional.sha256 },
      ],
      expected,
    ).valid,
    false,
  );
});
test("Optional schema validation leaves 001–006 alone but fails incomplete, nullable, non-idempotent or exposed upgrade schemas", async () => {
  const empty = { query: async () => ({ rows: [], rowCount: 0 }) };
  assert.equal(
    (await inspectAdminUpgradeSchema(empty as any)).compatible,
    true,
  );
  assert.equal(
    (await inspectAdminUpgradeSchema(empty as any, true)).compatible,
    false,
  );
  const columns = Object.entries(upgradeColumns).flatMap(([table, fields]) =>
    Object.entries(fields).map(([column, type]) => ({
      table_name: table,
      column_name: column,
      udt_name: type.replace(/\?$/, ""),
      is_nullable: type.endsWith("?") ? "YES" : "NO",
    })),
  );
  const constraints: any[] = [
    ...Object.entries({
      admin_owner: "singleton",
      admin_account_tokens: "token_hash",
      admin_notification_state: "singleton",
      admin_delivery_outbox: "id",
    }).map(([table, column]) => ({
      table_name: table,
      contype: "p",
      columns: [column],
    })),
    {
      table_name: "admin_delivery_outbox",
      contype: "u",
      columns: ["dedupe_key"],
    },
  ];
  for (const table of ["admin_owner", "admin_notification_state"])
    constraints.push({
      table_name: table,
      contype: "c",
      convalidated: true,
      definition: "CHECK (singleton)",
    });
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
  ] as const)
    constraints.push({
      table_name: table,
      contype: "c",
      convalidated: true,
      definition: `CHECK ((${column} = ANY (ARRAY[${values.map((v) => "'" + v + "'::text").join(",")}]))))`,
    });
  let exposed = false;
  const fake = {
    query: async (sql: string) =>
      sql.includes("admin upgrade schema")
        ? { rows: columns }
        : sql.includes("admin upgrade constraints")
          ? { rows: constraints }
          : sql.includes("admin upgrade RLS")
            ? {
                rows: Object.keys(upgradeColumns).map((relname) => ({
                  relname,
                  relrowsecurity: true,
                })),
              }
            : { rows: exposed ? [{}] : [], rowCount: exposed ? 1 : 0 },
  };
  assert.equal(
    (await inspectAdminUpgradeSchema(fake as any, true)).compatible,
    true,
  );
  columns.find(
    (c) => c.table_name === "admin_owner" && c.column_name === "password_hash",
  )!.is_nullable = "YES";
  assert.equal(
    (await inspectAdminUpgradeSchema(fake as any, true)).compatible,
    false,
  );
  columns.find(
    (c) => c.table_name === "admin_owner" && c.column_name === "password_hash",
  )!.is_nullable = "NO";
  exposed = true;
  assert.equal(
    (await inspectAdminUpgradeSchema(fake as any, true)).compatible,
    false,
  );
});

test("Shared notification watermarks remain monotone across devices and count late commits independently of created_at", async (t) => {
  const memory = adminMemory(null),
    cfg = loadConfig({
      NODE_ENV: "test",
      ADMIN_UPGRADE_ENABLED: "true",
      ADMIN_SESSION_SECRET: "private-test-session-secret-".repeat(2),
    });
  let total = 2;
  const original = memory.pool.query.bind(memory.pool),
    query = async (sql: string, values: any[] = []): Promise<any> => {
      if (sql === "SELECT count(*)::int AS total FROM public.bookings")
        return { rows: [{ total }] };
      if (sql.startsWith("SELECT seen_total AS total"))
        return {
          rows: memory.state.seen ? [{ total: memory.state.seen.total }] : [],
        };
      return original(sql, values);
    };
  const app = express();
  app.use(express.json());
  app.use(
    "/api/admin",
    createObservationRouter(
      { query, connect: async () => ({ query, release() {} }) } as any,
      cfg,
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  const mark = async (n: number) => {
    const cursor = encodeBookingCursor(
      {
        at: "2026-10-19T01:00:00.123456Z",
        booking: "EFB-20261019-12345",
        total: n,
      },
      cfg.ADMIN_SESSION_SECRET!,
    );
    const r = await fetch(
      "http://127.0.0.1:" +
        (server.address() as any).port +
        "/api/admin/updates/seen",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cursor }),
      },
    );
    assert.equal(r.status, 200);
    return r.json();
  };
  assert.equal((await mark(2)).unread, 0);
  total = 3;
  assert.equal(
    (await mark(1)).unread,
    1,
    "An older device cannot roll back the shared watermark or consume a late commit",
  );
  assert.equal(memory.state.seen.total, 2);
  assert.equal((await mark(3)).unread, 0);
  assert.equal(memory.state.seen.total, 3);
});
