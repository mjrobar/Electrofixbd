# Issue #16 implementation report

Branch: `feat/issue-16-reviews-media-categories`, based on reviewed `fix/local-test-editor-hydration-text-wrap` (`b7fe6fa`). All public frontend components, pages, data, styles and clients are unchanged. The existing legacy-service editor hydration, text wrapping, content import provenance and public fallback behavior are preserved. This is backend/admin work for Draft PR review, not a deployment.

## Completed

- Works and testimonials use a dynamically loaded active-service dropdown with published Bengali names. PostgreSQL foreign keys store stable service IDs; new categories appear after service publication. Backend validates selections. Existing unmapped text remains untouched until explicitly mapped; no enum or speculative migration.
- New service/work titles propose editable ASCII slugs. Latin accents normalize; Bangla-only titles receive deterministic safe ASCII fingerprints. Collision handling includes archived records; blank server-generated slugs serialize concurrent creation. Existing slugs remain permanent. Explicit custom collisions fail without overwriting records.
- Service covers, work images, testimonial avatars and testimonial photos offer device upload alongside existing URL fields. Authenticated uploads preserve session and CSRF checks. Matching JPEG/PNG/WebP bytes and MIME, 5 MiB, 16 MP, 6000px, nonanimation limits and bounded processing apply. Metadata-stripped WebP uses generated names, private filesystem permissions and PostgreSQL metadata. File/directory sync precedes metadata confirmation. Restart persistence is tested.
- Public review/image APIs support validated consent, optional city/area and still photo, category ID, shared daily PostgreSQL quotas, IP throttling/honeypot and duplicate/idempotent handling. Writes are transactional, explicitly pending/unpublished, with no publication flag accepted from customers. Image claims are secret, expiring and single-use. Public responses expose no private pending fields.
- Admin Pending Review filter and shortcut, private image previews, edit/save/preview/publish, unpublish, reversible archive, restore and version history use the existing design system. Publication alone exposes the approved category/location/photo through existing GET contracts. Unpublish/archive denies public media access and removes API cards. No customer hard-delete endpoint exists.
- Portable Node + PostgreSQL deployment templates support a durable media volume. Optional reviewed retention maintenance preserves attached/history references and previews before deleting old unreferenced blobs. Existing HTTPS URL-only content works without local storage enabled. Temporary Vercel storage is rejected.

## Verification

All database mutations and destructive rehearsals ran only against explicitly loopback PostgreSQL test databases. New integration coverage provisions a random database and a dedicated nonowner, non-superuser runtime role with RLS. No inherited Primary Database connection was used.

| Check                                                     | Result                                                                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                            | Passed                                                                                                                                                                     |
| `npm test` with explicit local `TEST_DATABASE_URL`        | 43 passed, 0 failed, 0 skipped                                                                                                                                             |
| Additional targeted Phase 4C checks after final hardening | 4 passed, including failed real PG insert redaction/no success and retention preservation                                                                                  |
| `npm run build`                                           | Passed; existing Vite future-native-loader `__dirname` warning remains                                                                                                     |
| `npm run test:startup` with disposable database           | 2 passed: development and production startup, routing and shutdown                                                                                                         |
| Optional Playwright admin acceptance                      | Passed: eight views at 375/768/1440, no overflow/page errors; original lifecycle plus dynamic category, auto slug, device upload and pending review edit/publish/unpublish |
| Public source scope check / `git diff --check`            | No public source changes / passed                                                                                                                                          |

Security/API coverage includes unsafe bytes/MIME, oversized upload/dimensions, symlink/ephemeral storage rejection, metadata stripping, unauthenticated upload rejection, private pending images, category validation and future additions, duplicate names/Bangla slugs, immutable existing URLs, upload restart persistence, idempotent intake, publication-field injection rejection, invalid/reused claims, moderation/history/archive, published API allowlists, quota enforcement and actual PostgreSQL insert failure without false confirmation.

## Migration and operator requirements

Review and apply additive `005_reviews_media_categories.sql` only to an explicitly approved target after backup. It adds category references, location/moderation/consent/idempotency metadata, `media_assets` and `review_quotas`; historical public/customer data is not rewritten. Review the separately gated security preview to grant the dedicated runtime role access/policies for the new tables. No migration, production ACL change, media cleanup, merge or deployment was performed on any real/Primary Database.

Before enabling uploads on the final host: verify Sharp's native package support, provision the durable Node-owned 0700 media volume outside application code, configure storage and a stable abuse secret, set body limits, and rehearse coordinated PostgreSQL/media backup and recovery. The filesystem must have capacity monitoring/quota. See [operations guide](issue-16-operations.md).

## Remaining integration and limitations

- Public `TestimonialsSection.tsx` still has the original localStorage/FileReader/immediate prepend implementation because public source ownership is preserved. Google AI Studio must replace that submission path using the exact [frontend API specification](issue-16-frontend-review-api.md). Until then, the existing public form is not server-persistent and must not be treated as moderated intake. The backend/admin flow is implemented and tested independently.
- Location/category card presentation is specified for frontend-owner integration; APIs already return approved `address`, `service_id` and compatible `service_type`. City/area is optional; do not collect full street addresses/private contacts.
- Oracle/shared-host filesystem durability, ARM package installation and operator backup restore were not verifiable without access to that final host. The durability flag is an explicit operator assertion. Vercel device uploads remain unavailable by design.
- Public attachments are still images only. External editorial video URLs remain supported. Anti-abuse does not establish customer identity and does not include a CAPTCHA; global/daily ceilings deliberately bound intake and may need operational tuning.
- Attached/archived/history-referenced media and customer records are retained. Legal erasure/hard-delete requires a separate approved retention procedure. A crash before metadata insert can leave an untracked blob; audited volume/metadata reconciliation is documented.
- AI Studio verification and owner local/secondary acceptance remain required before merge. `package.json`/`bun.lock` (Sharp), additive public response fields, and the exact feature-branch Vercel deployment-disable rule require special review under AGENTS.md. Main deployment settings and public routing are preserved.
