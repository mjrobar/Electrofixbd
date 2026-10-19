/** Explicitly approved operator process, never imported or run by the web app. */
import "dotenv/config";
import pg from "pg";
import { setTimeout as delay } from "node:timers/promises";
import { loadConfig } from "../server/config";
import {
  processDeliveryOnce,
  queueBookingReceipts,
} from "../server/admin-delivery";
import {
  assertAdminOperatorTarget,
  verifyOperatorConnection,
} from "./lib/admin-operator-target";
if (!process.argv.includes("--once") && !process.argv.includes("--watch"))
  throw Error(
    "Choose --once or --watch only after reviewing the delivery runbook and owner approval.",
  );
const url = process.env.ADMIN_WORKER_DATABASE_URL;
if (!url)
  throw Error(
    "Set ADMIN_WORKER_DATABASE_URL explicitly; no application URL fallback.",
  );
const target = assertAdminOperatorTarget(url, process.env),
  config = loadConfig({ ...process.env, DATABASE_URL: url });
if (!config.ADMIN_DELIVERY_WORKER_ENABLED || !config.ADMIN_UPGRADE_ENABLED)
  throw Error("Approved delivery worker is disabled.");
const pool = new pg.Pool({
  connectionString: url,
  max: 2,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
pool.on("error", () => console.error("Delivery database unavailable."));
let stopped = false;
const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
    shutdown.abort();
  });
try {
  await verifyOperatorConnection(pool, target);
  do {
    const queued = await queueBookingReceipts(pool, config);
    if (queued)
      console.log(
        JSON.stringify({ event: "booking_receipts_queued", count: queued }),
      );
    for (let i = 0; i < 25 && !stopped; i++) {
      const result = await processDeliveryOnce(pool, config);
      if (!result) break;
      console.log(
        JSON.stringify({
          id: result.id,
          channel: result.channel,
          state: result.state,
          code: result.code,
        }),
      );
    }
    if (!process.argv.includes("--watch")) break;
    await delay(20000, undefined, { signal: shutdown.signal }).catch(() => {});
  } while (!stopped);
} catch {
  console.error(
    "Delivery worker stopped safely. Review target/configuration, private queue metadata and permissions. No provider payload was logged.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
