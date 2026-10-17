import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import { ApiError } from "./errors";
import {
  conflict,
  listQuery,
  parse,
  revisionSchema,
  route,
  searchPattern,
  text,
  transaction,
} from "./admin-utils";
export const bookingTransitions: Record<string, string[]> = {
  pending: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: ["confirmed"],
  cancelled: ["pending"],
};
export function createOperationsRouter(pool: pg.Pool) {
  const router = Router();
  router.get(
    "/overview",
    route(async (_req, res) => {
      const [b, c, s, w, t, days, states, activity] = await Promise.all([
        pool.query(
          "SELECT count(*)::int AS total,count(*) FILTER(WHERE status='pending')::int AS pending FROM public.bookings",
        ),
        pool.query(
          "SELECT count(*)::int AS total,count(*) FILTER(WHERE status='new')::int AS unread FROM public.contact_messages",
        ),
        pool.query(
          "SELECT count(*)::int AS total FROM public.services WHERE archived_at IS NULL AND is_active IS TRUE",
        ),
        pool.query(
          "SELECT count(*)::int AS total FROM public.works WHERE archived_at IS NULL",
        ),
        pool.query(
          "SELECT count(*)::int AS total FROM public.testimonials WHERE archived_at IS NULL",
        ),
        pool.query(
          "SELECT (created_at AT TIME ZONE 'Asia/Dhaka')::date AS day,count(*)::int AS bookings FROM public.bookings WHERE created_at>=now()-interval '30 days' GROUP BY day ORDER BY day",
        ),
        pool.query(
          "SELECT status,count(*)::int AS total FROM public.bookings GROUP BY status ORDER BY status",
        ),
        pool.query(
          "SELECT entity,action,revision,created_at FROM public.admin_audit ORDER BY id DESC LIMIT 8",
        ),
      ]);
      res.json({
        bookings: b.rows[0],
        contacts: c.rows[0],
        services: s.rows[0].total,
        works: w.rows[0].total,
        testimonials: t.rows[0].total,
        days: days.rows,
        statuses: states.rows,
        activity: activity.rows,
      });
    }),
  );
  for (const entity of ["bookings", "contacts"] as const) {
    const table = entity === "bookings" ? "bookings" : "contact_messages",
      idColumn = entity === "bookings" ? "booking_number" : "id";
    const statuses =
      entity === "bookings"
        ? Object.keys(bookingTransitions)
        : ["new", "read", "replied"];
    const fields =
      entity === "bookings"
        ? "booking_number,customer_name,phone,address,service_name,status,notes,admin_notes,revision,created_at"
        : "id,name,phone,message,status,admin_notes,revision,created_at";
    const search =
      entity === "bookings"
        ? "concat_ws(' ',booking_number,customer_name,phone,service_name)"
        : "concat_ws(' ',name,phone,message)";
    router.get(
      "/" + entity,
      route(async (req, res) => {
        const query = parse(listQuery, req.query);
        if (query.status !== "all" && !statuses.includes(query.status))
          throw new ApiError(400, "INVALID_STATUS", "Invalid status filter.");
        const where = `($1='all' OR status=$1) AND ${search} ILIKE $2`,
          params = [query.status, searchPattern(query.q)];
        const total = await pool.query(
          `SELECT count(*)::int AS total FROM public.${table} WHERE ${where}`,
          params,
        );
        const result = await pool.query(
          `SELECT ${fields} FROM public.${table} WHERE ${where} ORDER BY created_at DESC,${idColumn} DESC LIMIT $3 OFFSET $4`,
          [...params, query.limit, query.offset],
        );
        res.json({
          items: result.rows,
          total: total.rows[0].total,
          pagination: query,
        });
      }),
    );
    router.patch(
      `/${entity}/:id`,
      route(async (req, res) => {
        const id = req.params.id;
        if (
          entity === "bookings"
            ? !/^EFB-\d{8}-\d{5}$/.test(id)
            : !z.string().uuid().safeParse(id).success
        )
          throw new ApiError(400, "INVALID_ID", "Invalid record ID.");
        const input = parse(
          z
            .object({
              revision: revisionSchema,
              status: z.string().optional(),
              admin_notes: text.max(5000).optional(),
            })
            .strict()
            .refine(
              (v) => v.status !== undefined || v.admin_notes !== undefined,
              "Provide status or internal notes.",
            ),
          req.body,
        );
        if (input.status !== undefined && !statuses.includes(input.status))
          throw new ApiError(400, "INVALID_STATUS", "Invalid status.");
        const item = await transaction(pool, async (db) => {
          const current = (
            await db.query(
              `SELECT ${fields} FROM public.${table} WHERE ${idColumn}=$1 FOR UPDATE`,
              [id],
            )
          ).rows[0];
          if (!current)
            throw new ApiError(404, "NOT_FOUND", "Record not found.");
          if (current.revision !== input.revision) throw conflict();
          if (
            entity === "bookings" &&
            input.status &&
            input.status !== current.status &&
            !bookingTransitions[current.status]?.includes(input.status)
          )
            throw new ApiError(
              409,
              "INVALID_TRANSITION",
              "Use the next workflow step or reopen the booking first.",
            );
          return (
            await db.query(
              `UPDATE public.${table} SET status=$1,admin_notes=$2${entity === "bookings" ? ",updated_at=now()" : ""} WHERE ${idColumn}=$3 RETURNING ${fields}`,
              [
                input.status ?? current.status,
                input.admin_notes ?? current.admin_notes,
                id,
              ],
            )
          ).rows[0];
        });
        res.json({ item });
      }),
    );
  }
  return router;
}
