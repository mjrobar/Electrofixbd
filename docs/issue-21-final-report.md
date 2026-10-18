# Issue 21 consolidated implementation report

Consolidated Draft PR: [#28](https://github.com/mjrobar/Electrofixbd/pull/28).

Review date: 19 October 2026 (Asia/Dhaka). Branch: `feat/issue-21-complete-cms`. Implementation starts at Draft PR #27 (`d8610dcdd87c6fcf6034ec08ca8122fce780627c`) and includes all preceding Issue 21 changes. The consolidated Draft PR targets `fix/windows-local-media-storage` (PR #20), so reviewers see the whole Issue 21 stack in one diff. Earlier Draft PRs #22–#27 are retained, not merged or closed.

**Backend/Admin implementation and safe static/mock checks are complete for this handoff. Production readiness is not verified.** PostgreSQL execution, shared Secondary acceptance and independent original AI Studio/public CMS integration remain pending. No migration/import, real customer update, local PostgreSQL creation, Supabase connection, merge or deployment occurred in this task.

## Completed changes

- Deterministic AST inventory from 25 pinned public source files: 958 mapped editorial/collection fields, 3,143 explicit behavior/design exclusions, 536 immutable dynamic bindings. The generator compares source content with the immutable Git snapshot; CRLF/LF normalization is allowed, arbitrary hash refresh is not. All source collection leaves are round-trip checked. [Inventory](issue-21-full-content-inventory.md), [exact field TSV](issue-21-field-inventory.tsv), [catalogue](../server/full-content-catalog.json).
- Structured, validated CMS documents for 19 components/modules, including navigation/header/footer, booking/contact labels, home sections, cards/stats, filters, page intros, metadata, media, CTA descriptors and safe home section order/enabled settings. Specialized Hero/FAQ/Business and Services/Works/Testimonials editors retain their contracts. Existing approved Admin colors, typography, spacing, controls and responsive layout are reused.
- Dedicated Admin form controls for typed text, template bindings, safe links/media, allowlisted icons, booleans/numbers; repeated add/remove/reorder; immutable source binding/field validation, dirty/busy guards, preview, explicit draft/save/publish/unpublish/archive/restore and revision history. Device image upload is available for structured component media and existing collection editors, backed by the durable host volume. Specialized legacy site settings retain URL fields.
- Additive public source-shaped CMS APIs plus publication state/fallback metadata. Empty/unpublished responses are authoritative; collection values and state share a read-only repeatable-read snapshot. Original public pages/components, styles, frontend clients and shared API files are unchanged. [Frontend-owner integration specification](issue-21-public-cms-contract.md) describes exact binding/fallback rules.
- Full pinned source import has **50 entries: 19 component documents + 4 compatibility site modules + 6 services + 12 works + 9 static testimonials**. Includes 3 hero slides, 8 FAQ items, one business settings object and six legacy page sections within a compatibility module. Original IDs/slug values, URLs, source flags, localized dates/captions, arrays and order are preserved. Existing General service is outside these source counts and remains intact.
- Deterministic preview and recursive field diffs; protected full application backup including prior versions/schema and exact raw PostgreSQL JSON for timestamp/numeric precision; signed expiring backup approval; explicit draft-only import with transaction locks/stale-state detection; authored/published/archived/identity-colliding content preserved with conflicts. Only exact untouched foundation services receive draft updates. Duplicate static review identities are treated conservatively as conflicts. No customer/bookings/contact write targets and no auto-publish. Old partial importer remains hard-blocked.
- Import run history and revision-checked atomic rollback: preserve newer edits, restore prior drafts, archive newly imported static rows, retain audit/history. Mapping upgrades require explicit export/review; incompatible versions fail rather than overwrite. Current snapshot version is 2.
- Import and rollback disabled by default; an owner-enabled target label and existing authenticated Admin/CSRF protection are required. Publication visibility includes component and specialized module image fields; pending review images cannot be repurposed through CMS publication. Retention scanning includes CMS/history references but was not run.
- Portable Node 24 + standard `pg` implementation; no new Supabase/Vercel production dependency. Read-only explicit-Secondary preflight/field verification and private backup tooling have no migration/import execution mode. [Windows acceptance/runbook](issue-21-secondary-acceptance.md) contains approval boundaries, environment, backup/import steps, rollback and the complete checklist.

## Database review (not applied)

Exact migration: [006_full_cms_inventory.sql](../db/migrations/006_full_cms_inventory.sql).

SHA-256: `45e01f793e3aa7cb730ffd35d4532bafd9d8568bd4b63750e81fe123318e8ff2`.

Adds `cms_documents`, `cms_import_runs`, `cms_publication_state` with browser access revoked/RLS enabled; inserts seven configuration-state rows using the pre-existing legacy publication status once; adds service order and Works/Testimonial legacy ID/display/order columns; extends CMS history entity and revision/audit trigger. Existing editorial/customer rows are not rewritten. Migrations 001–005 are byte-unchanged. The one-time state initialization prevents later draft-only imports from suppressing static fallback merely by incrementing a revision.

Optional [scoped runtime grants](../db/security/002_issue21_runtime_grants.sql) need separate review/approval after 006 if the dedicated runtime role lacks new table/ledger access. The existing broad ACL tooling now includes these tables but was not executed. Runtime readiness checks expect the new schema and privilege boundary, so do not deploy this code against an unapproved/unmigrated database.

## Actual verification results

All unit/startup/UI commands explicitly removed `DATABASE_URL`, `MIGRATION_DATABASE_URL` and `TEST_DATABASE_URL` from their environment. No disposable or shared PostgreSQL database was used.

| Check | Observed result | Evidence boundary |
|---|---|---|
| `npm run lint` | Passed (`tsc --noEmit`) | TypeScript static check |
| `npm run build` | Passed, client and Node server bundles | Production compilation; no deployment |
| `npm test` | **57 tests: 38 passed, 0 failed, 19 skipped** | Skipped tests require PostgreSQL; not claimed as passed |
| `npm run test:startup` | **2 passed, 0 failed** | Dev/production Node routing/startup/shutdown with deliberately unreachable localhost DB address; no DB creation, migrations or persistence proof |
| Mocked Playwright Admin CMS check | Passed at **375 / 768 / 1440 px** | All API calls intercepted with synthetic memory fixtures; edit/preview/save/publish/unpublish/import preview, no horizontal overflow or browser page errors; no DB connection |
| Full catalogue `--check` | Passed | Exact pinned source and every mapped leaf/projection; original AI Studio workspace not available |
| PostgreSQL grammar parsing | Passed: 006 (12 SQL statements, 2 PL/pgSQL units), optional grants (1/1), broad ACL script (2/2) | `pglast` parsing only; not PostgreSQL execution/type/permission verification |
| Ownership/whitespace review | Passed | No public frontend diff against PR #20 or PR #27; migrations 001–005 unchanged; `git diff --check` clean |

Passing non-destructive regressions include booking/contact API shapes and failure handling, rate limiting/proxy identity, content fallback source guards, legacy catalogue provenance/line endings, source record normalization, full draft query parameter binding, immutable/unsafe CMS validation, authoritative empty states, disabled/invalid import approval, Secondary target guards, source-shaped privacy projection and image normalization. The in-memory importer query-sink test caught and now prevents a collection INSERT parameter-count regression. Actual database transaction behavior is not established by these mocks.

Build reports the inherited Vite future `configLoader`/`__dirname` warning and a 3.1 MB server bundle warning caused by the complete embedded catalogue. Both builds exit successfully. No public build configuration was changed to hide warnings.

## Unresolved acceptance and production blockers

1. **Migration 006 execution and runtime privileges are unverified.** Owner SQL review and explicit Secondary approval come first; import and acceptance test writes need separate approval. All 19 DB-dependent tests were skipped. Prepared integration fixtures are not evidence of success and must never be pointed at shared Secondary.
2. **Full database round trip is pending:** source → persisted draft → Admin → export/API, idempotence, locking/races, least privilege, revision history, rollback and exact customer preservation need approved Secondary observations. Counts alone cannot prove preservation.
3. **Public CMS integration and same-to-same rendering are pending with Google AI Studio.** Existing public empty-array fallbacks still resurrect static data; the new authoritative CMS contracts are available but not wired into those protected components. Independent original AI Studio source was not supplied/reconciled. No cross-device published rendering or original-design visual parity claim is made.
4. **Operational recovery and durable hosting acceptance are pending:** native backup scope/restore rehearsal, runtime roles/RLS, final Windows/Node host permissions, persistent media after restart/deployment and proxy/TLS configuration. Legacy external media URLs remain external; mirroring/rehosting requires a separate reviewed plan.
5. **Mapping upgrades and oversized backups require review:** no automatic remapping of authored documents; interactive backup conservatively caps at 32 MiB and fails closed. JSON backups cover 15 application tables/schema/media metadata, not physical media or every managed Supabase schema; native pg_dump/media backup remain required.
6. Production writes, Primary backup/migration/import, merge and deployment remain outside authorization. This report is an implementation handoff, not production certification.

## Special review and next gate

Under AGENTS.md, explicitly review the new exact development dependency `@babel/parser@8.0.7`, its `bun.lock` changes, additive backend CMS API contracts/configuration and the exact Vercel development-branch disable rule in `vercel.json`. Existing deployment rules are retained and `feat/issue-21-complete-cms` is explicitly disabled. No merge/deploy is requested by this PR.

Review the exact Migration 006 SQL and [Secondary runbook](issue-21-secondary-acceptance.md). No database command will be run until the owner explicitly approves the specific Secondary operation. Primary remains untouched. After approved Secondary acceptance and AI Studio integration, update this report with observed field comparisons and outstanding failures before considering production rollout.

## PR #28 Windows regression follow-up

The image-security test now applies the POSIX-only `/tmp` and `/var/tmp` production assertions on POSIX, while checking filesystem roots, application directories and missing durability on all platforms. Windows uses a directory junction for the canonical-path rejection test, avoiding Developer Mode/administrator requirements. Production `mediaRoot` and configuration validation are unchanged; no path, ownership, permission, durability, Vercel or canonical-path guard was relaxed.

The direct esbuild dependency is now `^0.28.0` (locked to 0.28.2), compatible with Vite 8's `^0.27.0 || ^0.28.0` peer range. A cleanly generated npm v3 `package-lock.json` includes Windows native optional packages and is validated using `npm ci --strict-peer-deps`, without legacy-peer/force overrides. `bun.lock` is synchronized with the new direct dependency. Package/lock/workflow changes require the AGENTS.md special review; public files and SQL are unchanged.

Native Windows testing is provided by the [Windows regression check on this Draft PR](https://github.com/mjrobar/Electrofixbd/pull/28/checks). Its isolated Node 24 job clears database URL variables, uses no database service or secrets, and runs locked installation, TypeScript lint, production build, the full non-destructive unit suite and startup/routing checks. The core suite passed **38 tests with 0 failures and 19 database tests skipped** on both Linux and Windows. Linux also passed both startup/graceful-shutdown checks. Windows startup termination assertions now reflect native `child.kill(SIGTERM)` semantics (forced termination, not delivery to Node's POSIX shutdown handler); the strict zero-exit/no-signal check remains on POSIX. Windows forced-termination checks are not proof of graceful shutdown.

No local PostgreSQL database was created, neither Supabase project was connected or modified, and no migration/import/deployment/merge was performed for this follow-up. Existing database acceptance and public frontend integration blockers above remain unchanged.
