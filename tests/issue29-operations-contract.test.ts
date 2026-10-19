import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import { createOperationsRouter } from "../server/admin-operations";
import { errorHandler } from "../server/errors";
test("Existing booking/contact list and mutation contracts retain statuses, transitions, validation, revision conflicts and private notes (memory protocol)", async (t) => {
  const booking = {
      booking_number: "EFB-20261019-12345",
      customer_name: "Synthetic",
      phone: "01700000000",
      address: "Synthetic address",
      service_name: "Fixture service",
      status: "pending",
      notes: "Customer note",
      admin_notes: "",
      revision: 4,
      created_at: "2026-10-19T00:00:00Z",
    },
    contact = {
      id: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
      name: "Synthetic",
      phone: "01700000000",
      message: "Preserved original message",
      status: "new",
      admin_notes: "",
      revision: 2,
      created_at: "2026-10-19T00:00:00Z",
    },
    queries: { sql: string; values: any[] }[] = [];
  const before = structuredClone({ booking, contact });
  const client = {
    release() {},
    async query(sql: string, values: any[] = []): Promise<any> {
      queries.push({ sql, values });
      assert.equal(
        Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))),
        values.length,
      );
      if (/^(BEGIN|SET|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
      const row = sql.includes("public.contact_messages") ? contact : booking;
      if (sql.startsWith("SELECT count")) return { rows: [{ total: 1 }] };
      if (sql.startsWith("SELECT")) return { rows: [structuredClone(row)] };
      if (sql.startsWith("UPDATE")) {
        row.status = values[0];
        row.admin_notes = values[1];
        row.revision++;
        return { rows: [structuredClone(row)] };
      }
      throw Error("Unexpected SQL");
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api/admin",
    createOperationsRouter({
      query: client.query,
      connect: async () => client,
    } as any),
  );
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  const base =
    "http://127.0.0.1:" + (server.address() as any).port + "/api/admin";
  async function patch(path: string, body: unknown) {
    const r = await fetch(base + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }
  const list = await (
    await fetch(base + "/bookings?q=%25_&status=pending&offset=0")
  ).json();
  assert.deepEqual(Object.keys(list).sort(), ["items", "pagination", "total"]);
  assert.equal(list.pagination.limit, 30);
  assert.equal(list.pagination.offset, 0);
  assert.ok(queries.some((q) => q.values[1] === "%\\%\\_%"));
  const id = "/bookings/" + booking.booking_number;
  assert.equal(
    (await patch(id, { revision: 4, status: "completed" })).status,
    409,
  );
  assert.equal(
    (await patch(id, { revision: 3, status: "confirmed" })).status,
    409,
  );
  assert.equal(
    (await patch(id, { revision: 4, status: "invented" })).status,
    400,
  );
  assert.equal(
    (
      await patch(id, {
        revision: 4,
        status: "confirmed",
        customer_name: "Forbidden edit",
      })
    ).status,
    400,
  );
  assert.equal(queries.filter((q) => q.sql.startsWith("UPDATE")).length, 0);
  const saved = await patch(id, {
    revision: 4,
    status: "confirmed",
    admin_notes: "Internal follow-up",
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.item.revision, 5);
  assert.equal(saved.body.item.status, "confirmed");
  const replied = await patch("/contacts/" + contact.id, {
    revision: 2,
    status: "replied",
    admin_notes: "Contacted manually",
  });
  assert.equal(replied.status, 200);
  assert.equal(replied.body.item.status, "replied");
  for (const [key, value] of Object.entries(before.booking))
    if (!["status", "admin_notes", "revision"].includes(key))
      assert.equal((booking as any)[key], value);
  for (const [key, value] of Object.entries(before.contact))
    if (!["status", "admin_notes", "revision"].includes(key))
      assert.equal((contact as any)[key], value);
  assert.equal(queries.filter((q) => q.sql.startsWith("UPDATE")).length, 2);
  assert.ok(
    queries
      .filter((q) => q.sql.startsWith("UPDATE"))
      .every((q) => q.sql.includes("SET status=$1,admin_notes=$2")),
  );
});
