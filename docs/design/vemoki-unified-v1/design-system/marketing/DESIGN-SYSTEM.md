# Vemoki — Neon Event Experience

**Status:** Approved visual direction / design handoff v1.0 (2026-10-24)
**Scope:** `vemoki.com` **B2B marketing website** only.
**Related repository:** `hangndat/ticket-solution` (`apps/web/app/marketing`, `src/marketing`).
**Visual intent:** The original creative Option 2 converted to dark mode: expressive human-centered hero, glossy 3D/neon ribbons and orbs, festival/conference photography, clean product mockups, and exceptionally concise copy.

> This is a concept and implementation reference, not a representation of production UI or verified customer evidence. Media and product screenshots in this handoff are AI-generated illustrative assets. Replace them with approved original artwork and real product captures before publication.

## 1. Product positioning & communication

**Buyer:** event organizers, regardless of team size: workshops/meetups, conferences/summits, concerts/festivals, and corporate events.

**Hero headline:** "Biến mọi sự kiện thành trải nghiệm đáng nhớ."
**One-sentence value proposition:** "Mời khách, phát vé, check-in và theo dõi vận hành — tất cả trong một nền tảng."
**Primary CTA:** "Xem demo" — link to the actual demo experience, with honest demo labeling.
**Secondary CTA:** "Đăng ký tư vấn" — connect to the real lead form in `apps/web` at implementation time.
**Footer CTA:** "Sự kiện tiếp theo. Trải nghiệm khác biệt."

**No social proof until verified.** Do not publish fictional organizer logos, testimonials, client names, attendee totals, conversion rates, performance guarantees, or claims of deployments to 50,000+ attendees. Case studies are gated on customer approval.

**MVP truth:** Vemoki presently focuses on invitation codes, free ticket issuance, QR check-in, event operations, audit, and reporting. Do not suggest that public paid ticket checkout, seat maps, refunds, or native Android are available in the MVP. Offline multi-device gate is subject to release/correctness evidence. Check latest repository PRD before shipping copy.

## 2. Visual principles

1. **Emotion first:** a real-feeling event atmosphere and an expressive central human subject.
2. **Product proof second:** a genuine dashboard / ticket / scanner view (concept labels for prototypes).
3. **Big type, sparse text:** one headline + one supportive sentence per major section; avoid paragraph-heavy feature inventories.
4. **Controlled spectacle:** gradients and decorative 3D shapes concentrate around the hero, product collage, and final CTA; content cards and body typography stay calm.
5. **Accessibility over visual effects:** body copy must remain legible when gradients are removed; no information conveyed only by color.

## 3. Brand & tokens

The authoritative existing product brand is `brand/vemoki/tokens.json`, **Live Pulse v2**. It currently defines the shared light product tokens (`ink #0B1220`, `paper #F4F6F8`, `signal #E11D48`) and Sora / Be Vietnam Pro font families.

**Do not replace or mutate those global tokens.** This marketing concept introduces scoped `--vm-*` variables in `tokens.css`, on `html[data-vemoki-marketing='neon-v1']`. Brand mark assets must be sourced from `brand/vemoki/mark.svg`; the V glyph in `index.html` is a placeholder, not an approved logo replacement.

### Color tokens

| Purpose | Token | Value |
| --- | --- | --- |
| Site background | `--vm-bg` | `#060817` |
| Deep background | `--vm-bg-deep` | `#040611` |
| Card surface | `--vm-surface` | `#0E1229` |
| Raised surface | `--vm-surface-raised` | `#151935` |
| Primary text | `--vm-text` | `#FAF9FF` |
| Secondary text | `--vm-text-secondary` | `#C2C6DE` |
| Subtle text | `--vm-text-subtle` | `#989DBD` |
| Outline | `--vm-outline` | `#38345F` |
| Violet | `--vm-purple` | `#9B4DFF` |
| Magenta | `--vm-magenta` | `#F23CB3` |
| Coral | `--vm-coral` | `#FF835F` |
| Electric blue | `--vm-blue` | `#397DFF` |
| Cyan | `--vm-cyan` | `#28D4EF` |
| Positive state | `--vm-success` | `#39E3AA` |
| Keyboard focus | `--vm-focus` | `#B2CBFF` |

**Gradients**
- Primary action: `linear-gradient(105deg, #EE35B4 0%, #9944FF 48%, #3383FF 100%)`.
- Emphasis headline: `linear-gradient(100deg, #FF68AA 2%, #FF8F6E 31%, #C870FF 63%, #777CFF 100%)`.
- Decorative glows can use translucent accent colors, but text and focus indicators must have their own contrast-safe solid fallbacks.

### Typography

Use self-hosted fonts already available in `apps/web/fonts` via `next/font/local`; do not add third-party font dependencies.

| Role | Family | Desktop | Mobile | Weight |
| --- | --- | --- | --- | --- |
| H1 hero | Sora | 64–72 / 1.12 | 34–40 / 1.15 | 800 |
| H2 section | Sora | 42–52 / 1.18 | 30–32 / 1.18 | 800 |
| H3 card | Be Vietnam Pro | 18 / 1.3 | 12–14 / 1.3 | 700–750 |
| Body | Be Vietnam Pro | 16 / 1.65 | 13–14 / 1.65 | 400 |
| Button | Be Vietnam Pro | 14 / 1.2 | 13 / 1.2 | 700–750 |
| Eyebrow | Sora | 11 / 1.2 | 10 / 1.2 | 700 |

For Vietnamese, do not force `uppercase` on whole paragraphs. Use letterspacing only for short English eyebrow labels. Preserve sufficient diacritic clearance and avoid clipped text.

### Spacing, radius & shadow

- Base spacing step: 4px. Common values: 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80px.
- Content max-width: **1220px**, mobile side gutters: **18px**, desktop gutters: **20px+**.
- Radii: **10px** small, **16px** cards, **22px** product, **28px** hero CTA, **999px** pill.
- Interactive minimum hit target: **44×44px**.
- Section padding: desktop **78px**, mobile **48px**.
- Shadows: card `0 14px 48px rgba(0,0,0,.34)`, primary CTA glow in `tokens.css`.

## 4. Components & interaction states

| Component | Visual contract | Required behavior |
| --- | --- | --- |
| `MarketingHeader` | Brand + desktop links; brand + 44px menu on mobile | Menu button toggles `aria-expanded`, `aria-controls`; Escape closes menu in production |
| `GradientButton` | Gradient primary and outlined secondary, 48px default height | Keyboard focus visible, hover/pressed/disabled/loading states; button semantics for actions, link semantics for navigation |
| `HeroSection` | Two-column desktop; copy → actions → immersive illustration on mobile | Headline never covered by art, CTA above first scroll on common phones if feasible |
| `EventTypeCard` | 4 across desktop, 2-column mobile; real event photography | Only render arrow/link affordance if a destination exists; descriptive alt text |
| `ProductShowcase` | Feature labels + approved dashboard / QR / gate imagery | Explicitly label mockups as illustrative until sourced from deployed product |
| `FinalCTA` | Wide deep-violet gradient with subtle orbital decoration | One main action and one secondary action; real consultation destination |
| `MobileMenu` | Opaque panel and distinct touch targets | Escape dismissal, click outside, focus handling, no inaccessible off-screen links |

**State tokens:** hover = slight surface lift/lightness, pressed = return to baseline scale, focus-visible = 3px solid `--vm-focus` with 4px offset, disabled = lower contrast + disabled semantics (not just opacity), loading = progress label with `aria-busy`.

## 5. Responsive rules

| Viewport | Layout |
| --- | --- |
| 320–359px | 18px gutters, 32px H1, CTA wraps/stack, 2 event columns where text still fits |
| 360–639px | 18px gutters, 34–40px H1, mobile menu, image below hero copy, 2 event columns |
| 640–899px | intermediate tablet adjustments; verify card text and art/heading overlap |
| 900–1279px | desktop/tablet hybrid, reduced H1 scale |
| 1280px+ | 2-column hero & product, 4 event columns, 1220px content max |

**Mobile page order:** Brand/menu → eyebrow → headline → value sentence → CTA pair → 3 short benefits → hero art → event categories → core capabilities → demo mockup → final CTA → footer.

Do not stack 4 dense icon cards inside the mobile hero or use infinite carousels. Preserve a single clear primary CTA and meaningful breathing room. Ensure no horizontal overflow at 320/360/390/430px.

## 6. Motion & accessibility

- Decorative layer entrance: up to 400–600ms, easing `cubic-bezier(.2,.8,.2,1)`; staggered text 60–100ms where approved.
- Microinteraction: 150–220ms for button hover/focus/press.
- Scroll effects must not be required for reading; avoid performance-heavy constant parallax on mobile.
- Honor `prefers-reduced-motion: reduce` by disabling non-essential animations/transitions.
- Body text and controls: WCAG AA contrast review against actual composited backgrounds; gradient text is for display titles, not paragraphs or controls.
- Semantic `h1 → h2 → h3`; menu accessible by keyboard; touch target min 44px; meaningful alternative text for informative photos.
- Mobile QA: screen readers + zoom 200%, no text clipping with Vietnamese diacritics.

## 7. Implementation boundary in ticket-solution

- Target B2B landing page: `apps/web/app/marketing/page.tsx` renders `src/marketing/sales-page`.
- Put theme under a **marketing-only root attribute or wrapper**, e.g. `data-vemoki-marketing="neon-v1"`. Beware `html[data-surface]` and shared `ThemeProvider`: do not change consumer product or portal globally.
- Preserve `brand/vemoki/tokens.json` and `@ticket/ui` existing design tokens. Map the new styles as local marketing CSS variables; if creating a theme module, keep it inside marketing scope.
- Reuse Sora and Be Vietnam Pro self-hosted fonts from `apps/web/app/layout.tsx`.
- Respect existing language toggle, sign-in links, lead submission behavior, demo routes, SEO, CSP, consent / privacy flows. The downloadable HTML preview is *not* a production integration patch.
- Use product-owned screenshots after approval; don't show AI-generated fake analytics totals as genuine data.

## 8. Definition of done for implementation

- [ ] Desktop and mobile match the agreed creative direction while remaining legible.
- [ ] No fabricated customers, reviews, logos or usage claims.
- [ ] All CTAs use verified existing navigation / lead forms.
- [ ] Product copy does not imply paid ticket checkout, Android native or unverified scale guarantees.
- [ ] Keyboard nav, reduced motion, focus styles, alt text and semantic headings verified.
- [ ] Responsive screenshots checked at 320, 360, 390, 430, 768, 1024, and 1440px.
- [ ] No horizontal overflow or mobile layout shifts on image loading.
- [ ] Existing marketing auth/CTA/SEO integration tests remain green.
- [ ] Existing attendee web and portal layouts unchanged.
- [ ] Preview reviewed, relevant tests pass, PR reviewed, evidence recorded and meaningful commit created.

**Suggested commit:** `feat(marketing): introduce Vemoki neon event experience design`

## 9. Files in this handoff

- `index.html`, `styles.css`, `tokens.css`: self-contained responsive static concept.
- `assets/`: illustrative design artwork (not production assets).
- `mobile.png`: validated 390px full-page screenshot.
- `mobile-small.png`: 320px layout screenshot.
- `desktop.png`: 1440px full-page counterpart.

Note: external consultation/email paths in the concept are **illustrative navigation** and must be rewired to existing, verified lead flows. This project does not claim a Figma file, merged PR, or deployment.
