import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import catalog from "./full-content-catalog.json";
import { documentSchema } from "./cms-contract";
import { validate } from "./site-controls";
import { projectStaticRecords, renderSiteSource } from "./cms-projection";
import { columns, contentSchemas, type Kind } from "./admin-content";
import { canonical, digest, ImportConflict } from "./content-import";
import { parse, route, transaction } from "./admin-utils";
import { ApiError } from "./errors";
export const fullImportApproval = "IMPORT COMPLETE PINNED CONTENT AS DRAFTS";
export const backupTables = [
  "schema_migrations",
  "services",
  "works",
  "testimonials",
  "bookings",
  "contact_messages",
  "site_content",
  "content_history",
  "admin_audit",
  "admin_sessions",
  "media_assets",
  "review_quotas",
  "cms_documents",
  "cms_import_runs",
  "cms_publication_state",
] as const;
export function sourceUuid(kind: string, id: string) {
  const hash = digest([kind, id]).slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`;
}
export function staticRecords() {
  return [
    ...catalog.collections.services.map((s, i) => ({
      kind: "services" as const,
      id: s.id,
      source_id: s.id,
      data: {
        slug: s.slug,
        name: s.name,
        short_description: s.shortDescription,
        full_description: s.fullDescription,
        common_problems: s.commonProblems,
        service_process: s.serviceProcess,
        cover_image: s.coverImage,
        is_active: s.isActive,
        sort_order: i + 1,
      },
    })),
    ...catalog.collections.works.map((s, i) => ({
      kind: "works" as const,
      id: sourceUuid("works", s.id),
      source_id: s.id,
      data: {
        title: s.title,
        slug: s.slug,
        service_type: s.serviceType,
        category: s.category,
        description: s.description,
        media_url: s.mediaUrl,
        media_type: s.mediaType,
        is_featured: s.isFeatured ?? false,
        is_published: false,
        service_id: null,
        display_date: s.createdAt ?? "",
        sort_order: i + 1,
      },
    })),
    ...catalog.collections.testimonials.map((s, i) => ({
      kind: "testimonials" as const,
      id: sourceUuid("testimonials", s.id),
      source_id: s.id,
      data: {
        customer_name: s.customerName,
        address: s.location ?? "",
        review: s.review,
        service_type: s.serviceType,
        rating: s.rating,
        avatar_url: (s as any).avatarUrl ?? null,
        media_url: s.mediaUrl ?? null,
        media_type: s.mediaType ?? null,
        is_published: false,
        service_id: null,
        display_date: s.date ?? "",
        display_time: s.time ?? "",
        source_created_at: s.createdAt ?? "",
        sort_order: i + 1,
      },
    })),
  ];
}
export function coverageSummary() {
  const invalid = catalog.documents.flatMap((d) =>
    documentSchema.safeParse(d).success ? [] : [d.id],
  );
  const missing = catalog.inventory.filter(
    (i) => ["editorial", "collection"].includes(i.classification) && !i.target,
  );
  const records: Record<string, any[]> = {
    services: [],
    works: [],
    testimonials: [],
  };
  const normalizationErrors: string[] = [];
  for (const record of staticRecords()) {
    if (!contentSchemas[record.kind].strict().safeParse(record.data).success)
      normalizationErrors.push(
        record.kind + ":" + record.source_id + " validation",
      );
    records[record.kind].push({
      ...record.data,
      id: record.id,
      legacy_source_id: record.source_id,
    });
  }
  const projected = {
    ...projectStaticRecords(records),
    ...renderSiteSource(catalog.site_content),
  };
  for (const key of Object.keys(catalog.static_values))
    if (
      canonical((projected as any)[key]) !==
      canonical((catalog.static_values as any)[key])
    )
      normalizationErrors.push(key + " is not losslessly normalized");
  for (const kind of ["services", "works", "testimonials"]) {
    const rows = records[kind];
    if (
      new Set(rows.map((r) => r.id)).size !== rows.length ||
      (kind !== "testimonials" &&
        new Set(rows.map((r) => r.slug)).size !== rows.length)
    )
      normalizationErrors.push(kind + " duplicate source identity");
  }
  invalid.push(...normalizationErrors);
  return {
    complete: !invalid.length && !missing.length,
    outstanding: [...invalid, ...missing.map((i) => i.id)],
    source_ref: catalog.source_ref,
    snapshot_digest: catalog.snapshot_digest,
    mapping_version: catalog.mapping_version,
    original_ai_studio_reconciled: catalog.original_ai_studio_reconciled,
    source_files: catalog.sources.length,
    literals: catalog.inventory.filter((i) => i.classification !== "binding")
      .length,
    fields: catalog.inventory.filter((i) => i.target).length,
    behavior: catalog.inventory.filter((i) => i.classification === "behavior")
      .length,
    bindings: catalog.inventory.filter((i) => i.classification === "binding")
      .length,
    documents: catalog.documents.length,
    collections: {
      services: catalog.collections.services.length,
      works: catalog.collections.works.length,
      testimonials: catalog.collections.testimonials.length,
    },
    sections: catalog.documents.map((d) => ({
      id: d.id,
      source_path: d.source_path,
      groups: d.groups.length,
      items: d.groups.reduce((n, g) => n + g.items.length, 0),
      fields: d.groups.reduce(
        (n, g) => n + g.items.reduce((m, i) => m + i.fields.length, 0),
        0,
      ),
      actions: d.actions.length,
    })),
  };
}
export type Backup = {
  format: string;
  schema_version: number;
  rows: Record<string, any[]>;
  schema?: Record<string, unknown>;
  lossless_rows?: Record<string, string[]>;
};
type Entry = {
  kind: Kind | "site_content" | "cms_documents";
  id: string;
  source_id: string;
  action: "import-draft" | "skip" | "conflict";
  reason: string;
  data: any;
  current: any;
  differences: { field: string; before: unknown; after: unknown }[];
};
function diff(before: any, after: any, prefix = ""): Entry["differences"] {
  if (canonical(before ?? null) === canonical(after ?? null)) return [];
  const left = before && typeof before === "object" ? before : {},
    right = after && typeof after === "object" ? after : {};
  const keys = [
    ...new Set([...Object.keys(left), ...Object.keys(right)]),
  ].sort();
  if (keys.length)
    return keys.flatMap((k) =>
      diff(left[k], right[k], prefix ? prefix + "." + k : k),
    );
  return [
    { field: prefix || "value", before: before ?? null, after: after ?? null },
  ];
}
function seedOnly(current: any, desired: any) {
  return (
    current.revision === 0 &&
    !current.admin_draft &&
    !current.archived_at &&
    current.slug === desired.slug &&
    current.name === desired.name &&
    current.is_active === true &&
    !current.short_description &&
    !current.full_description &&
    !current.cover_image &&
    JSON.stringify(current.common_problems) === "[]" &&
    JSON.stringify(current.service_process) === "[]" &&
    current.sort_order == null
  );
}
export function buildFullPreview(backup: Backup) {
  const entries: Entry[] = [];
  for (const [id, data] of Object.entries(catalog.site_content)) {
    const parsed = validate(id as any, data);
    if (!parsed.success) throw Error("Invalid site snapshot " + id);
    const current = backup.rows.site_content?.find((r) => r.key === id) ?? null;
    const blank = id === "business_settings" ? {} : [];
    const eligible =
      !current ||
      (current.revision === 0 &&
        canonical(current.draft) === canonical(blank) &&
        canonical(current.published) === canonical(blank));
    const same = current && canonical(current.draft) === canonical(parsed.data);
    entries.push({
      kind: "site_content",
      id,
      source_id: id,
      action: eligible ? "import-draft" : same ? "skip" : "conflict",
      reason: eligible
        ? "New/untouched module"
        : same
          ? "Identical draft already present"
          : "Existing authored draft/publication preserved",
      data: parsed.data,
      current,
      differences: diff(current?.draft, parsed.data),
    });
  }
  for (const document of catalog.documents) {
    const current =
      backup.rows.cms_documents?.find((r) => r.id === document.id) ?? null;
    const eligible =
      !current ||
      (current.revision === 0 &&
        canonical(current.draft) === "{}" &&
        canonical(current.published) === "{}" &&
        !current.archived_at &&
        current.publication_state === "uninitialized" &&
        (current.mapping_version ?? catalog.mapping_version) ===
          catalog.mapping_version);
    const same =
      current &&
      (current.mapping_version ?? catalog.mapping_version) ===
        catalog.mapping_version &&
      canonical(current.draft) === canonical(document);
    entries.push({
      kind: "cms_documents",
      id: document.id,
      source_id: document.source_path,
      action: eligible ? "import-draft" : same ? "skip" : "conflict",
      reason: eligible
        ? "New/untouched source section"
        : same
          ? "Identical draft already present"
          : "Existing source section preserved",
      data: document,
      current,
      differences: diff(current?.draft, document),
    });
  }
  for (const record of staticRecords()) {
    const current =
      backup.rows[record.kind]?.find(
        (r) =>
          r.id === record.id ||
          (record.kind !== "services" &&
            r.legacy_source_id === record.source_id) ||
          (record.kind !== "testimonials" &&
            r.slug === (record.data as any).slug) ||
          (record.kind === "testimonials" &&
            r.customer_name === (record.data as any).customer_name &&
            r.review === record.data.review &&
            r.service_type === record.data.service_type &&
            r.rating === record.data.rating),
      ) ?? null;
    const same =
      current && canonical(current.admin_draft) === canonical(record.data);
    const eligible =
      !current ||
      (record.kind === "services" &&
        current.id === record.id &&
        seedOnly(current, record.data));
    entries.push({
      ...record,
      action: eligible ? "import-draft" : same ? "skip" : "conflict",
      reason: eligible
        ? current
          ? "Exact untouched foundation seed; only draft changes"
          : "Missing static record"
        : same
          ? "Identical draft already present"
          : "Existing record/slug/edit preserved",
      current,
      data: record.data,
      differences: diff(current?.admin_draft ?? current, record.data),
    });
  }
  const coverage = coverageSummary();
  const contentState = Object.fromEntries(
    ["services", "works", "testimonials", "site_content", "cms_documents"].map(
      (k) => [k, backup.lossless_rows?.[k] ?? backup.rows[k] ?? []],
    ),
  );
  const preview_digest = digest({
    snapshot: catalog.snapshot_digest,
    schema: backup.schema ?? null,
    contentState,
    entries: entries.map(({ current, ...entry }) => entry),
  });
  return {
    catalog: {
      source_ref: catalog.source_ref,
      notes: catalog.notes,
      snapshot_digest: catalog.snapshot_digest,
      mapping_version: 2,
    },
    coverage,
    entries,
    modules: entries,
    backup,
    backup_digest: digest(backup),
    preview_digest,
    totals: {
      imported: entries.filter((e) => e.action === "import-draft").length,
      skipped: entries.filter((e) => e.action === "skip").length,
      conflicted: entries.filter((e) => e.action === "conflict").length,
    },
  };
}
export async function readFullPreview(db: Pick<pg.Pool, "query">) {
  const rows: Record<string, any[]> = {};
  const lossless_rows: Record<string, string[]> = {};
  let bytes = 0;
  for (const table of backupTables) {
    const cursor = "efb_backup_" + table;
    rows[table] = [];
    lossless_rows[table] = [];
    await db.query(
      `DECLARE ${cursor} NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS row_json FROM public.${table} t`,
    );
    try {
      for (;;) {
        const batch = await db.query(`FETCH FORWARD 500 FROM ${cursor}`);
        if (!batch.rowCount) break;
        bytes += batch.rows.reduce(
          (n, row) => n + 3 * Buffer.byteLength(row.row_json, "utf8"),
          0,
        );
        if (bytes > 32 * 1024 * 1024)
          throw new ApiError(
            413,
            "BACKUP_TOO_LARGE",
            "Application backup exceeds the 32 MiB interactive limit. Arrange a reviewed native database backup; no import approval is issued.",
          );
        lossless_rows[table].push(...batch.rows.map((row) => row.row_json));
        rows[table].push(...batch.rows.map((row) => JSON.parse(row.row_json)));
      }
    } finally {
      await db.query(`CLOSE ${cursor}`);
    }
    rows[table].sort((a, b) =>
      canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0,
    );
    lossless_rows[table].sort();
  }
  const schema: Record<string, unknown> = {};
  schema.columns = (
    await db.query(
      "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1) ORDER BY table_name,ordinal_position",
      [backupTables],
    )
  ).rows;
  schema.constraints = (
    await db.query(
      "SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) ORDER BY c.relname,k.conname",
      [backupTables],
    )
  ).rows;
  schema.policies = (
    await db.query(
      "SELECT * FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1) ORDER BY tablename,policyname",
      [backupTables],
    )
  ).rows;
  schema.indexes = (
    await db.query(
      "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1) ORDER BY tablename,indexname",
      [backupTables],
    )
  ).rows;
  schema.trigger_functions = (
    await db.query(
      "SELECT pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='efb_track_change'",
    )
  ).rows;
  return buildFullPreview({
    format: "electrofix-application-backup-v2",
    schema_version: 6,
    rows,
    schema,
    lossless_rows,
  });
}
export async function fullPreview(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await readFullPreview(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function applyFullImport(pool: pg.Pool, expected: string) {
  if (!coverageSummary().complete)
    throw new ImportConflict("Required source fields are unmapped.");
  return transaction(pool, async (db) => {
    await db.query(
      "LOCK TABLE site_content,cms_documents,services,works,testimonials,cms_import_runs IN SHARE ROW EXCLUSIVE MODE",
    );
    const preview = await readFullPreview(db);
    if (preview.preview_digest !== expected)
      throw new ImportConflict(
        "Content changed after backup. Export and approve a fresh snapshot.",
      );
    const imported: Entry[] = [],
      after: Record<string, number> = {};
    for (const item of preview.entries) {
      if (item.action !== "import-draft") continue;
      let row: any;
      if (item.kind === "site_content") {
        const blank = item.id === "business_settings" ? {} : [];
        row = (
          await db.query(
            "INSERT INTO site_content(key,draft,published,revision) VALUES($1,$2,$3,1) ON CONFLICT(key) DO UPDATE SET draft=EXCLUDED.draft,updated_at=now() RETURNING *",
            [item.id, JSON.stringify(item.data), JSON.stringify(blank)],
          )
        ).rows[0];
      } else if (item.kind === "cms_documents") {
        row = (
          await db.query(
            "INSERT INTO cms_documents(id,title,source_path,draft,revision,mapping_version,source_ref) VALUES($1,$2,$3,$4,1,$5,$6) ON CONFLICT(id) DO UPDATE SET draft=EXCLUDED.draft,updated_at=now() RETURNING *",
            [
              item.id,
              item.data.title,
              item.data.source_path,
              JSON.stringify(item.data),
              catalog.mapping_version,
              catalog.source_ref,
            ],
          )
        ).rows[0];
      } else if (item.current) {
        row = (
          await db.query(
            `UPDATE public.${item.kind} SET admin_draft=$1 WHERE id=$2 RETURNING *`,
            [JSON.stringify(item.data), item.current.id],
          )
        ).rows[0];
      } else {
        const pub = item.kind === "services" ? "is_active" : "is_published";
        const values = { ...item.data, [pub]: false };
        const names = columns[item.kind];
        const extras =
          item.kind === "services"
            ? []
            : item.kind === "testimonials"
              ? ["legacy_source_id", "created_at"]
              : ["legacy_source_id"];
        row = (
          await db.query(
            `INSERT INTO public.${item.kind}(id,${[...names, ...extras, "admin_draft"].join(",")}) VALUES(${Array.from({ length: names.length + extras.length + 2 }, (_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
            [
              item.id,
              ...names.map((k) =>
                ["common_problems", "service_process"].includes(k)
                  ? JSON.stringify(values[k])
                  : (values[k] ?? null),
              ),
              ...extras.map((key) =>
                key === "legacy_source_id"
                  ? item.source_id
                  : item.data.source_created_at,
              ),
              JSON.stringify(item.data),
            ],
          )
        ).rows[0];
      }
      imported.push(item);
      after[item.kind + ":" + item.id] = row.revision;
      await db.query(
        "INSERT INTO admin_audit(entity,record_id,action,revision) VALUES($1,$2,$3,$4)",
        [item.kind, item.id, "static-import-draft", row.revision],
      );
    }
    const id = randomUUID(),
      result = {
        run_id: id,
        imported: imported.map((i) => i.kind + ":" + i.id),
        skipped: preview.entries
          .filter((i) => i.action === "skip")
          .map((i) => i.kind + ":" + i.id),
        conflicted: preview.entries
          .filter((i) => i.action === "conflict")
          .map((i) => i.kind + ":" + i.id),
        totals: preview.totals,
      };
    await db.query(
      "INSERT INTO cms_import_runs(id,snapshot_digest,preview_digest,before_content,after_revisions,result,mapping_version) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        catalog.snapshot_digest,
        expected,
        JSON.stringify(
          imported.map(({ kind, id, current }) => ({ kind, id, current })),
        ),
        JSON.stringify(after),
        JSON.stringify(result),
        catalog.mapping_version,
      ],
    );
    return result;
  });
}
export async function rollbackFullImport(pool: pg.Pool, id: string) {
  return transaction(pool, async (db) => {
    await db.query(
      "LOCK TABLE site_content,cms_documents,services,works,testimonials,cms_import_runs IN SHARE ROW EXCLUSIVE MODE",
    );
    const run = (
      await db.query("SELECT * FROM cms_import_runs WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    if (!run) throw new ApiError(404, "RUN_NOT_FOUND", "Import run not found.");
    if (run.rolled_back_at) return { run_id: id, already_rolled_back: true };
    for (const target of run.before_content) {
      const key = target.kind === "site_content" ? "key" : "id";
      const row = (
        await db.query(
          `SELECT * FROM public.${target.kind} WHERE ${key}=$1 FOR UPDATE`,
          [target.id],
        )
      ).rows[0];
      if (
        !row ||
        row.revision !== run.after_revisions[target.kind + ":" + target.id]
      )
        throw new ImportConflict(
          "A target was edited/published after import. Use version history to restore it explicitly.",
        );
    }
    for (const target of run.before_content) {
      if (target.kind === "site_content")
        await db.query(
          "UPDATE site_content SET draft=$1,updated_at=now() WHERE key=$2",
          [
            JSON.stringify(
              target.current?.draft ??
                (target.id === "business_settings" ? {} : []),
            ),
            target.id,
          ],
        );
      else if (target.kind === "cms_documents")
        await db.query(
          "UPDATE cms_documents SET draft=$1,published='{}',publication_state=$4,archived_at=CASE WHEN $2 THEN now() ELSE NULL END,updated_at=now() WHERE id=$3",
          [
            JSON.stringify(target.current?.draft ?? {}),
            !target.current,
            target.id,
            target.current?.publication_state ?? "uninitialized",
          ],
        );
      else if (target.current)
        await db.query(
          `UPDATE public.${target.kind} SET admin_draft=$1 WHERE id=$2`,
          [
            target.current.admin_draft
              ? JSON.stringify(target.current.admin_draft)
              : null,
            target.id,
          ],
        );
      else
        await db.query(
          `UPDATE public.${target.kind} SET archived_at=now(),${target.kind === "services" ? "is_active" : "is_published"}=false,admin_draft=NULL WHERE id=$1`,
          [target.id],
        );
      await db.query(
        "INSERT INTO admin_audit(entity,record_id,action) VALUES($1,$2,$3)",
        [target.kind, target.id, "static-import-rollback"],
      );
    }
    await db.query(
      "UPDATE cms_import_runs SET rolled_back_at=now() WHERE id=$1",
      [id],
    );
    return { run_id: id, restored: run.before_content.length };
  });
}
const sign = (s: string, secret: string) =>
  createHmac("sha256", secret).update(s).digest("hex");
export function createFullImportRouter(
  pool: pg.Pool,
  secret: string,
  target = { enabled: false, label: "Not approved" },
) {
  const router = Router();
  router.get("/full-content-import/inventory", (_req, res) =>
    res.json({
      coverage: coverageSummary(),
      sources: catalog.sources,
      inventory: catalog.inventory,
    }),
  );
  for (const backup of [false, true])
    router.get(
      "/full-content-import/" + (backup ? "backup" : "preview"),
      route(async (_req, res) => {
        const preview = { ...(await fullPreview(pool)), target };
        if (!backup) {
          const { backup: _, ...safe } = preview;
          return res.json(safe);
        }
        const payload =
          preview.preview_digest +
          "." +
          preview.backup_digest +
          "." +
          (Date.now() + 15 * 60 * 1000);
        res.set(
          "Content-Disposition",
          'attachment; filename="electrofix-full-backup.json"',
        );
        return res.json({
          ...preview,
          approval_token: payload + "." + sign(payload, secret),
        });
      }),
    );
  router.post(
    "/full-content-import/apply",
    route(async (req, res) => {
      if (!target.enabled || target.label === "Not approved")
        throw new ApiError(
          409,
          "TARGET_NOT_APPROVED",
          "Import is disabled until the owner approves and labels this database target.",
        );
      const input = parse(
        z
          .object({
            approval: z.literal(fullImportApproval),
            approval_token: z.string().max(300),
            acknowledge_conflicts: z.boolean(),
          })
          .strict(),
        req.body,
      );
      const pieces = input.approval_token.split(".");
      const [hash, backupHash, expiry, mac] = pieces,
        payload = pieces.slice(0, 3).join(".");
      if (
        pieces.length !== 4 ||
        !/^\d+$/.test(expiry) ||
        Number(expiry) <= Date.now() ||
        ![hash, backupHash, mac].every((v) => /^[a-f0-9]{64}$/.test(v)) ||
        !timingSafeEqual(Buffer.from(mac), Buffer.from(sign(payload, secret)))
      )
        throw new ApiError(
          409,
          "INVALID_APPROVAL",
          "Export a fresh full backup and approve its preview.",
        );
      if (!input.acknowledge_conflicts)
        throw new ApiError(
          400,
          "REVIEW_CONFLICTS",
          "Acknowledge that conflicts are preserved, not overwritten.",
        );
      try {
        return res.json(await applyFullImport(pool, hash));
      } catch (e) {
        if (e instanceof ImportConflict)
          throw new ApiError(409, "IMPORT_CONFLICT", e.message);
        throw e;
      }
    }),
  );
  router.get(
    "/full-content-import/export",
    route(async (_req, res) => {
      const preview = await fullPreview(pool);
      res.set(
        "Content-Disposition",
        'attachment; filename="electrofix-editorial-export.json"',
      );
      res.json({
        format: "electrofix-editorial-export-v2",
        snapshot_digest: catalog.snapshot_digest,
        source_ref: catalog.source_ref,
        rows: Object.fromEntries(
          [
            "services",
            "works",
            "testimonials",
            "site_content",
            "cms_documents",
            "content_history",
          ].map((t) => [t, preview.backup.rows[t]]),
        ),
      });
    }),
  );
  router.get(
    "/full-content-import/runs",
    route(async (_req, res) =>
      res.json({
        items: (
          await pool.query(
            "SELECT id,snapshot_digest,result,created_at,rolled_back_at FROM cms_import_runs ORDER BY created_at DESC LIMIT 30",
          )
        ).rows,
      }),
    ),
  );
  router.post(
    "/full-content-import/runs/:id/rollback",
    route(async (req, res) => {
      if (!target.enabled || target.label === "Not approved")
        throw new ApiError(
          409,
          "TARGET_NOT_APPROVED",
          "Import rollback is disabled until the owner approves and labels this database target.",
        );
      parse(
        z
          .object({ approval: z.literal("ROLL BACK UNEDITED IMPORT DRAFTS") })
          .strict(),
        req.body,
      );
      const id = parse(z.string().uuid(), req.params.id);
      try {
        return res.json(await rollbackFullImport(pool, id));
      } catch (e) {
        if (e instanceof ImportConflict)
          throw new ApiError(409, "ROLLBACK_CONFLICT", e.message);
        throw e;
      }
    }),
  );
  return router;
}
