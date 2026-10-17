# Google AI Studio handoff — existing content import

This is a specification for the public frontend owner. This PR changes no public
frontend file, layout, style, animation or behavior. Import first creates drafts;
the public API stays empty until an administrator publishes each module.

## API to consume

Use same-origin `GET /api/site-content/{key}` where key is `hero_slides`, `faqs`,
`business_settings`, or `page_sections`. A successful response has
`{ success: true, data, updated_at }`; the endpoint returns only the saved
publication, never draft or revision. Responses use `Cache-Control: no-store`.
Missing configuration/database failures return 503; unknown modules return 404.
No admin credentials, database URL, Supabase key or admin endpoint belongs in the
public bundle. Treat all strings as text, not HTML.

## Preserve existing presentation

| Module / imported ID | Source slot | Mapping and compatibility requirement |
| --- | --- | --- |
| hero_slides / legacy-hero-1..3 | HeroSlider slides | title → title, subtitle → titleBn, description → description, image_url → image, button_label → primaryCta. Keep existing badge, serviceHint, secondary CTA, phone/WhatsApp/navigation flags and booking callbacks keyed to the original slide ID. Blank button_url must not replace the booking callback with a link. |
| faqs / legacy-faq-1..8 | FAQSection / FAQ_DATA | question and answer directly; preserve accordion structure, initial expansion, accessibility and animation. |
| business_settings | BUSINESS_CONFIG consumers | business_name → name, phone → displayed phone, whatsapp → WhatsApp number, address → location, hours → businessHours, facebook_url / youtube_url → social links. Derive phone call normalization with the existing rules; retain the existing local fallback when an optional value is blank. |
| page_sections / legacy-home-about | AboutSection | heading and body only; image_url maps to the existing about image slot. Preserve other panels/statistics. |
| page_sections / legacy-home-emergency | EmergencyBanner | heading and body only; retain hotline, hours badge and CTA behavior. |
| page_sections / legacy-home-faq | FAQSection header | heading and body only; retain the header badge and accordion. |
| page_sections / legacy-contact-intro | ContactSection hero | heading and first supporting line only; retain the separate main description, contact form and durable submission behavior. |
| page_sections / legacy-services-intro | ServicesPageView intro | heading and first supporting line in the existing intro slots only. |
| page_sections / legacy-works-intro | OurWorksPageView intro | heading and first supporting line in the existing intro slots only. |

The catalogue records exact source paths, hashes and selectors. Its snapshot comes
from base commit `4409920ce5e23c24c5b09e44549b20d1a29c14dd`. It does not model all
page copy. Never replace an entire component with a generic page-section renderer.
Preserve inline emphasis when using the imported plain-text body; the admin body
is text and contains no HTML. Preserve each component's responsive classes and
all service booking/contact contracts.

## Empty, unpublished and failure handling

Fetch modules independently so one unavailable module cannot blank another.
Keep the current source content while a module has no published content or its
request fails. An empty business object is an unpublished baseline. Initial
hero/FAQ/page arrays are also empty. The API currently does not distinguish an
intentionally published empty collection from an initial empty publication; agree
on this behavior with the owner before using empty arrays to hide whole sections.
For published nonempty arrays, honor `is_active` (false means hidden), stable IDs
and array order, while retaining supported local behavioral metadata. Handle new
hero IDs explicitly: the current schema cannot describe secondary actions, badges
or booking service hints, so do not invent those behaviors. Optional missing
email/logo/URL values must not create blank clickable controls or broken images.

Publishing changes only JSON availability; it does not automatically re-import
files into AI Studio. Import this feature branch manually, preserve the public
files, and make any integration in a separate frontend-owned branch.

## AI Studio verification before merge

Verify the existing layout at 375, 768 and 1440 pixels; hero timing and touch
navigation; all booking/phone/WhatsApp CTAs; FAQ keyboard/accordion behavior;
about/emergency/contact/services/works sections; public fallback before publishing
and during API failure; draft edits remaining invisible until publish; and no
credentials or admin traffic in the public client. Run lint, tests and production
build after the frontend-owned integration and report compatibility issues to
Codex. Do not merge or deploy without the owner's explicit approval.
