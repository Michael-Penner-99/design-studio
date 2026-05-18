# SOP 07 — SEO + Content

## Purpose
Local-SEO keyword research + every line of copy the site will display. Voice matches `brand/voice.md` exactly. Every claim traces to evidence.

## Inputs
- `clients/{slug}/brief.md`
- `clients/{slug}/brand/voice.md`
- `clients/{slug}/strategy/sitemap.md`
- `clients/{slug}/strategy/wireframes.md` (token plan at bottom)
- `clients/{slug}/evidence/reviews.json`
- `clients/{slug}/research/competitors.md`

## Steps

1. **Keyword research.** Use the `seo-keyword-tool` skill. For each page in the sitemap:
   - Primary keyword (highest local volume × intent match).
   - 2-3 secondary keywords (related, same intent).
   - Local modifiers (city, neighborhoods, "near me").
   - Intent class: informational / navigational / transactional / commercial.
   Write to `strategy/keywords.md` as a table per page.

2. **Title + meta** for each page. Title ≤ 60 chars. Meta description ≤ 155 chars. Use primary keyword + city. Voice-checked.

3. **Section copy.** For each token in the wireframe's token plan:
   - Look up the section's purpose + source-of-content from `wireframes.md`.
   - Draft the copy:
     - Headlines: short, declarative, voice-matched. Hero-style metallic headlines tend all-caps and 4-6 words.
     - Body: 2-3 sentence paragraphs. Sentence-fragment bullets are fine.
     - CTAs: action verbs. "Get a free roof inspection." not "Click here." not "Learn more."
   - Every numeric claim ("100+ homeowners served") must point to a number in brief.md or evidence/. Annotate the source in a comment in copy.md:
     ```
     {{hero_subline}}: "Trusted by 247 Kansas City homeowners since 2008."
     # source: brief.md review_summary.google_count + business_founded year
     ```

4. **FAQ.** Generate 8-12 Q&A pairs informed by:
   - Common search-query stems (`how much does {service} cost`, `do you offer {service} financing`, `how long does {service} take`).
   - Frequent themes in reviews.
   - Gaps competitors don't address (from research).

5. **Service-detail copy.** For each `/services/{slug}` page: extended hero, what-this-service-is, who-it's-for, our-process (3-5 steps), pricing-or-financing pointer, related-projects (link to gallery photos), CTA.

6. **Write `strategy/copy.md`** as a flat token dictionary:
   ```
   {{hero_headline}}: "..."
   {{hero_subline}}: "..."
   {{about_h2}}: "..."
   ...
   ```
   Comments preceded by `#` are allowed for source annotations.

7. **Set `status: copy-complete`.**

## Outputs
- `strategy/keywords.md`
- `strategy/copy.md`

## Exit criteria
- Every token in the wireframe token plan has a value in copy.md.
- Every numeric claim has a source annotation.
- copy.md voice-spotcheck against voice.md (compare 5 random headlines).
