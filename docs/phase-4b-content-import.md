# Phase 4B existing content import and admin synchronization

Issue #7 implementation, stacked on `feat/phase-4b-site-controls-api` at
`4409920ce5e23c24c5b09e44549b20d1a29c14dd`. No public frontend changes,
deployment, automatic migration, or production database access is part of this work.
Migration 003 already provides every required column; no new migration is needed.

## Source catalogue and dry-run baseline

`server/existing-content-catalog.json` is a reviewed, static source snapshot. It
contains the source commit, SHA-256 of each inspected file, field mappings,
unsupported fields, and proposed draft data. Runtime does not execute or import
public React components. Tests fail when a catalogued source file changes, so the
snapshot must be reviewed against future source changes before importing again.

| Module | Existing source | Imported fields | Baseline preview |
| --- | --- | --- | --- |
| Hero slides | `src/components/home/HeroSlider.tsx`, `slides` | ID, title, Bengali subtitle, description, image, primary CTA label | 3 draft slides |
| FAQs | `src/data/testimonialsData.ts`, `FAQ_DATA` | Generated stable ID, question, answer | 8 draft FAQs |
| Business settings | `src/data/siteConfig.ts`, `BUSINESS_CONFIG` | Name, displayed phone, WhatsApp number, city/location, hours, Facebook, YouTube | 7 sourced values |
| Page sections | AboutSection, EmergencyBanner, FAQSection, ContactSection, ServicesPageView, OurWorksPageView | First main heading and following paragraph; about image from BUSINESS_CONFIG | 6 draft sections |

All component paths in the page-section row are under `src/components/` and are
listed individually with hashes and selectors in the catalogue. Page-section IDs
are `legacy-home-about`, `legacy-home-emergency`, `legacy-home-faq`,
`legacy-contact-intro`, `legacy-services-intro`, and `legacy-works-intro`.
About is a home-page section, not an invented separate about-page route.

Mapping is deliberately partial. Email, logo URL and hero button URL are absent
from the represented source and remain blank. Address is the existing city label,
not a street address. FAQ category defaults to the schema's `General`; IDs and
active flags are import metadata. Hero badges, secondary CTAs, service hints,
booking callbacks, nested cards, statistics, navbar and footer presentation do not
fit the current module schema and remain documented, unchanged source content.
Text from nested inline markup is flattened to plain text; markup and layout are
not imported. AI Studio must retain the existing behavioral fields and layout.

A dry run against the disposable local database after migration 003 reported all
four untouched placeholders eligible, with the counts above. No draft or
publication changed during preview. This report describes that local baseline,
not the current production database.

## Nontechnical admin workflow

1. Sign in to `/admin`, then open Website Content.
2. Choose **Preview import**. Expand each module and the source mapping. A preview
   reads data only and grants no apply token.
3. Choose **Download backup for approval**. This makes a fresh preview, exports all
   `site_content` rows (draft, published, revision, timestamp), source mappings and
   proposed data, and issues a signed approval token valid for 15 minutes. Keep
   the downloaded JSON somewhere private. Review this fresh preview if anything
   changed since the first preview.
4. Check the explicit approval statement and choose **Approve draft import**.
   This is the operator approval gate for the selected environment. Do not approve
   a production import until the owner has separately authorized that operation.
5. Review each imported module, edit, **Save draft**, then **Publish saved draft**
   with its confirmation when approved. Importing alone does not publish content.

The UI prevents import during unsaved module edits or editor requests. Module
switching confirms discarding edits. Failed loads disable editing and publishing;
reload is available. Empty collections explain how to import or add items; empty
business settings render labelled blank fields. Unsaved edits disable publication.
Validation errors include field paths. Revision conflicts retain local edits until
the operator chooses reload. Existing admin shell, typography, colors, spacing and
CSS remain intact.

## Backend contract and non-destructive rules

All import endpoints are under the existing authenticated `/api/admin` router,
with `Cache-Control: no-store`. POST requires the exact configured Origin and
`X-Admin-Request: 1`, in addition to the HttpOnly session cookie.

- `GET /site-content-import/preview`: catalogue, per-module action/reason/data,
  backup snapshot, backup digest and preview digest. No writes or apply token.
- `GET /site-content-import/backup`: same snapshot as an attachment, plus an
  HMAC-signed expiring `approval_token`. The preview digest binds the entire
  backup, import data and catalogue. No database writes.
- `POST /site-content-import/apply`: JSON containing `approval_token` and
  `approval: "IMPORT EXISTING CONTENT AS DRAFTS"`. Returns imported/skipped module
  keys only after commit. Missing approval is 400; stale/invalid/expired approval
  is 409. Export and review again after a conflict. Storage failures are sanitized
  503 responses.

Import uses a single transaction with a table write lock, a 5-second lock timeout
and 15-second statement timeout. It compares the complete locked database snapshot
to the approved preview before writing. Only missing modules or exact migration
placeholders (revision 0, both draft and published empty in the correct shape)
are eligible. Existing authored drafts, publications, and intentionally emptied
revision > 0 records are skipped wholesale. It does not merge into authored
modules, even if some individual fields are blank. Missing modules are inserted
with an empty publication; placeholders receive only a draft and revision update.
All imported records start at revision 1. Repeated imports skip those records
without changing revisions or timestamps. Any failure rolls back every write.
Other tables, ACLs, RLS and migrations are untouched.

Publishing locks the selected row, verifies its revision and validates that same
locked draft before copying it to published. The response includes draft and
publication with the new revision. Untouched revision-0 placeholders cannot be
published. Duplicate IDs are rejected. The admin JSON parser allows 2 MB so valid
multi-entry modules are not rejected by the former 8 KB login-sized limit.
Login keeps its 30-attempt / 15-minute limit; other admin requests allow 300
requests per 15 minutes so ordinary preview/edit/refetch operations remain usable.

## Read-only operator export

An optional CLI uses a separate, explicit variable and a read-only PostgreSQL
connection. It never falls back to `DATABASE_URL`, never applies imports, and
creates the export exclusively with mode 0600 rather than overwriting a file.

```sh
IMPORT_DATABASE_URL='<reviewed development database URL>' \
  node --import tsx scripts/preview-content-import.ts /private/path/new-preview.json
```

The export includes only `site_content`, not credentials or customer tables. It
is not a full database disaster-recovery backup. Obtain a separate approved full
backup if operating on a real database. For an undo, preserve the original export
and obtain approval for a reviewed restore; compare current revisions with the
imported revision before restoring anything. Do not blindly restore over newer
admin edits. There is no automatic restore/delete or startup import.

## Validation and limits

Node 24 is required. Use only an explicitly disposable local PostgreSQL target:

```sh
npm run lint
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/electrofix_test npm test
npm run build
npm run test:startup
```

Integration tests refuse remote hosts and database names without `test`. The new
import suite creates and drops its own random test database. Coverage includes
source hashes and partial mapping, deterministic previews, preserving authored
and intentionally empty records, export integrity, authentication/Origin checks,
explicit approval and token expiry/tampering, stale snapshots, idempotency,
missing modules, competing imports, full rollback on a late failure, large drafts,
optimistic save conflicts, locked publish validation and published-only reads.
Existing migration assertions now account for migration 003 and restrict legacy
column comparisons to the pre-existing tables.

See the separate `phase-4b-ai-studio-handoff.md` for public frontend integration.
AI Studio compatibility verification is still required before merging. No public
content wiring is implemented here.

### Implementation verification results

Verified with Node `v24.19.0` and disposable PostgreSQL `18.4`:

- `npm run lint`: passed.
- `npm test` with the explicit local `TEST_DATABASE_URL`: 28 passed, 0 failed,
  0 skipped, including the new four-test import/admin suite.
- `npm run build`: passed for the Vite client and portable Node server bundle.
  Existing Vite warning: `__dirname` in `vite.config.ts` will need attention for a
  future native config loader. Build configuration was left unchanged.
- `npm run test:startup`: both development and production checks passed.
- Headless Chromium against a second disposable local database: login, preview,
  attachment backup download, approval, import, draft/save/publish, public reads,
  loading-failure recovery and blank optional business values passed. No browser
  runtime errors or horizontal overflow at 375, 768 and 1440 pixels; screenshots
  were inspected for the existing admin shell and new controls.
- Read-only CLI preview/export succeeded; exported local placeholders remained
  eligible for import afterward. No dependency manifests or lockfiles changed.

The base repository's npm peer resolution required `--legacy-peer-deps` for the
existing Vite 8 / esbuild 0.25 peer mismatch in this environment. This did not
require a dependency or build configuration change. AI Studio review and any
real-environment import approval remain separate from these local checks.
