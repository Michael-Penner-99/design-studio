---
name: color-extractor
description: Extract the dominant color palette from a set of images (logo + photos) and return weighted-frequency colors with cluster deduplication.
---

# color-extractor

## What this skill does
Given a list of image paths and per-image weights, return up to 12 dominant colors clustered to ΔE < 8.

## Inputs
```json
{
  "images": [
    { "path": "assets/raw/logo.svg", "weight": 3.0 },
    { "path": "assets/raw/project-1.jpg", "weight": 1.0 },
    ...
  ],
  "max_colors": 12
}
```

## Output
```json
{
  "colors": [
    { "hex": "#0F172A", "name": "deep navy", "frequency": 0.34, "from_image": "logo.svg" },
    { "hex": "#C6A75E", "name": "warm gold", "frequency": 0.18, "from_image": "logo.svg" },
    ...
  ]
}
```

## Implementation
- Use Python `Pillow` + `colorthief` or `Pillow` + k-means (e.g. `scikit-learn.cluster.KMeans` on pixel RGB values).
- For SVG inputs, rasterize at 256×256 first.
- Compute ΔE (CIE2000) between each pair, merge clusters where ΔE < 8.
- Name each color by mapping to nearest CSS named color, or use a small lookup table.
