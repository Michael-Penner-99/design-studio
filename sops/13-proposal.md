# SOP 13 — Proposal (PDF + Sales Walkthrough HTML)

## Purpose

Generate the two sales artifacts Action Studio sends after a build:

1. **`proposal/proposal.pdf`** — the formal proposal PDF the lead opens once and forwards to whoever signs.
2. **`sales/index.html`** — the new interactive walkthrough page deployed at `{slug}-sales.actiondesignstudio.com` (Phase 8). The page the lead actually scrolls through.

Both artifacts share the same source data — brief, research, evidence, deploy URL — so they tell the same story in two different formats.

## Inputs

- `clients/{slug}/brief.md`
- `clients/{slug}/research/competitors.md`
- `clients/{slug}/research/site-scorecard.md` (the contractor's existing site score, 0-120)
- `clients/{slug}/brand/` (palette, voice)
- `clients/{slug}/evidence/reviews.json`
- `clients/{slug}/strategy/keywords.md` (primary keyword)
- `clients/{slug}/qa/report.md` (final new-site score)
- `clients/{slug}/deploy/preview-url.txt` (Phase 8 runs before Phase 7)
- `clients/{slug}/assets/processed/logo.{png,svg}`
- `templates/proposal/` (PDF source)
- `templates/walkthrough/walkthrough.html.template` (walkthrough source)

## Steps

### Part A — Build the walkthrough HTML

1. **Scaffold the sales folder.** Ensure `clients/{slug}/sales/` and `clients/{slug}/sales/assets/` exist. If the client was scaffolded by `new-client-from-name.sh`, `sales/` is already there.

2. **Copy assets.** Copy `clients/{slug}/assets/processed/logo.{ext}` into `clients/{slug}/sales/assets/logo.{ext}`. The walkthrough refers to it as `assets/logo.{ext}` (relative path inside the sales project).

3. **Resolve the walkthrough template.** Read `templates/walkthrough/walkthrough.html.template`. Apply the token resolver in this order:

   1. **Conditionals first** — walk every `{{#if_<condition>}}...{{/if_<condition>}}` block. Evaluate the condition (see condition table below). If false, strip the block (open tag through close tag inclusive). If true, keep the inner content for further resolution.
   2. **Tokens** — replace every `{{token}}` with the resolved value (see token table below).
   3. **Asset paths** — replace `{{asset:logo}}` etc. with the relative path inside `sales/assets/`.

   Write the result to `clients/{slug}/sales/index.html`.

4. **Walkthrough token resolution table**:

   | Token | Source |
   |---|---|
   | `{{contractor_brand_name}}` | `brief.md` → `brand_name` |
   | `{{contractor_logo_path}}` | `assets/logo.{ext}` (relative path) |
   | `{{prepared_date}}` | run timestamp formatted "Month D, YYYY" |
   | `{{opportunity_summary}}` | 2-3 sentence synthesis from `research/competitors.md` — pull the gap summary, not the per-competitor teardowns |
   | `{{primary_keyword}}` | `strategy/keywords.md` → first primary keyword |
   | `{{review_count}}` | `evidence/reviews.json` → `count` |
   | `{{review_rating}}` | `evidence/reviews.json` → `rating` |
   | `{{photo_count}}` | count of `project-*` files in `assets/processed/` |
   | `{{old_site_score}}` | `research/site-scorecard.md` → `total_score`. In name-and-reviews mode (no existing site), use `0`. |
   | `{{new_site_score}}` | `qa/report.md` → final score |
   | `{{site_preview_url}}` | `deploy/preview-url.txt` |
   | `{{calendar_url}}` | `$CALENDAR_URL` env var, default `mailto:hello@actiondesignstudio.com` |
   | `{{standard_tier_price}}` | run option `standard_tier_price`, default `$5,000` |
   | `{{pro_tier_price}}` | run option `pro_tier_price`, default `$15,000` |

5. **Conditionals supported** (v1):

   | Condition | True when |
   |---|---|
   | `if_mode_url` | `brief.md` frontmatter `_meta.mode == "url"` (or missing, which defaults to url) |
   | `if_mode_name_and_reviews` | `brief.md` frontmatter `_meta.mode == "name-and-reviews"` |
   | `if_standard_tier` | run was triggered with `tier == "standard"` (default) |
   | `if_pro_tier` | run was triggered with `tier == "pro"` |

   Resolver rules:
   - Conditionals are evaluated **before** token substitution (a token might land inside a stripped block).
   - Conditionals do not nest in v1. The resolver looks for matched `{{#if_X}}` / `{{/if_X}}` pairs on the same nesting level.
   - Unknown conditions raise a build error (don't silently treat them as false — that masks template typos).

6. **Halt if any token is unresolved.** After resolution, scan the output for any remaining `{{` substring. If found, halt with `walkthrough-unresolved-token-{token-name}`.

### Part B — Build the proposal PDF

7. **Cover.** Compose `proposal/cover.png` from `templates/proposal/cover.html.template`. Inject contractor name, logo, primary palette, and Action Studio mark. Render to PNG via the pdf/headless-browser skill.

8. **Pages.** The PDF mirrors the walkthrough HTML structure but is paginated and printable:
   - **Cover** (1 page)
   - **The Opportunity** — synthesis of `research/competitors.md` gaps, framed as the dollar value the contractor is leaving on the table. Same `opportunity_summary` block as the walkthrough.
   - **What We Built** — 2 pages: a laptop mockup with the live URL screenshotted at hero scroll position, and a phone mockup at the contact form. Both embed `deploy/preview-url.txt`.
   - **The Winning Formula** — three-lever section, same copy as the walkthrough.
   - **Real Proof** — 1 page summarizing review evidence (rating, count, sample quotes). Each quote cites source platform. In name-and-reviews mode, also include a small note: "Photos shown are AI-generated placeholders pending real-photo handoff."
   - **Why It Converts** — 1 page on sales psychology: scarcity, social proof, mobile-first, owner-led.
   - **The Investment** — 1 page with the same tier pricing as the walkthrough.
   - **Side-by-side scorecard** — 1 page with the old vs new score (same `{{old_site_score}}` / `{{new_site_score}}` values).
   - **Next Step** — 1 page with the walkthrough URL prominent: "View the full interactive walkthrough at `{slug}-sales.actiondesignstudio.com`" plus the schedule-the-cutover-call CTA. The PDF is the bait; the walkthrough page is where they actually convert.

9. **Output** to `clients/{slug}/proposal/proposal.pdf`. Use the pdf skill.

### Part C — Verify and finalize

10. **Verify the walkthrough HTML is well-formed.** Parse it; ensure no unclosed tags, no remaining `{{` tokens. The output must be valid HTML that a Vercel static deploy will serve.

11. **Verify the PDF.** Exists, > 0 bytes, opens.

12. **Voice.** Action Studio voice — direct, confident, evidence-anchored. No "we are delighted to..." preambles.

13. **Set `status: proposal-ready`** in `brief.md`.

## Outputs

- `clients/{slug}/proposal/proposal.pdf`
- `clients/{slug}/proposal/cover.png`
- `clients/{slug}/sales/index.html`
- `clients/{slug}/sales/assets/logo.{png,svg}`

## Exit criteria

- PDF exists, > 0 bytes, opens, embeds the live preview URL.
- `sales/index.html` exists, contains no unresolved `{{` tokens, parses as valid HTML.
- `sales/assets/logo.{ext}` exists and is referenced by `sales/index.html`.
- Every numeric claim in both artifacts traces to a source file in the client folder.
- The walkthrough's `{{site_preview_url}}` matches the contents of `deploy/preview-url.txt`.

## Halt

- Any walkthrough token unresolved at write time → halt with `walkthrough-unresolved-token-{name}`.
- Any unknown conditional in the walkthrough template → halt with `walkthrough-unknown-conditional-{name}`.
- PDF generation fails → halt with `proposal-pdf-render-failed`, surface the renderer error.
- `deploy/preview-url.txt` missing or HEAD non-200 → halt with `proposal-needs-live-preview-url`. (Phase 8 runs before Phase 7 specifically to prevent this.)
