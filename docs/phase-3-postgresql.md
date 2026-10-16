# Phase 3: five-table portable PostgreSQL integration

Branch: `feat/phase-3-postgresql-integration`, based on Phase 2 commit `7568fbb`. Follow root AGENTS.md. This change does not authorize live migrations, merge, deployment, admin implementation or public design edits.

## Schema comparison and preservation

The comparison source is checked-in `supabase-schema.sql`; the actual live Supabase schema and grants have not been inspected. Five table names supplied by the owner are not proof of identical columns, constraints or policies. The migration runner checks the target catalog and refuses incompatible shapes rather than attempting destructive normalization.

| Table            | Legacy schema                                                                                                                     | Phase 3 treatment                                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| services         | Text IDs, unique slug, descriptions, JSONB problem/process arrays, cover image, nullable active flag, timestamps                  | Existing values, IDs, defaults and nullable behavior retained. Fresh Phase 2 reference seeds remain only for fresh installs; no reseeding on adoption. Public API selects active rows.                           |
| bookings         | UUID with uuid-ossp default, unique booking number, service_id FK with ON DELETE SET NULL, PII, nullable notes/status, timestamps | Existing IDs, FK, rows, NULLs and defaults retained. Parameterized pg writes supply UUIDs explicitly. Unauthenticated lookup continues to omit PII.                                                              |
| contact_messages | UUID default, name/phone/message, constrained nullable status, timestamp                                                          | Existing rows/defaults retained; pg inserts must commit before API success.                                                                                                                                      |
| works            | UUID default, title/unique slug, service_type, category, description, media_url, image/video media_type, is_featured, timestamp   | Every existing field retained. Add is_published BOOLEAN DEFAULT true only if absent, matching formerly public works. Preserve an existing publication flag exactly. New API selects only TRUE.                   |
| testimonials     | UUID default, customer_name, review, service_type, rating 1–5/default 5, avatar_url, is_published, timestamp                      | Preserve rating, avatar and publication values exactly. Add nullable media_url and image/video media_type only if absent; preserve existing media fields and extra columns. New API selects only published rows. |

New content tables on a fresh installation use application-supplied UUIDs, ordinary PostgreSQL types/constraints and `now()` TIMESTAMPTZ defaults, without Supabase roles, extensions, REST APIs, Auth or Storage. Existing uuid-ossp and timezone-expression defaults are intentionally left unchanged. A later export to a host without uuid-ossp must explicitly review default conversion or install that standard PostgreSQL extension; an unreviewed dump restore is not automatically portable. JSONB/TIMESTAMPTZ and pg access are portable PostgreSQL features.

No migration drops a table, updates/deletes customer/content rows, renames service IDs, removes foreign keys, changes existing defaults/nullability, replaces rating constraints, resets media/publication values, or alters live RLS/grants. Existing constraints remain enforced. Schema validation checks required types, ID primary keys, non-deferrable unique constraints, omitted INSERT columns with safe defaults/nullability, and the validated service FK with ON DELETE SET NULL; it is deliberately conservative about type drift (for example varchar instead of expected text). It does not certify every custom CHECK expression, index, trigger or RLS policy.

## Versioned migration paths

`001_backend_foundation.sql` is immutable and unchanged from Phase 2. `002_content_tables.sql` creates missing content tables and adds optional content fields. Existing tables are validated before DDL. Migration files are checksummed; edited applied files are rejected. One transaction and an advisory lock serialize migrators. A five-second DDL lock timeout and bounded statement timeout cause rollback instead of indefinite blocking. Additive ALTER TABLE still needs a lock; plan an approved maintenance window for a busy database.

1. **Fresh database:** `npm run db:migrate` runs 001 and 002 and records both checksums. No extension or Supabase role setup is required.
2. **Phase 2 database with valid ledger:** the same command verifies 001 and adds 002, preserving existing services/bookings/contacts.
3. **Existing legacy database without a baseline:** default migration refuses adoption. After backup, schema/grant review, rehearsal and explicit approval, use `npm run db:migrate -- --adopt-existing`. Compatible existing core tables are baselined by recording 001's checksum without executing its CREATE statements or seeds. The ledger records `adopted=true` for that baseline. Then 002 is applied additively. Adoption means runtime-compatible, not byte-for-byte identical to the fresh schema.
4. **Incompatible or partial core schema:** fail and roll back; prepare a separate reviewed migration. Do not bypass validation, edit old migration checksums, or reset existing tables.

The runner reads exported `MIGRATION_DATABASE_URL`, or `DATABASE_URL` as fallback. Never commit values or pass a live connection without approval. It is not automatically invoked by application startup or Vercel. Back up application rows, schema/defaults/constraints, grants, policies and migration ledger before an approved existing-database change. Verify restoring the backup on an isolated host first. Rehearse using a suitably protected disposable copy; this task used synthetic data only.

Before any live adoption, compare catalog types, defaults, nullable flags, constraints, indexes, custom columns, triggers, row counts and RLS/grants against the approved snapshot. After adoption, verify unchanged original values/counts/IDs/FKs and policy definitions, then make separately approved synthetic writes through the intended least-privilege runtime role. An exported Supabase platform dump should not blindly restore auth/storage/realtime schemas or provider roles.

Existing installations are not automatically given `srv-general`: submitted service IDs must reference existing active services. The existing frontend already supplies a selected service ID. A missing-service submission can safely fail validation if the legacy database has no general service; creating one requires an explicit content decision, not an overwrite of existing IDs.

## Repositories and read APIs

`server/content.ts` implements PostgreSQL service/work/testimonial repositories; `server/store.ts` composes them with existing booking/contact writes. The shared Express application and Vercel adapter expose:

- GET `/api/services`: active services, including descriptions, JSONB arrays and cover image.
- GET `/api/works`: published portfolio records including image/video metadata, category and featured/publication flags. Optional category and featured=true/false filters.
- GET `/api/testimonials`: published testimonials including rating, avatar and optional media fields.

Responses use `{success:true, services|works|testimonials:[...], pagination:{limit,offset}}`. Default limit is 20, maximum 100; offset is bounded to 100000. Order is deterministic. Unknown filters, invalid bounds/types return the existing structured 400 error. SQL uses parameters, explicit columns and public projection. Content write/admin routes are not exposed; POST/PATCH/DELETE return 405. Database errors return sanitized 503, not fabricated content or confirmation.

Existing booking/contact request and success shapes are unchanged. Readiness now verifies all five tables, consumed columns and relevant SQL privileges. Readiness does not perform writes or prove an RLS INSERT policy allows a particular record. A least-privilege runtime role requires schema USAGE, SELECT for the five tables (contact schema readiness currently uses a SELECT projection), and INSERT for bookings/contact_messages. It needs no DDL, ownership, superuser or BYPASSRLS. Additional RLS policies must permit the intended operations where RLS is enabled.

No Supabase SDK/service appears in business logic. No frontend component, style, editorial data, App.tsx, API client, package manifest, lockfile or deployment configuration is changed in this phase. Public content views still use their existing static data until AI Studio approves wiring the new read APIs; adding APIs does not claim the website now renders database content.

## RLS review and proposed corrections — approval required

These are findings about the repository's SQL, not statements about uninspected live grants:

- `Public booking lookup` permits SELECT with `USING (true)` to anon/authenticated/service_role. With SELECT grants, this permits all booking rows including PII; there is no ownership check.
- `Public booking insertion` and contact insertion use `WITH CHECK (true)`. Granted anonymous clients can bypass API validation, throttling and workflow rules via Supabase REST, and can submit allowed non-initial statuses.
- `Public works read access` uses `USING (true)`: it will not hide a work marked unpublished by the new field. API filtering alone does not fix direct database/REST access.
- Testimonials already restrict public SELECT to is_published=true; active services use is_active=true. Audit actual table grants and role privileges as well as policies. BYPASSRLS/service-role/table-owner access can bypass policy protection.

**Proposed correction plan, not an executable application migration:** after owner approval, use a dedicated non-owner/non-superuser/non-BYPASSRLS runtime login, revoke anonymous/authenticated access to private bookings/contact tables, and retire their broad public SELECT/INSERT policies. Restrict direct content SELECT to active/published rows, or revoke direct anonymous content access entirely if only Express serves content. Give the runtime role explicit operation-specific policies and grants. Revoke unnecessary default privileges to prevent future tables inheriting anonymous access.

Illustrative SQL for DBA review only (role names and existing policy names must be verified; do not run as part of this task):

```sql
-- Separately approved security change, after backup and dependency review:
REVOKE ALL ON public.bookings, public.contact_messages FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Public booking lookup" ON public.bookings;
DROP POLICY IF EXISTS "Public booking insertion" ON public.bookings;
DROP POLICY IF EXISTS "Public contact insertion" ON public.contact_messages;
-- Where direct public portfolio reads remain required:
ALTER POLICY "Public works read access" ON public.works USING (is_published IS TRUE);
-- Use an already provisioned, least-privilege app role; no credentials in SQL:
GRANT USAGE ON SCHEMA public TO electrofix_app;
GRANT SELECT ON public.services, public.bookings, public.contact_messages,
  public.works, public.testimonials TO electrofix_app;
GRANT INSERT ON public.bookings, public.contact_messages TO electrofix_app;
-- When RLS is enabled, define narrowly scoped app-role policies separately,
-- including pending/new INSERT checks and active/published content SELECT.
```

Do not apply this sample blindly: audit PUBLIC grants, role inheritance, existing mobile/other clients, service-role use, default privileges and existing policy dependencies first. PostgreSQL SELECT grants on customer tables must not reach public users through inherited roles. The task's migrations intentionally preserve policies rather than silently breaking another client. A disposable non-owner/non-BYPASSRLS role test reproduces the broad-policy PII exposure and verifies access revocation blocks it. No live policy was changed. This remains a production security prerequisite, not a resolved live finding.

## Validation and AI Studio handoff

Tests cover fresh five-table installation, existing Phase 2 ledger upgrade, explicit legacy adoption, nullable/default/media/publication/ID/FK preservation, repeatability, concurrent migration serialization, checksum/type/FK rejection, and rollback without a baseline ledger on incompatibility. Legacy fixtures are constructed from the checked-in table DDL on disposable databases; no live schema/data copy is used. PostgreSQL repositories are tested through both Express and the thin Vercel adapter, including publication filtering, SQL injection-shaped category input, pagination, invalid query handling and unsupported methods. Existing durable booking/contact, restricted-role, connectivity, frontend-client and real-process startup tests remain required.

Run on a disposable local PostgreSQL 17 cluster with `TEST_DATABASE_URL` supplied securely:

```sh
npm run lint
npm run build
npm test
npm run test:startup
```

Without TEST_DATABASE_URL, PostgreSQL tests are explicitly skipped; that is not full integration validation. Migration test helpers require a local host and test database name, create randomly named disposable databases, and remove only those test databases afterward. Role tests require disposable-cluster operator privileges; the application runtime does not. Docker is optional test infrastructure, not a hosting dependency.

AI Studio should manually import this branch, verify unchanged public UI and existing booking/contact flows, and review the new content DTOs before integrating them into its owned views. `shared/api.ts` is a special-review contract change. No public design is modified here. For review before Phase 2 is merged, the Phase 3 PR should target `feat/phase-2-portable-backend`; later retarget/rebase only after the approved Phase 2 merge.

Remaining production work: actual schema/grant validation and approved migration, RLS correction, backup/restore rehearsal, idempotency and private tracking, distributed abuse controls, admin authentication/sessions/CSRF, provider TLS/proxy qualification, and live ARM/Passenger/Vercel compatibility checks. Publication filtering follows stored booleans and does not prove consent or editorial review of legacy published content. Existing UUID/timezone defaults and custom CHECK/trigger behavior need explicit export/production review. No merge, deployment or live database modification is included.
