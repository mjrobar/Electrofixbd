import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import type { Config } from "./config";
import { parse, route, transaction } from "./admin-utils";
import { ApiError } from "./errors";
import { bookingReceipt, emailReady, whatsappReady } from "./admin-delivery";
import { digest } from "./content-import";
type Cursor = { at: string; booking: string; total: number };
const cursorShape = z
  .object({
    at: z.iso.datetime({ offset: true }),
    total: z.number().int().min(0).max(2147483647),
    booking: z.string().regex(/^EFB-\d{8}-\d{5}$/),
  })
  .strict();
const sign = (s: string, secret: string) =>
  createHmac("sha256", secret)
    .update("booking-seen:" + s)
    .digest("hex");
export function encodeBookingCursor(value: Cursor, secret: string) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return payload + "." + sign(payload, secret);
}
export function decodeBookingCursor(value: string, secret: string): Cursor {
  const [payload, mac, ...extra] = value.split(".");
  if (
    value.length > 600 ||
    extra.length ||
    !/^[A-Za-z0-9_-]+$/.test(payload || "") ||
    !/^[a-f0-9]{64}$/.test(mac || "") ||
    !timingSafeEqual(Buffer.from(mac), Buffer.from(sign(payload, secret)))
  )
    throw new ApiError(
      400,
      "INVALID_CURSOR",
      "Refresh the notification feed before marking it seen.",
    );
  try {
    return cursorShape.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "Invalid notification cursor.");
  }
}
export const analyticsPeriods = {
  day: { unit: "day", range: "29 days", label: "Last 30 calendar days" },
  week: {
    unit: "week",
    range: "11 weeks",
    label: "Last 12 calendar weeks · Monday start",
  },
  month: {
    unit: "month",
    range: "11 months",
    label: "Last 12 calendar months",
  },
  year: { unit: "year", range: "4 years", label: "Last 5 calendar years" },
} as const;
export function createObservationRouter(pool: pg.Pool, config: Config) {
  const router = Router();
  router.get(
    "/analytics",
    route(async (req, res) => {
      const { period } = parse(
          z
            .object({
              period: z.enum(["day", "week", "month", "year"]).default("day"),
            })
            .strict(),
          req.query,
        ),
        p = analyticsPeriods[period];
      // All SQL fragments are closed constants, never request-provided SQL.
      const rows = await pool.query(
        `WITH bounds AS (SELECT date_trunc('${p.unit}',now() AT TIME ZONE 'Asia/Dhaka') AS finish), series AS (SELECT generate_series(finish-interval '${p.range}',finish,interval '1 ${p.unit}') AS bucket FROM bounds), counts AS (SELECT date_trunc('${p.unit}',created_at AT TIME ZONE 'Asia/Dhaka') AS bucket,count(*)::int AS bookings FROM public.bookings WHERE created_at >= ((SELECT min(bucket) FROM series) AT TIME ZONE 'Asia/Dhaka') AND created_at < (((SELECT finish FROM bounds)+interval '1 ${p.unit}') AT TIME ZONE 'Asia/Dhaka') GROUP BY 1) SELECT to_char(s.bucket,'YYYY-MM-DD') AS day,coalesce(c.bookings,0)::int AS bookings FROM series s LEFT JOIN counts c USING(bucket) ORDER BY s.bucket`,
      );
      res.json({
        period,
        time_zone: "Asia/Dhaka",
        range_label: p.label,
        week_starts_on: "Monday",
        points: rows.rows,
      });
    }),
  );
  router.get(
    "/updates",
    route(async (req, res) => {
      const input = parse(
        z.object({ seen: z.string().max(600).optional() }).strict(),
        req.query,
      );
      const data = await transaction(pool, async (db) => {
        await db.query(
          "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
        );
        let seen: Cursor | null = input.seen
          ? decodeBookingCursor(input.seen, config.ADMIN_SESSION_SECRET!)
          : null;
        if (config.ADMIN_UPGRADE_ENABLED) {
          const state = (
            await db.query(
              "SELECT to_char(seen_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS at,seen_booking AS booking,seen_total AS total FROM public.admin_notification_state WHERE singleton=true",
            )
          ).rows[0];
          seen = state || null;
        }
        const items = (
          await db.query(
            "SELECT booking_number,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM public.bookings ORDER BY created_at DESC,booking_number DESC LIMIT 20",
          )
        ).rows;
        const counts = (
          await db.query("SELECT count(*)::int AS total FROM public.bookings")
        ).rows[0];
        const changes = (
          await db.query(
            "SELECT (SELECT coalesce(max(id),0)::text FROM public.admin_audit) AS audit,(SELECT count(*)::int FROM public.contact_messages) AS contacts,(SELECT max(created_at)::text FROM public.contact_messages) AS last_contact,now() AS server_time",
          )
        ).rows[0];
        const latest = items[0]
          ? encodeBookingCursor(
              {
                at: items[0].created_at,
                booking: items[0].booking_number,
                total: counts.total,
              },
              config.ADMIN_SESSION_SECRET!,
            )
          : null;
        return {
          server_time: changes.server_time,
          change_token: digest({
            audit: changes.audit,
            contacts: changes.contacts,
            last_contact: changes.last_contact,
            total: counts.total,
            latest,
          }),
          total: counts.total,
          unread: Math.max(0, counts.total - (seen?.total || 0)),
          items,
          latest_cursor: latest,
          read_state: config.ADMIN_UPGRADE_ENABLED
            ? "shared-owner"
            : "this-browser",
        };
      });
      res.json(data);
    }),
  );
  router.post(
    "/updates/seen",
    route(async (req, res) => {
      const input = parse(
          z.object({ cursor: z.string().max(600) }).strict(),
          req.body,
        ),
        seen = decodeBookingCursor(input.cursor, config.ADMIN_SESSION_SECRET!);
      const unread = await transaction(pool, async (db) => {
        const current = (
          await db.query("SELECT count(*)::int AS total FROM public.bookings")
        ).rows[0].total;
        seen.total = Math.min(seen.total, current);
        if (config.ADMIN_UPGRADE_ENABLED) {
          await db.query(
            "INSERT INTO public.admin_notification_state(singleton,seen_at,seen_booking,seen_total) VALUES(true,$1,$2,$3) ON CONFLICT(singleton) DO UPDATE SET seen_at=EXCLUDED.seen_at,seen_booking=EXCLUDED.seen_booking,seen_total=EXCLUDED.seen_total,updated_at=now() WHERE admin_notification_state.seen_total<EXCLUDED.seen_total",
            [seen.at, seen.booking, seen.total],
          );
          const effective = (
            await db.query(
              "SELECT seen_total AS total FROM public.admin_notification_state WHERE singleton=true",
            )
          ).rows[0];
          if (effective) seen.total = effective.total;
        }
        // Count watermark covers late commits with older/tied created_at values.
        // Existing booking business logic has no deletion operation.
        const latest = (
          await db.query("SELECT count(*)::int AS total FROM public.bookings")
        ).rows[0].total;
        return Math.max(0, latest - seen.total);
      });
      res.json({
        success: true,
        unread,
        read_state: config.ADMIN_UPGRADE_ENABLED
          ? "shared-owner"
          : "this-browser",
      });
    }),
  );
  router.get(
    "/booking-receipts/:number",
    route(async (req, res) => {
      const number = parse(
          z.string().regex(/^EFB-\d{8}-\d{5}$/),
          req.params.number,
        ),
        { details } = parse(
          z
            .object({ details: z.enum(["true", "false"]).default("false") })
            .strict(),
          req.query,
        );
      const b = (
        await pool.query(
          "SELECT booking_number,service_name,customer_name,phone,address,notes,status,created_at FROM public.bookings WHERE booking_number=$1",
          [number],
        )
      ).rows[0];
      if (!b) throw new ApiError(404, "NOT_FOUND", "Booking not found.");
      res.json({
        text: bookingReceipt(b, details === "true"),
        includes_customer_details: details === "true",
        mode: "manual",
        automatic_delivery: whatsappReady(config)
          ? "configured-worker-required"
          : "disabled",
      });
    }),
  );
  router.get(
    "/integrations",
    route(async (_req, res) => {
      const states = config.ADMIN_UPGRADE_ENABLED
        ? (
            await pool.query(
              "SELECT channel,state,count(*)::int AS total FROM public.admin_delivery_outbox GROUP BY channel,state ORDER BY channel,state",
            )
          ).rows
        : [];
      res.json({
        storage_enabled: config.ADMIN_UPGRADE_ENABLED,
        email: {
          configured: emailReady(config),
          provider: "Resend HTTPS adapter",
          worker_enabled: config.ADMIN_DELIVERY_WORKER_ENABLED,
        },
        whatsapp: {
          configured: whatsappReady(config),
          worker_enabled: config.ADMIN_DELIVERY_WORKER_ENABLED,
          recipient_configured: Boolean(config.WHATSAPP_ADMIN_RECIPIENT),
          includes_customer_details: config.WHATSAPP_INCLUDE_CUSTOMER_DETAILS,
        },
        queue: states,
        requirements:
          "Owner-approved schema, worker and delivery configuration. WhatsApp needs Business Platform credentials, approved template and recipient opt-in. Email needs a verified sending domain/provider. Provider acceptance does not prove device delivery.",
      });
    }),
  );
  return router;
}
