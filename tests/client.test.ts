import assert from "node:assert/strict";
import { test } from "node:test";
import {
  submitBookingRequest,
  submitContactMessage,
  getLocalBooking,
} from "../src/lib/bookingClient";

test("frontend client never fabricates success on server/network failure", async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
  const payload = {
    customer_name: "Test",
    phone: "01700000000",
    address: "Dhaka test",
    service_id: "srv-general",
  };
  for (const failure of [
    new Response(JSON.stringify({ error: "Please try again later." }), {
      status: 503,
    }),
    new Response("<html>SPA</html>", { status: 200 }),
    new Response("{}", { status: 200 }),
  ]) {
    globalThis.fetch = async () => failure.clone();
    await assert.rejects(submitBookingRequest(payload));
    await assert.rejects(
      submitContactMessage({
        name: "Test",
        phone: "01700000000",
        message: "Test issue",
      }),
    );
  }
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  await assert.rejects(submitBookingRequest(payload));
  await assert.rejects(
    submitContactMessage({
      name: "Test",
      phone: "01700000000",
      message: "Test issue",
    }),
  );
  assert.equal(getLocalBooking("EFB-FAKE"), null);
});
test("frontend client accepts server-confirmed booking/contact shapes", async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        booking: { booking_number: "EFB-20261014-12345" },
      }),
    );
  assert.equal(
    (
      await submitBookingRequest({
        customer_name: "Test",
        phone: "01700000000",
        address: "Dhaka test",
        service_id: "srv-general",
      })
    ).booking_number,
    "EFB-20261014-12345",
  );
  await submitContactMessage({
    name: "Test",
    phone: "01700000000",
    message: "Test issue",
  });
});
