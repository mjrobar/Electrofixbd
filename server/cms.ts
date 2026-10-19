import { createContentRepository } from "./content";
import { paginationSchema } from "../shared/api";
import { renderCollectionRow, renderDocument } from "./cms-projection";
import { assertMediaReferences } from "./media-storage";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import catalog from "./full-content-catalog.json";
import { documentSchema, documentDefinitions } from "./cms-contract";
import {
  parse,
  route,
  revisionSchema,
  transaction,
  conflict,
} from "./admin-utils";
import { ApiError } from "./errors";
const definition = (id: string) => catalog.documents.find((d) => d.id === id);
async function checkImages(db: Pick<pg.Pool, "query">, document: any) {
  for (const g of document.groups)
    for (const i of g.items)
      for (const f of i.fields)
        if (f.kind === "media")
          await assertMediaReferences(db, { media_url: f.value });
}
export function createCmsRouter(pool: pg.Pool) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/cms/documents",
    route(async (_req, res) =>
      res.json({
        definitions: documentDefinitions,
        items: (
          await pool.query(
            "SELECT id,title,publication_state,revision,archived_at FROM cms_documents ORDER BY id",
          )
        ).rows,
      }),
    ),
  );
  router.get(
    "/cms/documents/:id",
    route(async (req, res) => {
      const source = definition(req.params.id);
      if (!source)
        throw new ApiError(404, "UNKNOWN_DOCUMENT", "Unknown CMS section.");
      const current = (
        await pool.query("SELECT * FROM cms_documents WHERE id=$1", [source.id])
      ).rows[0];
      res.json({
        item: current ?? {
          id: source.id,
          title: source.title,
          source_path: source.source_path,
          draft: {},
          published: {},
          revision: 0,
          publication_state: "uninitialized",
        },
        template: source,
      });
    }),
  );
  router.put(
    "/cms/documents/:id/draft",
    route(async (req, res) => {
      const input = parse(
        z.object({ revision: revisionSchema, data: documentSchema }).strict(),
        req.body,
      );
      if (input.data.id !== req.params.id)
        throw new ApiError(400, "WRONG_DOCUMENT", "Document identity differs.");
      const item = await transaction(pool, async (db) => {
        await db.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,21))",
          [req.params.id],
        );
        const current = (
          await db.query("SELECT * FROM cms_documents WHERE id=$1 FOR UPDATE", [
            req.params.id,
          ])
        ).rows[0];
        if ((current?.revision ?? 0) !== input.revision) throw conflict();
        if (current?.archived_at)
          throw new ApiError(
            409,
            "ARCHIVED",
            "Restore this section before editing.",
          );
        if (current && current.mapping_version !== catalog.mapping_version)
          throw new ApiError(
            409,
            "MAPPING_VERSION_CONFLICT",
            "Export and review a source mapping upgrade before editing this version.",
          );
        await checkImages(db, input.data);
        const saved = (
          await db.query(
            `INSERT INTO cms_documents(id,title,source_path,draft,revision,mapping_version,source_ref) VALUES($1,$2,$3,$4,1,$5,$6) ON CONFLICT(id) DO UPDATE SET draft=EXCLUDED.draft,title=EXCLUDED.title,updated_at=now() RETURNING *`,
            [
              input.data.id,
              input.data.title,
              input.data.source_path,
              JSON.stringify(input.data),
              catalog.mapping_version,
              catalog.source_ref,
            ],
          )
        ).rows[0];
        if (!current)
          await db.query(
            "INSERT INTO admin_audit(entity,record_id,action,revision) VALUES($1,$2,$3,$4)",
            ["cms_documents", input.data.id, "create-draft", saved.revision],
          );
        return saved;
      });
      res.json({ item });
    }),
  );
  for (const action of ["publish", "unpublish", "archive", "restore"] as const)
    router.post(
      "/cms/documents/:id/" + action,
      route(async (req, res) => {
        if (!definition(req.params.id))
          throw new ApiError(404, "UNKNOWN_DOCUMENT", "Unknown CMS section.");
        const input = parse(
          z.object({ revision: revisionSchema }).strict(),
          req.body,
        );
        const item = await transaction(pool, async (db) => {
          const current = (
            await db.query(
              "SELECT * FROM cms_documents WHERE id=$1 FOR UPDATE",
              [req.params.id],
            )
          ).rows[0];
          if (!current)
            throw new ApiError(404, "NOT_FOUND", "Save/import a draft first.");
          if (current.revision !== input.revision) throw conflict();
          if (current.archived_at && action !== "restore")
            throw new ApiError(409, "ARCHIVED", "Restore section first.");
          if (action === "publish") {
            parse(documentSchema, current.draft);
            await checkImages(db, current.draft);
          }
          return (
            await db.query(
              `UPDATE cms_documents SET ${action === "publish" ? "published=draft,publication_state='published'" : action === "archive" ? "archived_at=now(),published='{}',publication_state='unpublished'" : action === "restore" ? "archived_at=NULL,publication_state='unpublished',published='{}'" : "published='{}',publication_state='unpublished'"},updated_at=now() WHERE id=$1 RETURNING *`,
              [req.params.id],
            )
          ).rows[0];
        });
        res.json({ item });
      }),
    );
  return router;
}
export function createPublicCmsRouter(pool: pg.Pool) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/cms/collections/:kind",
    route(async (req, res) => {
      const kind = parse(
          z.enum(["services", "works", "testimonials"]),
          req.params.kind,
        ),
        page = parse(paginationSchema, req.query),
        client = await pool.connect();
      let rows: any[], state: string;
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const repository = createContentRepository(client);
        rows =
          kind === "services"
            ? await repository.listServices(page)
            : kind === "works"
              ? await repository.listWorks(page)
              : await repository.listTestimonials(page);
        state =
          (
            await client.query(
              "SELECT state FROM cms_publication_state WHERE key=$1",
              [kind],
            )
          ).rows[0]?.state ?? "uninitialized";
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
      res.json({
        success: true,
        contract_version: 2,
        state,
        fallback_allowed: state === "uninitialized",
        items: rows.map((row) => renderCollectionRow(kind, row)),
        pagination: page,
      });
    }),
  );
  router.get(
    "/cms/publication",
    route(async (_req, res) =>
      res.json({
        success: true,
        collections: (
          await pool.query(
            "SELECT key,state FROM cms_publication_state ORDER BY key",
          )
        ).rows,
        documents: (
          await pool.query(
            "SELECT id,publication_state AS state FROM cms_documents ORDER BY id",
          )
        ).rows,
        semantics: {
          fallback_only_when: "uninitialized",
          empty_publication: "authoritative",
        },
      }),
    ),
  );
  router.get(
    "/cms/documents/:id",
    route(async (req, res) => {
      if (!definition(req.params.id))
        throw new ApiError(404, "UNKNOWN_DOCUMENT", "Unknown CMS section.");
      res.set("Cache-Control", "no-store");
      const current = (
        await pool.query(
          "SELECT published,publication_state,revision FROM cms_documents WHERE id=$1",
          [req.params.id],
        )
      ).rows[0];
      res.json({
        success: true,
        state: current?.publication_state ?? "uninitialized",
        data: current?.published ?? {},
        render_ready:
          current?.publication_state === "published"
            ? renderDocument(current.published)
            : null,
        revision: current?.revision ?? 0,
        fallback_allowed:
          !current || current.publication_state === "uninitialized",
      });
    }),
  );
  return router;
}
