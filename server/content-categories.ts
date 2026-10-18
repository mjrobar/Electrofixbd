import { createHash } from "node:crypto";
import type pg from "pg";
import { ApiError } from "./errors";
// Latin accents are transliterated; scripts without an ASCII transliteration use
// a deterministic title fingerprint rather than a misleading empty slug.
export function slugBase(title: string) {
  const ascii = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
  return (
    ascii ||
    "item-" +
      createHash("sha256")
        .update(title.normalize("NFC"))
        .digest("hex")
        .slice(0, 12)
  );
}
export async function proposeSlug(
  db: Pick<pg.Pool, "query">,
  kind: "services" | "works",
  title: string,
) {
  const base = slugBase(title);
  const rows = await db.query(
    `SELECT slug FROM public.${kind} WHERE slug=$1 OR slug LIKE $2`,
    [base, base + "-%"],
  );
  const used = new Set(rows.rows.map((r) => r.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = base + "-" + n;
  return slug;
}
export async function validateCategory(
  db: Pick<pg.Pool, "query">,
  kind: string,
  data: Record<string, unknown>,
  current?: Record<string, unknown>,
) {
  if (kind === "services") return;
  const previous = (current?.admin_draft as Record<string, unknown>) ?? current;
  if (!data.service_id) {
    // Existing unmapped labels may be retained verbatim, never silently remapped.
    if (
      current &&
      !previous?.service_id &&
      data.service_type === previous?.service_type &&
      (kind !== "works" || data.category === previous?.category)
    )
      return;
    throw new ApiError(
      400,
      "SERVICE_REQUIRED",
      "Select an active service category.",
    );
  }
  const result = await db.query(
    "SELECT id,name FROM public.services WHERE id=$1 AND is_active IS TRUE AND archived_at IS NULL FOR SHARE",
    [data.service_id],
  );
  if (!result.rowCount)
    throw new ApiError(
      400,
      "INVALID_SERVICE",
      "Select an active service category.",
    );
  // Preserve compatibility labels as snapshots; identity remains a foreign key.
  data.service_type = result.rows[0].name;
  if (kind === "works") data.category = result.rows[0].name;
}
