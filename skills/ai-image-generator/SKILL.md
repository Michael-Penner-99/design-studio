---
name: ai-image-generator
description: Generate a brand-fitted mascot or hero illustration when the contractor doesn't have one. Used by design-director (SOP 09) only when needed.
---

# ai-image-generator

## What this skill does
Render a single AI image to spec. Used sparingly — only for mascots and only if `assets/raw/mascot.*` is missing and the brand archetype calls for one.

## Inputs
```json
{
  "prompt": "...",
  "style": "flat-illustration | photo-real | hand-drawn",
  "palette_anchors": ["#0F172A", "#C6A75E"],
  "aspect": "square | portrait | landscape",
  "out_path": "assets/raw/mascot.png"
}
```

## Output
PNG written to `out_path`. Appends entry to `assets/manifest.json` with `license_claim: "ai-generated, action-studio-licensed"`.

## Implementation
Wraps an image-gen API (OpenAI Images, Replicate FLUX, Stability AI). The exact provider lives in env (`IMAGE_GEN_PROVIDER` + `IMAGE_GEN_API_KEY`).

## Constraints
- Never use this for project photos, owner photos, or team photos. Those must be real (extracted in Phase 2). If missing, that's a halt condition — not a gen-image fallback.
- Mascots only.

## TODO before first run
- Choose provider, add credentials to env.
