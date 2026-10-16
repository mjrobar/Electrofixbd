import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Router, json } from "express";
import { rateLimit } from "express-rate-limit";
import pg from "pg";
import type { Config } from "./config";

const cookieName = "efb_admin_session";
const maxAge = 8 * 60 * 60;
const allowedStatuses = new Set(["pending", "confirmed", "in_progress", "completed", "cancelled"]);

function constantEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function passwordMatches(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !/^[a-f0-9]{128}$/i.test(expected || "") || password.length > 1024) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
function parseCookie(header: string) {
  const part = header.split(";").map(s => s.trim()).find(s => s.startsWith(cookieName + "="));
  return part?.slice(cookieName.length + 1) || "";
}
export function createAdminRouter(config: Config) {
  const router = Router();
  const secret = config.ADMIN_SESSION_SECRET;
  const username = config.ADMIN_USERNAME;
  const passwordHash = config.ADMIN_PASSWORD_HASH;
  const enabled = Boolean(secret && secret.length >= 32 && username && passwordHash && config.DATABASE_URL);
  const pool = enabled ? new pg.Pool({ connectionString: config.DATABASE_URL, max: 3, connectionTimeoutMillis: config.DB_TIMEOUT_MS }) : null;
  pool?.on("error", () => console.error("Admin PostgreSQL idle connection failed."));
  router.use((_req,res,next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }));
  router.use(json({ limit: "8kb" }));
  const isAuthenticated = (cookie: string) => {
    if (!secret || !cookie) return false;
    const [user, expiry, nonce, mac] = cookie.split(".");
    if (!user || !expiry || !nonce || !mac || !/^\d+$/.test(expiry) || Number(expiry) <= Date.now()) return false;
    return constantEqual(sign([user, expiry, nonce].join("."), secret), mac) && user === "admin";
  };
  router.use((req,res,next) => {
    if (["POST","PATCH","PUT","DELETE"].includes(req.method)) {
      // Block cross-origin and script-only requests that cannot present the exact Origin.
      if (!config.PUBLIC_ORIGIN || req.get("origin") !== config.PUBLIC_ORIGIN || req.get("x-admin-request") !== "1")
        return res.status(403).json({ error: "Forbidden." });
    }
    next();
  });
  router.post("/login", async (req,res) => {
    const user = req.body?.username;
    const password = req.body?.password;
    if (!enabled || typeof user !== "string" || typeof password !== "string" || !constantEqual(user, username!) || !passwordMatches(password, passwordHash!))
      return res.status(401).json({ error: "Invalid credentials." });
    const expiry = String(Date.now() + maxAge * 1000);
    const payload = ["admin", expiry, randomBytes(20).toString("hex")].join(".");
    res.cookie(cookieName, payload + "." + sign(payload, secret!), { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: maxAge * 1000 });
    return res.json({ success: true, user: { name: "Administrator" } });
  });
  router.use((req,res,next) => {
    if (!isAuthenticated(parseCookie(req.headers.cookie || ""))) return res.status(401).json({ error: "Authentication required." });
    next();
  });
  router.get("/me", (_req,res) => res.json({ user: { name: "Administrator" } }));
  router.post("/logout", (_req,res) => {
    res.clearCookie(cookieName, { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "strict", path: "/api/admin" });
    res.json({ success: true });
  });
  router.get("/overview", async (_req,res) => {
    try {
      const [bookings, contacts, services, works, testimonials] = await Promise.all([
        pool!.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE status='pending')::int AS pending FROM public.bookings"),
        pool!.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE status='new')::int AS unread FROM public.contact_messages"),
        pool!.query("SELECT count(*)::int AS total FROM public.services"),
        pool!.query("SELECT count(*)::int AS total FROM public.works"),
        pool!.query("SELECT count(*)::int AS total FROM public.testimonials")
      ]);
      res.json({ bookings: bookings.rows[0], contacts: contacts.rows[0], services: services.rows[0].total, works: works.rows[0].total, testimonials: testimonials.rows[0].total });
    } catch { res.status(503).json({ error: "Dashboard data unavailable." }); }
  });
  router.get("/bookings", async (req,res) => {
    const offset = Number(req.query.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return res.status(400).json({ error: "Invalid offset." });
    try {
      const result = await pool!.query("SELECT booking_number,customer_name,phone,address,service_name,status,notes,created_at FROM public.bookings ORDER BY created_at DESC LIMIT 30 OFFSET $1", [offset]);
      res.json({ items: result.rows });
    } catch { res.status(503).json({ error: "Bookings unavailable." }); }
  });
  router.patch("/bookings/:number", async (req,res) => {
    if (!/^EFB-\d{8}-\d{5}$/.test(req.params.number) || !allowedStatuses.has(req.body?.status))
      return res.status(400).json({ error: "Invalid booking or status." });
    try {
      const result = await pool!.query("UPDATE public.bookings SET status=$1,updated_at=now() WHERE booking_number=$2 RETURNING booking_number,status", [req.body.status, req.params.number]);
      if (!result.rowCount) return res.status(404).json({ error: "Booking not found." });
      res.json({ item: result.rows[0] });
    } catch { res.status(503).json({ error: "Could not update booking." }); }
  });
  router.get("/contacts", async (req,res) => {
    const offset = Number(req.query.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return res.status(400).json({ error: "Invalid offset." });
    try {
      const result = await pool!.query("SELECT id,name,phone,message,status,created_at FROM public.contact_messages ORDER BY created_at DESC LIMIT 30 OFFSET $1", [offset]);
      res.json({ items: result.rows });
    } catch { res.status(503).json({ error: "Messages unavailable." }); }
  });
  router.patch("/contacts/:id", async (req,res) => {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(req.params.id) || !["new","read","replied"].includes(req.body?.status))
      return res.status(400).json({ error: "Invalid message or status." });
    try {
      const result = await pool!.query("UPDATE public.contact_messages SET status=$1 WHERE id=$2 RETURNING id,status", [req.body.status,req.params.id]);
      if (!result.rowCount) return res.status(404).json({ error: "Message not found." });
      res.json({ item: result.rows[0] });
    } catch { res.status(503).json({ error: "Could not update message." }); }
  });
  return router;
}

// Generate ADMIN_PASSWORD_HASH without extra dependencies:
// node -e "const c=require('node:crypto');const salt=c.randomBytes(16).toString('hex');console.log(salt+':'+c.scryptSync(process.argv[1],salt,64).toString('hex'))" "your-password"
