# SOP 09 — Creative Direction

> Substep 2 of Creative Direction: convert the style into concrete creative decisions.

## Purpose
Specify hero composition, color motifs, signature moves, and mascot — at a level of detail the site-builder can implement without re-deciding anything.

## Inputs
- `strategy/design-direction.md` (Style stance — already written by SOP 08)
- `brand/palette.json`, `brand/typography.json`
- `assets/raw/` and `assets/processed/`

## Steps

1. **Hero composition.** Add a `## Hero composition` section to `design-direction.md`:
   - Layout (full-bleed photo + overlay copy / split / mascot-centered / pattern + condensed headline)
   - Which photo from `assets/processed/` to use (filename + reason)
   - Overlay treatment (gradient direction, opacity)
   - Headline placement and color (which palette role)
   - Primary CTA placement, secondary CTA optional

2. **Color motifs.** `## Color motifs` section:
   - Where each palette role appears across the site. Be specific. E.g. "primary on CTAs and links only; ink as section bg for Home/Reviews/Gallery; surface_alt for About/Services; accent only on hover/decorative diagonal stripes."
   - Exact Tailwind class names the build will use for each role. This becomes the source of truth for `tailwind.config.js`.

3. **Signature moves.** `## Signature moves` section. 8-12 distinctive elements:
   - "Diagonal accent stripe under every H2"
   - "Marquee band of trust phrases between hero and reviews"
   - "Real Google reviews carousel pulled from evidence/reviews.json"
   - "Before/after slider on gallery items"
   - "Animated count-up on stats band"
   - etc.
   Each signature move names the section partial it lives in (`templates/sections/{name}/`). If a partial doesn't exist, mark NEW — the site-builder will create it.

4. **Mascot decision.** `## Mascot` section:
   - If `assets/raw/` has a mascot, use it. Note filename.
   - If not, decide: does this archetype need one? Hero / Everyman often yes. Premium / Commercial usually no.
   - If yes-and-missing: write an AI image generation prompt (style, subject, framing, color palette) for `skills/ai-image-generator`. Run the skill. Save the result to `assets/raw/mascot.png` and `assets/manifest.json`.
   - If no: write "No mascot for this brand." and explain why.

5. **Set `status: design-direction-complete`.**

## Outputs
- `strategy/design-direction.md` (complete: Style stance + Hero + Motifs + Signatures + Mascot)
- Optionally: `assets/raw/mascot.png` if generated

## Exit criteria
- 4 sections in design-direction.md complete (Hero, Motifs, Signatures, Mascot).
- 8-12 signature moves named, each pointing to a real or NEW section partial.
- Tailwind class plan in Motifs is concrete (class names, not "use the brand color").
