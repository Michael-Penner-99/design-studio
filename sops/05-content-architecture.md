# SOP 05 — Content Architecture

> Substep that fills the gap between Brand Audit and SEO+Content. Defines *what pages* the site has and *what each page's job is* before any copy is written.

## Purpose
Produce the sitemap — every page that will be built — and the role each page plays in the conversion funnel.

## Inputs
- `clients/{slug}/brief.md`
- `clients/{slug}/research/competitors.md` (for gaps)
- `clients/{slug}/brand/brand-dna.md` (for archetype-driven page logic)
- `recipes/contractor-{sub_trade}.yml` (for default sitemap)

## Steps

1. **Start from the recipe.** Read `recipes/contractor-{sub_trade}.yml`. The recipe gives a default sitemap with rationale for each page.
2. **Add gap pages.** For each gap from `competitors.md` that warrants a dedicated page (financing, before/after gallery, areas-served grid, FAQ hub) — add it. Don't add it if the gap is better solved by a section on an existing page.
3. **Expand services.** For each service in `brief.md.services[]`, declare a Services-detail page at `/services/{service-slug}`. Slug rule: kebab-case from the canonical service name.
4. **Geography pages (optional, depends on recipe).** If the recipe enables them and `brief.md.geography.service_areas[]` has > 3 cities, declare a service-area page per major city at `/areas/{city-slug}`. Defer to recipe.
5. **Write the sitemap** to `strategy/sitemap.md`:

   ```
   # Sitemap

   | Path | Page name | Purpose (one line) | Primary funnel role |
   |---|---|---|---|
   | / | Home | Establish trust, prove credibility, route to next action | TOFU + funnel router |
   | /about | About | Owner-led trust building | MOFU trust |
   | /services | Services index | Hub for all services | MOFU navigation |
   | /services/roof-replacement | Roof replacement | Convert the high-intent visitor | BOFU |
   | /services/roof-repair | Roof repair | Convert the urgent visitor | BOFU urgent |
   | /reviews | Reviews | Density of social proof for the skeptic | MOFU proof |
   | /contact | Contact | Final conversion step | BOFU |
   ```

6. **Set `status: sitemap-complete`.**

## Outputs
- `strategy/sitemap.md`

## Exit criteria
- At minimum: Home, About, Services index, ≥ 1 Services detail page, Reviews, Contact.
- Every page has a one-line purpose.
- Every page has a funnel-role tag (TOFU, MOFU, BOFU, or "router").
