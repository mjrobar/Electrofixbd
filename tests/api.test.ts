import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { test } from "node:test";
import { createApp } from "../server/app";
import { loadConfig } from "../server/config";
import { ApiError } from "../server/errors";
import type { Store } from "../server/store";
import { createVercelHandler } from "../server/vercel";

const booking = {
  booking_number: "EFB-20261014-12345",
  customer_name: "Test Customer",
  phone: "01700000000",
  address: "Dhaka test address",
  notes: "private",
  service_name: "General Appliance Servicing",
  status: "pending",
  created_at: "2026-10-14T00:00:00.000Z",
};
const input = {
  customer_name: " Test Customer ",
  phone: "+880 1700-000000",
  address: "Dhaka test address",
  service_id: "srv-general",
};
// Injected test fixture only: production runtime always uses the PostgreSQL store.
function fixture(overrides: Partial<Store> = {}): Store {
  return {
    createBooking: async () => booking,
    getBooking: async () => booking,
    createContact: async () => {},
    ready: async () => true,
    close: async () => {},
    ...overrides,
  };
}
async function serve(
  store: Store,
  adapter = false,
  parsedBody = false,
  limit = 100,
) {
  const app = createApp({
    config: loadConfig({
      NODE_ENV: "test",
      PUBLIC_ORIGIN: "https://electrofix.test",
      API_RATE_LIMIT: String(limit),
    }),
    store,
  });
  const handler = adapter ? createVercelHandler(() => app) : app;
  const server = createServer(async (req, res) => {
    if (parsedBody && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      (req as IncomingMessage & { body: unknown }).body = JSON.parse(
        Buffer.concat(chunks).toString(),
      );
    }
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return {
    base,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
const post = (body: unknown, extra: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...extra },
  body: JSON.stringify(body),
});
for (const adapter of [false, true]) {
  test(`${adapter ? "Vercel adapter" : "Express"} API contracts`, async (t) => {
    let written: unknown;
    const runtime = await serve(
      fixture({
        createBooking: async (value) => {
          written = value;
          return booking;
        },
      }),
      adapter,
    );
    t.after(runtime.close);
    const request = (route: string, options?: RequestInit) =>
      fetch(runtime.base + route, options);
    const health = await request("/api/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");
    assert.equal(health.headers.get("x-powered-by"), null);
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.ok(health.headers.get("x-request-id"));
    assert.equal((await (await request("/api/status")).json()).ready, true);
    const created = await request("/api/bookings", post(input));
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.success, true);
    assert.equal(body.booking.booking_number, booking.booking_number);
    assert.equal((written as { phone: string }).phone, "8801700000000");
    assert.equal(
      (written as { customer_name: string }).customer_name,
      "Test Customer",
    );
    for (const route of [
      "/api/bookings/" + booking.booking_number,
      "/api/bookings?bookingNumber=" + booking.booking_number,
      "/api/bookings?number=" + booking.booking_number,
    ]) {
      const found = await request(route);
      assert.equal(found.status, 200);
      const publicBody = (await found.json()).booking;
      assert.deepEqual(Object.keys(publicBody).sort(), [
        "booking_number",
        "created_at",
        "service_name",
        "status",
      ]);
    }
    assert.equal(
      (
        await request(
          "/api/contact",
          post({
            name: "Test",
            phone: "01700000000",
            message: "Test appliance issue",
          }),
        )
      ).status,
      200,
    );
    for (const [route, status, options] of [
      ["/api/unknown", 404, undefined],
      ["/api", 404, undefined],
      [
        "/api/health",
        405,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      ],
      [
        "/api/bookings",
        405,
        { method: "DELETE", headers: { "content-type": "application/json" } },
      ],
      ["/api/contact", 405, undefined],
      ["/api/bookings", 400, undefined],
      ["/api/bookings/not-a-number", 400, undefined],
      ["/api/bookings/%ZZ", 400, undefined],
      ["/api/bookings", 400, post({ ...input, phone: "lettersletters" })],
      ["/api/bookings", 400, post({ ...input, service_id: { bad: true } })],
      ["/api/bookings", 400, post({ ...input, customer_name: "x" })],
      ["/api/bookings", 400, post({ ...input, unknown: true })],
      [
        "/api/contact",
        400,
        post({ name: "Test", phone: "01700000000", message: "tiny" }),
      ],
      [
        "/api/contact",
        415,
        {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "bad",
        },
      ],
      [
        "/api/bookings",
        400,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{broken",
        },
      ],
      [
        "/api/contact",
        413,
        post({
          name: "Test",
          phone: "01700000000",
          message: "x".repeat(17000),
        }),
      ],
      ["/api/bookings", 403, post(input, { origin: "https://attacker.test" })],
    ] as [string, number, RequestInit | undefined][]) {
      const result = await request(route, options);
      assert.equal(result.status, status, route);
      const error = await result.json();
      assert.equal(typeof error.error, "string");
      assert.equal(typeof error.code, "string");
      assert.equal(typeof error.request_id, "string");
    }
    assert.equal(
      (
        await request(
          "/api/bookings",
          post(input, { origin: "https://electrofix.test" }),
        )
      ).status,
      201,
    );
    const options = await request("/api/contact", { method: "OPTIONS" });
    assert.equal(options.status, 204);
    assert.match(options.headers.get("allow")!, /POST/);
    assert.equal(
      (await request("/api/health", { method: "HEAD" })).status,
      200,
    );
  });
}
test("Vercel pre-parsed JSON has the same validation and body limits", async (t) => {
  const runtime = await serve(fixture(), true, true);
  t.after(runtime.close);
  assert.equal(
    (await fetch(runtime.base + "/api/bookings", post(input))).status,
    201,
  );
  assert.equal(
    (
      await fetch(
        runtime.base + "/api/contact",
        post({
          name: "Test",
          phone: "01700000000",
          message: "x".repeat(17000),
        }),
      )
    ).status,
    413,
  );
});
test("database failures never confirm submissions or disclose raw errors", async (t) => {
  const failure = new ApiError(
    503,
    "STORAGE_UNAVAILABLE",
    "Please try again later. Your request has not been confirmed.",
  );
  const runtime = await serve(
    fixture({
      createBooking: async () => {
        throw failure;
      },
      createContact: async () => {
        throw failure;
      },
      getBooking: async () => {
        throw failure;
      },
      ready: async () => false,
    }),
  );
  t.after(runtime.close);
  for (const [route, options] of [
    ["/api/bookings", post(input)],
    [
      "/api/contact",
      post({ name: "Test", phone: "01700000000", message: "Test issue" }),
    ],
    ["/api/bookings/" + booking.booking_number, undefined],
    ["/api/status", undefined],
  ] as const) {
    const res = await fetch(runtime.base + route, options);
    assert.equal(res.status, 503);
    assert.notEqual((await res.json()).success, true);
  }
});
test("internal failures are redacted", async (t) => {
  const runtime = await serve(
    fixture({
      createBooking: async () => {
        throw new Error("postgres://secret/customer/private");
      },
    }),
  );
  t.after(runtime.close);
  const res = await fetch(runtime.base + "/api/bookings", post(input));
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.doesNotMatch(text, /secret|customer\/private/);
});
test("missing bookings return 404", async (t) => {
  const runtime = await serve(fixture({ getBooking: async () => null }));
  t.after(runtime.close);
  assert.equal(
    (await fetch(runtime.base + "/api/bookings/" + booking.booking_number))
      .status,
    404,
  );
});
test("rate limits return structured 429", async (t) => {
  const runtime = await serve(fixture(), false, false, 1);
  t.after(runtime.close);
  await fetch(runtime.base + "/api/health");
  const result = await fetch(runtime.base + "/api/health");
  assert.equal(result.status, 429);
  assert.equal((await result.json()).code, "RATE_LIMITED");
});
test("configuration is validated without exposing credentials", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production" }),
    /Production requires/,
  );
  assert.throws(() => loadConfig({ PORT: "invalid" }), /PORT/);
  assert.throws(() => loadConfig({ TRUST_PROXY: "true" }), /TRUST_PROXY/);
  assert.throws(
    () => loadConfig({ PUBLIC_ORIGIN: "https://example.test/a" }),
    /origin/,
  );
  assert.throws(
    () =>
      loadConfig({
        DATABASE_URL: "postgresql://secret@localhost/db?sslmode=no-verify",
      }),
    (err) => !String(err).includes("secret"),
  );
  assert.equal(
    loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/db",
      PUBLIC_ORIGIN: "https://example.test",
    }).PORT,
    3000,
  );
});

test("Vercel adapter initialization failure returns a sanitized API error", async (t) => {
  const server = createServer(
    createVercelHandler(() => {
      throw new Error("private configuration postgres://secret");
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const result = await fetch(
    `http://127.0.0.1:${(server.address() as { port: number }).port}/api/health`,
  );
  assert.equal(result.status, 503);
  const body = await result.json();
  assert.equal(body.code, "CONFIGURATION_UNAVAILABLE");
  assert.equal(typeof body.request_id, "string");
  assert.doesNotMatch(JSON.stringify(body), /secret|postgres/);
});
