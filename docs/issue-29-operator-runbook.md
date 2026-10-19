# Issue 29 operator runbook — prepared commands, no execution approval

This document does not authorize database changes, delivery, merge or deployment. Primary Supabase must remain untouched. Optional 007, runtime grants, owner bootstrap/reset, notification writes, import and provider sends each need the owner's explicit approval for the verified target. None were executed during implementation.

## Safe local Windows update

Stop the current local Node process. Use Node 24 and the existing clean checkout. Stop on any failed command:

```powershell
git switch feat/issue-29-admin-upgrade
if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
git pull --ff-only origin feat/issue-29-admin-upgrade
if ($LASTEXITCODE -ne 0) { throw 'Update failed.' }
npm ci --strict-peer-deps
if ($LASTEXITCODE -ne 0) { throw 'Install failed.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
$env:ADMIN_UPGRADE_ENABLED = 'false'
$env:ADMIN_DELIVERY_WORKER_ENABLED = 'false'
$env:EMAIL_DELIVERY_ENABLED = 'false'
$env:WHATSAPP_RECEIPTS_ENABLED = 'false'
$env:CONTENT_IMPORT_ENABLED = 'false'
npm run dev
```

Verify that the app's existing `DATABASE_URL` is the approved Secondary runtime connection before starting. Do not put Primary credentials into this checkout. With upgrade storage off, the existing environment-based account, CMS/import and all customer operations retain their contracts. Shared notification state, account changes and automatic delivery stay off. Preview/analytics remain read-only; do not press customer status/save, branding publication, mark-seen in shared mode, import or other write actions without approval.

To repeat the full non-destructive local suite in a separate PowerShell session, preserve and clear DB variables for the duration; do not set `TEST_DATABASE_URL`:

```powershell
$names = @('DATABASE_URL','MIGRATION_DATABASE_URL','TEST_DATABASE_URL','SECONDARY_DATABASE_URL','SECURITY_DATABASE_URL')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  npm run lint
  if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
  npm run test:startup
  if ($LASTEXITCODE -ne 0) { throw 'Startup check failed.' }
  node --import tsx .\scripts\build-migration-manifest.ts --check
  if ($LASTEXITCODE -ne 0) { throw 'Migration manifest drift; stop and review.' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
```

The 19 PostgreSQL tests intentionally skip. Startup checks use a deliberately unreachable localhost address, without creating a database. Browser scripts additionally require an independently installed Playwright module; CI supplies this in an isolated runner directory. They intercept all API requests with synthetic fixtures.

The existing Secondary read-only preflight command remains available, using only the previously verified `SECONDARY_PROJECT_NAME`, `SECONDARY_PROJECT_REF`, `PRIMARY_PROJECT_REF` denylist identifier and `SECONDARY_DATABASE_URL`:

```powershell
node --import tsx .\scripts\secondary-content-acceptance.ts "C:\PrivateBackups\issue29-preflight-$(Get-Date -Format yyyyMMdd-HHmmss).json"
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; review evidence without repairing or replaying a ledger.' }
```

A six-migration database does not need 007 to pass its existing CMS preflight. If approved 007 is later applied, the tool additionally verifies its source evidence/private schema; untracked, partial or conflicting upgrade history fails. Do not run `db:migrate`, `supabase db push`, migration repair, import or grant SQL as a response to a failed preflight.

## Exact optional SQL and approval sequence

- [007_admin_upgrade.sql](../db/optional/007_admin_upgrade.sql), LF SHA-256 `4b51a8b7f53a177c13d13b0b9f4fa1286f585ab0edbdd248556356523679d80a`.
- [003_admin_upgrade_runtime_grants.sql](../db/security/003_admin_upgrade_runtime_grants.sql), LF SHA-256 `eb0160c364b2add66ccec60b2fda3696fa59c7ff1650f6ee8b20e976dd52bf3f`.

007 creates four private tables, constraints/queue indexes, browser access revokes/RLS, and `bookings_created_cursor`. It neither seeds an owner nor updates/deletes existing booking, message, review or CMS records. Index creation may briefly lock the bookings table; review the maintenance window on the actual PostgreSQL host. Files are outside `db/migrations` so the existing baseline runner never applies them automatically.

After the owner reviews and separately approves the exact operation:

1. Independently verify the Secondary project/host/database/user and runtime role. Stop local acceptance writes and workers. Record current migration history and private content/customer preservation evidence read-only. Preserve imported run `ab1743bf-8fc8-47eb-8922-82b9962a5a66`, 46 drafts and four preserved conflicts; this task has not read or modified them.
2. Make a full native database backup and matching durable media backup as below. Protect role/configuration and existing owner hash privately. Review backup scope and a separately authorized restore rehearsal.
3. Apply the reviewed optional SQL through the **existing owner-managed migration system**, retaining its original statements/source evidence. Use the canonical SQL unchanged. Do not create or copy a public ledger, replay 001–006, invent a checksum or edit history to obtain a passing report. Any different applied statements require provenance review.
4. Separately review/apply the grant script in a transaction with `SELECT set_config('efb.runtime_role','YOUR_EXISTING_RESTRICTED_RUNTIME_ROLE',true);`. It rejects privileged/table-owning roles and browser inheritance. It grants only SELECT/INSERT/UPDATE on the four new tables, with role-scoped RLS. Existing tables/grants stay separate.
5. Run read-only preflight/security checks using the actual Node runtime role, including owner/table visibility and all optional columns/keys/enums/RLS/browser denials. Do not enable storage on an empty/unreadable owner table.
6. With separate owner approval, bootstrap the single owner using the command below while upgrade storage is still off in the app. Bootstrap preserves the existing valid scrypt hash and revokes all sessions; it will not overwrite an existing owner.
7. Set `ADMIN_UPGRADE_ENABLED=true`, retain a strong stable `ADMIN_SESSION_SECRET`, restart the local app and verify login using Secondary only. Once activation is verified, remove the obsolete `ADMIN_PASSWORD_HASH` from the web runtime environment; the DB owner record is authoritative and avoids accidental reactivation of a stale environment password.
8. Account/email/notification test writes need their own explicit approval. Enable provider delivery and its worker only after the external requirements are completed and approved. No automatic application startup migration/worker is provided.

## Private backup and recovery evidence

Use the verified Secondary operator's PostgreSQL client configuration: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE=verify-full`, and a trusted `PGSSLROOTCERT` if needed. Never print passwords or put a connection URL in command history. Commands below are prepared backup instructions; do not point them at Primary:

```powershell
pg_dump --format=custom --file=C:\PrivateBackups\secondary-before-issue29.dump
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; stop.' }
pg_restore --list C:\PrivateBackups\secondary-before-issue29.dump > C:\PrivateBackups\secondary-before-issue29.list.txt
if ($LASTEXITCODE -ne 0) { throw 'Backup inspection failed; stop.' }
Get-FileHash C:\PrivateBackups\secondary-before-issue29.dump -Algorithm SHA256
```

Use a compatible PostgreSQL client version. Inspect whether managed Supabase schemas/roles are included or excluded by permissions; retain the owner/dashboard backup and role/grants recovery plan. An archive listing does not prove restore. Any restore rehearsal needs a separately authorized isolated target; never restore into a real project as a test.

Back up the entire durable `MEDIA_ROOT` with matching file hashes and consistent DB timing. Store native backups, encrypted queue key, service configuration and bootstrap evidence in encrypted private storage with Windows ACLs restricted to the operator. POSIX file modes alone do not protect Windows files. Application JSON backups remain sensitive and do not replace native/media backups; after 007 they include all four new private tables and their schema metadata. The existing 32 MiB interactive cap remains enforced.

## Server-only environment

Keep all variables without a `VITE_` prefix. See [.env.example](../.env.example); never commit live values.

| Variable                                                                                           | Requirement                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing `DATABASE_URL`, `PUBLIC_ORIGIN`, Admin/session and durable `MEDIA_*` configuration        | Previously verified Secondary runtime only. Production requires HTTPS and a persistent host volume outside the application. Existing strict `mediaRoot` checks are preserved.  |
| `ADMIN_UPGRADE_ENABLED`                                                                            | Default `false`; true only after approved 007/grants/owner bootstrap. Required for account/shared notification/queue persistence.                                              |
| `ADMIN_DELIVERY_ENCRYPTION_KEY`                                                                    | 64 hex characters from 32 random bytes. Back up privately; separate from session secret. AES-256-GCM binds each envelope to its job/channel.                                   |
| `ADMIN_DELIVERY_APPROVAL`                                                                          | Exact `OWNER APPROVED DELIVERY`; explicit approval required before any delivery flag/worker is enabled.                                                                        |
| `ADMIN_DELIVERY_WORKER_ENABLED`                                                                    | Default `false`. Configuration does not prove a worker is running.                                                                                                             |
| `EMAIL_DELIVERY_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`                                           | Default off; approved key and verified sending address/domain, SPF/DKIM, correct origin. The implemented adapter is Resend HTTPS, not an unconfigured SMTP relay.              |
| `WHATSAPP_RECEIPTS_ENABLED`                                                                        | Default off; automatic receipts go to the opted-in owner recipient.                                                                                                            |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`                                                | Approved Meta Business/Cloud API account and production token/phone-number ID with appropriate permissions.                                                                    |
| `WHATSAPP_ADMIN_RECIPIENT`                                                                         | International digits including country code, without `+`. Owner-controlled opted-in number; never taken from the customer's booking phone.                                     |
| `WHATSAPP_RECIPIENT_OPT_IN_AT`, `WHATSAPP_RECEIPTS_START_AT`                                       | Explicit ISO timestamps. Start cannot precede actual opt-in. Set an approved cutoff to avoid unintended historical receipt backfill.                                           |
| `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_GRAPH_VERSION`                   | Approved eight-body-parameter template, exact language and currently supported Graph version. There is no guessed Graph version default.                                       |
| `WHATSAPP_INCLUDE_CUSTOMER_DETAILS`                                                                | Default `false`; explicitly approve privacy/recipient access before enabling. Internal notes are always excluded.                                                              |
| `ADMIN_WORKER_DATABASE_URL` / `ADMIN_OWNER_DATABASE_URL`                                           | Separate explicit operator target for the selected command; never falls back to app `DATABASE_URL`.                                                                            |
| `ADMIN_OPERATOR_EXPECTED_HOST`, `ADMIN_OPERATOR_EXPECTED_DATABASE`, `ADMIN_OPERATOR_EXPECTED_USER` | Independently verified exact connection identity. The actual PostgreSQL database/role are checked after connection as well.                                                    |
| `ADMIN_OPERATOR_TARGET_LABEL`                                                                      | Supabase: exact `OWNER VERIFIED SECONDARY`. Future standard PostgreSQL host: exact `OWNER VERIFIED NODE POSTGRES HOST`, requiring separate production authorization.           |
| `SECONDARY_PROJECT_NAME`, `SECONDARY_PROJECT_REF`, `PRIMARY_PROJECT_REF`                           | For Supabase operator commands, exact Secondary name/ref plus a distinct Primary denylist ref. Supabase URLs require `sslmode=verify-full`. No Primary URL/password is needed. |
| `ADMIN_OWNER_RECOVERY_APPROVAL`                                                                    | Exact `RESET SINGLE OWNER PASSWORD AND REVOKE ALL SESSIONS`, with approved `--backup-reviewed` operation.                                                                      |
| `ADMIN_NEW_PASSWORD_FILE`                                                                          | Reset only: private operator-owned file containing the new 12–128 character passphrase. Never pass a password as a CLI argument. Securely remove the file afterward.           |

## Explicit owner bootstrap / emergency reset

**Prepared commands: do not run without separate approval and verified target/backup.** Fill the operator variables above privately. The web server must stay off or upgrade-disabled during initial bootstrap:

```powershell
$env:ADMIN_OWNER_RECOVERY_APPROVAL = 'RESET SINGLE OWNER PASSWORD AND REVOKE ALL SESSIONS'
node --import tsx .\scripts\admin-owner-recovery.ts --bootstrap --backup-reviewed
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap failed; stop and review.' }
```

Bootstrap needs the existing expected `ADMIN_USERNAME` and valid `ADMIN_PASSWORD_HASH`; it never overwrites an existing owner or marks an email verified. For an explicitly authorized lost-password reset, set the expected username and private `ADMIN_NEW_PASSWORD_FILE`, then use `--reset --backup-reviewed` instead of `--bootstrap`. Reset retains the existing verified email, invalidates all tokens and sessions, cancels pending recovery emails and audits metadata only. There is no multi-user management or public recovery bypass.

Email change and self-service reset require a verified address. Enrollment needs the current password; replacement keeps the old address until the new address's single-use link is verified. Links expire in 15 minutes, are purpose/credential bound and do not expose tokens through API responses/logs. The URL fragment is cleared from the browser after loading. A new action revokes earlier action links. Secret rotation invalidates pending links; request new ones after restarting app and worker consistently.

## Approved delivery worker and template contract

**Prepared command; execution sends messages and writes queue/audit state, requiring separate approval.** No worker starts with the web application. Run on the same durable Node + PostgreSQL host under a supervisor, or use an approved scheduler with `--once`:

```powershell
node --import tsx .\scripts\admin-delivery-worker.ts --once
# For an explicitly approved supervised long-running process:
# node --import tsx .\scripts\admin-delivery-worker.ts --watch
```

A Meta template must be approved with these eight body parameters, in order:

1. Booking number.
2. Service name.
3. Received time in Asia/Dhaka.
4. Existing booking status.
5. Customer name, or `View in secure Admin`.
6. Phone, or the same privacy placeholder.
7. Abbreviated address, or the privacy placeholder.
8. Abbreviated customer note, or the privacy placeholder.

Suggested fixed template body (submit/review with Meta; this file is not template approval):

```text
ElectroFix BD · Booking receipt
Booking: {{1}}
Service: {{2}}
Received: {{3}} (Bangladesh time)
Status: {{4}}
Customer: {{5}}
Phone: {{6}}
Address: {{7}}
Customer note: {{8}}
This records a service request. Appointment confirmation follows separately.
Full details remain in secure Admin.
```

Parameters are bounded and single-line; approved template text supplies the formatting. Customer details are omitted by default. The worker independently discovers committed bookings since the approved cutoff, queues unique receipt keys and never changes booking/customer rows. Meta failure cannot turn a saved booking into a failed booking response.

Claims use SKIP LOCKED; unique keys deduplicate enqueueing. At most five attempts with bounded exponential delay. Resend uses a stable job `Idempotency-Key` within its [documented 24-hour window](https://resend.com/docs/dashboard/emails/idempotency-keys); recovery jobs expire after 15 minutes. WhatsApp rate limits retry; ambiguous timeouts/5xx or interrupted processing are held as `uncertain` for operator review, not sent again blindly. Check the provider before deciding on any manual retry. Provider `sent` means acceptance, not proof of handset delivery. Sent/permanently failed payloads are erased; uncertain encrypted payloads remain private pending review/retention decisions. Queue/audit summaries contain no customer content or credentials. Alternate transports can be provided through the worker's typed adapter injection after review; no SMTP adapter is installed by default.

Manual WhatsApp preview and sharing remain available without Cloud API credentials. The owner explicitly chooses the recipient and presses Send in WhatsApp. This action is labeled manual and is not automatic delivery.

## Rollback and acceptance checklist

Before optional activation, code rollback to PR #28 retains its original six-migration behavior. After activation, stop workers and disable delivery first. Preserve additive tables/history/media. **Do not simply switch back to stale environment credentials:** keep the reviewed DB-aware authentication or deliberately rotate a fresh legacy hash/session secret and revoke sessions under an approved operator recovery plan. Do not drop 007 tables or restore a whole database blindly over newer edits.

Applying 007 changes verified migration history: obtain a fresh CMS preview/backup/token afterward. Pre-upgrade import runs can be refused by existing history-binding checks; use reviewed per-record history when required. No importer or customer-data rollback is automatic.

- [ ] Owner reviews exact SQL/grants hashes, maintenance window, backup scope, encrypted storage and independent Secondary identity. No Primary access.
- [ ] Separate approval for 007/grants, then read-only verification of ledger evidence, columns/keys/enums/RLS/browser denial, required runtime rights and index.
- [ ] Separately approve bootstrap; confirm old sessions revoked, DB owner login works, obsolete environment password is removed and source selection never falls back.
- [ ] Approve only synthetic account/notification acceptance writes. Verify old-password/CSRF rejection, concurrent revision/session changes, email verification, single use/expiry, recovery generic responses and all-session revocation.
- [ ] Approve provider setup/sends separately. Verify Meta template/opt-in/cutoff and Resend domain/DNS/HTTPS; observe actual acceptance/failure/429/ambiguity/idempotence and worker restart. Never claim handset/email delivery from mocks.
- [ ] Confirm polling in two owner devices, shared mark-seen monotonicity, late/burst notifications, hidden/offline/modal/dirty pauses, manual refresh and no duplicate alerts after reload. OS notifications require permission and an open tab; browser-closed Web Push is a separate project.
- [ ] Verify original Bookings/Messages statuses, notes, search/filter/pagination/revision conflicts and privacy. Real customer records stay unchanged during acceptance.
- [ ] Confirm existing CMS/import, Services/Works/Reviews/device upload and private pending-review media, without imports or unintended publication. Record the existing 46 drafts/four conflicts unchanged.
- [ ] Verify branding drafts preserve all other settings; only explicit publish affects the public API. Durable media survives restart/deployment, PNG sizes are correct, unpublish revokes access. Frontend owner separately integrates/reviews original public design.
- [ ] Check physical mobile/Windows behavior and accessible focus/contrast; retain CI synthetic screenshots and exact observed results. Keep merge/deploy/Primary rollout as separate approval gates.
