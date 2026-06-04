# Action Design Studio — Marketing Site Design

**Date:** 2026-06-04
**Status:** Approved design → ready for implementation plan
**Domain:** actiondesignstudio.com (apex)

## Goal

Build Action Design Studio's own multi-page marketing website — the agency that
runs this website factory. Stone Systems (https://stonesystems.io/) is the
structural/design reference: a web-design + marketing-automation company selling
to contractors. This is the agency's own brand-new site, **not** a contractor
lead, so the 8-phase factory pipeline does not apply.

## Decisions (locked with the user)

| Decision | Choice |
|---|---|
| Brand name / wordmark | **Action Design Studio** |
| Core offering | **Full marketing-system stack** (Stone-Systems-style) |
| Page scope | **Full Stone-Systems-style** set |
| Testimonials | **Designed placeholder section** + commented live-widget drop-in slot |
| Contact form | **Formspree-ready** (placeholder endpoint, swappable) |
| Pricing | **3 placeholder tiers** with clearly-marked editable prices |

## Build approach

Fresh standalone static site, reusing the factory's visual system.

- Location: `clients/action-design-studio/site/`
- Tailwind via CDN with an inline `tailwind.config` block in each page `<head>`
  (same pattern as `clients/saskair/site/`).
- Fonts: Barlow Condensed (headings) + Barlow (body) via Google Fonts.
- Shared header/footer markup repeated per page (static site, no build step).
- Mobile-first, responsive, accessible (semantic landmarks, alt text, focus states,
  labelled form fields, keyboard-operable accordion/carousel).
- Vanilla JS only, inline or in a small `assets/site.js`, for: mobile nav toggle,
  FAQ accordion, testimonials carousel, current-year in footer.

**Rejected alternatives:** (a) forking an existing client site — contractor-structured,
fights the agency IA; (b) running the full factory pipeline — it crawls a contractor's
existing assets/reviews, mismatched for a new own-brand site.

## Brand system

### Wordmark
`ACTION` in large `font-heading`; `DESIGN STUDIO` as a gold, letter-spaced sub-line
(reuses the existing `brand_name_primary` / `brand_name_secondary` header pattern).
Logo SVG (user-provided) saved to `assets/logo.svg`; also rendered as the favicon.

### Palette (Tailwind tokens)
Silver + dark blue + gold splashes.

| Token | Hex | Role |
|---|---|---|
| `navy` | `#0A1A33` | dark hero/CTA bands, footer, dark sections |
| `blue` | `#16385F` | structural blue, secondary surfaces on dark |
| `blue-bright` | `#2C5C92` | hover/interactive blue, links on dark |
| `silver` | `#C9D0D8` | borders, muted text on dark, hairlines |
| `mist` | `#EEF1F5` | light alt-section background |
| `gold` | `#C9A23F` | CTAs, links, accents, icon highlights ("splashed in") |
| `gold-deep` | `#A8842F` | gold hover/pressed |
| `ink` | `#14181D` | body text, high-contrast headings on light |
| `white` | `#FFFFFF` | primary page background |

Helper classes (defined once, reused): `.btn-gold` (gold CTA), `.btn-ghost`
(outline CTA on dark), `.gold-text` (gold accent text), `.glass` (translucent
card on dark), `.card` (light surface card with silver border).

### Type scale
h1 3.25rem / h2 2.25rem / h3 1.5rem / body 1.0625rem / small 0.875rem / tiny 0.75rem
(mirrors the existing factory scale).

## Offering — six services

1. **Conversion Website** — fast, bespoke, mobile-first contractor sites that turn visits into booked jobs.
2. **5-Star Review Engine** — automated funnel that routes happy customers to public reviews.
3. **Missed-Call Text-Back** — auto-text every missed call so no lead goes cold.
4. **Local SEO** — rank in the local map pack for the trade + city.
5. **One-Click Campaigns** — send promos/seasonal offers to the customer list in one click.
6. **All-In-One Inbox** — calls, texts, emails, web chat, social DMs in a single inbox.

Each service: short value prop + 3 benefit bullets + outcome line + CTA.

## Information architecture

```
/                         index.html            Home
/services/                services/index.html   Services overview (6 cards)
/services/<slug>.html      6 detail pages        (conversion-website, review-engine,
                                                  missed-call-text-back, local-seo,
                                                  one-click-campaigns, all-in-one-inbox)
/pricing.html                                    3 tiers (placeholder prices)
/work.html                                       Our Work (placeholder portfolio grid)
/testimonials.html                               Full testimonials page + widget slot
/process.html                                    3-step process timeline
/about.html                                      Story / mission / promise
/blog/                    blog/index.html        Blog index ("coming soon" empty-state)
/faq.html                                        FAQ accordion
/contact.html                                    Formspree-ready form + email/phone
/privacy.html                                    Legal stub
/terms.html                                      Legal stub
```

Plus: `sitemap.xml`, `robots.txt`, `assets/` (logo, favicons, site.js).

### Global nav (header)
Services · Pricing · Our Work · Testimonials · Process · About
Right side: green-dot click-to-call `639-571-3298` + **Book a Call** gold CTA
(scrolls to/links to Contact). Mobile: hamburger → slide/expand menu.

### Footer (4 columns)
- **Brand** + blurb + social placeholders + © year (auto).
- **Company:** About, Process, Our Work, Blog, Contact.
- **Services:** the six services.
- **Get started:** Pricing, Book a Call, email, phone.
- Legal row: Privacy · Terms.

## Page-by-page section structure

### Home
1. Hero — navy band, headline + sub + dual CTA (Book a Call / See Services), 5★
   review badges (Google / Facebook / Trustpilot, marked placeholder), trust line.
2. Social-proof strip — logos/trades marquee (placeholder logos).
3. Services — 6-card grid, each linking to its detail page.
4. Trades-served marquee — scrolling list (Roofing, HVAC, Plumbing, Landscaping, …).
5. Process — 3 steps (Demo call → We build → You launch).
6. Why us — 4–6 differentiators (evidence-backed, no contracts, fast turnaround, real assets).
7. Testimonials — carousel (placeholder cards + live-widget drop-in slot).
8. FAQ teaser — 3–4 Qs → link to full FAQ.
9. Final CTA — navy band, Book a Call.

### Service detail (×6)
Hero (service name + promise) → what it is → 3 benefit bullets → how it works
(mini 3-step) → related services → CTA.

### Pricing
Intro → 3 tier cards (Starter / Growth / Pro) with **placeholder $** and feature
lists, middle tier flagged "Most Popular" → "custom / not sure? Book a Call" → FAQ teaser → CTA.

### Our Work
Intro → responsive portfolio grid of placeholder project cards (screenshot slot,
client name, trade, result stat) clearly marked as placeholders → CTA.

### Testimonials
Intro → grid/carousel of placeholder testimonial cards (avatar, name, trade, quote,
5★) → prominent commented `<!-- LIVE REVIEW WIDGET DROP-IN -->` slot → CTA.

### Process
3-step timeline with detail per step → "what you get" → CTA.

### About
Story → mission → the evidence-backed promise (real reviews, real photos, documented
build) → founder bio placeholder → CTA.

### Blog
Styled "coming soon" empty-state + hidden/commented post-card template for later → CTA.

### FAQ
Accordion (keyboard-accessible) of 8–10 Qs (results timing, pricing, contracts,
trades served, what's included, ownership). → CTA.

### Contact
Heading → Formspree-ready form (name, business, email, phone, message; labelled,
required where appropriate; `action="https://formspree.io/f/REPLACE_ME"` placeholder)
→ direct email `michael@actiondesignstudio.com` + phone `639-571-3298` (click-to-call)
→ Book-a-Call CTA.

### Privacy / Terms
Standard readable stubs with editable placeholders (company name, contact email,
effective date).

## Placeholders & later inputs (non-blocking)

Everything the user hasn't supplied is rendered as a clearly-marked, editable
placeholder so the site looks complete and intentional now:
- Real prices, project screenshots/results, real testimonials & star counts,
  social links, founder bio/photo, Formspree endpoint, live review-widget embed.
- Each placeholder is consistent (e.g., a small muted "placeholder" note pattern or
  obvious sample content) and documented in a top-level `README.md` inside the site
  folder listing exactly what to swap and where.

## Accessibility & quality bar

- Semantic `<header><nav><main><section><footer>`, one `<h1>` per page, logical heading order.
- All images have alt text; decorative images `alt=""`.
- Color contrast: gold-on-navy and ink-on-white meet WCAG AA for text sizes used.
- Form fields labelled; accordion and carousel keyboard-operable; visible focus states.
- Per-page `<title>` + meta description; Open Graph tags; favicon.
- `robots.txt` + `sitemap.xml`.

## Out of scope (YAGNI)

- No CMS / build step / framework. Static HTML + CDN Tailwind + tiny vanilla JS.
- No real blog posts (structure only).
- No live backend; contact uses Formspree.
- No deployment in this work (separate step; apex domain config handled later).
