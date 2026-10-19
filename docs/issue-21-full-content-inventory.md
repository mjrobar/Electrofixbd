# Issue 21 complete pinned-source inventory

This inventory covers the repository public source at `d8610dcdd87c6fcf6034ec08ca8122fce780627c` (PR #27), including the preceding Issue 21 stack. It does **not** certify a separate Google AI Studio workspace. That reconciliation and public CMS integration remain acceptance blockers.

The exact values, SHA-256 provenance, AST paths, source line/column, typed CMS destinations and explicit behavior exclusions are in [the catalogue](../server/full-content-catalog.json). [The field-by-field TSV](issue-21-field-inventory.tsv) lists every inventoried value/binding, including exclusions. Neither file contains database/customer data.

The catalogue has 25 source files, 958 mapped editorial/collection fields, 3,143 behavior/design exclusions and 536 immutable dynamic bindings. There are 19 component documents, 6 services, 12 works, 9 static testimonials, 3 hero slides, 8 FAQs and one business settings object. Six legacy page sections remain inside their compatibility module. First pristine import has **50 entries: 19 documents + 4 compatibility modules + 27 collection records**. Counts are source counts, not guaranteed total database counts: existing content is preserved; the seventh foundation service `General` is not a static source service.

## Editable component documents

| CMS section | Source | Groups | Items | Fields | CTA bindings |
|---|---|---:|---:|---:|---:|
| App | `src/App.tsx` | 4 | 9 | 48 | 7 |
| DatabaseStatusBanner | `src/components/common/DatabaseStatusBanner.tsx` | 1 | 1 | 34 | 4 |
| ContactSection | `src/components/contact/ContactSection.tsx` | 1 | 1 | 51 | 4 |
| AboutSection | `src/components/home/AboutSection.tsx` | 5 | 17 | 56 | 2 |
| EmergencyBanner | `src/components/home/EmergencyBanner.tsx` | 1 | 1 | 11 | 3 |
| FAQSection | `src/components/home/FAQSection.tsx` | 1 | 1 | 8 | 3 |
| HeroSlider | `src/components/home/HeroSlider.tsx` | 1 | 1 | 12 | 7 |
| TestimonialsSection | `src/components/home/TestimonialsSection.tsx` | 4 | 8 | 83 | 16 |
| Footer | `src/components/layout/Footer.tsx` | 1 | 1 | 34 | 11 |
| Navbar | `src/components/layout/Navbar.tsx` | 3 | 6 | 42 | 12 |
| BookingModal | `src/components/services/BookingModal.tsx` | 1 | 1 | 45 | 6 |
| ServiceCard | `src/components/services/ServiceCard.tsx` | 1 | 1 | 5 | 4 |
| ServiceDetailView | `src/components/services/ServiceDetailView.tsx` | 1 | 1 | 23 | 8 |
| ServicesPageView | `src/components/services/ServicesPageView.tsx` | 3 | 9 | 51 | 6 |
| OurWorksPageView | `src/components/works/OurWorksPageView.tsx` | 1 | 1 | 11 | 0 |
| WorkGallery | `src/components/works/WorkGallery.tsx` | 3 | 3 | 25 | 4 |
| siteConfig | `src/data/siteConfig.ts` | 1 | 1 | 4 | 0 |
| bookingClient | `src/lib/bookingClient.ts` | 1 | 1 | 8 | 0 |
| Page metadata and social sharing | `index.html` | 1 | 1 | 7 | 0 |

## Source coverage and disposition

| Source | Mapped fields | Explicit code/design exclusions | Dynamic bindings |
|---|---:|---:|---:|
| `src/App.tsx` | 48 | 294 | 65 |
| `src/components/common/DatabaseStatusBanner.tsx` | 34 | 112 | 8 |
| `src/components/contact/ContactSection.tsx` | 51 | 322 | 43 |
| `src/components/home/AboutSection.tsx` | 56 | 212 | 24 |
| `src/components/home/EmergencyBanner.tsx` | 11 | 87 | 9 |
| `src/components/home/FAQSection.tsx` | 8 | 74 | 15 |
| `src/components/home/HeroSlider.tsx` | 42 | 130 | 26 |
| `src/components/home/TestimonialsSection.tsx` | 83 | 485 | 107 |
| `src/components/layout/Footer.tsx` | 34 | 184 | 17 |
| `src/components/layout/Navbar.tsx` | 42 | 216 | 35 |
| `src/components/services/BookingModal.tsx` | 45 | 277 | 53 |
| `src/components/services/ServiceCard.tsx` | 5 | 68 | 15 |
| `src/components/services/ServiceDetailView.tsx` | 23 | 194 | 35 |
| `src/components/services/ServicesPageView.tsx` | 51 | 227 | 46 |
| `src/components/works/OurWorksPageView.tsx` | 11 | 88 | 4 |
| `src/components/works/WorkGallery.tsx` | 25 | 134 | 34 |
| `src/data/servicesData.ts` | 120 | 1 | 0 |
| `src/data/siteConfig.ts` | 19 | 1 | 0 |
| `src/data/testimonialsData.ts` | 115 | 1 | 0 |
| `src/data/worksData.ts` | 120 | 1 | 0 |
| `src/lib/bookingClient.ts` | 8 | 11 | 0 |
| `src/main.tsx` | 0 | 7 | 0 |
| `src/types.ts` | 0 | 16 | 0 |
| `index.html` | 7 | 0 | 0 |
| `src/index.css` | 0 | 1 | 0 |

## Editing and preservation contract

- Website Content → Complete website CMS edits component copy, nested cards/stats/navigation/footer, media, labels, page composition and CTA descriptors. Existing Hero/FAQ/Business editors retain their specialized contracts. Services/Works/Testimonials retain dedicated collection editors. Legacy page-section summaries are compatibility projections; complete component documents are canonical for detailed copy.
- Text remains Unicode; source IDs, array order, slug values, media URLs and authored display dates are retained. An absent email/logo/street address is not invented. Legacy external URLs are preserved; assets are not downloaded or rewritten.
- CTA descriptors preserve immutable callback/expression bindings. Booking remains a booking callback with an optional service hint. The API never invents a URL or executes a source expression. Template placeholders retain binding order. Frontend-owner adapters must bind these to existing components explicitly.
- Home composition includes the original six sections in their original order, editable enabled/order values constrained to the allowlist. CSS classes, animations, layout measurements, imports, routing code, state transitions and executable callbacks remain code. Every excluded literal has a reason; bindings remain recorded separately. Changing source CSS to contain generated copy/background media fails the generator until reviewed.
- Validation uses typed scalar/link/media/template/icon/boolean/number fields and structured groups. Fixed groups cannot lose fields; repeatable items clone complete source templates with stable IDs. Draft save does not publish; publication, archive, restore and history are explicit operations.
- `node --import tsx scripts/build-full-content-catalog.ts --check` compares the working public source against the immutable Git snapshot and rebuilds the mapping deterministically. Only CRLF/LF is normalized; no trimming or Unicode normalization occurs. A changed file/hash requires source review, never an expected-hash-only replacement. New snapshot versions require an explicit reviewed source ref; incompatible existing mappings are rejected for manual export/upgrade review.

## Verification boundary

Pure tests verify every mapped leaf and normalization → source-shaped projection, including Bangla, flags, localized date captions, media, IDs and nested order. Mocked UI/API tests verify editor behavior. Actual PostgreSQL persistence, migration, privileges, import concurrency, rollback and cross-device public rendering remain **unexecuted** pending owner approval on Secondary. Original public files are unchanged; their current fallback behavior must be integrated by Google AI Studio using [the API specification](issue-21-public-cms-contract.md).
