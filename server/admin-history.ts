import { documentSchema } from "./cms-contract";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import { ApiError } from "./errors";
import { columns, contentSchemas, isKind } from "./admin-content";
import { validate, type Key, schemas } from "./site-controls";
import {
  conflict,
  parse,
  revisionSchema,
  route,
  transaction,
} from "./admin-utils";
export function createHistoryRouter(pool: pg.Pool) {
  const router = Router();
  router.get(
    "/history/:entity/:id",
    route(async (req, res) => {
      const { entity, id } = req.params;
      if (
        !isKind(entity) &&
        entity !== "site_content" &&
        entity !== "cms_documents"
      )
        throw new ApiError(404, "UNKNOWN_MODULE", "Unknown module.");
      const result = await pool.query(
        "SELECT revision,snapshot,saved_at FROM public.content_history WHERE entity=$1 AND record_id=$2 ORDER BY revision DESC LIMIT 30",
        [entity, id],
      );
      res.json({ items: result.rows });
    }),
  );
  router.post(
    "/history/:entity/:id/restore",
    route(async (req, res) => {
      const { entity, id } = req.params;
      if (
        !isKind(entity) &&
        entity !== "site_content" &&
        entity !== "cms_documents"
      )
        throw new ApiError(404, "UNKNOWN_MODULE", "Unknown module.");
      const input = parse(
        z
          .object({ revision: revisionSchema, source_revision: revisionSchema })
          .strict(),
        req.body,
      );
      const item = await transaction(pool, async (db) => {
        const current = (
          await db.query(
            `SELECT * FROM public.${entity} WHERE ${entity === "site_content" ? "key" : "id"}=$1 FOR UPDATE`,
            [id],
          )
        ).rows[0];
        if (!current) throw new ApiError(404, "NOT_FOUND", "Record not found.");
        if (current.revision !== input.revision) throw conflict();
        const old = (
          await db.query(
            "SELECT snapshot FROM public.content_history WHERE entity=$1 AND record_id=$2 AND revision=$3",
            [entity, id, input.source_revision],
          )
        ).rows[0]?.snapshot;
        if (!old)
          throw new ApiError(
            404,
            "HISTORY_NOT_FOUND",
            "Saved version not found.",
          );
        if (entity === "cms_documents") {
          if (current.archived_at)
            throw new ApiError(409, "ARCHIVED", "Restore section first.");
          const data = parse(documentSchema, old.draft);
          return (
            await db.query(
              "UPDATE cms_documents SET draft=$1,updated_at=now() WHERE id=$2 RETURNING *",
              [JSON.stringify(data), id],
            )
          ).rows[0];
        }
        if (entity === "site_content") {
          if (!Object.hasOwn(schemas, id))
            throw new ApiError(404, "UNKNOWN_MODULE", "Unknown site module.");
          const parsed = validate(id as Key, old.draft);
          if (!parsed.success)
            throw new ApiError(
              409,
              "INVALID_HISTORY",
              "This version is not compatible with current validation.",
            );
          return (
            await db.query(
              "UPDATE public.site_content SET draft=$1::jsonb,updated_at=now() WHERE key=$2 RETURNING *",
              [JSON.stringify(parsed.data), id],
            )
          ).rows[0];
        }
        if (current.archived_at)
          throw new ApiError(
            409,
            "ARCHIVED",
            "Restore the archived record first.",
          );
        const data = parse(
          contentSchemas[entity].strict(),
          old.admin_draft ??
            Object.fromEntries(columns[entity].map((c) => [c, old[c]])),
        );
        // Restoring a version never changes identity, URL or publication; publish separately.
        if (entity !== "testimonials")
          Object.assign(data, { slug: current.slug });
        return (
          await db.query(
            `UPDATE public.${entity} SET admin_draft=$1::jsonb WHERE id=$2 RETURNING *`,
            [JSON.stringify(data), id],
          )
        ).rows[0];
      });
      res.json({ item });
    }),
  );
  router.get(
    "/audit",
    route(async (req, res) => {
      const offset = parse(
        z.coerce.number().int().min(0).max(100000),
        req.query.offset ?? 0,
      );
      const result = await pool.query(
        "SELECT entity,record_id,action,revision,created_at FROM public.admin_audit ORDER BY id DESC LIMIT 30 OFFSET $1",
        [offset],
      );
      res.json({ items: result.rows });
    }),
  );
  return router;
}
