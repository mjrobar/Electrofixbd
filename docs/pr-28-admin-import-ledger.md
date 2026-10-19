# PR #28: Admin full-import migration history correction

## Root cause and implementation

The Secondary CLI preflight already understood Supabase-managed history, but the Admin importer still defaulted to `public.schema_migrations`. Its Preview and Backup endpoints consequently failed with `ADMIN_UNAVAILABLE` even when the read-only preflight had verified the actual ledger.

The Admin Preview, Backup, Apply, Rollback and editorial Export now use the same read-only migration proof core as the Secondary preflight. Both native PostgreSQL and Supabase-managed histories are supported. Neither ledger is created, rewritten, adopted or replayed. If both exist, both must validate; a conflicting or inaccessible ledger cannot be bypassed by selecting the other. Unknown, missing, duplicated, out-of-order or modified migration evidence fails closed. Admin operations additionally require complete verified provenance, rather than accepting a metadata-only warning.

The production Node bundle includes a reviewed manifest of migrations 001–006 and the existing strictly pinned historical Migration 003 mapping. Runtime verification requires no SQL source directory, current-working-directory assumption or filesystem-based migration execution. Exact LF and CRLF file checksums are included for Windows portability; arbitrary checksum or SQL changes are rejected. All six SQL files and the historical mapping pins are unchanged. Unit tests compare the embedded manifest against every source migration. This offline consistency check also runs without opening a database:

```powershell
node --import tsx .\scripts\build-migration-manifest.ts --check
```

That command does not update the manifest. Never regenerate a hash to conceal changes to an applied migration; source changes require migration/provenance review.

Preview and Backup run in read-only, repeatable-read transactions. They retain the actual ledger's fully qualified source, validation result and history digest. The logical `rows.schema_migrations` backup key contains the selected physical ledger; a second validated history, when present, is also backed up under its fully qualified key. Original PostgreSQL JSON text remains in `lossless_rows`.

Apply revalidates history inside its repeatable-read transaction before any content change. The approved preview digest includes the selected source and history proof, so switching ledgers or changing content/schema after backup invalidates approval. A successful run stores its ledger binding in the existing `cms_import_runs.result` JSON. Rollback validates current history and that binding before checking all target revisions and making any change. No new schema migration is required.

Existing authentication, CSRF protection, disabled-by-default target approval, expiring signed backup approval, draft-only import, conflict preservation, revision checks, customer-table exclusions and rollback confirmation remain enforced. Public frontend files and Admin design are unchanged.

## Update and read-only local check on Windows

Stop the local Node process first. Run from the existing clean checkout with Node 24:

```powershell
git switch feat/issue-21-complete-cms
if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed; stop.' }
git pull --ff-only origin feat/issue-21-complete-cms
if ($LASTEXITCODE -ne 0) { throw 'Update failed; stop.' }
npm ci --strict-peer-deps
if ($LASTEXITCODE -ne 0) { throw 'Install failed; stop.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed; stop.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed; stop.' }
$env:CONTENT_IMPORT_ENABLED = 'false'
npm run dev
```

Use only the previously verified Secondary runtime configuration. Do not substitute Primary credentials. Open Admin → Website Content → Existing content import. Preview remains read-only even with import disabled. Expected managed-only result: HTTP 200, `migration_ledger.source = supabase_migrations.schema_migrations`, `provenance_verified = true`, and the existing conflict/skip/importable counts for this database. These counts depend on existing edits; do not assume pristine totals. A private Backup download is also read-only, but includes sensitive application/customer records and must stay in protected storage.

For the independent read-only preflight, keep the existing verified `SECONDARY_DATABASE_URL`, `SECONDARY_PROJECT_REF` and target identity configuration described in the [Secondary runbook](issue-21-secondary-acceptance.md), then run:

```powershell
node --import tsx .\scripts\secondary-content-acceptance.ts "C:\PrivateBackups\issue21-preflight-$(Get-Date -Format yyyyMMdd-HHmmss).json"
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; stop and review the report.' }
```

No migration, grant, ledger repair or import command is part of this update. A runtime role without SELECT access to the actual history receives `MIGRATION_HISTORY_UNAVAILABLE`; review access separately instead of creating another ledger. Invalid history receives `MIGRATION_HISTORY_INVALID`; unavailable historical proof receives `MIGRATION_PROVENANCE_UNVERIFIED`.

## Validation and limitations

Local Node 24 verification passed: TypeScript lint, client/server production build, **75 automated tests: 56 passed, 0 failed, 19 database-dependent tests skipped**, and two database-unavailable startup/routing checks. The eight additional tests use an in-memory SQL protocol sink and loopback HTTP, not a PostgreSQL connection. They cover both ledger formats through all four operations, exact reviewed 003 provenance, dual-history conflicts, missing/modified/unverified history, permission failures, stale source bindings, legacy run refusal, raw history backup, approval guards and rollback state.

Native Windows CI uses the existing isolated workflow with all database connection variables empty; its result is linked on [PR #28](https://github.com/mjrobar/Electrofixbd/pull/28/checks). Production compilation retains the existing Vite configuration and server bundle-size warnings.

No database connection, migration, import, ledger modification, customer change, merge or deployment was performed for this fix. Primary Supabase was not accessed. The reported successful Secondary preflight is owner-provided evidence, not a new observation made here. Real PostgreSQL apply/rollback behavior and local Windows Admin acceptance remain unverified in this task.

After updating, discard earlier backup approval tokens and download a fresh protected backup before any separately approved import. Existing import runs without the new verified ledger binding cannot use automatic bulk rollback; preserve a backup and review their per-record history instead. This is a safety refusal, not a reason to edit a run or ledger manually. Import/rollback writes still require separate owner approval and explicit importer enablement.
