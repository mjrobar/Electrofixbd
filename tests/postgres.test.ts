import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { createStore } from "../server/store";
import { loadConfig } from "../server/config";
import { migrate } from "../scripts/migrate";

const url = process.env.TEST_DATABASE_URL;
test(
  "PostgreSQL: migrations, durable writes, restart, concurrency and failed inserts",
  {
    skip: !url
      ? "Set TEST_DATABASE_URL to a disposable local database."
      : false,
  },
  async () => {
    // Never use DATABASE_URL here; refuse remote targets and require explicit test opt-in.
    const parsed = new URL(url!);
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname),
      "Integration tests require a disposable local PostgreSQL database.",
    );
    assert.match(
      parsed.pathname,
      /test/,
      "Test database name must contain test.",
    );
    await migrate(url!);
    await migrate(url!); // Repeatability and migration ledger.
    const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: url });
    let store = createStore(config);
    const testName = `Integration ${randomUUID()}`;
    const input = {
      customer_name: testName,
      phone: "01700000000",
      address: "Dhaka test",
      notes: "test",
      service_id: "srv-general",
      service_name: "Untrusted supplied name",
    };
    let number: string;
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      assert.equal(await store.ready(), true);
      const created = await store.createBooking(input);
      number = created.booking_number;
      assert.match(number, /^EFB-\d{8}-\d{5}$/);
      assert.match(created.created_at, /Z$/);
      assert.equal(created.service_name, "General Appliance Servicing");
      await store.createContact({
        name: testName,
        phone: "01700000000",
        message: "PostgreSQL contact test",
      });
      assert.equal(
        Number(
          (
            await client.query(
              "SELECT count(*) FROM public.contact_messages WHERE name = $1",
              [testName],
            )
          ).rows[0].count,
        ),
        1,
      );
      await store.close();
      store = createStore(config);
      assert.equal((await store.getBooking(number))?.booking_number, number);
      const results = await Promise.all(
        Array.from({ length: 12 }, () => store.createBooking(input)),
      );
      assert.equal(
        new Set(results.map((record) => record.booking_number)).size,
        12,
      );
      await assert.rejects(
        store.createBooking({ ...input, service_id: "missing" }),
        { code: "INVALID_SERVICE" },
      );
      const before = Number(
        (await client.query("SELECT count(*) FROM public.bookings")).rows[0]
          .count,
      );
      await client.query(
        "ALTER TABLE public.bookings ADD CONSTRAINT test_reject_name CHECK (customer_name <> 'Reject Test')",
      );
      try {
        await assert.rejects(
          store.createBooking({ ...input, customer_name: "Reject Test" }),
          { code: "STORAGE_UNAVAILABLE" },
        );
      } finally {
        await client.query(
          "ALTER TABLE public.bookings DROP CONSTRAINT test_reject_name",
        );
      }
      assert.equal(
        Number(
          (await client.query("SELECT count(*) FROM public.bookings")).rows[0]
            .count,
        ),
        before,
      );
      const found = await store.getBooking(number);
      assert.ok(found);
      assert.equal("phone" in found, false);
    } finally {
      await store.close();
      await client.end();
    }
  },
);
test("unconfigured storage is unavailable, with no in-memory success path", async () => {
  const store = createStore(loadConfig({ NODE_ENV: "test" }));
  assert.equal(await store.ready(), false);
  await assert.rejects(
    store.createContact({
      name: "Test",
      phone: "01700000000",
      message: "Test issue",
    }),
    { code: "STORAGE_UNAVAILABLE" },
  );
  await store.close();
});

test(
  "PostgreSQL runtime role needs no schema ownership; missing write rights fail readiness",
  {
    skip: !url
      ? "Set TEST_DATABASE_URL to a disposable local database."
      : false,
  },
  async () => {
    const target = new URL(url!);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
    assert.match(target.pathname, /test/);
    await migrate(url!);
    const operator = new pg.Client({ connectionString: url });
    await operator.connect();
    const role = `efb_test_${randomUUID().replaceAll("-", "")}`;
    let store: ReturnType<typeof createStore> | undefined;
    try {
      await operator.query(`CREATE ROLE ${role} LOGIN`);
      await operator.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await operator.query(
        `GRANT SELECT ON public.services, public.bookings, public.contact_messages, public.works, public.testimonials TO ${role}`,
      );
      target.username = role;
      target.password = "";
      store = createStore(
        loadConfig({ NODE_ENV: "test", DATABASE_URL: target.toString() }),
      );
      assert.equal(await store.ready(), false);
      await operator.query(
        `GRANT INSERT ON public.bookings, public.contact_messages TO ${role}`,
      );
      assert.equal(await store.ready(), true);
      await store.createBooking({
        customer_name: "Restricted Runtime Test",
        phone: "01700000000",
        address: "Dhaka test",
        notes: "",
        service_id: "srv-general",
      });
      await store.createContact({
        name: "Restricted Runtime Test",
        phone: "01700000000",
        message: "Local role test",
      });
    } finally {
      await store?.close();
      await operator.query(`DROP OWNED BY ${role}`);
      await operator.query(`DROP ROLE ${role}`);
      await operator.end();
    }
  },
);
