import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, json } from "express";
import { rateLimit } from "express-rate-limit";
import type pg from "pg";
import type { Config } from "./config";
import { route } from "./admin-utils";
import {
  credentialFingerprint,
  readOwner,
  validPasswordHash,
  verifyOwnerPassword,
} from "./admin-identity";
import {
  createAccountRouter,
  createPublicRecoveryRouter,
} from "./admin-account";
const cookieName = "efb_admin_session";
const cookieOptions = (production: boolean) => ({
  httpOnly: true,
  secure: production,
  sameSite: "strict" as const,
  path: "/api/admin",
});
const equal = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createAdminAuth(config: Config, pool: pg.Pool | null) {
  const router = Router();
  const secret = config.ADMIN_SESSION_SECRET || "",
    hash = config.ADMIN_PASSWORD_HASH || "",
    username = config.ADMIN_USERNAME || "";
  const validHash = validPasswordHash(hash);
  const enabled = Boolean(
    pool &&
    secret.length >= 32 &&
    (config.ADMIN_UPGRADE_ENABLED || (username && validHash)),
  );
  const sensitiveBodies = new Set([
    "/login",
    "/recovery/request",
    "/recovery/complete",
    "/account/password",
    "/account/email",
    "/account/verify-email",
  ]);
  const tokenHash = (token: string) =>
    createHmac("sha256", secret).update(token).digest("hex");
  const cookie = (header: string) =>
    header
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || "";
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  router.use((req, res, next) => {
    const upload = req.path === "/media" && req.method === "POST";
    const limit = upload
      ? 5 * 1024 * 1024
      : sensitiveBodies.has(req.path)
        ? 8192
        : 2 * 1024 * 1024;
    const charset = req
      .get("content-type")
      ?.match(/charset\s*=\s*"?([^;"\s]+)/i)?.[1]
      ?.toLowerCase();
    if (Number(req.get("content-length")) > limit)
      return res.status(413).json({ error: "Request too large." });
    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
      (!config.PUBLIC_ORIGIN ||
        req.get("origin") !== config.PUBLIC_ORIGIN ||
        req.get("x-admin-request") !== "1")
    )
      return res.status(403).json({ error: "Forbidden." });
    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
      ((!upload && !req.is("application/json")) ||
        Boolean(charset && !["utf8", "utf-8"].includes(charset)))
    )
      return res.status(415).json({ error: "Send UTF-8 application/json." });
    if (!upload && req.body !== undefined) {
      try {
        if (typeof req.body === "string") req.body = JSON.parse(req.body);
        if (Buffer.byteLength(JSON.stringify(req.body)) > limit)
          return res.status(413).json({ error: "Request too large." });
      } catch {
        return res.status(400).json({ error: "Invalid JSON." });
      }
    }
    next();
  });
  const loginJson = json({ limit: "8kb" }),
    contentJson = json({ limit: "2mb" });
  router.use((req, res, next) =>
    sensitiveBodies.has(req.path)
      ? loginJson(req, res, next)
      : contentJson(req, res, next),
  );
  router.use(createPublicRecoveryRouter(config, enabled ? pool : null));
  router.post(
    "/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    route(async (req, res) => {
      const user = req.body?.username,
        password = req.body?.password;
      if (
        !enabled ||
        typeof user !== "string" ||
        user.length > 150 ||
        typeof password !== "string" ||
        password.length > 1024
      )
        return res.status(401).json({ error: "Invalid credentials." });
      const owner = await readOwner(pool!, config);
      if (
        !(await verifyOwnerPassword(password, owner.password_hash)) ||
        !equal(user, owner.username)
      )
        return res.status(401).json({ error: "Invalid credentials." });
      const fingerprint = credentialFingerprint(owner, config);
      const token = randomBytes(32).toString("hex");
      await pool!.query(
        "DELETE FROM public.admin_sessions WHERE expires_at<=now() OR last_seen_at<now()-interval '30 minutes' OR credential_version<>$1",
        [fingerprint],
      );
      await pool!.query(
        "INSERT INTO public.admin_sessions(token_hash,credential_version,expires_at) VALUES($1,$2,now()+interval '8 hours')",
        [tokenHash(token), fingerprint],
      );
      res.cookie(cookieName, token, {
        ...cookieOptions(config.NODE_ENV === "production"),
        maxAge: 8 * 60 * 60 * 1000,
      });
      return res.json({
        success: true,
        user: { name: "Administrator", role: "owner" },
      });
    }),
  );
  router.use(
    route(async (req, res, next) => {
      const token = cookie(req.headers.cookie || "");
      if (!enabled || !/^[a-f0-9]{64}$/.test(token))
        return res.status(401).json({ error: "Authentication required." });
      const fingerprint = credentialFingerprint(
        await readOwner(pool!, config),
        config,
      );
      const result = await pool!.query(
        "UPDATE public.admin_sessions SET last_seen_at=now() WHERE token_hash=$1 AND credential_version=$2 AND expires_at>now() AND last_seen_at>now()-interval '30 minutes' RETURNING token_hash",
        [tokenHash(token), fingerprint],
      );
      if (!result.rowCount)
        return res
          .status(401)
          .json({ error: "Session expired. Please sign in again." });
      res.locals.sessionHash = tokenHash(token);
      res.locals.credentialVersion = fingerprint;
      next();
    }),
  );
  router.get("/me", (_req, res) =>
    res.json({ user: { name: "Administrator", role: "owner" } }),
  );
  if (pool) router.use(createAccountRouter(config, pool));
  router.post(
    "/logout",
    route(async (_req, res) => {
      await pool!.query(
        "DELETE FROM public.admin_sessions WHERE token_hash=$1",
        [res.locals.sessionHash],
      );
      res.clearCookie(
        cookieName,
        cookieOptions(config.NODE_ENV === "production"),
      );
      res.json({ success: true });
    }),
  );
  router.post(
    "/logout-all",
    route(async (_req, res) => {
      await pool!.query("DELETE FROM public.admin_sessions");
      res.clearCookie(
        cookieName,
        cookieOptions(config.NODE_ENV === "production"),
      );
      res.json({ success: true });
    }),
  );
  router.get(
    "/sessions",
    route(async (_req, res) => {
      const fingerprint = credentialFingerprint(
        await readOwner(pool!, config),
        config,
      );
      const result = await pool!.query(
        "SELECT created_at,last_seen_at,expires_at,(token_hash=$1) AS current FROM public.admin_sessions WHERE credential_version=$2 AND expires_at>now() AND last_seen_at>now()-interval '30 minutes' ORDER BY created_at DESC LIMIT 100",
        [res.locals.sessionHash, fingerprint],
      );
      res.json({ items: result.rows });
    }),
  );
  return router;
}
