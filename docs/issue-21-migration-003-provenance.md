# Migration 003: verified historical identity

Reviewed 19 October 2026. This is a provenance review, not a migration to execute.

The owner reported `20261017052646 / create_site_content_controls` as the only unresolved Secondary migration identity. Codex retrieved its original `statements` and the `public.site_content` schema using SELECT-only queries through the explicitly labelled Secondary account, after confirming the project name **Electrofixbd.Test Project** and its project metadata. Primary was not accessed. No migration, import, ledger repair, grant/policy change or record write was performed. No customer records were read.

The [sanitized evidence fixture](../tests/fixtures/provenance/site-content-20261017052646.json) contains only the recorded migration identity/SQL and site-content structural metadata. Operator identity/email and unrelated ledger fields were omitted. The user also supplied the formatted SQL, which agrees with the retrieved statement.

## Exact differences and equivalence

The applied migration stores **one compact SQL string** in its `statements` array. The repository [003_site_content.sql](../db/migrations/003_site_content.sql), unchanged since commit `4409920`, includes explanatory comments and line breaks. Both contain the same four top-level statements:

| Statement | Applied versus repository |
|---|---|
| `CREATE TABLE IF NOT EXISTS public.site_content` | Same five columns/types, NOT NULLs/defaults, primary key and four allowed keys |
| Initial `INSERT` | Same four key/draft/published tuples, including `{}` for business settings; same `ON CONFLICT (key) DO NOTHING` |
| `REVOKE ALL ... FROM PUBLIC` | Identical |
| `DO $$...$$` | Same two role-existence conditions and role-specific revokes; whitespace/line breaks differ inside the dollar-quoted block |

Offline PostgreSQL parsing (`pglast`, no DB execution) confirmed that SQL parse trees match after excluding source-location metadata and comparing the `DO` body separately. The PL/pgSQL parse trees also match after excluding source line numbers. Automated CI tests additionally compare the body tokens and remaining SQL independently, preserving quoted strings, defaults, rows, roles, revokes and delimiters.

**There is no schema, seed or privilege-operation difference to reconcile.** The current validator correctly treated the dollar-quoted body as opaque, so its compact source did not have the same generic token digest as the repository source. That global rule remains unchanged. The failure was an unrecognized historical identity/representation, not evidence that 003 needed to run again.

## Pinned identity proof

| Proof | SHA-256 |
|---|---|
| Repository 003, LF-normalized exact bytes | `4af545e2729bb384613066e7f678e9d676a2bb5283f1ae02a78cd8bdb969f99f` |
| Original applied SQL string | `dcafb6b3c9d9b12f6f0f9fca7a7821f1a005c916c8684d19559ff4e539b8a847` |
| Original statements array, compact JSON with LF normalization only | `a4ff51b5ca4185452bd10ba92200bc81d7fd29c57d7cd7ae823d96fcdbe711e1` |

The explicit [reviewed mapping](../scripts/lib/verified-migration-identities.json) is limited to `supabase_migrations.schema_migrations`, **version `20261017052646`**, **name `create_site_content_controls`**, and local file `003_site_content.sql`. Acceptance requires both the pinned canonical file hash and the pinned original statements-array hash. No historical checksum was present; the report does not invent one. It reports `statements: verified-historical-variant`, the mapping ID, stored-statement fingerprint and this review path.

Missing/empty/modified SQL, changed roles/defaults, appended statements, wrong identity, altered canonical source or a conflicting checksum fails validation. Changed evidence must be separately reviewed; there is no name-only alias, fallback, checksum refresh or generic dollar-body normalization. Existing version-order/duplicate checks and other migration provenance rules remain intact. No ledger row is rewritten to resemble the repository filename.

## Resulting Secondary schema observed read-only

| Column | Type | Nullable | Default |
|---|---|---|---|
| `key` | text | No | none; primary key |
| `draft` | jsonb | No | `'[]'::jsonb` |
| `published` | jsonb | No | `'[]'::jsonb` |
| `revision` | integer | No | `0` |
| `updated_at` | timestamptz | No | `now()` |

The validated key check allows exactly `hero_slides`, `faqs`, `business_settings`, `page_sections`; those four module keys exist. These match 003. Preflight now verifies these actual defaults/nullability and the exact validated four-key constraint independently of migration identity. It still verifies the primary key and later revision/history metadata. The observed enabled `efb_track` trigger uses the invoker revision function introduced by later migrations; its presence is not a difference in 003.

`anon` and `authenticated` had no table privileges. RLS was observed disabled and no policies were present on this table. Both 003 sources omit RLS enablement, so this is not an identity mismatch or a reason to replay 003. Runtime security readiness/RLS hardening remains a separate review/approval concern; this provenance fix neither changes it nor certifies production readiness.

## Safe outcome and rerun

No reconciliation SQL or ledger mutation is needed. Keep migrations 001–006 immutable and do not replay 003. Use the existing verified Secondary environment variables (`SECONDARY_PROJECT_NAME`, `SECONDARY_PROJECT_REF`, `PRIMARY_PROJECT_REF` denylist, `SECONDARY_DATABASE_URL`) from the updated PR #28 checkout. With a private `C:\PrivateBackups` directory already present, rerun in PowerShell:

```powershell
node --import tsx .\scripts\secondary-content-acceptance.ts "C:\PrivateBackups\issue21-preflight-$(Get-Date -Format yyyyMMdd-HHmmss).json"
```

Review `compatible`, `migration_validation`, `schema_validation`, and `provenance_verified`. This command only reads history, metadata and counts; it cannot migrate, repair or import. If any evidence differs from the pinned snapshot, retain the failure report and review the difference rather than changing the ledger/hash to force success. Full live acceptance remains for the owner to run; this review validates Migration 003, not every production prerequisite.
