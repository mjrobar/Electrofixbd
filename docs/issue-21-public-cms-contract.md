# Issue 21 public CMS integration specification

Implementation belongs to Google AI Studio under AGENTS.md. **No public frontend files were changed in this PR.** The original appearance, CSS, component structure, animations, routing, booking flow and review moderation must survive integration. This specification is a handoff, not evidence that public integration passed.

## Read contracts

Existing `/api/services`, `/api/works`, `/api/testimonials`, `/api/reviews`, booking and contact contracts remain available. Additive endpoints:

| Endpoint | Result |
|---|---|
| `GET /api/cms/documents/:id` | `{success,state,data,render_ready,revision,fallback_allowed}`; published document only, never a draft |
| `GET /api/cms/collections/services` | `{success,contract_version:2,state,fallback_allowed,items,pagination}` with original camelCase source shapes |
| `GET /api/cms/collections/works` | Same envelope; original source ID and authored display caption in `createdAt` |
| `GET /api/cms/collections/testimonials` | Same envelope; original source ID, review/location/media/rating/date/time/source `createdAt`; no consent, submission hashes or draft metadata |
| `GET /api/cms/publication` | Collection/document state list and fallback semantics |
| Existing `GET /api/site-content/:key` | Hero/FAQ/business/legacy page-section published content and additive state metadata |

Collection pagination uses `limit` (1–100, default 20), `offset` (default 0). Fetch additional pages when needed; a single page does not prove complete content. Services use preserved sort order; Works use sort order then timestamp; Testimonials use newest authored/server creation time then sort order. Review form submission continues using the existing persistent review API and pending moderation; never prepend a review as published after submit.

Document IDs, group/item/field IDs, source-key mappings and exact baseline values are in `server/full-content-catalog.json` and `docs/issue-21-field-inventory.tsv`. `/api/admin/cms/documents` supplies authenticated editor definitions. The public document includes structured groups and CTA descriptors. `render_ready` exposes data-only field maps, typed values and actions. It never interprets source expressions or injects HTML.

## Fallback and empty content

- `uninitialized` + `fallback_allowed:true`: retain the matching static baseline until an owner manages publication.
- `published`: use published CMS values; an empty list is authoritative. Never substitute static items because `items.length === 0`.
- `unpublished` + `fallback_allowed:false`: hide/clear the managed section or collection according to its existing layout. Never resurrect static data.
- Cache the last successful state per section if desired. A later network failure must not replace known `unpublished` with static content. Unknown first-load failures require a deliberate frontend loading/error policy; verify it with the owner. API state and data should be consumed from the same envelope rather than raced against separate requests.
- Draft import leaves publication state `uninitialized`, preserving current static behavior. Publish/unpublish/archive explicitly controls authoritative state. No public drafts or pending customer review images may leak.

## Binding adapters and content precedence

Use explicit adapters from stable field IDs/source keys into existing props. React must render strings as text. Do not use `eval`, `Function`, `dangerouslySetInnerHTML` or runtime execution of catalogue source expressions. Templates preserve `{{bindingN}}` placeholders and immutable binding references; resolve only known references through existing application data. Unrecognized mappings must produce an integration error, not guessed content.

Repeated groups preserve IDs, item order and complete templates. Navigation items preserve names and paths. `ui_app` → `layout_home` controls original home sections (`hero`, `services`, `emergency`, `about`, `testimonials`, `faq`) using enabled booleans and order; map to existing components. Do not derive components or arbitrary routes from strings.

Component documents are canonical for detailed component copy and nested cards. Hero/FAQ/Business specialized modules and collection rows are canonical for their corresponding runtime datasets. Legacy `page_sections` summaries are compatibility projections, not an alternative full component inventory. Avoid rendering both sources or falling back from a deliberately blank canonical value to a legacy value. Metadata document edits require a frontend adapter for title/description/OG/language.

CTA actions have typed `kind`, optional `destination` and `service_hint`, plus immutable source `binding`. Map booking to the existing modal callback (with service hint); navigate to the existing router; phone/WhatsApp/external to validated destinations; interaction to the original known callback. Do not fabricate booking URLs. Preserve original callback meaning, security attributes and source flags. Do not execute the stored `binding` string. Unknown email/logo/street address remains absent.

Remote media references stay unchanged. `/api/media/:uuid` is served only when referenced by published, non-archived content. A device image uploaded to a draft uses authenticated Admin preview until publication. The final host must retain durable `MEDIA_ROOT` plus database metadata across restart and deployment; Vercel temporary storage cannot be used.

## Required frontend verification

Compare all 958 mapped source leaves plus CTA bindings against the independent original AI Studio source. Verify exact Bangla/Unicode/copy, media, IDs, display captions, nested card order, flags, component placement and booking hints at 375/768/1440 widths. Test uninitialized/static, published, published-empty, unpublished, API-failure-after-unpublish and reload on a second device. Recheck Booking, Contact, service filters/details/slugs, Works filters/media, Review submit/pending/approve/reject and durable image serving. Record screenshots and field comparisons in the Secondary acceptance report. This has not been executed for this branch.
