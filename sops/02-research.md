# SOP 02 — Research

## Purpose
Map the contractor's local market, score their existing site on 12 axes, and produce competitor teardowns that surface gaps the new site will exploit.

## Inputs
- `clients/{slug}/brief.md` — fully populated by SOP 01.

## Steps

1. **Map the local market.** WebSearch the trade + primary city. Population (city + metro), median home value (residential) or business density (commercial), seasonal demand peaks. Write to `research/market.md`.
2. **Score the contractor's existing site** on these 12 axes (0-10 each):
   - Hero clarity (Do you know what they do in 3 seconds?)
   - Value proposition (Why them vs. anyone else?)
   - Social proof density (Reviews, badges, photos above-the-fold)
   - Services clarity (Can a visitor find their service?)
   - Geography clarity (Do they serve me?)
   - Trust signals (Insurance, license, certifications, BBB)
   - Photography quality (Real vs. stock, varied vs. monotone)
   - Brand consistency (Same identity across pages)
   - Copy quality (No typos, no generic filler, scannable)
   - CTAs (Visible, repeated, action-verb)
   - Mobile (Layout, tap targets, load)
   - Page speed (Lighthouse estimate is fine)
   Write each score with a one-line rationale to `research/site-scorecard.md`. Sum the score for a single number "X/120".
3. **For each competitor in `brief.md.competitors[]`** (3-5 URLs):
   - WebFetch their homepage.
   - Score them on the same 12 axes (don't need to write the scores out per axis; write a one-line summary instead).
   - Identify their top ranking keyword + their primary differentiator.
   - Identify the *thing they're missing* that the new Action Studio site will use.
   Write each as a section in `research/competitors.md`.
4. **Synthesize gaps.** At the bottom of `competitors.md`, write a "Gaps to exploit" list. 3-5 items. These are the **strategic openings**: "No competitor has a financing calculator." "No competitor shows real owner photo + bio." "All competitors look corporate; the market is residential, families want a neighbor."
5. **Append** the gaps list to `brief.md.gaps[]` (merge with anything already there; dedupe).
6. **Set `status: research-complete`.**

## Outputs
- `clients/{slug}/research/market.md`
- `clients/{slug}/research/site-scorecard.md`
- `clients/{slug}/research/competitors.md`
- `brief.md.gaps[]` augmented.

## Exit criteria
- Site scorecard total is calculated.
- 3-5 competitor teardowns present, each ≥ 200 words.
- Gaps section in competitors.md has ≥ 3 items.
