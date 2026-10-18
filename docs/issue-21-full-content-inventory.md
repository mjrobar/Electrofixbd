# Issue #21 — Full-fidelity CMS content inventory (Phase 1)

**Status:** verified initial source audit, NOT completed migration. Source branch: `fix/windows-local-media-storage`. Re-audit against the original Google AI Studio frontend at final integration. No database modifications.

| Source | Current preview/import | Missing / required for lossless CMS | Admin destination |
|---|---|---|---|
| `src/components/home/HeroSlider.tsx` | 3 slide title, translated title, description, image, primary CTA | badge, secondaryCta, serviceHint, isPhoneCall, isWhatsApp, isNavigateServices, original order and behavioral CTA types (booking callback cannot become a fabricated URL) | Hero Slides |
| `src/data/testimonialsData.ts` FAQ_DATA | question and answer with default General | preserve full text, original ordering, future authored categories | FAQs |
| `src/data/siteConfig.ts` | name, phone, whatsapp, city, hours, social URLs | shortName, tagline, phoneClean, phoneInternational, serviceCoverage, experience, circuitBoardSpecialty, aboutSectionImage | Business Settings |
| `src/components/home/AboutSection.tsx` | first title/paragraph, image | nested cards, counter/stat values and labels, remaining copy, actions and layout order | About Page Sections |
| `src/components/home/EmergencyBanner.tsx` | first title/paragraph | other text/labels, CTAs and action types | Emergency Page Sections |
| `src/components/home/FAQSection.tsx` | first title/paragraph | additional copy and support actions, preserve FAQ_DATA references | FAQ Page Sections |
| `src/components/contact/ContactSection.tsx` | first title/paragraph | rest of authored contact text, labels, help descriptions | Contact Page Sections |
| `src/components/services/ServicesPageView.tsx` | first title/paragraph | filter labels, introductions, other editorial copy | Services Page Sections |
| `src/components/works/OurWorksPageView.tsx` | first title/paragraph | all labels, introductions, CTA copy | Works Page Sections |
| Header/navigation/footer/other public components | not mapped | COMPLETE component crawl required; capture every visible editorial string/link/media/order | Sitewide Content |
| Services/Works/Testimonials catalog modules | separate pre-existing import flow | verify every legacy item/array/media/slug and existing user data; no accidental publishing or resurrection | respective CMS modules |

## Source-preserving implementation contract

- Do **not** claim complete import until every current user-visible editorial field has a destination, exact source mapping and export proof; record intentional non-editorial behavior separately.
- Preserve Unicode Bengali, URLs, IDs, arrays, item order, flags, CTA action types and existing design interactions. Do not invent unknown email, logo, street address or phone URLs.
- Extend schema and Admin editors additively with field-level validation and stable identifiers. Keep version history, drafts and publish separation.
- Preview must be read-only and show per-section counts, field coverage, differences and conflict handling. Provide full source backup and pre-import database backup.
- Explicit **draft-only** import must be deterministic/idempotent, preserve existing edited/published records, skip conflicts with reports, and allow rollback/retry.
- Verify source → DB draft → Admin → export → approved public API → public render round-trip for every field.
- Do not publish, modify primary Supabase, or run destructive tests on secondary Supabase without explicit approval.
- Owner-accepted prior local tests (booking, contact, services, works, reviews, device uploads, persistence) must remain passing.

## Remaining stages
- [x] Identify and document verified source gaps.
- [ ] Exhaustively inventory all public components, data and original AI Studio source.
- [ ] Add additive DB migrations and Admin CMS editors + validation.
- [ ] Implement versioned complete import, backup/diff/conflict reporting.
- [ ] Request approval before migration; run Secondary preflight and field-level tests.
- [ ] Integrate published APIs into original public UI without changing design or reviving intentionally unpublished content.
- [ ] Request separate approval before Primary DB backup/migration/import.
