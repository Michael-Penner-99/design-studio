# SOP 04 — Brand Audit

## Purpose
Convert real assets + real voice into a design profile so every element on the new site matches who the contractor actually is — not a designer's guess.

## Inputs
- `clients/{slug}/brief.md` (status: assets-complete)
- `assets/raw/` (logo + photos)
- The contractor's site text (re-fetch if needed)

## Steps

1. **Palette extraction.** Run `skills/color-extractor` on:
   - `assets/raw/logo.{ext}` — weight 3x
   - 5 representative project photos — weight 1x each
   - Owner photo if present — weight 0.5x
   The skill returns up to 12 dominant colors with frequency. Cluster near-identical (ΔE < 8) into one. Pick:
   - **primary** — most dominant non-neutral color from logo.
   - **secondary** — second logo color, or darker shade of primary if logo is single-color.
   - **accent** — call-to-action color. Default: warm gold (#C6A75E) if no clear accent in logo. Override if the logo gives one.
   - **ink** — deepest dark from photos / logo background.
   - **surface** / **surface_alt** — two related darks for section alternation.
   Write to `brand/palette.json` per the schema in the agent prompt.

2. **Typography decision.** Match brand archetype (from brand-dna.md, written next) to font family:
   - **Hero / Premium** (Capstone-like) — Display: Anton or Bebas Neue. Body: Montserrat.
   - **Caretaker / Family** — Display: Playfair Display or Fraunces. Body: Inter or Source Sans.
   - **Everyman / Local Pro** — Display: Oswald or Barlow Condensed. Body: Inter.
   - **Commercial / Industrial** — Display: Industry or Roboto Condensed. Body: Roboto.
   Output to `brand/typography.json` with weights and a 6-step scale.

3. **Brand DNA narrative.** 1-2 pages to `brand/brand-dna.md`:
   - Who they are in one sentence.
   - Archetype (one of: Hero, Caretaker, Everyman, Outlaw, Sage, Innocent, Lover, Jester, Magician, Ruler, Creator, Explorer). Justify in two sentences using evidence from the brief and review snippets.
   - Differentiator (the one thing competitors don't have).
   - Proof points (cert, years in business, review count, geography).
   - Contradictions / tensions (e.g. "they describe themselves as family-owned but use corporate stock imagery — we lean into family-owned").

4. **Voice document.** `brand/voice.md`:
   - Tone in three adjectives.
   - Vocabulary they use (sample 10 phrases from their site / Google reply text).
   - Vocabulary to avoid (corporate clichés that contradict the archetype).
   - 5 sample headlines in their voice.
   - Do/Don't list.

5. **Set `status: brand-complete`.**

## Outputs
- `brand/palette.json`
- `brand/typography.json`
- `brand/brand-dna.md`
- `brand/voice.md`

## Exit criteria
- palette.json has all required roles populated.
- typography.json has heading + body families with weights.
- brand-dna.md identifies an archetype.
- voice.md has 5 sample headlines.
