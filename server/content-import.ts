import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import catalog from "./existing-content-catalog.json";
import { validate, type Key } from "./site-controls";

// Full-fidelity migration gate: the old four-module catalog is incomplete.
// Never allow approval while public sitewide and detailed copy remains unmapped.
export const outstandingContentCoverage = [
  "Navbar announcements and navigation labels",
  "Footer copy, footer navigation and contact labels",
  "Contact page detailed cards and form editorial labels",
  "Services page filters, search and pagination labels",
  "Remaining About editorial text and presentation elements",
  "Remaining testimonials and sitewide UI copy",
  "Final Google AI Studio public frontend reconciliation",
] as const;
export const completeContentCoverage = outstandingContentCoverage.length === 0;
export const importApproval = "IMPORT EXISTING CONTENT AS DRAFTS";
export const importKeys: Key[] = ["hero_slides", "faqs", "business_settings", "page_sections"];
export type ContentRow = { key: Key; draft: unknown; published: unknown; revision: number; updated_at: string | Date };
// Canonical JSON ensures PostgreSQL JSONB key ordering cannot invalidate the preview.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical((value as Record<string,unknown>)[key])).join(",") + "}";
  return JSON.stringify(value);
}
export function digest(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }
function empty(key: Key, value: unknown) {
  return key === "business_settings" ? value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0 : Array.isArray(value) && value.length === 0;
}
export function buildImportPreview(rows: ContentRow[]) {
  const backup = { format: "electrofix-site-content-v1", rows: [...rows].sort((a,b) => a.key.localeCompare(b.key)) };
  const modules = importKeys.map(key => {
    const row = rows.find(row => row.key === key);
    const result = validate(key, catalog.data[key]);
    if (!result.success) throw Error("Invalid import catalog: " + key);
    const eligible = !row || row.revision === 0 && empty(key,row.draft) && empty(key,row.published);
    return { key, action: eligible ? "import-draft" : "skip", reason: eligible ? row ? "Untouched migration placeholder" : "Missing module" : "Existing authored content or revision; preserved", data: result.data };
  });
  const backup_digest = digest(backup);
  const preview_digest = digest({ backup_digest, modules, catalog });
  return { catalog, backup, backup_digest, preview_digest, modules, coverage: { complete: completeContentCoverage, outstanding: [...outstandingContentCoverage] } };
}
export async function readImportPreview(db: Pick<pg.Pool, "query">) {
  const result = await db.query<ContentRow>("SELECT key,draft,published,revision,updated_at FROM public.site_content ORDER BY key");
  return buildImportPreview(result.rows);
}
export class ImportConflict extends Error {}
export async function applyContentImport(db: pg.Pool, expectedDigest: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    // Also serializes absent-row inserts and draft/publish edits against the approved snapshot.
    await client.query("LOCK TABLE public.site_content IN SHARE ROW EXCLUSIVE MODE");
    const preview = await readImportPreview(client);
    if (preview.preview_digest !== expectedDigest) throw new ImportConflict("Content changed after preview. Download a fresh backup and review again.");
    for (const item of preview.modules) {
      if (item.action !== "import-draft") continue;
      const placeholder = item.key === "business_settings" ? {} : [];
      await client.query(`INSERT INTO public.site_content (key,draft,published,revision)
        VALUES ($1,$2::jsonb,$3::jsonb,1)
        ON CONFLICT (key) DO UPDATE SET draft=EXCLUDED.draft,revision=site_content.revision+1,updated_at=now()
        WHERE site_content.revision=0 AND site_content.draft=$3::jsonb AND site_content.published=$3::jsonb`,
        [item.key,JSON.stringify(item.data),JSON.stringify(placeholder)]);
    }
    await client.query("COMMIT");
    return { imported: preview.modules.filter(item=>item.action === "import-draft").map(item=>item.key), skipped: preview.modules.filter(item=>item.action === "skip").map(item=>item.key) };
  } catch (error) { await client.query("ROLLBACK").catch(()=>{}); throw error; }
  finally { client.release(); }
}
function sign(value: string, secret: string) { return createHmac("sha256",secret).update(value).digest("hex"); }
export function createContentImportRouter(db: pg.Pool, secret: string) {
  const router = Router();
  // Mounted behind the existing session and Origin/CSRF checks. No public import endpoint.
  router.get("/site-content-import/preview", async (_req,res) => {
    try { const preview = await readImportPreview(db); return res.json(preview); }
    catch { return res.status(503).json({error:"Import preview unavailable. Verify migration 003 and retry."}); }
  });
  router.get("/site-content-import/backup", async (_req,res) => {
    try {
      const preview = await readImportPreview(db);
      const payload = `${preview.preview_digest}.${Date.now()+15*60*1000}`;
      res.setHeader("Content-Disposition",'attachment; filename="electrofix-content-backup.json"');
      return res.json({ ...preview, approval_token: payload+"."+sign(payload,secret) });
    } catch { return res.status(503).json({error:"Backup could not be exported. Import remains disabled."}); }
  });
  router.post("/site-content-import/apply", async (req,res) => {
    if (!completeContentCoverage) return res.status(409).json({error:"Full content import is blocked: some website content is not yet mapped.", outstanding:[...outstandingContentCoverage]});
    if(req.body?.approval !== importApproval || typeof req.body?.approval_token !== "string") return res.status(400).json({error:"Download a backup and explicitly approve the draft import first."});
    const [hash,expiry,mac,...extra] = req.body.approval_token.split(".");
    const expected = sign(`${hash}.${expiry}`,secret);
    if(extra.length || !/^[a-f0-9]{64}$/.test(hash||"") || !/^\d+$/.test(expiry||"") || Number(expiry)<=Date.now() || typeof mac!=="string" || !/^[a-f0-9]{64}$/.test(mac) || !timingSafeEqual(Buffer.from(mac),Buffer.from(expected))) return res.status(409).json({error:"Backup approval expired or invalid. Export a fresh backup."});
    try { return res.json(await applyContentImport(db,hash)); }
    catch(error) { return res.status(error instanceof ImportConflict ? 409 : 503).json({error:error instanceof ImportConflict ? error.message : "Import failed; no changes were committed."}); }
  });
  return router;
}
