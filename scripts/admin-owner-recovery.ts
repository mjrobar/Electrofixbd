/** Explicit operator-only bootstrap/reset. No HTTP bypass, migration or auto-run. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadConfig } from "../server/config";
import {
  encodeOwnerPassword,
  validPasswordHash,
} from "../server/admin-identity";
import { transaction } from "../server/db/transaction";
import {
  assertAdminOperatorTarget,
  verifyOperatorConnection,
} from "./lib/admin-operator-target";
const bootstrap = process.argv.includes("--bootstrap"),
  reset = process.argv.includes("--reset");
if (
  bootstrap === reset ||
  !process.argv.includes("--backup-reviewed") ||
  process.env.ADMIN_OWNER_RECOVERY_APPROVAL !==
    "RESET SINGLE OWNER PASSWORD AND REVOKE ALL SESSIONS"
)
  throw Error(
    "Choose bootstrap/reset with a reviewed backup and explicit owner-recovery approval.",
  );
const url = process.env.ADMIN_OWNER_DATABASE_URL;
if (!url)
  throw Error(
    "Set ADMIN_OWNER_DATABASE_URL explicitly; no application URL fallback.",
  );
const target = assertAdminOperatorTarget(url, process.env),
  config = loadConfig({
    ...process.env,
    DATABASE_URL: url,
    ADMIN_UPGRADE_ENABLED: "true",
  });
if (!config.ADMIN_USERNAME || config.ADMIN_USERNAME.length > 150)
  throw Error("Set the expected ADMIN_USERNAME.");
let hash = config.ADMIN_PASSWORD_HASH || "";
if (reset) {
  if (!process.env.ADMIN_NEW_PASSWORD_FILE)
    throw Error(
      "Provide a private ADMIN_NEW_PASSWORD_FILE, never a command-line password.",
    );
  const password = (
    await readFile(process.env.ADMIN_NEW_PASSWORD_FILE, "utf8")
  ).replace(/\r?\n$/, "");
  if (
    password.trim().length < 12 ||
    password.length > 128 ||
    /[\u0000-\u001f]/.test(password)
  )
    throw Error(
      "New password must contain 12–128 characters without control characters.",
    );
  hash = await encodeOwnerPassword(password);
}
if (!validPasswordHash(hash))
  throw Error("Bootstrap requires the existing valid scrypt hash.");
const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
try {
  await verifyOperatorConnection(pool, target);
  await transaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(29001)");
    const owner = (
      await db.query(
        "SELECT username FROM public.admin_owner WHERE singleton=true FOR UPDATE",
      )
    ).rows[0];
    if (owner && owner.username !== config.ADMIN_USERNAME)
      throw Error("Existing owner identity differs. No overwrite is allowed.");
    if (bootstrap && owner)
      throw Error(
        "Owner is already initialized; bootstrap will not overwrite it.",
      );
    if (!owner)
      await db.query(
        "INSERT INTO public.admin_owner(singleton,username,password_hash) VALUES(true,$1,$2)",
        [config.ADMIN_USERNAME, hash],
      );
    else
      await db.query(
        "UPDATE public.admin_owner SET password_hash=$1,credential_revision=credential_revision+1,updated_at=now() WHERE singleton=true",
        [hash],
      );
    await db.query(
      "UPDATE public.admin_account_tokens SET used_at=now() WHERE used_at IS NULL",
    );
    await db.query(
      "UPDATE public.admin_delivery_outbox SET state='cancelled',payload=NULL,updated_at=now() WHERE channel='email' AND dedupe_key LIKE 'owner-action:%' AND state IN ('queued','retry')",
    );
    await db.query("DELETE FROM public.admin_sessions");
    await db.query(
      "INSERT INTO public.admin_audit(entity,record_id,action) VALUES('admin_account','owner',$1)",
      [
        bootstrap
          ? "operator_bootstrap_sessions_revoked"
          : "operator_reset_sessions_revoked",
      ],
    );
  });
  console.log(
    "Owner operation completed; all sessions revoked. No email was marked verified. Securely remove the temporary password file and review the deployment configuration.",
  );
} catch {
  console.error(
    "Owner operation failed safely. Verify the reviewed target, schema/grants and owner identity. No credentials or raw database error were logged.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
