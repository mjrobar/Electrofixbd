import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type pg from "pg";
import type { Config } from "./config";
import { ApiError } from "./errors";
const derive = promisify(scrypt);
export type Owner = {
  username: string;
  password_hash: string;
  credential_revision: number;
  verified_email?: string | null;
  email_verified_at?: string | null;
};
export const validPasswordHash = (hash: string) =>
  /^[a-zA-Z0-9_-]{8,128}:[a-fA-F0-9]{128}$/.test(hash);
export async function verifyOwnerPassword(password: string, hash: string) {
  if (
    typeof password !== "string" ||
    password.length > 1024 ||
    !validPasswordHash(hash)
  )
    return false;
  const [salt, expected] = hash.split(":");
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
export async function encodeOwnerPassword(password: string) {
  const salt = randomBytes(24).toString("base64url");
  return (
    salt + ":" + ((await derive(password, salt, 64)) as Buffer).toString("hex")
  );
}
export function credentialFingerprint(owner: Owner, config: Config) {
  // revision zero exactly preserves the legacy configured hash/session format.
  return createHmac("sha256", config.ADMIN_SESSION_SECRET || "")
    .update(
      owner.username +
        ":" +
        owner.password_hash +
        (owner.credential_revision ? ":" + owner.credential_revision : ""),
    )
    .digest("hex");
}
export async function readOwner(
  db: Pick<pg.Pool, "query">,
  config: Config,
): Promise<Owner> {
  if (config.ADMIN_UPGRADE_ENABLED) {
    const item = (
      await db.query(
        "SELECT username,password_hash,credential_revision,verified_email,email_verified_at FROM public.admin_owner WHERE singleton=true",
      )
    ).rows[0];
    if (item) return item;
    throw new ApiError(
      503,
      "OWNER_NOT_INITIALIZED",
      "Owner storage is enabled but no owner is readable. Review the approved bootstrap and runtime grants; no environment-password fallback was attempted.",
    );
  }
  return {
    username: config.ADMIN_USERNAME || "",
    password_hash: config.ADMIN_PASSWORD_HASH || "",
    credential_revision: 0,
    verified_email: null,
  };
}
export async function lockOwner(db: Pick<pg.Pool, "query">, config: Config) {
  await db.query("SELECT pg_advisory_xact_lock(29001)");
  const owner = await readOwner(db, config);
  return owner;
}
