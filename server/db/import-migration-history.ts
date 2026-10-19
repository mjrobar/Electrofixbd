import type pg from "pg";
import manifest from "./migration-manifest.json";
import {
  inspectMigrationLedgers,
  type MigrationArtifact,
} from "./migration-ledger";
import { ApiError } from "../errors";
import { digest } from "../content-import";
export async function importMigrationHistory(db: Pick<pg.Pool, "query">) {
  let validation: Awaited<ReturnType<typeof inspectMigrationLedgers>>;
  try {
    validation = await inspectMigrationLedgers(
      db,
      manifest as MigrationArtifact[],
    );
  } catch {
    throw new ApiError(
      503,
      "MIGRATION_HISTORY_UNAVAILABLE",
      "Cannot inspect migration history. Run the read-only preflight with this runtime role and review ledger/schema access. No fallback or repair was attempted.",
    );
  }
  if (!validation.valid || !validation.selected)
    throw new ApiError(
      409,
      "MIGRATION_HISTORY_INVALID",
      "Migration history is missing, unknown or conflicting. Run the read-only preflight and review its errors; do not rerun migrations or repair a ledger to bypass validation.",
    );
  if (!validation.provenance_verified)
    throw new ApiError(
      409,
      "MIGRATION_PROVENANCE_UNVERIFIED",
      "Historical SQL/checksum provenance is incomplete. Review the read-only preflight before approving an import or rollback.",
    );
  return {
    source: validation.selected,
    history_digest: digest(validation),
    validation,
  };
}
