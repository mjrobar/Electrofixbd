# Issue 21 Secondary Supabase review and Windows acceptance

**Current Secondary status:** the owner reports migrations 001–006 are already applied through Supabase's migration system, with `supabase_migrations.schema_migrations` present and no `public.schema_migrations`. Do not create a public ledger, adopt/repair history or rerun migrations to satisfy this preflight. Codex has not connected to either project or independently verified this database state. Primary remains untouched; no new database operation is authorized by this tooling fix. Import/publication and test writes still require separate explicit approval.

## Exact review artifacts

- Exact SQL: [`db/migrations/006_full_cms_inventory.sql`](../db/migrations/006_full_cms_inventory.sql). It is the complete executable SQL, not a pseudocode excerpt. SHA-256: `45e01f793e3aa7cb730ffd35d4532bafd9d8568bd4b63750e81fe123318e8ff2`.
- Optional separately reviewed runtime grants: [`db/security/002_issue21_runtime_grants.sql`](../db/security/002_issue21_runtime_grants.sql). This is not an automatically executed migration. Review role/ownership/browser privileges before applying.
- Pinned source Git ref: `d8610dcdd87c6fcf6034ec08ca8122fce780627c`.
- Catalogue snapshot digest: `7c47fbc8894e7b53a2229ce12259f50bc1e971b115c26efd5b99f22fd3b558aa`.
- [Complete inventory](issue-21-full-content-inventory.md), [field TSV](issue-21-field-inventory.tsv), [public integration specification](issue-21-public-cms-contract.md).

006 adds three RLS-enabled CMS tables, additive source/display/order columns, the CMS history entity/trigger and seven initial publication-state configuration rows. It does not update/delete any existing customer/editorial record. It replaces the shared revision function while preserving invoker security and existing history/audit behavior. Review the function, role permissions, lock requirements and deployed schema names before approval. Migrations 001–005 are unchanged. Static parsing is not a PostgreSQL execution test.

## Environment and target separation

Use Node 24 and the lockfile. Keep all passwords/connection strings outside Git, screenshots and reports. Close any app still pointed at Primary before testing. Do not copy Primary credentials into this checkout. Use separate Windows terminals/configuration for operator and runtime credentials.

| Variable | Purpose |
|---|---|
| `SECONDARY_PROJECT_NAME=Electrofixbd.Test Project` | Exact project label required by read-only tooling |
| `SECONDARY_PROJECT_REF=<reviewed secondary ref>` | Owner verifies against the dashboard |
| `PRIMARY_PROJECT_REF=<primary ref only>` | Denylist identifier; no Primary URL/password required |
| `SECONDARY_DATABASE_URL=<secondary direct/session PostgreSQL URL>` | Explicit target, including verified TLS; tooling never falls back to DATABASE_URL |
| `DATABASE_URL=<secondary runtime-role URL>` | App only, after migration approval; least-privileged server credential |
| `MIGRATION_DATABASE_URL=<secondary migration-role URL>` | Operator only, only during explicitly approved migration; clear immediately afterward |
| `PUBLIC_ORIGIN=http://localhost:3000` | Local development CSRF origin; use exact HTTPS origin for production |
| `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=3000` | Local Windows binding; do not expose acceptance server publicly |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | Existing owner login; generate password hash with the existing password-hash script; use a private random session secret |
| `REVIEW_ABUSE_SECRET` | Private random string, at least 32 characters, for persistent review abuse protection |
| `MEDIA_ROOT=C:\ElectrofixBD\durable-media` | Private durable directory outside checkout/build; service account read/write, not webroot |
| `MEDIA_STORAGE_DURABLE=true` | Explicit durability acknowledgment; backup this directory |
| `CONTENT_IMPORT_ENABLED=false` | Default; keep disabled until explicit import approval |
| `CONTENT_IMPORT_TARGET_LABEL=Electrofixbd.Test Project — OWNER VERIFIED SECONDARY` | Owner-facing import target; requires separate database identity verification, not proof by itself |
| `TRUST_PROXY=false` | Local; final host must configure exact trusted reverse proxy only |

Do not set `TEST_DATABASE_URL`. Do not run `tests/admin-ui.check.mjs`, database integration tests or disposable helpers against shared Secondary. Do not use transaction pooler port 6543 for migration/pg_dump. Choose direct or session mode (typically 5432), verify host and pooler username match the Secondary ref, and validate TLS certificates. Never use `sslmode=no-verify`. Read-only scripts reject mismatched refs and Primary hosts/usernames. Their target guard does not authorize a connection: do not run them until the owner approves Secondary access.

## Preflight and backup (operator, after access approval)

1. Record the reviewed branch/commit and verify the SQL hash with PowerShell:
   ```powershell
   Get-FileHash db/migrations/006_full_cms_inventory.sql -Algorithm SHA256
   ```
   Git must preserve the committed SQL bytes (LF). Do not edit migration checksums to bypass CRLF/content drift. Compare committed 001–006 bytes/actual ledger and resolve discrepancies by review.
2. Set the explicit Secondary variables above. Run read-only preflight, writing into a private directory outside the repository:
   ```powershell
   node --import tsx scripts/secondary-content-acceptance.ts C:\PrivateBackups\issue21-before.json
   ```
   The script uses one read-only repeatable-read transaction. It detects `public.schema_migrations` and/or `supabase_migrations.schema_migrations` without creating either; both must validate if both exist. All committed migration versions 001–006 must be accounted for, without unknown/duplicate/out-of-order identities. Native checksums are mandatory. Supabase names may match the numbered filename or its unnumbered stem; timestamp versions can also be identified by exact stored SQL provenance. Short numeric versions can identify older ledgers. Timestamp-only rows without names or source evidence cannot be guessed from a row count.

   A single explicitly reviewed historical identity is supported: `20261017052646 / create_site_content_controls` → `003_site_content.sql`. [The comparison report](issue-21-migration-003-provenance.md) contains the SELECT-only Secondary evidence, exact formatting difference, schema comparison and pinned hashes. This mapping requires the exact recorded identity plus both the unchanged committed file hash and original stored statements-array hash. Missing/changed evidence fails; no name-only alias or global dollar-body normalization is used. Current site-content defaults/nullability/four-key constraint are also independently checked. Do not replay 003 or edit the ledger to rename this migration.

   Stored checksums are compared where available. Supabase `statements` are compared to committed SQL using a token digest that ignores outer formatting/comments but preserves quoted values and dollar-quoted function bodies (only CRLF/LF is normalized). Statement splitting/final delimiters are accommodated; available but mismatched SQL is an error, never silently ignored. Empty/absent historical SQL is reported as unavailable, with `provenance_verified:false` and an explicit owner-review warning, not an invented checksum. SQL version identity alone does not prove historical source equivalence.

   Application tables are checked independently: core column/key/FK compatibility, 004–006 column types, CMS/source identity keys, validated CMS/moderation constraints and enabled invoker revision/history triggers. `missing_tables` concerns actual application tables; absence of the native ledger is not a missing application table. `migration_validation`, `schema_validation` and the top-level `compatible` field report the separate checks. A missing/invalid ledger, schema mismatch or incomplete `--verify` produces exit code 1 after writing the report. Permission/inspection errors fail without falling back to another ledger. No automatic repair/import occurs.

   Exact PowerShell rerun command from the updated checkout, using the same previously verified Secondary environment variables and an existing private backup directory:
   ```powershell
   node --import tsx .\scripts\secondary-content-acceptance.ts "C:\PrivateBackups\issue21-preflight-$(Get-Date -Format yyyyMMdd-HHmmss).json"
   ```
   A fresh filename avoids overwriting prior evidence. This default preflight reads metadata, history and counts only. The optional `--verify` compares content read-only; it never imports. The read-only backup helper also uses the validated physical ledger and records its fully qualified source rather than requiring a synthetic public ledger. Stop and review any failure; do not run migrations or ledger repair to force a passing report.
3. Arrange a maintenance window and stop acceptance writes. Obtain a full native custom-format database backup with a suitable PostgreSQL client version. Set `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` to the verified Secondary operator connection locally; set `PGSSLMODE=verify-full` and a trusted `PGSSLROOTCERT` where needed. Never print credentials. Example commands (not run here):
   ```powershell
   pg_dump --format=custom --file=C:\PrivateBackups\secondary-before-import.dump
   if ($LASTEXITCODE -ne 0) { throw 'Backup failed; stop.' }
   pg_restore --list C:\PrivateBackups\secondary-before-import.dump > C:\PrivateBackups\secondary-before-import.list.txt
   if ($LASTEXITCODE -ne 0) { throw 'Backup inspection failed; stop.' }
   Get-FileHash C:\PrivateBackups\secondary-before-import.dump -Algorithm SHA256
   ```
   Retain ownership/ACL information. Supabase may restrict managed schemas; inspect the archive scope and document exclusions, dashboard backup availability and the separate role/grants recovery plan. Archive-list verification does not prove restore; a separately authorized restore rehearsal is required before production approval. Do not restore into either real project during this task.
4. Copy the entire durable media directory with coordinated DB snapshot timing to encrypted private backup storage, preserving a file manifest and hashes. Retain original configuration/role names privately. Restrict Windows ACLs to the operator (POSIX `0600` alone is not Windows protection). Keep backup/digests and manifest in separate protected storage. Never upload customer/session backups to GitHub.

## Already applied migrations: no replay

For this Secondary project, 001–006 are already applied via Supabase according to owner verification. **Do not run `scripts/migrate.ts`, `supabase db push`, migration repair/adoption, CREATE/INSERT into a ledger, or Migration 006 again.** The portable migration runner remains unchanged and expects its own native ledger; this fix provides read-only recognition of the actual managed ledger, not conversion between migration systems. A migration-ledger naming difference is not evidence that the schema is missing.

Use the read-only preflight above to inspect actual schema and source evidence. Any unknown version, checksum/SQL mismatch or actual schema gap requires owner review of the report and applied artifacts. Additional runtime grants or schema changes remain separate approval decisions; do not automatically run ACL scripts. Preserve the existing native/media backup plan for any subsequently approved operation.

## Full import (separate explicit approval)

1. Confirm owner approval for a **draft-only Secondary import**, target identity, exact source snapshot and conflicts. Configure the Node app with Secondary runtime credentials only; restart with `CONTENT_IMPORT_ENABLED=true` and the clear target label. Do not publish automatically.
2. Open Admin → Website Content → Existing content import. Preview is read-only and reports every eligible/identical/conflicted entry and recursive field differences. Expected pristine source totals: **50 entries = 19 documents + 4 site modules + 6 services + 12 works + 9 testimonials**; 958 mapped fields, 25 source files, 3 hero slides, 8 FAQ items. Six legacy page sections belong to one module. Existing edits produce conflicts; source counts are not total DB row counts. Untouched six foundation services receive drafts only; their published columns remain unchanged. Existing General service/customer records remain intact.
3. Download the full application backup immediately before approval. It includes all 15 application tables, customer rows, existing versions, sessions, media metadata, schema and `lossless_rows` containing exact PostgreSQL JSON text for microsecond timestamps/arbitrary-precision numerics. It is sensitive. Protect it locally. It does not replace native pg_dump or physical media backup and does not cover all managed Supabase Auth/Storage schemas. A 32 MiB conservative interactive cap fails closed; arrange a reviewed streaming/native workflow if exceeded rather than bypassing the guard.
   Optional read-only protected export after 006:
   ```powershell
   node --import tsx scripts/export-full-content-backup.ts C:\PrivateBackups\issue21-before-import.json
   ```
   The Admin backup also returns the 15-minute signed approval token. Backups must be newly downloaded; expired/stale previews require a fresh backup/token. The application cannot prove the owner stored the file securely; owner acknowledgment is required.
4. Review conflicts; preserve every existing edit/published record. Acknowledge backup/target/conflicts and apply the explicit draft import. The server rechecks editorial state/schema while holding transaction locks; stale state rejects the whole operation. Save the run ID and exact applied/skipped/conflicted report. No customer table is an importer write target. Imported review rows remain unpublished and do not bypass moderation.
5. Disable `CONTENT_IMPORT_ENABLED` again. Do not publish or edit protected records. Run approved read-only verification:
   ```powershell
   node --import tsx scripts/secondary-content-acceptance.ts C:\PrivateBackups\issue21-after-import.json --verify
   ```
   This compares each draft field against the source. Pristine result should have 50 exact draft matches, zero differences. Existing conflicts require individually reviewed exceptions; never overwrite to force this count. Compare before/after protected customer rows privately field-by-field, not counts alone. Repeat preview/import (only if separately approved) must show skips and zero editorial changes; run/audit metadata may grow.

## Rollback and recovery

- Failed migration: runner rolls back its transaction. Inspect before retrying; do not edit checksums. A lost connection requires checking ledger/schema before assuming rollback.
- Application rollback: revert code to reviewed PR #27 while retaining additive 006 schema. Stop writes and verify compatibility first. No automatic down migration/drop script is provided because it could discard authored CMS revisions.
- Draft import rollback: Admin run history requests `ROLL BACK UNEDITED IMPORT DRAFTS`. Requires owner-approved write and enabled importer. It checks every imported target revision before any change; a single post-import edit/publish produces 409 and no rollback changes. Existing seed drafts are restored; newly imported static rows/documents are archived/cleared, not hard-deleted. History/audit/run records remain. Repeated rollback is idempotent. Publication/customer records are not blindly restored.
- If a target was edited or published after import, export its current version and use per-record history to restore an explicitly reviewed draft, then separately approve publication. Do not overwrite later edits through a bulk rollback.
- Native disaster recovery needs a separate approved operator plan and isolated restore rehearsal; it may overwrite newer data. Do not restore a whole backup into shared Secondary or Primary as a routine test. Media backup restoration must match database references. Primary recovery/rollout is outside this authorization.

## Complete acceptance checklist (all DB/write items pending approval)

- [ ] Verify Secondary project ref/host/user, absence of Primary credentials, TLS, runtime least privilege and owner-approved backup/SQL hashes.
- [ ] Confirm validated actual ledger 001–006, full native backup scope, protected media backup, encrypted storage and separately authorized restore rehearsal.
- [ ] Verify the already-applied 006 columns/tables/defaults/constraints/history trigger and browser-role denials; do not replay 006. Bookings/Contact/Reviews/private media remain inaccessible to anon/authenticated SQL roles.
- [ ] Exact preview counts/958 mapped values and all behavior exclusions reviewed against pinned source **and independent original AI Studio source**. Do not mark original reconciliation complete based on repository hashes alone.
- [ ] Compare every field from TSV: Bangla/Unicode, whitespace, IDs, URLs, icons, localized captions, numeric/boolean values, null/absent semantics, array/nested order, all CTA hints/flags and home composition. No invented email/logo/address or fabricated booking URL.
- [ ] Download lossless full backup, perform approved draft import; verify every eligible DB draft → Admin editor → export → source-shaped/render-ready API value. Protected real customer rows are byte/field equivalent before/after.
- [ ] Retry/idempotence; existing modified/published/archived/slug-colliding records conflict without overwrite; duplicate static reviews conflict; mapping-version mismatches stop. Refresh stale preview and reject tampered/expired token, missing acknowledgment, disabled target and unauthorized/CSRF requests.
- [ ] Create only separately approved synthetic fixtures for new acceptance writes. Verify draft save, validation, upload preview, publish, unpublish, archive/restore, expected-revision conflict, history restore-as-draft and atomic rollback conflict across all CMS sections. Never edit a real customer record.
- [ ] Booking: dynamic categories/service IDs, required phone/address, durable receipt and admin retrieval after Node restart; failures return no false success.
- [ ] Contact: validation, rate limiting, durable submission and Admin workflow after restart; failures remain visible.
- [ ] Services: all 6 source records/details/arrays/media/slug history/redirects/order, preserved General seed, edits/unpublish and API compatibility.
- [ ] Works: all 12 source IDs/media/filter labels, captions/order, slug history and published-only responses.
- [ ] Reviews: all 9 static reviews/location/date/time/source timestamps, source order; persistent public submission stays Pending, synthetic photo ownership/idempotency/limits, approve/reject/publish/unpublish and zero automatic publication.
- [ ] Image Upload: device image validation/size/type/decode/path controls, authenticated preview, pending review isolation, published CMS reference visibility, unpublish/archive denial, retained files after Node restart/deployment. Do not run retention deletion against shared data.
- [ ] Admin UI at 375/768/1440: all editors, repeated add/remove/reorder, labels/media controls, template validation, dirty/busy navigation guards, exact preview/diff/export, accessible errors and no overflow.
- [ ] Frontend-owner integration: published/uninitialized/authoritative-empty/unpublished, network failure after unpublish, second-device reload, original design/animations/booking callbacks preserved. Current public source still requires this integration.
- [ ] Import rollback with unedited synthetic targets, 409 atomic refusal after a newer edit, repeated rollback and history recovery; no real customer modifications. Record actual observations rather than marking prepared tests as passed.
- [ ] Remove operator credentials, disable importer, retain protected evidence; owner reviews unresolved failures before separate merge/deploy/Primary proposal.
