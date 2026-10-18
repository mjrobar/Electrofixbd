# Issue #16 — migrations, durable media and moderation operations

Nothing in this PR migrates the Primary Database, changes its ACLs, deploys, merges or schedules maintenance. All automated mutations use local disposable PostgreSQL. Owner acceptance and Google AI Studio verification precede merge/deployment.

## Additive schema and historical mapping

Review and explicitly run migration `005_reviews_media_categories.sql` using the existing migration runner against the intended authorized target after backup. Do not use the Primary Database for automated test suites. The runner never runs during application startup. New nullable `works.service_id` / `testimonials.service_id` reference `services(id)` with indexes; no enum prevents future categories. Existing text `category` / `service_type`, IDs, slugs, publication state, media URLs and drafts are untouched. Testimonial `address` defaults empty, `submission_source` defaults `admin`, `moderation_status` defaults `editorial`; consent/idempotency/digest fields are nullable. New customer inserts explicitly use `false`, `customer`, `pending` and a consent timestamp.

There is **no guessed historical name mapping**. Editors show the original label as a legacy option. Retaining it unchanged is permitted; explicitly selecting an active service persists its ID and a published Bengali name snapshot. New records require an active category. Service name changes never rewrite historical published labels; explicitly saving/publishing a mapped record refreshes its label from the current service name. Existing inactive mapped categories require replacement before another publish. New draft services appear in category dropdowns only after publication. Legacy version snapshots remain restorable as drafts; publish revalidates the current category and media rules.

Production's dedicated runtime role also needs SELECT/INSERT/UPDATE and scoped RLS policies on `media_assets` and `review_quotas`. The separately gated `db/security/001_browser_access_lockdown.sql` / `scripts/secure-database.ts` preview/apply workflow now includes them and still requires explicit backup/ACL approval. It is not an automatic data migration. Re-review the entire preview before applying on an already hardened host. The readiness guard expects eleven private application tables. Do not grant browser roles direct access to intake, media metadata or quotas.

Slug creation proposes ASCII slugs from Latin text with accent normalization; wholly non-Latin titles use a deterministic `item-<12 hex title digest>` fallback. Collisions include archived rows and receive `-2`, `-3`, etc. Blank/omitted slugs are generated on the server under a transaction/advisory lock; proposed slugs remain editable before save. Explicit/custom slug collisions return 409 and never overwrite another item; use “Suggest available slug” to obtain a fresh proposal. Existing slugs remain immutable, including during version restoration.

## Final host requirements

Use Node 24 + PostgreSQL and the new portable `sharp` dependency, with native Linux ARM64/x64 packages supported by the host. Install from reviewed `package.json` / `bun.lock` with optional native packages enabled; the Linux test host successfully decoded/re-encoded uploads. Verify the final host's architecture/libc and package installation before enabling uploads; Oracle/shared-host access was not available for verification.

Provision a real persistent volume, e.g. `/var/lib/electrofix/media`, owned by the unprivileged Node service user, mode 0700, files 0600. The application enforces ownership by its service user and rejects group/other directory permissions. It must survive restarts and application releases and have a filesystem quota, free-space monitoring, backup and restore checks. Set server-only:

```dotenv
MEDIA_ROOT=/var/lib/electrofix/media
MEDIA_STORAGE_DURABLE=true
REVIEW_ABUSE_SECRET=<stable-random-secret-at-least-32-characters>
```

The abuse secret may fall back to `ADMIN_SESSION_SECRET`, but a separate stable secret avoids losing duplicate/IP consistency on admin secret rotation. Never expose either in frontend builds. Empty optional env values are accepted. The app refuses a media root within/above its working application directory, symlinked roots, production `/tmp`/`/var/tmp`, and local upload configuration on Vercel. The durability flag is an operator assertion: software cannot prove that an arbitrary mount survives host replacement. With storage disabled, existing external HTTPS images continue working; upload attempts return honest 503 responses. Text-only pending reviews can still be submitted. No Supabase Storage adapter is introduced.

The systemd example now creates `/var/lib/electrofix` with `StateDirectory` and permits writes there while keeping application source read-only. Set `MEDIA_ROOT` to its `media` subdirectory. The nginx example allows 5 MiB bodies and proxies media through Node. **Never add an nginx/static public alias to the media volume**, or pending images would bypass moderation. Node public `/api/media/:uuid` checks a current published, nonarchived service/work/testimonial reference on every request. Admin `/api/admin/media/:uuid/blob` requires the existing owner session; both use no-store, nosniff, generated WebP names and safe content disposition. Unpublish/archive denies subsequent public fetches; previously downloaded images cannot be revoked.

Uploads are raw binary, at most 5 MiB; matching JPEG/PNG/WebP signatures and MIME are required. Sharp rejects corrupt/animated/oversized images, strips metadata, applies orientation and emits WebP. Two decodes per Node process bound concurrent image processing; excess receives 429. No external URL is fetched by the server, and client filenames never determine paths. PostgreSQL holds metadata only; the media volume holds blobs. File and directory sync complete before metadata persistence. Successful metadata persistence is required before confirming an upload; failed inserts remove the new file. A process crash between file creation and metadata insertion can leave an untracked file: reconcile the volume against metadata during audited backup/maintenance, never blindly delete files by age.

## Moderation and retention

Website Content → testimonials → **Pending Review** lists only unarchived, unpublished customer records awaiting first approval. Owner can inspect content and private image previews, edit name/review/category/city-area/photo, save a draft, preview and explicitly publish. First publication marks `reviewed`; later unpublish leaves the item in the ordinary unpublished/draft filter rather than misclassifying it as never reviewed. Archive is confirmed, reversible and never hard-deletes customer records. Restore does not publish; history restore creates a draft and preserves current public content until explicit publication. Do not publish personal contact information in names/reviews/location. Review consent records acceptance of the form notice, not independent identity verification.

Retain attached images and all editorial/history references, including archived and unpublished customer records, until a separately approved erasure/retention procedure is defined. There is no destructive customer hard-delete endpoint. Public upload claims expire at 24 hours. Unattached and unreferenced media older than 48 hours are eligible for the operator maintenance tool (100 candidates per invocation):

```bash
# Explicit maintenance target, never DATABASE_URL fallback. Default previews only.
MEDIA_MAINTENANCE_DATABASE_URL=<authorized-operator-target> \
MEDIA_ROOT=/var/lib/electrofix/media MEDIA_STORAGE_DURABLE=true \
PUBLIC_ORIGIN=https://your-domain node --import tsx scripts/media-retention.ts
```

After a coordinated PG/media backup and preview review, the operator can explicitly opt into `--apply --backup-reviewed` with `MEDIA_RETENTION_APPROVAL='REMOVE UNREFERENCED MEDIA'`. It locks each candidate, rechecks all content/draft/history references, tombstones metadata, removes only its generated blob, and purges quota buckets older than 30 days. Referenced assets and attached reviews are never candidates. Failed unlink operations leave a tombstone and retry safely next time. The maintenance connection requires table DELETE for quota cleanup, unavailable to the application runtime by design. No job is installed or run automatically. Check preview volume and run reviewed batches as needed; monitor disk rather than assuming quotas replace maintenance.

Take PostgreSQL and media backups as one recovery unit during a write pause/snapshot, encrypt off-host copies, and rehearse restore with IDs/filenames intact. A database-only backup cannot restore photos; a media-only backup cannot restore moderation visibility. The current system intentionally does not remove referenced history, implement legal erasure, resize video, perform identity verification, or provide malware/CAPTCHA services. Public attachments are still images only; existing editorial external video URLs remain supported.

## Review gates

`package.json` and `bun.lock` add only `sharp` and its native image dependencies; review their platform requirements. `vercel.json` adds an exact disabled rule for this feature branch to prevent branch deployment; no main routing/build/deployment behavior changes. Public API additions and the separate frontend handoff require AI Studio compatibility review. No Google-owned public source file is modified.
