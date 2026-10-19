import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../server/config";
import {
  bookingReceipt,
  whatsappReceiptParameters,
  deliverJob,
  enqueueDelivery,
  openDelivery,
  processDeliveryOnce,
  queueBookingReceipts,
  sealDelivery,
  type DeliveryJob,
} from "../server/admin-delivery";
import { adminMemory } from "./helpers/admin-upgrade-memory";
const key = "12".repeat(32),
  approval = {
    ADMIN_UPGRADE_ENABLED: "true",
    ADMIN_DELIVERY_APPROVAL: "OWNER APPROVED DELIVERY",
    ADMIN_DELIVERY_ENCRYPTION_KEY: key,
    ADMIN_DELIVERY_WORKER_ENABLED: "true",
  };
const emailConfig = () =>
  loadConfig({
    NODE_ENV: "test",
    PUBLIC_ORIGIN: "https://admin.example.invalid",
    ...approval,
    EMAIL_DELIVERY_ENABLED: "true",
    EMAIL_FROM: "sender@example.invalid",
    RESEND_API_KEY: "fake-test-secret",
  });
const waConfig = () =>
  loadConfig({
    NODE_ENV: "test",
    ...approval,
    WHATSAPP_RECEIPTS_ENABLED: "true",
    WHATSAPP_ACCESS_TOKEN: "fake-test-secret",
    WHATSAPP_PHONE_NUMBER_ID: "1234567890",
    WHATSAPP_ADMIN_RECIPIENT: "8801700000000",
    WHATSAPP_RECIPIENT_OPT_IN_AT: "2026-01-01T00:00:00Z",
    WHATSAPP_RECEIPTS_START_AT: "2026-01-02T00:00:00Z",
    WHATSAPP_TEMPLATE_NAME: "approved_test_receipt",
    WHATSAPP_GRAPH_VERSION: "v23.0",
  });
function job(channel: "email" | "whatsapp", payload: any): DeliveryJob {
  const id = randomUUID();
  return {
    id,
    channel,
    dedupe_key: "fixture",
    payload: sealDelivery(payload, key, id, channel),
    attempts: 1,
    expires_at: new Date(Date.now() + 600000).toISOString(),
  };
}
test("Encrypted queue envelopes bind to job/channel, resist tampering and never store plaintext email tokens or receipt PII", () => {
  const j = job("email", {
    to: "owner@example.invalid",
    text: "secret-single-use-token",
  });
  assert.equal(j.payload.includes("owner@"), false);
  assert.equal(j.payload.includes("secret-single-use-token"), false);
  assert.equal(
    openDelivery(j.payload, key, j.id, j.channel).text,
    "secret-single-use-token",
  );
  assert.throws(() => openDelivery(j.payload, key, randomUUID(), j.channel));
  assert.throws(() => openDelivery(j.payload, key, j.id, "whatsapp"));
  assert.throws(() =>
    openDelivery(j.payload, "34".repeat(32), j.id, j.channel),
  );
});
test("Delivery cannot enable without explicit approval, secure key, verified sender or complete WhatsApp opt-in/template settings", () => {
  assert.throws(() =>
    loadConfig({ NODE_ENV: "test", EMAIL_DELIVERY_ENABLED: "true" }),
  );
  assert.throws(() =>
    loadConfig({
      NODE_ENV: "test",
      ...approval,
      WHATSAPP_RECEIPTS_ENABLED: "true",
    }),
  );
  assert.throws(() =>
    loadConfig({
      NODE_ENV: "test",
      ...approval,
      EMAIL_DELIVERY_ENABLED: "true",
      EMAIL_FROM: "\r\nInjected",
      RESEND_API_KEY: "fake",
      PUBLIC_ORIGIN: "https://admin.example.invalid",
    }),
  );
  assert.equal(
    loadConfig({ NODE_ENV: "test" }).WHATSAPP_RECEIPTS_ENABLED,
    false,
  );
});
test("Provider adapters distinguish acceptance, permanent failure, retry and ambiguous WhatsApp transport without leaking raw errors", async () => {
  const e = job("email", {
      to: "owner@example.invalid",
      subject: "Test",
      text: "Private fixture",
    }),
    w = job("whatsapp", { parameters: Array(8).fill("Synthetic receipt") });
  let calls = 0;
  const capture: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), "https://api.resend.com/emails");
    assert.equal((init!.headers as any)["Idempotency-Key"], e.id);
    assert.equal(init!.redirect, "error");
    return new Response(JSON.stringify({ id: "email-test-accepted" }), {
      status: 200,
    });
  };
  assert.equal((await deliverJob(e, emailConfig(), capture)).state, "sent");
  assert.equal(calls, 1);
  assert.equal(
    (
      await deliverJob(
        e,
        emailConfig(),
        async () => new Response("", { status: 429 }),
      )
    ).state,
    "retry",
  );
  assert.equal(
    (
      await deliverJob(
        e,
        emailConfig(),
        async () => new Response("", { status: 400 }),
      )
    ).state,
    "failed",
  );
  const ambiguous = await deliverJob(w, waConfig(), async () => {
    throw Error("provider-private-body-and-phone");
  });
  assert.deepEqual(ambiguous, {
    state: "uncertain",
    code: "TRANSPORT_UNCONFIRMED",
  });
  assert.equal(
    (
      await deliverJob(
        w,
        waConfig(),
        async () => new Response("", { status: 503 }),
      )
    ).state,
    "uncertain",
  );
  assert.equal(
    (
      await deliverJob(w, waConfig(), async (input, init) => {
        assert.match(
          String(input),
          /^https:\/\/graph.facebook.com\/v23.0\/1234567890\/messages$/,
        );
        const body = JSON.parse(String(init!.body));
        assert.equal(body.to, "8801700000000");
        assert.equal(body.type, "template");
        return new Response(
          JSON.stringify({ messages: [{ id: "wa-test-accepted" }] }),
        );
      })
    ).state,
    "sent",
  );
  assert.equal(
    (
      await deliverJob(
        { ...e, expires_at: "2000-01-01T00:00:00Z" },
        emailConfig(),
        capture,
      )
    ).code,
    "EXPIRED",
  );
  assert.equal(calls, 1);
});
test("Queue idempotence, atomic claim, bounded retries and crash handling operate independently of booking persistence (memory only)", async () => {
  const db = adminMemory(null),
    config = emailConfig(),
    expiry = new Date(Date.now() + 600000).toISOString();
  await enqueueDelivery(
    db.pool,
    config,
    "email",
    "dedupe-fixture",
    { to: "owner@example.invalid", subject: "Test", text: "Private" },
    expiry,
  );
  await enqueueDelivery(
    db.pool,
    config,
    "email",
    "dedupe-fixture",
    { text: "Different" },
    expiry,
  );
  assert.equal(db.state.jobs.size, 1);
  const sent = await processDeliveryOnce(
    db.pool,
    config,
    async () => new Response(JSON.stringify({ id: "accepted-test" })),
  );
  assert.equal(sent!.state, "sent");
  assert.equal([...db.state.jobs.values()][0].payload, null);
  assert.equal(
    await processDeliveryOnce(db.pool, config, async () => {
      throw Error("No provider call expected");
    }),
    null,
  );
  await enqueueDelivery(
    db.pool,
    config,
    "email",
    "failure-fixture",
    { to: "owner@example.invalid", subject: "Test", text: "Private" },
    expiry,
  );
  const failure = [...db.state.jobs.values()].at(-1)!;
  for (let i = 0; i < 5; i++) {
    failure.available_at = 0;
    await processDeliveryOnce(
      db.pool,
      config,
      async () => new Response("", { status: 503 }),
    );
  }
  assert.equal(failure.attempts, 5);
  assert.equal(failure.state, "failed");
  assert.equal(failure.last_code, "RETRY_LIMIT");
  assert.equal(failure.payload, null);
  const wa = waConfig();
  await enqueueDelivery(
    db.pool,
    wa,
    "whatsapp",
    "wa-crash",
    { parameters: Array(8).fill("Synthetic receipt") },
    expiry,
  );
  const crash = [...db.state.jobs.values()].at(-1)!;
  crash.state = "processing";
  crash.attempts = 1;
  crash.locked_at = Date.now() - 180000;
  await processDeliveryOnce(db.pool, wa, async () => {
    throw Error("No provider call expected");
  });
  assert.equal(crash.state, "uncertain");
  assert.equal(
    db.queries.some((q) =>
      /^(?:UPDATE|INSERT INTO|DELETE FROM) (?:public\.)?(?:bookings|contact_messages)\b/.test(
        q.sql,
      ),
    ),
    false,
    "Delivery must never mutate customer records",
  );
  assert.ok(db.state.audits.length >= 6);
});
test("Receipts preserve the booking number/time/status, exclude internal notes, and share customer details only explicitly", () => {
  const b = {
    booking_number: "EFB-20261019-12345",
    service_name: "Synthetic service",
    created_at: "2026-10-18T18:00:00Z",
    status: "pending",
    customer_name: "Synthetic customer",
    phone: "01700000000",
    address: "Synthetic address",
    notes: "Customer note",
    admin_notes: "PRIVATE ADMIN SECRET",
  };
  const safe = bookingReceipt(b);
  assert.match(safe, /EFB-20261019-12345/);
  assert.match(safe, /(?:19 October 2026|October 19, 2026)/);
  assert.equal(safe.includes(b.phone), false);
  assert.equal(safe.includes(b.address), false);
  const full = bookingReceipt(b, true);
  assert.ok(full.includes(b.phone) && full.includes(b.notes));
  assert.equal(full.includes(b.admin_notes), false);
  const params = whatsappReceiptParameters(
    {
      ...b,
      address: "Line one\nLine two\t" + "x".repeat(500),
      notes: "Note\n" + "x".repeat(500),
    },
    true,
  );
  assert.equal(params.length, 8);
  assert.ok(params.every((v) => !/[\r\n\t]/.test(v) && v.length <= 180));
  assert.ok(params.join("").length < 700);
});
test("Disabled receipt scanning performs no database reads or writes", async () => {
  let called = false;
  const fake = {
    connect: async () => {
      called = true;
      throw Error("must not connect");
    },
  };
  assert.equal(
    await queueBookingReceipts(fake as any, loadConfig({ NODE_ENV: "test" })),
    0,
  );
  assert.equal(called, false);
});

test("Concurrent receipt scanning can only enqueue one receipt per booking and reports actual inserts", async () => {
  const memory = adminMemory(null),
    config = waConfig(),
    baseQuery = memory.pool.query.bind(memory.pool);
  const booking = {
    booking_number: "EFB-20261019-12345",
    service_name: "Synthetic service",
    created_at: "2026-10-19T00:00:00Z",
    status: "pending",
    customer_name: "Synthetic",
    phone: "01700000000",
    address: "Synthetic",
    notes: "",
  };
  const query = async (sql: string, values: any[] = []) =>
    sql.startsWith("SELECT b.booking_number")
      ? { rows: [booking] }
      : baseQuery(sql, values);
  const pool = { query, connect: async () => ({ query, release() {} }) } as any;
  assert.equal(await queueBookingReceipts(pool, config), 1);
  assert.equal(await queueBookingReceipts(pool, config), 0);
  assert.equal(memory.state.jobs.size, 1);
  const job = [...memory.state.jobs.values()][0];
  assert.equal(
    openDelivery(job.payload, key, job.id, "whatsapp")
      .parameters.join(" ")
      .includes(booking.phone),
    false,
  );
});
