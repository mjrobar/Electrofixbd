import { randomUUID } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import { ApiError } from "./errors";
import { mediaUrl } from "./media";
import {
  conflict,
  listQuery,
  parse,
  revision,
  revisionSchema,
  route,
  searchPattern,
  text,
  transaction,
} from "./admin-utils";
export const contentSchemas = {
  services: z.object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    name: text.min(2).max(150),
    short_description: text.min(1).max(5000),
    full_description: text.min(1).max(5000),
    common_problems: z.array(text.max(5000)).max(50),
    service_process: z.array(text.max(5000)).max(50),
    cover_image: mediaUrl.nullish(),
    is_active: z.boolean(),
  }),
  works: z.object({
    title: text.min(2).max(200),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    service_type: text.min(1).max(150),
    category: text.min(1).max(100),
    description: text.min(1).max(5000),
    media_url: mediaUrl.refine((v) => Boolean(v), "Media URL required."),
    media_type: z.enum(["image", "video"]),
    is_featured: z.boolean(),
    is_published: z.boolean(),
  }),
  testimonials: z.object({
    customer_name: text.min(2).max(150),
    review: text.min(1).max(5000),
    service_type: text.min(1).max(150),
    rating: z.number().int().min(1).max(5),
    avatar_url: mediaUrl.nullish(),
    media_url: mediaUrl.nullish(),
    media_type: z.enum(["image", "video"]).nullable(),
    is_published: z.boolean(),
  }),
};
export type Kind = keyof typeof contentSchemas;
export const columns: Record<Kind, string[]> = {
  services: [
    "slug",
    "name",
    "short_description",
    "full_description",
    "common_problems",
    "service_process",
    "cover_image",
    "is_active",
  ],
  works: [
    "title",
    "slug",
    "service_type",
    "category",
    "description",
    "media_url",
    "media_type",
    "is_featured",
    "is_published",
  ],
  testimonials: [
    "customer_name",
    "review",
    "service_type",
    "rating",
    "avatar_url",
    "media_url",
    "media_type",
    "is_published",
  ],
};
export function isKind(value: string): value is Kind {
  return Object.hasOwn(contentSchemas, value);
}
const publication = (kind: Kind) =>
  kind === "services" ? "is_active" : "is_published";
function content(kind: Kind, data: unknown) {
  return parse(contentSchemas[kind].strict(), data) as Record<string, unknown>;
}
function values(kind: Kind, data: Record<string, unknown>) {
  return columns[kind].map((c) =>
    ["common_problems", "service_process"].includes(c)
      ? JSON.stringify(data[c])
      : (data[c] ?? null),
  );
}
function checkId(kind: Kind, id: string) {
  if (
    (kind !== "services" && !z.string().uuid().safeParse(id).success) ||
    (kind === "services" && !/^[a-zA-Z0-9_-]{1,150}$/.test(id))
  )
    throw new ApiError(400, "INVALID_ID", "Invalid record ID.");
}
async function locked(
  db: pg.PoolClient,
  kind: Kind,
  id: string,
  expected: unknown,
) {
  const result = await db.query(
    `SELECT * FROM public.${kind} WHERE id=$1 FOR UPDATE`,
    [id],
  );
  if (!result.rowCount)
    throw new ApiError(404, "NOT_FOUND", "Content not found.");
  if (result.rows[0].revision !== revision(expected)) throw conflict();
  return result.rows[0];
}
export function createAdminContentRouter(pool: pg.Pool) {
  const router = Router();
  router.get(
    "/content/:kind",
    route(async (req, res) => {
      const kind = req.params.kind;
      if (!isKind(kind))
        throw new ApiError(404, "UNKNOWN_MODULE", "Unknown content module.");
      const query = parse(listQuery, req.query),
        pub = publication(kind);
      if (!["all", "published", "draft", "archived"].includes(query.status))
        throw new ApiError(400, "INVALID_STATUS", "Unknown content filter.");
      const where = `($1='archived' AND archived_at IS NOT NULL OR $1<>'archived' AND archived_at IS NULL) AND ($1 NOT IN ('published','draft') OR $1='published' AND ${pub} IS TRUE OR $1='draft' AND (${pub} IS NOT TRUE OR admin_draft IS NOT NULL)) AND to_jsonb(t)::text ILIKE $2`;
      const params = [query.status, searchPattern(query.q)];
      const total = await pool.query(
        `SELECT count(*)::int AS total FROM public.${kind} t WHERE ${where}`,
        params,
      );
      const result = await pool.query(
        `SELECT * FROM public.${kind} t WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,
        [...params, query.limit, query.offset],
      );
      res.json({
        items: result.rows,
        total: total.rows[0].total,
        pagination: query,
      });
    }),
  );
  router.post(
    "/content/:kind",
    route(async (req, res) => {
      const kind = req.params.kind;
      if (!isKind(kind))
        throw new ApiError(404, "UNKNOWN_MODULE", "Unknown content module.");
      const data = content(kind, req.body),
        pub = publication(kind);
      data[pub] = false;
      const id = kind === "services" ? "srv-" + data.slug : randomUUID();
      try {
        const result = await pool.query(
          `INSERT INTO public.${kind}(id,${columns[kind].join(",")},admin_draft) VALUES(${Array.from({ length: columns[kind].length + 2 }, (_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
          [id, ...values(kind, data), JSON.stringify(data)],
        );
        res.status(201).json({ item: result.rows[0] });
      } catch (error) {
        if ((error as { code: string }).code === "23505")
          throw new ApiError(
            409,
            "DUPLICATE_CONTENT",
            "The slug already exists, including archived content. Restore that record instead.",
          );
        throw error;
      }
    }),
  );
  router.put(
    "/content/:kind/:id",
    route(async (req, res) => {
      const kind = req.params.kind,
        id = req.params.id;
      if (!isKind(kind))
        throw new ApiError(404, "UNKNOWN_MODULE", "Unknown content module.");
      checkId(kind, id);
      const { revision: expected, ...body } = parse(
        contentSchemas[kind].extend({ revision: revisionSchema }).strict(),
        req.body,
      ) as Record<string, unknown>;
      const data = content(kind, body);
      const item = await transaction(pool, async (db) => {
        const current = await locked(db, kind, id, expected);
        if (current.archived_at)
          throw new ApiError(
            409,
            "ARCHIVED",
            "Restore archived content before editing.",
          );
        if (kind !== "testimonials" && data.slug !== current.slug)
          throw new ApiError(
            409,
            "IMMUTABLE_SLUG",
            "Existing URL slugs are permanent. Create a separate record for a new URL.",
          );
        return (
          await db.query(
            `UPDATE public.${kind} SET admin_draft=$1::jsonb WHERE id=$2 RETURNING *`,
            [JSON.stringify(data), id],
          )
        ).rows[0];
      });
      res.json({ item });
    }),
  );
  for (const action of [
    "publish",
    "unpublish",
    "archive",
    "restore",
  ] as const) {
    router.post(
      `/content/:kind/:id/${action}`,
      route(async (req, res) => {
        const kind = req.params.kind,
          id = req.params.id;
        if (!isKind(kind))
          throw new ApiError(404, "UNKNOWN_MODULE", "Unknown content module.");
        checkId(kind, id);
        const expected = parse(
          z.object({ revision: revisionSchema }).strict(),
          req.body,
        ).revision;
        const item = await transaction(pool, async (db) => {
          const current = await locked(db, kind, id, expected),
            pub = publication(kind);
          if (action !== "restore" && current.archived_at)
            throw new ApiError(
              409,
              "ARCHIVED",
              "Restore archived content first.",
            );
          if (action === "publish") {
            const data = content(
              kind,
              current.admin_draft ??
                Object.fromEntries(columns[kind].map((c) => [c, current[c]])),
            );
            data[pub] = true;
            if (kind !== "testimonials" && data.slug !== current.slug)
              throw new ApiError(
                409,
                "IMMUTABLE_SLUG",
                "The draft cannot change the URL slug.",
              );
            const set = columns[kind].map((c, i) => `${c}=$${i + 1}`).join(",");
            return (
              await db.query(
                `UPDATE public.${kind} SET ${set},admin_draft=NULL${kind === "services" ? ",updated_at=now()" : ""} WHERE id=$${columns[kind].length + 1} RETURNING *`,
                [...values(kind, data), id],
              )
            ).rows[0];
          }
          return (
            await db.query(
              `UPDATE public.${kind} SET ${pub}=false${action === "archive" ? ",archived_at=now()" : action === "restore" ? ",archived_at=NULL" : ""} WHERE id=$1 RETURNING *`,
              [id],
            )
          ).rows[0];
        });
        res.json({ item });
      }),
    );
  }
  // Compatibility alias: archive is always reversible; a revision is required.
  router.delete(
    "/content/:kind/:id",
    route(async (req, res) => {
      const kind = req.params.kind,
        id = req.params.id;
      if (!isKind(kind))
        throw new ApiError(404, "UNKNOWN_MODULE", "Unknown content module.");
      checkId(kind, id);
      const expected = revision(req.body?.revision);
      await transaction(pool, async (db) => {
        await locked(db, kind, id, expected);
        await db.query(
          `UPDATE public.${kind} SET archived_at=now(),${publication(kind)}=false WHERE id=$1`,
          [id],
        );
      });
      res.json({ success: true, archived: true });
    }),
  );
  return router;
}
