import { createHmac, randomBytes } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type pg from "pg";
import type { Config } from "./config";
import { ApiError } from "./errors";
import { parse, route, transaction } from "./admin-utils";
import {
  credentialFingerprint,
  encodeOwnerPassword,
  lockOwner,
  readOwner,
  verifyOwnerPassword,
} from "./admin-identity";
import { emailReady, enqueueDelivery } from "./admin-delivery";
const newPassword = z
  .string()
  .min(12)
  .max(128)
  .refine(
    (v) => v.trim().length >= 12,
    "Use at least 12 characters apart from leading/trailing spaces.",
  )
  .refine(
    (v) => !/[\u0000-\u001f]/.test(v),
    "Use a passphrase without control characters.",
  );
const currentPassword = z.string().min(1).max(1024);
const token = z.string().regex(/^[a-f0-9]{64}$/);
export const accountTokenHash = (value: string, config: Config) =>
  createHmac("sha256", config.ADMIN_SESSION_SECRET || "")
    .update("owner-action:" + value)
    .digest("hex");
const throttle = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many account attempts. Try again in 15 minutes." },
  });
function requireStorage(config: Config) {
  if (!config.ADMIN_UPGRADE_ENABLED)
    throw new ApiError(
      409,
      "ACCOUNT_STORAGE_DISABLED",
      "Account changes require the owner-approved Admin upgrade schema and runtime configuration. Existing sign-in remains available.",
    );
}
async function audit(db: Pick<pg.Pool, "query">, action: string) {
  await db.query(
    "INSERT INTO public.admin_audit(entity,record_id,action) VALUES('admin_account','owner',$1)",
    [action],
  );
}
async function invalidateActions(db: Pick<pg.Pool, "query">) {
  await db.query(
    "UPDATE public.admin_account_tokens SET used_at=now() WHERE used_at IS NULL",
  );
  await db.query(
    "UPDATE public.admin_delivery_outbox SET state='cancelled',payload=NULL,updated_at=now() WHERE channel='email' AND dedupe_key LIKE 'owner-action:%' AND state IN ('queued','retry')",
  );
}
async function issueAction(
  db: Pick<pg.Pool, "query">,
  config: Config,
  purpose: "verify_email" | "reset_password",
  email: string,
  fingerprint: string,
) {
  const raw = randomBytes(32).toString("hex"),
    hash = accountTokenHash(raw, config),
    expiry = new Date(Date.now() + 15 * 60000).toISOString();
  await invalidateActions(db);
  await db.query(
    "INSERT INTO public.admin_account_tokens(token_hash,purpose,email,credential_version,expires_at) VALUES($1,$2,$3,$4,$5)",
    [hash, purpose, email, fingerprint, expiry],
  );
  const link =
    config.PUBLIC_ORIGIN + "/admin#action=" + purpose + "&token=" + raw;
  await enqueueDelivery(
    db,
    config,
    "email",
    "owner-action:" + hash,
    {
      to: email,
      subject:
        purpose === "verify_email"
          ? "Verify your ElectroFix BD owner email"
          : "Reset your ElectroFix BD owner password",
      text: [
        purpose === "verify_email"
          ? "Confirm this address as the owner recovery email."
          : "A password recovery was requested for your owner account.",
        "This single-use link expires in 15 minutes:",
        link,
        "If you did not request this, do not use the link. Your existing credentials have not changed.",
      ].join("\n\n"),
    },
    expiry,
  );
}
export function createPublicRecoveryRouter(
  config: Config,
  pool: pg.Pool | null,
) {
  const router = Router();
  router.get("/recovery/status", (_req, res) =>
    res.json({
      available: Boolean(pool && emailReady(config)),
      delivery: "Approved email provider and running delivery worker required.",
    }),
  );
  router.post(
    "/recovery/request",
    throttle(),
    route(async (req, res) => {
      const input = parse(
        z.object({ email: z.string().email().max(254) }).strict(),
        req.body,
      );
      if (pool && emailReady(config)) {
        // Same public response for unknown addresses, missing enrollment and failures.
        try {
          await transaction(pool, async (db) => {
            const owner = await lockOwner(db, config);
            if (
              !owner.verified_email ||
              owner.verified_email.toLowerCase() !== input.email.toLowerCase()
            )
              return;
            await issueAction(
              db,
              config,
              "reset_password",
              owner.verified_email,
              credentialFingerprint(owner, config),
            );
            await audit(db, "recovery_requested");
          });
        } catch {
          /* Never reveal account existence or provider/database errors. */
        }
      }
      res.status(202).json({
        success: true,
        message:
          "If this address has verified recovery and delivery is configured, a single-use link will be queued. No password has changed.",
      });
    }),
  );
  router.post(
    "/recovery/complete",
    throttle(),
    route(async (req, res) => {
      requireStorage(config);
      if (!pool)
        throw new ApiError(
          503,
          "ACCOUNT_UNAVAILABLE",
          "Account storage unavailable.",
        );
      const input = parse(
        z.object({ token, password: newPassword }).strict(),
        req.body,
      );
      const hash = await encodeOwnerPassword(input.password);
      await transaction(pool, async (db) => {
        const owner = await lockOwner(db, config);
        const action = (
          await db.query(
            "SELECT purpose,email,credential_version FROM public.admin_account_tokens WHERE token_hash=$1 AND purpose='reset_password' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
            [accountTokenHash(input.token, config)],
          )
        ).rows[0];
        if (
          !action ||
          !owner.verified_email ||
          action.email !== owner.verified_email ||
          action.credential_version !== credentialFingerprint(owner, config)
        )
          throw new ApiError(
            400,
            "INVALID_RECOVERY",
            "This link is invalid, expired or already used. Request a new link.",
          );
        await db.query(
          "UPDATE public.admin_owner SET password_hash=$1,credential_revision=credential_revision+1,updated_at=now() WHERE singleton=true",
          [hash],
        );
        await invalidateActions(db);
        await db.query("DELETE FROM public.admin_sessions");
        await audit(db, "password_recovered_sessions_revoked");
      });
      res.json({ success: true, sign_in_required: true });
    }),
  );
  router.post(
    "/account/verify-email",
    throttle(),
    route(async (req, res) => {
      requireStorage(config);
      if (!pool)
        throw new ApiError(
          503,
          "ACCOUNT_UNAVAILABLE",
          "Account storage unavailable.",
        );
      const input = parse(z.object({ token }).strict(), req.body);
      await transaction(pool, async (db) => {
        const owner = await lockOwner(db, config);
        const action = (
          await db.query(
            "SELECT purpose,email,credential_version FROM public.admin_account_tokens WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
            [accountTokenHash(input.token, config)],
          )
        ).rows[0];
        if (
          !action ||
          action.credential_version !== credentialFingerprint(owner, config)
        )
          throw new ApiError(
            400,
            "INVALID_VERIFICATION",
            "This link is invalid, expired or already used.",
          );
        await db.query(
          "UPDATE public.admin_owner SET verified_email=$1,email_verified_at=now(),credential_revision=credential_revision+1,updated_at=now() WHERE singleton=true",
          [action.email],
        );
        await invalidateActions(db);
        await db.query("DELETE FROM public.admin_sessions");
        await audit(db, "email_verified_sessions_revoked");
      });
      res.json({ success: true, sign_in_required: true });
    }),
  );
  return router;
}
export function createAccountRouter(config: Config, pool: pg.Pool) {
  const router = Router();
  router.get(
    "/account",
    route(async (_req, res) => {
      const owner = await readOwner(pool, config);
      res.json({
        username: owner.username,
        storage_enabled: config.ADMIN_UPGRADE_ENABLED,
        email_delivery_ready: emailReady(config),
        verified_email: owner.verified_email || null,
        email_verified_at: owner.email_verified_at || null,
        password_policy:
          "12–128 characters; a unique passphrase is recommended.",
        recovery:
          "Only a verified email can receive recovery links. Existing email stays active until a replacement is verified.",
      });
    }),
  );
  router.post(
    "/account/password",
    throttle(),
    route(async (req, res) => {
      requireStorage(config);
      const input = parse(
        z
          .object({
            current_password: currentPassword,
            new_password: newPassword,
          })
          .strict(),
        req.body,
      );
      const hash = await encodeOwnerPassword(input.new_password);
      await transaction(pool, async (db) => {
        const owner = await lockOwner(db, config);
        if (
          credentialFingerprint(owner, config) !==
            res.locals.credentialVersion ||
          !(await verifyOwnerPassword(
            input.current_password,
            owner.password_hash,
          ))
        )
          throw new ApiError(
            403,
            "CURRENT_PASSWORD_REQUIRED",
            "The current password was not verified. Reload or check your password.",
          );
        if (await verifyOwnerPassword(input.new_password, owner.password_hash))
          throw new ApiError(
            400,
            "PASSWORD_UNCHANGED",
            "Choose a different password.",
          );
        await db.query(
          "UPDATE public.admin_owner SET password_hash=$1,credential_revision=credential_revision+1,updated_at=now() WHERE singleton=true",
          [hash],
        );
        await invalidateActions(db);
        await db.query("DELETE FROM public.admin_sessions");
        await audit(db, "password_changed_sessions_revoked");
      });
      res.json({ success: true, sign_in_required: true });
    }),
  );
  router.post(
    "/account/email",
    throttle(),
    route(async (req, res) => {
      requireStorage(config);
      if (!emailReady(config))
        throw new ApiError(
          409,
          "EMAIL_UNAVAILABLE",
          "Approved email delivery is not configured. Existing recovery email remains unchanged.",
        );
      const input = parse(
        z
          .object({
            current_password: currentPassword,
            email: z.string().email().max(254),
          })
          .strict(),
        req.body,
      );
      await transaction(pool, async (db) => {
        const owner = await lockOwner(db, config);
        if (
          credentialFingerprint(owner, config) !==
            res.locals.credentialVersion ||
          !(await verifyOwnerPassword(
            input.current_password,
            owner.password_hash,
          ))
        )
          throw new ApiError(
            403,
            "CURRENT_PASSWORD_REQUIRED",
            "The current password was not verified.",
          );
        if (owner.verified_email?.toLowerCase() === input.email.toLowerCase())
          throw new ApiError(
            409,
            "EMAIL_UNCHANGED",
            "This recovery address is already verified.",
          );
        await issueAction(
          db,
          config,
          "verify_email",
          input.email.toLowerCase(),
          credentialFingerprint(owner, config),
        );
        await audit(db, "email_verification_requested");
      });
      res.status(202).json({
        success: true,
        message:
          "Verification queued. Complete the single-use link within 15 minutes. Your existing recovery email remains active until then.",
      });
    }),
  );
  return router;
}
