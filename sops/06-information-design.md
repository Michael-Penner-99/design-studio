# SOP 06 — Information Design

> Substep that completes the pre-copy work. For every page in the sitemap, define the ordered list of sections.

## Purpose
Specify per-page section order before copy is written. The seo-strategist then writes copy *into* the wireframe rather than designing as they go.

## Inputs
- `clients/{slug}/strategy/sitemap.md`
- `clients/{slug}/brand/brand-dna.md` (archetype drives section order)
- `templates/sections/` (the section vocabulary available)

## Steps

1. **Map archetype → section sequence template.**
   - **Hero / Premium** → hero (full-bleed, photo + condensed metallic headline), marquee band, reviews (dense, real photos), about (owner intro), services grid, gallery, offers band, blog teaser, faq, areas-served, cta-contact, footer.
   - **Caretaker / Family** → hero (warm photo + serif headline + owner photo small), trust strip (badges), about (owner-led story, photo-prominent), reviews, services list, before/after gallery, financing band, faq, areas, cta-contact, footer.
   - **Everyman / Local Pro** → hero (action shot, condensed headline), services-first grid, reviews, gallery, areas-served map, faq, cta, footer.
   - **Commercial / Industrial** → hero (project photo, no-frills headline), services (with case-study-grade detail), gallery (organized by sector), client logos band, certifications, contact form, footer.

2. **For each page in the sitemap**, write its section sequence to `strategy/wireframes.md`. Per section, specify:
   - Section name (must exist in `templates/sections/` or be justified as new)
   - Purpose
   - Expected length / dimensions
   - **Source of content** — which `evidence/` file or `assets/raw/` photo or `research/` finding feeds it

3. **Cross-page consistency.** Header and footer are identical on every page. Section variants (e.g. abbreviated hero on About, full hero on Home) are explicitly noted.

4. **Token plan.** At the bottom of `wireframes.md`, list every `{{token}}` the build will need to resolve. Group by page. This is the seo-strategist's checklist for `copy.md`.

5. **Set `status: wireframes-complete`.**

## Outputs
- `strategy/wireframes.md`

## Exit criteria
- Every page in the sitemap has a wireframe.
- Every section references a partial in `templates/sections/` or has a "NEW" tag with justification.
- Token list at the bottom is complete and matches what the build will need.
