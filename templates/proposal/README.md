# Proposal templates

Templates consumed by `proposal-writer` (SOP 13).

## Files in this folder (target)

- `cover.html.template` — branded cover page rendered to PNG.
- `proposal.html.template` — full proposal body (gets rendered to PDF via the pdf skill).
- `laptop-mockup.html.template` — laptop frame, contractor's live preview URL goes inside.
- `phone-mockup.html.template` — phone frame, same.
- `pricing.md.template` — standard + pro tier pricing block in Action Studio voice.

## Tokens

Same convention as the page templates:
- `{{contractor_brand_name}}`, `{{contractor_owner_name}}`, `{{contractor_logo_path}}`
- `{{preview_url}}` — from `clients/{slug}/deploy/preview-url.txt`
- `{{review_summary}}` — formatted from `evidence/reviews.json`
- `{{competitor_gap_summary}}` — from `research/competitors.md`
- `{{action_studio_logo}}` — fixed brand asset
- `{{prepared_for_date}}` — today's date in long format

## Status (v1)

These templates are stubs in v1 — the proposal-writer agent generates the PDF programmatically in v1 using the docx/pdf skill plus inline templating. As we produce a few real proposals, extract the winning structure into formal `*.template` files in this folder.
