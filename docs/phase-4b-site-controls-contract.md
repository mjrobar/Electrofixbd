# Phase 4B — Site Controls API / Google AI Studio Handoff

## Ownership
Codex owns `db/migrations/003_site_content.sql`, `server/site-controls.ts`, server route mounts, and `src/admin/*`.
**Google AI Studio alone** implements any changes to the public React website. This branch does not change public UI components.

## Backend module keys
- `hero_slides` — ordered slides: id, title, subtitle, description, image_url, button_label, button_url, is_active
- `faqs` — ordered questions: id, question, answer, category, is_active
- `business_settings` — object: business_name, phone, whatsapp, email, address, hours, facebook_url, youtube_url, logo_url
- `page_sections` — ordered sections: id, page, section, heading, body, image_url, is_active

All controls support a draft and a published copy with increasing `revision` (optimistic concurrent editing).

## Admin-only routes
All require the existing admin HttpOnly session and same-origin write protection.
- `GET /api/admin/site-content/:key` -> `{item:{key,draft,published,revision,updated_at}}`
- `PUT /api/admin/site-content/:key/draft` with `{data,revision}` -> updated item, 409 on concurrent write.
- `POST /api/admin/site-content/:key/publish` with `{revision}` -> updated published item, 409 on concurrent write.

## Public read route
- `GET /api/site-content/:key` -> `{success:true,data,updated_at}`
- Server never serves draft values via the public route.
- A newly migrated empty list/object is **not** a request to erase existing hardcoded frontend content. AI Studio should retain existing content until data for that module is deliberately published and reviewed.
- Do not expose DB credentials or admin endpoints to public React code.
- Data may change after initial load; design a safe read strategy, loading/error states, and cache policy.
- Do not change public UI design, layout or behavior when integrating.

## Database
Migration 003 is **not yet applied** to production or test databases. It is additive, creates a new `public.site_content` table and placeholders, does not change existing rows in any of the original five tables. Take a backup, run migration on disposable test DB first, and verify RLS/grants/server database role before authorizing production migration.

## Verification before merge
- Node 24 TypeScript + build + existing tests.
- Add unit/integration tests for draft validation, unauthorized writes, publish, revision conflict and published-only public read.
- AI Studio public frontend compatibility review.
- Review unchanged public frontend file list.
- Do not merge without user approval.
