import { createHmac } from "node:crypto";
import type pg from "pg";
import { ApiError } from "./errors";
export async function reviewQuota(
  db: Pick<pg.Pool, "query">,
  secret: string,
  ip: string,
  kind: "uploads" | "submissions",
) {
  // Global daily ceiling bounds disk growth even when attackers rotate IPs.
  for (const [bucket, limit] of [
    ["global", kind === "uploads" ? 200 : 500],
    [
      createHmac("sha256", secret).update(ip).digest("hex"),
      kind === "uploads" ? 5 : 5,
    ],
  ] as const) {
    const result = await db.query(
      `INSERT INTO public.review_quotas(bucket,day,${kind}) VALUES($1,CURRENT_DATE,1) ON CONFLICT(bucket,day) DO UPDATE SET ${kind}=review_quotas.${kind}+1 WHERE review_quotas.${kind}<$2 RETURNING bucket`,
      [bucket, limit],
    );
    if (!result.rowCount)
      throw new ApiError(
        429,
        "REVIEW_QUOTA",
        "Daily submission limit reached. Please try tomorrow.",
      );
  }
}
