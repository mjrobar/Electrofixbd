# ElectroFix BD — Admin Interface Design System (Permanent Lock)

## Design Intent
A restrained, trustworthy business operations interface designed like a mature commercial SaaS admin product. No decorative gradients, glassmorphism, emoji headings, ornamental pills, or randomly colored cards. Optimize for readability and fast everyday maintenance by nontechnical operators.

## Locked Foundation
- **Typography:** Inter / Segoe UI / system sans for English and numerals, Noto Sans Bengali for Bengali; headings 600–700, body 400–500, numeric metrics tabular. Never use serif typeface in the admin shell.
- **Colors:** sidebar navy #11243A; background #F6F8FA; surfaces #FFFFFF; primary action #004179; primary hover #00325E; body text #17202A; muted #607080; borders #DCE3E8. Semantic success/warning/error colors only when communicating status.
- **Geometry:** standard control radius 6px; card radius 8px; no random radii or exaggerated round corners. Borders 1px, shadow low contrast.
- **Spacing:** 4px base, page 24/32px, cards 20/24px, controls min height 40px, touch controls min 44px on mobile.
- **Density:** compact but legible, clear labels and predictable alignment. Hide customer contact details behind authenticated session only.
- **Responsive:** 320px minimum design width, breakpoint at 1024px for sidebar vs mobile navigation, fixed mobile bottom bar with safe-area inset, no horizontal scroll for page, explicit table overflow if needed.
- **Layout:** single shared navigation shell across all modules. Do not change page fonts, colors or navigation by module.
- **Interaction:** visible focus rings, loading feedback, inline validation, confirmed saves, empty states, no fake success messages, archive confirmation, accessible control labels.
- **Content workflow:** preview, save, publish/unpublish, archive; never hard-delete records in use. Server response must confirm persistence before showing success.

## Coding Rules
- Scope admin styles under `.efb-admin` and define CSS variables in `src/admin/admin.css`. Preserve existing public frontend CSS.
- Use existing Tailwind and Lucide, no unnecessary UI framework additions or runtime dependencies.
- New admin modules must reuse Admin shell, ContentEditor patterns, and design tokens; do not implement unrelated colors, fonts, shapes, or effects.
- Make material redesign changes only through an explicit design-system revision and screenshots across desktop/mobile before merge.
- Public pages keep their separately owned design; only data integration changes under AI Studio compatibility review.

## Verification Gates
- Compare login, dashboard, bookings, messages, content editor and settings at 375px, 768px and 1440px.
- Lint, tests and build; check all save/error/refetch flows, no leaked credentials.
- Google AI Studio signs off shared frontend and public-facing changes before merge.
