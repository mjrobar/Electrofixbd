import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAdminPoller,
  bookingAlerts,
  readCheckpoint,
  type BookingFeed,
} from "../src/admin/live-data";
import {
  bdDate,
  bdDay,
  bookingNextStatuses,
} from "../src/admin/operations-model";
import { bookingTransitions } from "../server/admin-operations";
import {
  decodeBookingCursor,
  encodeBookingCursor,
} from "../server/admin-observation";
import { assertAdminOperatorTarget } from "../scripts/lib/admin-operator-target";
test("20-second scheduler pauses safely, never overlaps, aborts and cleans up (mocked timers)", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let allowed = true,
    calls = 0,
    finish: () => void = () => {},
    signal: AbortSignal | undefined;
  const poll = createAdminPoller({
    allowed: () => allowed,
    task: async (s) => {
      calls++;
      signal = s;
      await new Promise<void>((r) => {
        finish = r;
      });
    },
  });
  t.mock.timers.tick(19999);
  assert.equal(calls, 0);
  t.mock.timers.tick(1);
  assert.equal(calls, 1);
  t.mock.timers.tick(40000);
  assert.equal(calls, 1, "Pending request must not overlap");
  finish();
  await Promise.resolve();
  await Promise.resolve();
  allowed = false;
  t.mock.timers.tick(60000);
  assert.equal(calls, 1, "Hidden/offline/modal/dirty gates prevent requests");
  allowed = true;
  t.mock.timers.tick(20000);
  assert.equal(calls, 2);
  poll.stop();
  assert.equal(signal!.aborted, true);
  finish();
  await Promise.resolve();
  t.mock.timers.tick(60000);
  assert.equal(calls, 2);
  await poll.tick();
  assert.equal(calls, 2);
});
test("Notification baseline, refresh, reload and cross-tab checkpoints do not duplicate alerts or persist customer PII", () => {
  const one = {
      booking_number: "EFB-20261019-12345",
      created_at: "2026-10-19T01:00:00.000001Z",
    },
    two = {
      booking_number: "EFB-20261019-12346",
      created_at: "2026-10-19T01:00:00.000002Z",
    };
  const feed = { items: [one], unread: 1 } as BookingFeed,
    first = bookingAlerts(readCheckpoint(null), feed);
  assert.equal(first.fresh.length, 0);
  const next = bookingAlerts(first.checkpoint, { ...feed, items: [two, one] });
  assert.equal(next.fresh.length, 1);
  assert.equal(next.fresh[0].booking_number, two.booking_number);
  const resumed = readCheckpoint(JSON.stringify(next.checkpoint));
  assert.equal(
    bookingAlerts(resumed, { ...feed, items: [two, one] }).fresh.length,
    0,
  );
  assert.deepEqual(Object.keys(resumed).sort(), ["ids", "initialized"]);
  assert.deepEqual(
    readCheckpoint('{"initialized":true,"ids":["<script>private"]}'),
    { initialized: false, ids: [] },
  );
});
test("Bangladesh dates cross local midnight at 18:00 UTC, without browser timezone or seasonal DST drift", () => {
  assert.equal(bdDay(new Date("2026-01-31T17:59:59Z")), "2026-01-31");
  assert.equal(bdDay(new Date("2026-01-31T18:00:00Z")), "2026-02-01");
  assert.equal(bdDay(new Date("2026-07-31T18:00:00Z")), "2026-08-01");
  assert.match(bdDate("2026-10-18T18:00:00Z"), /19/);
  assert.deepEqual(bookingNextStatuses, bookingTransitions);
});
test("Signed notification cursors preserve microseconds and reject tampering/invalid shapes", () => {
  const secret = "private-test-secret",
    value = {
      at: "2026-10-19T00:00:00.123456Z",
      booking: "EFB-20261019-12345",
      total: 1,
    },
    signed = encodeBookingCursor(value, secret);
  assert.deepEqual(decodeBookingCursor(signed, secret), value);
  assert.throws(() => decodeBookingCursor(signed + "a", secret));
  assert.throws(() => decodeBookingCursor(signed, "other-secret"));
  assert.throws(() => decodeBookingCursor("a.b", secret));
});
test("Operator commands cannot inherit a URL or select Primary/mismatched identities", () => {
  const secondary = "abcdefghijklmnopqrst",
    primary = "tsrqponmlkjihgfedcba",
    url = `postgresql://postgres.${secondary}:hidden@aws-0.example.pooler.supabase.com/postgres?sslmode=verify-full`;
  const env = {
    SECONDARY_PROJECT_NAME: "Electrofixbd.Test Project",
    SECONDARY_PROJECT_REF: secondary,
    PRIMARY_PROJECT_REF: primary,
    ADMIN_OPERATOR_EXPECTED_HOST: "aws-0.example.pooler.supabase.com",
    ADMIN_OPERATOR_EXPECTED_DATABASE: "postgres",
    ADMIN_OPERATOR_EXPECTED_USER: "postgres." + secondary,
    ADMIN_OPERATOR_TARGET_LABEL: "OWNER VERIFIED SECONDARY",
  };
  assert.equal(assertAdminOperatorTarget(url, env).database, "postgres");
  assert.throws(() =>
    assertAdminOperatorTarget(url.replace(secondary, primary), env),
  );
  assert.throws(() => assertAdminOperatorTarget(url, {}));
  assert.throws(() =>
    assertAdminOperatorTarget(url.replace("verify-full", "no-verify"), env),
  );
});

test("A stale browser read cursor after session-secret rotation is discarded once without bypassing other errors", async () => {
  const { fetchBookingFeed } = await import("../src/admin/live-data");
  const paths: string[] = [];
  let discarded = 0;
  const feed = { items: [], unread: 0 } as unknown as BookingFeed;
  const result = await fetchBookingFeed(
    async (path) => {
      paths.push(path);
      if (path.includes("?"))
        throw Object.assign(Error("stale"), {
          status: 400,
          code: "INVALID_CURSOR",
        });
      return feed;
    },
    "old-signed-cursor",
    () => discarded++,
  );
  assert.equal(result, feed);
  assert.equal(discarded, 1);
  assert.deepEqual(paths, ["/updates?seen=old-signed-cursor", "/updates"]);
  await assert.rejects(
    fetchBookingFeed(
      async () => {
        throw Object.assign(Error("Forbidden"), { status: 403 });
      },
      "old",
      () => {
        throw Error("must not bypass");
      },
    ),
  );
});

test("Count checkpoints detect bursts larger than the visible feed and late commits with older timestamps", () => {
  const item = {
      booking_number: "EFB-20261019-12345",
      created_at: "2026-10-19T01:00:00Z",
    },
    feed = { items: [item], total: 50 } as BookingFeed;
  const first = bookingAlerts(readCheckpoint(null), feed);
  assert.equal(first.count, 0);
  const burst = bookingAlerts(first.checkpoint, { ...feed, total: 80 });
  assert.equal(burst.fresh.length, 0);
  assert.equal(burst.count, 30);
  const late = bookingAlerts(burst.checkpoint, { ...feed, total: 81 });
  assert.equal(late.count, 1);
  assert.equal(bookingAlerts(late.checkpoint, { ...feed, total: 81 }).count, 0);
});
