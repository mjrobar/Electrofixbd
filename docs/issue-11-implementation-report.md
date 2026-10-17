# Issue #11 implementation report

## Branch and scope

Starting point: reviewed integration branch `feat/public-frontend-fallback-issue-9`
at `ad4287e12e7b5fdfd654839e1162cbd61d63290a`, containing PR #4 → #5 → #6 → #8 → #10.
Implementation branch: `feat/issue-11-production-admin`. This is a Draft PR for
AI Studio review and the owner's coordinated acceptance, not deployment approval.

No public React component, data file, shared public contract, public API client,
stylesheet, asset, route, package manifest, lockfile or Vite/build configuration was
modified. Existing publications and IDs are preserved by additive migration 004.
No shared/production database was read, migrated, tested destructively or deployed.

## Implemented functionality

| Area                        | Result                                                                                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                   | Existing summary and recent bookings retained; aggregate 30-day booking activity and status breakdown added, using Bangladesh business dates                                                                                                                                          |
| Bookings                    | Bounded paginated search/filter, validated state transitions including reopen, private internal notes, optimistic revisions and row locks; public tracking fields unchanged                                                                                                           |
| Messages                    | Bounded paginated search/filter, new/read/replied, private internal notes, revision conflicts and confirmed saves                                                                                                                                                                     |
| Services/works/testimonials | New records start unpublished; draft editing, saved preview, explicit publish/unpublish, archive filter/recovery, version history and restore-as-draft; existing service/work slugs are immutable                                                                                     |
| Site controls               | Hero/FAQ/page order, stable item IDs, safe media/link URLs, active flags, preview, explicit unpublish and history; existing import preview/backup/approval workflow retained                                                                                                          |
| Hero actions                | Badge, primary/secondary labels, booking/navigate/phone/WhatsApp enums, service hints and safe links; explicit `actions_configured` opt-in preserves legacy button behavior until AI Studio connects the contract                                                                     |
| Business info               | Existing name/contact/social fields plus short name, tagline, service coverage, experience, specialty, normalized phones and about image contract                                                                                                                                     |
| Empty-state safety          | Untouched placeholders cannot publish; empty/all-inactive site drafts do not silently replace publications. Active hero slides need headline, image and primary CTA text. Unpublish is an explicit separate action                                                                    |
| Undo/history                | Database captures prior editorial snapshots transactionally. Restore creates a new draft/revision without republishing or changing record identity/URL. Runtime cannot edit/delete history                                                                                            |
| Admin UX                    | Existing shell/navigation and locked tokens retained; errors, confirmed saves, loading, empty results, retries, draft previews, unsaved-edit/navigation safeguards, usable mobile search and minimum touch controls                                                                   |
| Sessions                    | Opaque random cookie with keyed hash in PG, credential fingerprints, idle/absolute expiry, logout revocation, revoke-all and private active-session view; old stateless cookies intentionally require fresh sign-in                                                                   |
| Security                    | Async scrypt and constant-time compare, 8 KB login/2 MB content limits including framework-parsed bodies, exact Origin/custom-header CSRF checks, login/admin rate limits, strict proxy topology and forwarding-header validation with limiter validation enabled                     |
| Media                       | Public HTTPS or application-relative URLs only; reject unsafe protocols, credentials, direct IP/local hosts, backslashes and unsupported ports. No server URL fetch/upload execution path                                                                                             |
| PostgreSQL exposure         | Separate preview-first, explicitly approved browser-access lockdown; removes legacy permissive policies, revokes browser table/dependent-view access, restricts runtime grants/RLS, rejects privileged/owner runtime roles and unresolved browser-callable SECURITY DEFINER functions |
| Runtime                     | One Node 24 + PostgreSQL host; production DB-readiness security checks, bounded pool/query timeouts, graceful closure of admin/content pools, safe error messages and metadata-only change log                                                                                        |
| Operations                  | Environment inventory, stdin-only password-hash helper, systemd/nginx templates, backup/restore and release rollback procedures; no automatic production migration or destructive down migration                                                                                      |

Public `/api/services`, `/api/works`, `/api/testimonials`, booking and contact
contracts retain their existing shapes, pagination and published-only behavior.
Public responses use explicit field allowlists and never include admin drafts,
internal notes, history or archive metadata. Booking validation now holds a service
row lock through the durable insert to serialize against concurrent service edits.
The restricted runtime needs UPDATE permission on at least one service column for
PostgreSQL `SELECT FOR SHARE`; readiness and least-privilege tests cover this.

Private admin mutation behavior intentionally changes with its updated UI: content
PUT saves a draft and requires revision; publication is explicit; archive actions
are reversible. Prior admin-only automation must adopt this revision/action flow.
There is still one trusted owner account, not a simulated multi-user role system.

## Reviewable database changes

`db/migrations/004_admin_operations.sql` adds sessions, history, metadata-only audit,
content draft/archive/revision fields, booking/message internal notes/revisions,
indexes and an invoker trigger which snapshots previous editorial versions and
increments revisions. Original content/customer columns are not rewritten. Newly
created private tables have RLS enabled and browser privileges revoked.

`db/security/001_browser_access_lockdown.sql` is deliberately outside automatic
schema migrations. `scripts/secure-database.ts` previews metadata by default;
apply requires an explicit operator URL, selected restricted runtime role, exact
approval phrase and backup-review flag. It is transactional/repeatable and changes
ACLs/policies only. Disposable tests reproduce legacy exposure, verify rollback
when an unsafe function blocks approval, and prove browser table/view denial plus
working Node persistence after lockdown. The real primary exposure remains a
release blocker until separately authorized and verified on that target.

## Automated verification

Executed on Node `v24.19.0`, disposable local PostgreSQL `18.4`:

| Check                                                               | Result                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                      | Passed                                                                                                                                                                                                                             |
| `TEST_DATABASE_URL=<disposable local test DB> npm test`             | 39 passed; 0 failed; 0 skipped                                                                                                                                                                                                     |
| `npm run build`                                                     | Passed: Vite client and portable Node server bundle                                                                                                                                                                                |
| `TEST_DATABASE_URL=<disposable local test DB> npm run test:startup` | 2 passed; both development and production startup/routing/restart persistence/shutdown using a new disposable database and restricted runtime role                                                                                 |
| `tests/admin-ui.check.mjs` with an installed Playwright/Chromium    | Passed: compiled client, new disposable database/server, create/save/preview/publish, multiline content, historical draft restore, archive recovery, failed-load recovery, booking status/notes, message reply, session revocation |
| Responsive browser review                                           | Login, dashboard, bookings, messages, content and settings at 375/768/1440; no runtime errors or horizontal overflow; mobile search width checked; screenshots inspected                                                           |
| Public ownership / file-scope review                                | No public frontend, shared-contract, dependency or build-config diffs from integration base                                                                                                                                        |
| Source catalogue provenance and import safety                       | Existing LF/CRLF/source-change detection, non-destructive idempotency, backup approval, concurrency and rollback tests remain green                                                                                                |

New lifecycle/security and browser suites create/drop their own random test DBs.
The existing foundation suite also uses only the explicitly disposable local base
DB. Tests refuse remote hosts and non-test database names. Temporary LOGIN roles
in the least-privilege suites assume a disposable loopback-trust test cluster; do
not weaken production authentication to run tests. Tests require database/role
creation privileges on that isolated cluster only.

Coverage includes admin CRUD/publication/archive/restore, unauthorized and
cross-origin requests, cookies/revocation/expiry/credential rotation, stale
revisions and concurrent saves, safe media and hero actions, booking transitions,
private notes/PII allowlists, analytics, migration adoption/checksums/preservation,
unsafe proxy configuration/headers, independent rate-limit client identities,
legacy browser RLS exposure, gated rollback and least-privilege production reads
and writes. PostgreSQL/role migrations were never applied to either shared project.

Existing warnings/qualification limits: Vite warns about future native config
loading of `__dirname`; the inherited Vite/esbuild npm peer mismatch required
`--legacy-peer-deps` in this environment. No dependency/build files were changed.
Final Oracle/shared-host TLS, firewall, process-manager and proxy qualification are
operator acceptance steps, not claims inferred from local tests.

Optional reproducible browser check, after building and provisioning a disposable
local test cluster (Playwright is a separate test tool, not a runtime dependency):

```sh
TEST_DATABASE_URL='<disposable local cluster URL with test DB name>' \
PLAYWRIGHT_MODULE='/absolute/path/to/playwright/index.mjs' \
CHROMIUM_EXECUTABLE='/absolute/path/to/chromium' \
ADMIN_UI_OUTPUT='/private/work/test-screenshots' \
node --import tsx tests/admin-ui.check.mjs
```

## Remaining limitations and release gates

1. **No primary database security change was authorized or executed.** Review the
   full backup, role/policy preview and gated lockdown before real production use.
   Local tests do not certify either shared database's present exposure state.
2. **AI Studio integration remains separate.** The current public source does not
   fetch hero/FAQ/business/page-section JSON. Every public control is mapped or
   explicitly excluded in `issue-11-coverage-matrix.md`; do not claim full CMS
   editing without that frontend-owned work and compatibility verification.
3. **Static fallback semantics need agreement.** Issue #9 intentionally keeps
   static services/works/testimonials for empty/unavailable API arrays. Unpublishing
   all persisted records can therefore reveal static fallback content, not blank
   the site. No public UI change was made to alter that approved behavior.
4. **The public feedback/file form remains browser-local.** It is not a durable
   moderation queue or server upload. AI Studio must integrate a separately
   reviewed intake/consent/upload contract or label/disable that flow before launch.
5. **Media is URL-only; one trusted owner account.** No binary upload pipeline,
   object store, transcoder, antivirus, MFA, multi-user RBAC, password-reset email
   or customer SMS/email notification system is claimed. History/log retention
   needs an approved operator policy; UI displays the latest 30 prior versions.
6. **Final acceptance, merge and deployment require the owner.** Follow the single
   coordinated checklist in `issue-11-production-runbook.md`. No merge/deployment
   or automatic primary data import was performed by this work.

The coverage matrix is the separate AI Studio handoff; the production runbook
contains exact release/backup/rollback gates and deployment templates. Together
with this report they distinguish completed backend/admin contracts from the
remaining real-host, frontend-integration and owner-approval work.
