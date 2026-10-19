// Explicit approved Secondary target only; no DATABASE_URL fallback and no writes.
import pg from "pg";
import { writeFile } from "node:fs/promises";
import {
  assertSecondaryTarget,
  secondaryReport,
} from "./secondary-content-acceptance";
const target = assertSecondaryTarget(process.env),
  output = process.argv[2];
if (!output) throw Error("Pass a new private backup filename.");
const pool = new pg.Pool({
  connectionString: target,
  max: 1,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
  options: "-c default_transaction_read_only=on",
});
try {
  const report = await secondaryReport(pool, false, true);
  if (!report.compatible)
    throw Error(
      "Secondary schema/migration validation failed. Run the read-only preflight and review its report; no backup approval is issued.",
    );
  const preview = report.preview;
  await writeFile(output, JSON.stringify(preview, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      output,
      backup_digest: preview.backup_digest,
      preview_digest: preview.preview_digest,
      totals: preview.totals,
    }),
  );
} finally {
  await pool.end();
}
