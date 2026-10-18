# Issue #16 — public review form integration handoff

Backend/admin implementation base: `fix/local-test-editor-hydration-text-wrap`. Public components, including `src/components/home/TestimonialsSection.tsx`, are deliberately unchanged. Google AI Studio must integrate and verify this contract before the existing browser-local review form can be considered persistent. This document is the separate frontend integration specification; no public design change is needed.

## Required form behavior

1. Load categories from `GET /api/services?limit=100&offset=0`; paginate if necessary. Display published Bengali `name`, submit stable `id`. Do not hard-code an enum or submit category names. Keep existing presentation.
2. Collect `customer_name`, `rating` (integer 1–5), `review`, service category, optional **city / area**. Do not ask for a street address, telephone or private contact information. Show: “Your name, review, rating, selected service and optional city/area/photo may be published after administrator approval. Do not include private contact details.” Require an unchecked consent checkbox. The backend field name is `address` for compatibility with the requested schema; its intended value is only city/area.
3. Generate `submission_key = crypto.randomUUID()` once per attempt. Preserve the same key, text and uploaded image claim on a network retry. Keep these in component memory; do not persist image bytes/base64 or private review data in localStorage. Disable duplicate clicks while pending.
4. Optional photo: accept JPEG/PNG/WebP only, at most 5 MiB, one still image. For local preview use `URL.createObjectURL(file)` and revoke it when replaced/unmounted. Do not use FileReader/base64. POST the original file bytes as below. Upload success alone is **not** a submitted review. Claims expire after 24 hours; request a new upload after expiry. Do not log claim tokens.
5. POST the review JSON. Only a confirmed `201` response means durable intake. Show the pending message and reference, clear the form, and **do not prepend a card** or write `electrofix_user_feedbacks`. Never claim publication. Do not migrate old browser-local reviews automatically; they lack server consent/provenance.
6. Render cards only from the existing published `GET /api/testimonials` response. Preserve the existing card design; map additive `address` to the city/area line and `service_type` to the approved category label. `service_id` is stable identity. Never use pending form data as a public card. Remove the legacy localStorage/immediate-publication code during the frontend-owned integration.

## Image upload

```ts
const response = await fetch("/api/review-images", {
  method: "POST",
  headers: { "Content-Type": file.type },
  body: file,
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
// result.image = { id, url, claim_token, width, height }
```

Same-origin browser fetch automatically supplies `Origin`; it must equal configured `PUBLIC_ORIGIN`. This is a raw binary endpoint, **not multipart/form-data or JSON/base64**. Do not set `X-Admin-Request` or include admin credentials. Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, matching magic bytes. Decoding rejects corrupt images, animation, over 16 million pixels, or either dimension over 6000px. Stored output is metadata-stripped WebP. An unpublished image URL returns 404; use the local object URL while the form is open. Claim tokens are single-use and bind to one customer review. Do not expose them in rendered markup or analytics.

## Persistent intake

`POST /api/reviews`, UTF-8 `Content-Type: application/json`, same origin:

```json
{
  "submission_key": "6d048110-4148-4376-bc79-542e7465d884",
  "customer_name": "Customer name",
  "address": "Mirpur, Dhaka",
  "service_id": "srv-ac-repair",
  "review": "The repair service was professional.",
  "rating": 5,
  "consent": true,
  "website": "",
  "image": {
    "id": "ec232fd7-d232-43c4-a813-c54b8e1b01e3",
    "claim_token": "64-lowercase-hex-characters-returned-by-upload"
  }
}
```

Omit `image` entirely without a photo; omit or send empty `address`. `website` is an optional hidden honeypot and must remain empty; no accessibility-visible required field. Name: 2–150 trimmed characters; review: 10–3000; city/area: at most 150; JSON: at most 16 KiB. Control characters are rejected. Unknown fields, including publication/source/moderation flags, are rejected.

```json
{
  "success": true,
  "reference": "server-generated-review-uuid",
  "status": "pending",
  "message": "Your review was saved for administrator approval. It is not published."
}
```

A retry with the same key and normalized payload returns the same reference. A duplicate under another key, or reuse of a key for different content, returns 409. There is deliberately no public reference lookup exposing pending review details. A retry can still say `pending` after an admin has moderated it: it acknowledges original intake, not a public status lookup.

## Published cards

`GET /api/testimonials` keeps the existing envelope and fields. Additions: `service_id: string | null`, `address: string` (empty on legacy records). `service_type` is the approved service-name snapshot; historical unmapped text remains as authored. Never rely on a live service-name join changing old published wording. No consent timestamps, submission keys/digests, claim tokens or pending drafts are returned. Publish is admin-only; unpublish/archive removes the API card and denies new public image fetches. Previously downloaded images cannot be recalled.

## Errors and limits

Errors retain `{error, code, request_id}` where applicable; show useful text and keep the form on failure. 400: invalid fields/category/image claim; 403: wrong/missing Origin; 409: duplicate/key conflict; 413: too large; 415: unsupported image/MIME; 429: processing/rate/daily quota, retry later; 503: database/storage unavailable, never fake success. Uploads return 503 when no explicitly durable media volume is configured, including temporary Vercel hosting. Text-only reviews still work when review credentials/database are configured. Do not silently drop a selected attachment; allow the user to remove it explicitly.

Anti-abuse: shared daily PostgreSQL quotas of 5 uploads and 5 new reviews per IP, global ceilings of 200 uploads and 500 reviews daily (database date, deploy in UTC), plus a 15-request/15-minute IP throttle shared by both intake routes per Node process. Invalid upload attempts consume upload quota; database-failed review transactions do not confirm or consume submission quota. Do not automatically retry 429 in a tight loop. These controls are not a CAPTCHA or identity verification.

## Frontend-owner acceptance

Verify unchanged public appearance at mobile/tablet/desktop; future service categories load; optional location/photo and consent work; network failures retain unsent data; retry does not duplicate; successful submit shows pending/reference with no new card; admin edit/publish adds approved category/location; unpublish/archive removes it. Test only the disposable local/authorized secondary database. Existing static fallback reviews are separate editorial baseline data and must not resurrect withdrawn customer submissions.
