/** Explicit operator maintenance only; never invoked at application startup. */
import pg from "pg";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { unlink } from "node:fs/promises";
import { loadConfig } from "../server/config";
import { mediaRoot } from "../server/media-storage";
import { transaction } from "../server/db/transaction";
export async function retainMedia(pool: pg.Pool, root: string, apply = false) {
  const candidates = (
    await pool.query(
      "SELECT id,filename FROM public.media_assets WHERE review_id IS NULL AND created_at<now()-interval '48 hours' ORDER BY created_at LIMIT 100",
    )
  ).rows;
  const removed: string[] = [];
  for (const candidate of candidates) {
    if (candidate.filename !== candidate.id + ".webp")
      throw Error("Invalid stored media filename.");
    const eligible = await transaction(pool, async (db) => {
      // Lock first; a second statement sees committed references after a concurrent save.
      const asset = await db.query(
        "SELECT id FROM public.media_assets WHERE id=$1 AND review_id IS NULL FOR UPDATE",
        [candidate.id],
      );
      if (!asset.rowCount) return false;
      const reference = "/api/media/" + candidate.id;
      for (const table of [
        "services",
        "works",
        "testimonials",
        "site_content",
        "content_history",
      ]) {
        if (
          (
            await db.query(
              `SELECT 1 FROM public.${table} t WHERE strpos(to_jsonb(t)::text,$1)>0 LIMIT 1`,
              [reference],
            )
          ).rowCount
        )
          return false;
      }
      if (apply)
        await db.query(
          "UPDATE public.media_assets SET deleted_at=coalesce(deleted_at,now()),claim_hash=NULL WHERE id=$1",
          [candidate.id],
        );
      return true;
    });
    if (!eligible) continue;
    if (apply) {
      try {
        await unlink(join(root, candidate.filename));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    removed.push(candidate.id);
  }
  if (apply)
    await pool.query(
      "DELETE FROM public.review_quotas WHERE day<CURRENT_DATE-30",
    );
  return removed;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const url = process.env.MEDIA_MAINTENANCE_DATABASE_URL;
  if (!url)
    throw Error(
      "Set explicit MEDIA_MAINTENANCE_DATABASE_URL; no DATABASE_URL fallback.",
    );
  const apply = process.argv.includes("--apply");
  if (
    apply &&
    (!process.argv.includes("--backup-reviewed") ||
      process.env.MEDIA_RETENTION_APPROVAL !== "REMOVE UNREFERENCED MEDIA")
  )
    throw Error(
      "Reviewed backup and explicit media retention approval required.",
    );
  const config = loadConfig({
    NODE_ENV: process.env.NODE_ENV || "production",
    DATABASE_URL: url,
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN,
    MEDIA_ROOT: process.env.MEDIA_ROOT,
    MEDIA_STORAGE_DURABLE: process.env.MEDIA_STORAGE_DURABLE,
  });
  const root = await mediaRoot(config),
    pool = new pg.Pool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
    });
  try {
    console.log(
      JSON.stringify({
        apply,
        eligible_media: await retainMedia(pool, root, apply),
      }),
    );
  } finally {
    await pool.end();
  }
}
