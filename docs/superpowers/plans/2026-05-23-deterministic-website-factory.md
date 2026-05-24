# Deterministic Website Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-phase LLM pipeline with a single LLM "intake" step plus deterministic Python/bash scripts, so one contractor website costs ≤25% of the current tokens while keeping the Capstone layout/quality.

**Architecture:** `site = render(content.json, theme.json)`. The LLM only produces `content.json` (business-specific copy delta) + `theme.json` (colors/fonts) and gathers assets. A dependency-free renderer + build/qa/walkthrough scripts turn that data into the multi-page site, a QA report, and a live-editable sales walkthrough. Recipes provide per-trade default content the intake merges onto.

**Tech Stack:** Python 3.13 stdlib only (no pip installs at runtime), pytest for tests, Tailwind via CDN in output, bash worker, existing Vercel deploy script.

**Spec:** `docs/superpowers/specs/2026-05-23-deterministic-website-factory-design.md`

**Conventions:**
- All runtime code lives in the `factory` package at `scripts/factory/`; run via `python3 -m factory.<module>` with `PYTHONPATH=scripts`.
- Tests in `tests/`, run with `pytest`. `pytest.ini` sets `pythonpath = scripts`.
- Runtime scripts use **JSON only** (pyyaml is not installed). `quality-gates/checklist.yml` remains documentation; `qa.py` implements checks in code.
- Frequent commits; each task ends with a commit.

---

### Task 0: Project scaffolding

**Files:**
- Create: `pytest.ini`
- Create: `scripts/factory/__init__.py` (empty)
- Create: `tests/__init__.py` (empty)
- Create: `tests/fixtures/.gitkeep` (empty)

- [ ] **Step 1: Create `pytest.ini`**

```ini
[pytest]
pythonpath = scripts
testpaths = tests
python_files = test_*.py
```

- [ ] **Step 2: Create empty package/test files**

```bash
mkdir -p scripts/factory tests/fixtures
: > scripts/factory/__init__.py
: > tests/__init__.py
: > tests/fixtures/.gitkeep
```

- [ ] **Step 3: Verify pytest collects nothing yet (no error)**

Run: `pytest -q`
Expected: `no tests ran` (exit code 5 is fine) — confirms config loads without error.

- [ ] **Step 4: Commit**

```bash
git add pytest.ini scripts/factory/__init__.py tests/__init__.py tests/fixtures/.gitkeep
git commit -m "chore: scaffold factory package + pytest config"
```

---

### Task 1: Mustache-lite renderer (`factory/render.py`)

**Files:**
- Create: `scripts/factory/render.py`
- Test: `tests/test_render.py`

Supported syntax: `{{var}}` (HTML-escaped), `{{{var}}}` (raw), `{{#key}}…{{/key}}` (loop if list, render-once if truthy non-list, skip if falsy), `{{^key}}…{{/key}}` (render if falsy/empty), `{{> name}}` (include partial). Dotted lookups (`a.b`) supported. Inside a `{{#list}}` over dicts, keys resolve against the item; `.` refers to the item itself (for lists of scalars).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_render.py
from factory.render import render

def test_escapes_plain_var():
    assert render("Hi {{name}}", {"name": "A & B"}) == "Hi A &amp; B"

def test_raw_var_unescaped():
    assert render("{{{html}}}", {"html": "<b>x</b>"}) == "<b>x</b>"

def test_dotted_lookup():
    assert render("{{a.b}}", {"a": {"b": "v"}}) == "v"

def test_loop_over_dicts():
    out = render("{{#items}}[{{label}}]{{/items}}", {"items": [{"label": "x"}, {"label": "y"}]})
    assert out == "[x][y]"

def test_loop_over_scalars_uses_dot():
    out = render("{{#areas}}{{.}},{{/areas}}", {"areas": ["A", "B"]})
    assert out == "A,B,"

def test_section_truthy_renders_once():
    assert render("{{#on}}YES{{/on}}", {"on": True}) == "YES"

def test_section_falsy_skips():
    assert render("{{#on}}YES{{/on}}", {"on": False}) == ""
    assert render("{{#on}}YES{{/on}}", {"on": []}) == ""

def test_inverted_section():
    assert render("{{^x}}EMPTY{{/x}}", {"x": []}) == "EMPTY"
    assert render("{{^x}}EMPTY{{/x}}", {"x": [1]}) == ""

def test_partials():
    out = render("A{{> p}}B", {"v": "Z"}, partials={"p": "-{{v}}-"})
    assert out == "A-Z-B"

def test_missing_var_is_empty():
    assert render("x{{nope}}y", {}) == "xy"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_render.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'factory.render'`

- [ ] **Step 3: Implement `factory/render.py`**

```python
"""Dependency-free Mustache-lite renderer. Stdlib only."""
import re
from html import escape

_TOKEN = re.compile(r"\{\{(\{?)\s*([#^/>]?)\s*([\w.]+)\s*\}?\}\}")


def _lookup(ctx_stack, key):
    if key == ".":
        return ctx_stack[-1]
    parts = key.split(".")
    for scope in reversed(ctx_stack):
        if isinstance(scope, dict) and parts[0] in scope:
            val = scope
            ok = True
            for p in parts:
                if isinstance(val, dict) and p in val:
                    val = val[p]
                else:
                    ok = False
                    break
            if ok:
                return val
    return None


def render(template, context, partials=None):
    partials = partials or {}
    tokens = []
    pos = 0
    for m in _TOKEN.finditer(template):
        if m.start() > pos:
            tokens.append(("text", template[pos:m.start()]))
        triple, sigil, key = m.group(1), m.group(2), m.group(3)
        if sigil == "#":
            tokens.append(("open", key))
        elif sigil == "^":
            tokens.append(("inv", key))
        elif sigil == "/":
            tokens.append(("close", key))
        elif sigil == ">":
            tokens.append(("partial", key))
        elif triple:
            tokens.append(("raw", key))
        else:
            tokens.append(("var", key))
        pos = m.end()
    if pos < len(template):
        tokens.append(("text", template[pos:]))

    def walk(toks, i, ctx_stack, out):
        while i < len(toks):
            kind, val = toks[i]
            if kind == "text":
                out.append(val)
                i += 1
            elif kind == "var":
                v = _lookup(ctx_stack, val)
                out.append(escape(str(v)) if v is not None else "")
                i += 1
            elif kind == "raw":
                v = _lookup(ctx_stack, val)
                out.append(str(v) if v is not None else "")
                i += 1
            elif kind == "partial":
                out.append(render(partials.get(val, ""), ctx_stack[-1], partials))
                i += 1
            elif kind in ("open", "inv"):
                key = val
                depth = 1
                j = i + 1
                while j < len(toks) and depth:
                    if toks[j][0] in ("open", "inv") and toks[j][1] == key:
                        depth += 1
                    elif toks[j][0] == "close" and toks[j][1] == key:
                        depth -= 1
                    j += 1
                inner = toks[i + 1:j - 1]
                resolved = _lookup(ctx_stack, key)
                truthy = bool(resolved) and resolved is not None
                if kind == "open" and truthy:
                    if isinstance(resolved, list):
                        for item in resolved:
                            walk(inner, 0, ctx_stack + [item], out)
                    else:
                        scope = resolved if isinstance(resolved, dict) else {}
                        walk(inner, 0, ctx_stack + [scope], out)
                elif kind == "inv" and not truthy:
                    walk(inner, 0, ctx_stack, out)
                i = j
            elif kind == "close":
                i += 1
            else:
                i += 1
        return out

    return "".join(walk(tokens, 0, [context], []))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_render.py -q`
Expected: PASS (10 passed)

- [ ] **Step 5: Commit**

```bash
git add scripts/factory/render.py tests/test_render.py
git commit -m "feat: dependency-free mustache-lite renderer"
```

---

### Task 2: Color utilities (`factory/colors.py`)

**Files:**
- Create: `scripts/factory/colors.py`
- Test: `tests/test_colors.py`

Used by build (gradient/derived colors) and qa (WCAG contrast).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_colors.py
import pytest
from factory.colors import hex_to_rgb, contrast_ratio, darken, lighten

def test_hex_to_rgb():
    assert hex_to_rgb("#0F172A") == (15, 23, 42)
    assert hex_to_rgb("0F172A") == (15, 23, 42)

def test_contrast_white_on_navy_is_high():
    # White on Capstone navy is ~16:1
    assert contrast_ratio("#FFFFFF", "#0F172A") > 15

def test_contrast_symmetric():
    assert contrast_ratio("#000000", "#FFFFFF") == pytest.approx(21, abs=0.1)

def test_darken_reduces_luminance():
    base = "#0F172A"
    d = darken(base, 0.3)
    from factory.colors import relative_luminance
    assert relative_luminance(hex_to_rgb(d)) < relative_luminance(hex_to_rgb(base))

def test_lighten_increases_luminance():
    base = "#0F172A"
    from factory.colors import relative_luminance
    assert relative_luminance(hex_to_rgb(lighten(base, 0.3))) > relative_luminance(hex_to_rgb(base))

def test_darken_lighten_return_hex():
    assert darken("#0F172A", 0.2).startswith("#") and len(darken("#0F172A", 0.2)) == 7
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_colors.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'factory.colors'`

- [ ] **Step 3: Implement `factory/colors.py`**

```python
"""WCAG contrast + simple shade math. Stdlib only."""


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c))):02X}" for c in rgb)


def _channel(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(rgb):
    r, g, b = (_channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(hex1, hex2):
    l1 = relative_luminance(hex_to_rgb(hex1))
    l2 = relative_luminance(hex_to_rgb(hex2))
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def darken(h, amount):
    r, g, b = hex_to_rgb(h)
    return rgb_to_hex((r * (1 - amount), g * (1 - amount), b * (1 - amount)))


def lighten(h, amount):
    r, g, b = hex_to_rgb(h)
    return rgb_to_hex((r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_colors.py -q`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add scripts/factory/colors.py tests/test_colors.py
git commit -m "feat: color utilities (wcag contrast + shades)"
```

---

### Task 3: Deep-merge for recipe + delta (`factory/merge.py`)

**Files:**
- Create: `scripts/factory/merge.py`
- Test: `tests/test_merge.py`

Rule: dicts merge recursively; any non-dict value in `override` (including lists) **replaces** the base value. (Lists are whole-value overrides — a client's services list replaces the recipe default rather than appending.)

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_merge.py
from factory.merge import deep_merge

def test_scalar_override():
    assert deep_merge({"a": 1}, {"a": 2}) == {"a": 2}

def test_nested_merge():
    assert deep_merge({"a": {"x": 1, "y": 2}}, {"a": {"y": 3}}) == {"a": {"x": 1, "y": 3}}

def test_list_replaces_not_appends():
    assert deep_merge({"s": [1, 2]}, {"s": [9]}) == {"s": [9]}

def test_override_adds_new_keys():
    assert deep_merge({"a": 1}, {"b": 2}) == {"a": 1, "b": 2}

def test_does_not_mutate_inputs():
    base = {"a": {"x": 1}}
    deep_merge(base, {"a": {"y": 2}})
    assert base == {"a": {"x": 1}}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_merge.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'factory.merge'`

- [ ] **Step 3: Implement `factory/merge.py`**

```python
"""Recursive dict merge; non-dict values (incl. lists) replace."""
import copy


def deep_merge(base, override):
    result = copy.deepcopy(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = copy.deepcopy(v)
    return result
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_merge.py -q`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add scripts/factory/merge.py tests/test_merge.py
git commit -m "feat: deep-merge for recipe defaults + client delta"
```

---

### Task 4: Golden fixture — Capstone `content.json` + `theme.json`

**Files:**
- Create: `tests/fixtures/capstone/content.json`
- Create: `tests/fixtures/capstone/theme.json`

These encode the values already present in `clients/capstone-contracting/` (`strategy/copy.md`, `brand/palette.json`, `brand/typography.json`, `site/index.html`). They are the oracle for the build golden test: `build(fixture)` must reproduce the Capstone homepage structure.

- [ ] **Step 1: Create `tests/fixtures/capstone/theme.json`**

```json
{
  "colors": {
    "ink": "#080E1A", "navy": "#0F172A", "navy_2": "#0B1322", "card": "#18243A",
    "gold": "#C6A75E", "gold_light": "#E2C786", "gold_dark": "#A6884A",
    "btn_top": "#E7CE8C", "btn_mid": "#CDAE69", "btn_bottom": "#B0934F",
    "metallic_top": "#ffffff", "metallic_bottom": "#c2cad6"
  },
  "fonts": {
    "heading_family": "Anton",
    "body_family": "Montserrat",
    "google_fonts_url": "https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;500;600;700;800&display=swap"
  }
}
```

- [ ] **Step 2: Create `tests/fixtures/capstone/content.json`**

```json
{
  "meta": { "slug": "capstone-contracting", "mode": "url", "ai_photos": false,
            "domain": "capstone-contracting.actiondesignstudio.com" },
  "business": {
    "name": "Capstone Contracting Solutions", "short_name": "Capstone", "trade": "roofing",
    "phone_display": "(816) 721-1111", "phone_e164": "+18167211111",
    "email": "info@roofsbycapstone.com",
    "address_line": "Grain Valley, MO & Greater Kansas City",
    "primary_city": "Grain Valley", "metro": "Greater Kansas City", "state": "Missouri",
    "hours": "Mon–Sat 8:00 AM – 6:00 PM", "years_in_business": "10+",
    "google_maps_url": "https://www.google.com/maps?q=Capstone+Contracting+Solutions+Grain+Valley+MO",
    "facebook_url": "https://www.facebook.com/CapstoneContractingSolutions"
  },
  "reviews": {
    "google": { "rating": "4.9", "count": "247", "url": "https://www.google.com/maps?q=Capstone+Contracting+Solutions+Grain+Valley+MO" },
    "facebook": { "rating": "4.8", "count": "64", "url": "https://www.facebook.com/CapstoneContractingSolutions" },
    "featured": [
      { "name": "Sarah M.", "stars": 5, "source": "Google", "avatar": "avatar-1.jpg",
        "text": "Capstone handled our insurance claim from start to finish. The crew was professional, on time, and the new roof looks incredible. Highly recommend to anyone in the area." },
      { "name": "James L.", "stars": 5, "source": "Facebook", "avatar": "avatar-2.jpg",
        "text": "After a bad storm, Capstone came out the same day for an inspection. They walked me through every step and made the whole process stress-free. Outstanding work." },
      { "name": "Robert T.", "stars": 5, "source": "Google", "avatar": "avatar-3.jpg",
        "text": "We had three other quotes before choosing Capstone. Their pricing was fair, transparent, and the quality of the finished roof speaks for itself. Worth every penny." }
    ]
  },
  "services": [
    { "slug": "roof-repair", "label": "ROOF REPAIR", "icon": "⌂",
      "card_body": "Honest leak diagnosis, targeted repairs, and a written estimate before we touch your roof.",
      "detail_h1": "ROOF REPAIR.<br/>DONE HONESTLY.",
      "detail_subline": "Honest leak diagnosis, targeted repairs, and a written estimate before we touch your roof.",
      "included": ["Full leak diagnosis with photo documentation", "Targeted shingle and flashing repair", "Written estimate before any work begins"] },
    { "slug": "roof-replacement", "label": "ROOF REPLACEMENT", "icon": "⌂",
      "card_body": "Full tear-off, new underlayment, lifetime-architectural shingles, and a warranty you can actually file against.",
      "detail_h1": "ROOF REPLACEMENT.<br/>DONE RIGHT, ONCE.",
      "detail_subline": "Full tear-off, premium architectural shingles, ridge ventilation, and a warranty you can actually file against — installed by a crew with an owner on site.",
      "included": ["Full tear-off of the existing roof down to the deck.", "Ice & water shield on eaves, valleys, and penetrations.", "Lifetime architectural shingles from GAF, Owens Corning, CertainTeed, TAMKO, Atlas, or Malarkey — your choice."] },
    { "slug": "storm-damage", "label": "STORM DAMAGE", "icon": "⛈",
      "card_body": "Free post-storm inspection with drone footage, insurance-claim guidance, and same-day tarping if you need it.",
      "detail_h1": "STORM DAMAGE.<br/>HANDLED FAST.",
      "detail_subline": "Free post-storm inspection with drone footage, insurance-claim guidance, and same-day tarping if you need it.",
      "included": ["Free post-storm drone inspection", "Insurance-claim documentation and guidance", "Same-day emergency tarping"] },
    { "slug": "insurance-claims", "label": "INSURANCE CLAIMS", "icon": "✦",
      "card_body": "We guide you through the entire claims process — start to settlement.",
      "detail_h1": "INSURANCE CLAIMS.<br/>START TO SETTLEMENT.",
      "detail_subline": "We document the damage and guide you through the entire insurance claim process, from first inspection to final settlement.",
      "included": ["Full photo + drone damage documentation", "Adjuster-meeting support", "Claim guidance from filing to settlement"] }
  ],
  "service_areas": ["Grain Valley", "Blue Springs", "Lee's Summit", "Independence", "Kansas City", "Liberty", "Raytown", "Oak Grove", "Buckner", "Lone Jack"],
  "manufacturers": [
    { "name": "TAMKO", "color": "#c8202a", "style": "heading" },
    { "name": "ATLAS", "color": "#1f3b6e", "style": "heading" },
    { "name": "Owens Corning", "color": "#e6007e", "style": "body" },
    { "name": "CertainTeed", "color": "#004a2f", "style": "body" },
    { "name": "MALARKEY", "color": "#5b5b5b", "style": "heading" },
    { "name": "GAF", "color": "#111111", "style": "heading" }
  ],
  "hero": {
    "eyebrow": "BUILT ON STRENGTH. BACKED BY INTEGRITY.",
    "headline_lines": ["THE FINAL", "CONTRACTOR", "YOU'LL EVER NEED."],
    "subline": "Roofing, restoration, and exterior solutions built to protect what matters most.",
    "checkmarks": ["Same-Day Response Available", "Insurance Claims Handled End to End", "Owner On-Site Every Job", "100% Satisfaction Guarantee"]
  },
  "about": {
    "eyebrow": "ABOUT CAPSTONE SOLUTIONS",
    "h2_lines": ["RAISING THE STANDARD", "IN EXTERIOR SOLUTIONS."],
    "body": ["At Capstone Contracting Solutions, we do not just build roofs — we build trust. Founded by a team of seasoned exterior professionals, our company was created to bring honesty, integrity, and craftsmanship back to the contracting industry.", "Every project is personally managed by an owner from start to finish, ensuring your home receives the care and attention it deserves — from the first inspection to the final walkthrough."],
    "vision": "To be the most trusted name in exterior contracting across Greater Missouri, known for uncompromising quality, honest communication, and homeowner-first service.",
    "mission": "To protect every home we touch with durable, expertly installed exterior solutions — delivered on time, on budget, and backed by industry-leading warranties.",
    "badge_number": "10+", "badge_label": "YEARS OF EXPERIENCE"
  },
  "why": {
    "eyebrow": "WHY CAPSTONE",
    "h2_lines": ["WHY MORE HOMEOWNERS", "CHOOSE CAPSTONE"],
    "body": "We are not a faceless franchise. When you choose Capstone, you get a local, owner-operated team that treats your home like their own.",
    "pillars": [
      { "title": "FREE ROOF INSPECTIONS", "body": "Complete with drone footage and a full photo report." },
      { "title": "INSURANCE CLAIM ASSISTANCE", "body": "We guide you through the entire claims process — start to settlement." },
      { "title": "FLEXIBLE FINANCING OPTIONS", "body": "Trusted lending partners with plans to fit any budget." },
      { "title": "5-STAR RATED & LOCAL", "body": "Top-rated on Google and Facebook by your neighbors." }
    ]
  },
  "gallery": {
    "eyebrow": "— OUR WORK —", "h2": "SEE THE DIFFERENCE IN EVERY SHINGLE",
    "body": "Real projects completed across Grain Valley, Blue Springs, Lee's Summit, and Greater Missouri. Quality you can see in every detail."
  },
  "process": {
    "eyebrow": "OUR PROCESS", "h2_lines": ["SIMPLE.", "TRANSPARENT."],
    "body": "From your first call to warranty documentation, you will always know exactly where your project stands. Capstone keeps the process clear from day one.",
    "steps": ["Contact us by call, form, or referral.", "Free inspection, photo documentation, and insurance guidance.", "Detailed estimate, material selection, and scheduling.", "Professional installation, final walkthrough, and warranty hand-off."]
  },
  "offers": {
    "eyebrow": "— SPECIAL OFFERS —", "h2_lines": ["MAKING QUALITY ROOFING", "MORE ACCESSIBLE"],
    "body": "We believe every homeowner deserves quality roofing without financial stress. As a family-owned company, we proudly offer exclusive discounts for those who serve.",
    "cards": [
      { "icon": "★", "title": "FIRST RESPONDERS", "body": "Exclusive savings for police, fire, and EMS professionals who keep our community safe." },
      { "icon": "✎", "title": "EDUCATORS", "body": "A dedicated discount for teachers and school staff who shape the next generation." },
      { "icon": "⚑", "title": "MILITARY & VETERANS", "body": "Honoring active-duty service members and veterans with special pricing on every job." }
    ],
    "footnote": "Plus, take advantage of convenient financing through our trusted lending partners — with flexible terms to fit your budget."
  },
  "faq": [
    { "q": "How fast can you complete a roofing project in Kansas City?", "a": "Most residential roof replacements are completed in a single day. Larger or more complex projects may take longer — we will give you a clear timeline up front." },
    { "q": "Do you offer roofing financing in Kansas City, MO?", "a": "Yes. We partner with trusted lenders to offer flexible financing plans with terms designed to fit nearly any budget." },
    { "q": "What areas does Capstone Contracting Solutions service?", "a": "We proudly serve Grain Valley and the surrounding Greater Missouri communities, including Blue Springs, Lee's Summit, Independence, and more." },
    { "q": "Do you help with insurance claims after storm damage?", "a": "Absolutely. We document all damage with photos and drone footage and guide you through every step of the insurance claim process." },
    { "q": "Is it better to repair or replace my roof in Kansas City?", "a": "Our team will give you an honest assessment. If a repair is the smarter choice, we will tell you — we never upsell unnecessary work." },
    { "q": "Can a new roof improve my home's value in Kansas City?", "a": "Yes. A new roof is one of the highest-return home improvements, boosting curb appeal, energy efficiency, and resale value." }
  ],
  "areas_section": {
    "eyebrow": "SERVICE AREAS", "h2_lines": ["PROUDLY SERVING", "GREATER MISSOURI"],
    "body": "Headquartered in Grain Valley, Capstone proudly serves dozens of communities across the Greater Kansas City metro and surrounding Missouri."
  },
  "cta": {
    "eyebrow": "GET STARTED TODAY", "h2": "READY TO GET STARTED?",
    "body": "The wait ends here. Let's protect your home together. Get your free, no-obligation estimate from the team Greater Kansas City homeowners trust most."
  },
  "seo": {
    "home": { "title": "Roofing & Exteriors in Kansas City — Capstone Contracting Solutions", "description": "Owner-operated roofing & exterior contractor serving Grain Valley and Greater Kansas City. Free inspections, drone documentation, insurance claims handled." },
    "about": { "title": "About Capstone Contracting Solutions — Kansas City Roofing", "description": "Capstone Contracting Solutions is an owner-operated roofing & exterior contractor in Grain Valley, MO. See who we are and why every project gets the owner on site." },
    "services": { "title": "Roofing & Exterior Services — Capstone Contracting Solutions", "description": "Roof replacement, roof repair, storm-damage restoration, insurance-claim assistance across Greater Kansas City. Free inspection, no pressure." },
    "reviews": { "title": "Reviews — Capstone Contracting Solutions Kansas City Roofers", "description": "Read verified Google and Facebook reviews from Capstone customers in Grain Valley, Blue Springs, Lee's Summit, and Greater Kansas City." },
    "contact": { "title": "Contact — Capstone Contracting Solutions", "description": "Get a free, no-obligation roofing estimate from Capstone Contracting Solutions in Grain Valley and Greater Kansas City." }
  },
  "assets": {
    "logo": "logo.svg", "hero": "hero-house.jpg", "about": "about-team.jpg",
    "services": "services-house.jpg", "why": "why-drone.jpg", "process": "process-detail.jpg",
    "cta": "cta-house.jpg", "map": "map.jpg",
    "gallery": ["gallery-1.jpg", "gallery-2.jpg", "gallery-3.jpg", "gallery-4.jpg"],
    "avatars": ["avatar-1.jpg", "avatar-2.jpg", "avatar-3.jpg"]
  },
  "walkthrough": {
    "price": "$8,500", "price_note": "Full roof replacement — materials, labor, and lifetime workmanship warranty included.",
    "script_blocks": [
      { "label": "Opening", "text": "I built you a working website before you ever paid me a dollar. Let's walk through it together." },
      { "label": "Close", "text": "We can have this live on your domain this week. Want me to flip it on?" }
    ]
  }
}
```

- [ ] **Step 3: Validate the JSON parses**

Run: `python3 -c "import json; json.load(open('tests/fixtures/capstone/content.json')); json.load(open('tests/fixtures/capstone/theme.json')); print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/capstone/
git commit -m "test: capstone golden content + theme fixture"
```

---

### Task 5: Master template (`templates/site/`)

**Files:**
- Create: `templates/site/base.html`, `templates/site/home.html`, `templates/site/about.html`, `templates/site/services-index.html`, `templates/site/service-detail.html`, `templates/site/reviews.html`, `templates/site/contact.html`
- Create: `templates/site/partials/` — `head.html`, `header.html`, `footer.html`, `mobile-bar.html`, `marquee.html`, and section partials (`hero.html`, `logostrip.html`, `reviews.html`, `about.html`, `services.html`, `why.html`, `gallery.html`, `process.html`, `offers.html`, `faq.html`, `areas.html`, `cta.html`)
- Create: `templates/site/tailwind.config.js.tmpl`

Source of truth is `clients/capstone-contracting/site/index.html` (verbatim gold standard). Tokenize it — do NOT rewrite the markup.

- [ ] **Step 1: Copy the gold-standard HTML as the working base**

```bash
cp clients/capstone-contracting/site/index.html templates/site/home.html
cp clients/capstone-contracting/site/tailwind.config.js templates/site/tailwind.config.js.tmpl
```

- [ ] **Step 2: Tokenize `tailwind.config.js.tmpl`** — replace the hardcoded color hexes and font families so it renders from `theme.json`. Apply these exact substitutions (left = current literal in file → right = token):

```
#080E1A   → {{colors.ink}}
#0F172A   → {{colors.navy}}
#0B1322   → {{colors.navy_2}}
#18243A   → {{colors.card}}
#C6A75E   → {{colors.gold}}
#E2C786   → {{colors.gold_light}}
#A6884A   → {{colors.gold_dark}}
'Anton'        → '{{fonts.heading_family}}'
'Montserrat'   → '{{fonts.body_family}}'
```

(If the config uses other Capstone hexes, map each to the matching `colors.*` key from `theme.json`.)

- [ ] **Step 3: Extract shared shell into partials.** Cut these spans from `home.html` into partials and replace each with a `{{> name}}` include:
  - `<head>…</head>` → `partials/head.html`
  - `<header>…</header>` (+ mobile nav) → `partials/header.html`
  - the repeated marquee `<div class="marquee-band">…</div>` → `partials/marquee.html` (replace **every** occurrence in home.html with `{{> marquee}}`)
  - `<footer>…</footer>` → `partials/footer.html`
  - the sticky `<a class="mobile-call-bar">` → `partials/mobile-bar.html`

- [ ] **Step 4: Tokenize the shell partials** using `content.json` keys. Apply these substitutions across `head.html`, `header.html`, `footer.html`, `mobile-bar.html`:

```
Capstone Contracting Solutions   → {{business.name}}
CAPSTONE                         → {{business.short_name_upper}}     (see note)
(816) 721-1111                   → {{business.phone_display}}
+18167211111  / tel:+18167211111 → {{business.phone_e164}}
info@roofsbycapstone.com         → {{business.email}}
Grain Valley, MO & Greater Kansas City → {{business.address_line}}
Mon–Sat: 8:00 AM – 6:00 PM       → {{business.hours}}
the JSON-LD <title>/<meta> + og  → {{seo.home.title}} / {{seo.home.description}} / {{meta.domain}}
```

Note: add `short_name_upper` to content during build (Task 6) = `business.short_name.upper()`; the inline `SOLUTIONS` sub-label becomes `{{business.short_name_sub}}` defaulting to `"SOLUTIONS"`. The footer SERVICES/COMPANY link lists loop over `{{#services}}` and a fixed company list.

- [ ] **Step 5: Tokenize the head for per-page SEO.** In `base.html` (next step) the head will receive `seo_title`/`seo_description` via a `page` object; in `head.html` replace the title/description/canonical/og with `{{page.title}}`, `{{page.description}}`, `{{meta.domain}}{{page.path}}`. The JSON-LD block tokenizes: name→`{{business.name}}`, telephone→`{{business.phone_e164}}`, ratings→`{{reviews.google.rating}}`/`{{reviews.google.count}}`, areaServed loops `{{#service_areas}}`.

- [ ] **Step 6: Build `base.html`** as the page skeleton all pages share:

```html
<!DOCTYPE html>
<html lang="en">
{{> head}}
<body class="text-white antialiased">
{{> header}}
{{{body}}}
{{> footer}}
{{> mobile-bar}}
</body>
</html>
```

Where `{{{body}}}` is the page-specific rendered body (build composes page → base). `head.html` references `{{page.*}}`.

- [ ] **Step 7: Tokenize each home section into its partial.** Move each `<section>` from home.html into `partials/<name>.html` and tokenize against `content.json`. Required loops/fields per partial:
  - `hero.html`: `{{hero.eyebrow}}`, `{{#hero.headline_lines}}{{.}}<br/>{{/hero.headline_lines}}`, `{{hero.subline}}`, `{{#hero.checkmarks}}…{{.}}…{{/hero.checkmarks}}`, review badges from `{{reviews.google.*}}`/`{{reviews.facebook.*}}`, hero img `./assets/{{assets.hero}}`, the service `<select>` options loop `{{#services}}`.
  - `logostrip.html`: `{{#manufacturers}}` → `<span class="...{{#style_heading}}font-heading{{/style_heading}}..." style="color:{{color}}">{{name}}</span>` (precompute `style_heading` bool in build).
  - `reviews.html`: featured loop `{{#reviews.featured}}` → card with `{{name}}`, `{{{text}}}`, `{{source}}`, avatar `./assets/{{avatar}}`; counts from `{{reviews.*}}`.
  - `about.html`: `{{about.*}}`, body loop `{{#about.body}}<p>{{.}}</p>{{/about.body}}`, image `./assets/{{assets.about}}`.
  - `services.html`: heading from `{{services_*}}` block (store as `content.services_section`), tiles loop `{{#services}}` → `/services/{{slug}}` + `{{icon}}` + `{{label}}`; image `./assets/{{assets.services}}`.
  - `why.html`: pillars loop `{{#why.pillars}}`; image `./assets/{{assets.why}}`.
  - `gallery.html`: gallery images loop `{{#assets.gallery}}<img src="./assets/{{.}}" …>{{/assets.gallery}}`.
  - `process.html`: steps loop `{{#process.steps}}` (use `@index`+1 → precompute `process.steps` as list of `{n,text}` in build); image `./assets/{{assets.process}}`.
  - `offers.html`: cards loop `{{#offers.cards}}`; footnote `{{offers.footnote}}`.
  - `faq.html`: loop `{{#faq}}` → `<details>` with `{{q}}`/`{{a}}` (first item gets `open`; precompute `faq` items with `open` bool in build).
  - `areas.html`: `{{#service_areas}}` chips; map `./assets/{{assets.map}}`, `{{business.google_maps_url}}`.
  - `cta.html`: `{{cta.*}}`, contact form (same markup), bg `./assets/{{assets.cta}}`.
  - All forms: set `action="/api/contact" method="POST"` (per SOP 10 contact-form rule), not `action="#"`.

- [ ] **Step 8: Compose `home.html`** as just the section includes in Capstone order:

```html
{{> hero}}
{{> logostrip}}
{{> marquee}}
{{> reviews}}
{{> marquee}}
{{> about}}
{{> marquee}}
{{> services}}
{{> marquee}}
{{> why}}
{{> marquee}}
{{> gallery}}
{{> marquee}}
{{> process}}
{{> marquee}}
{{> offers}}
{{> faq}}
{{> areas}}
{{> cta}}
```

- [ ] **Step 9: Create secondary page bodies** by lifting the matching markup from the archived Capstone secondary pages (`clients/capstone-contracting/site/about.html`, `services/index.html`, `services/roof-replacement.html`, `reviews.html`) and tokenizing the same way:
  - `about.html`: hero band (`{{seo.about}}`, about copy) + reuse `{{> about}}` content + `{{> cta}}`.
  - `services-index.html`: heading + `{{#services}}` cards (label, card_body, link).
  - `service-detail.html`: uses a single `{{service.*}}` object (build renders this template once per service) — `{{service.detail_h1}}` (raw), `{{service.detail_subline}}`, `{{#service.included}}` list, `{{> cta}}`.
  - `reviews.html`: `{{#reviews.featured}}` full list + `{{reviews.*}}` stat bar.
  - `contact.html`: heading + the CTA form (`{{> cta}}`).

- [ ] **Step 10: Verify no Capstone-specific literals remain in templates** (should all be tokens now):

Run: `grep -rn "Capstone\|816) 721\|roofsbycapstone\|Grain Valley" templates/site/ || echo "clean"`
Expected: `clean` (zero matches)

- [ ] **Step 11: Commit**

```bash
git add templates/site/
git commit -m "feat: tokenized master template lifted from Capstone gold standard"
```

---

### Task 6: Build script (`factory/build.py`)

**Files:**
- Create: `scripts/factory/build.py`
- Test: `tests/test_build.py`

CLI: `python3 -m factory.build <client_dir>`. Reads `<client_dir>/content.json` (+ optional `theme.json`; default theme if absent), loads `recipes/{trade}.json` defaults, deep-merges, precomputes derived fields, renders all pages from `templates/site/`, copies assets, writes `<client_dir>/site/`. Exits non-zero on unresolved token or missing asset.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_build.py
import json, shutil
from pathlib import Path
from factory.build import build_site

FIX = Path("tests/fixtures/capstone")

def _setup(tmp_path):
    client = tmp_path / "capstone-contracting"
    (client / "assets" / "processed").mkdir(parents=True)
    shutil.copy(FIX / "content.json", client / "content.json")
    shutil.copy(FIX / "theme.json", client / "theme.json")
    # stub every asset referenced so the missing-asset gate passes
    content = json.loads((FIX / "content.json").read_text())
    a = content["assets"]
    names = [a["logo"], a["hero"], a["about"], a["services"], a["why"], a["process"], a["cta"], a["map"]] + a["gallery"] + a["avatars"]
    for n in names:
        (client / "assets" / "processed" / n).write_bytes(b"x")
    return client

def test_build_produces_all_pages(tmp_path):
    client = _setup(tmp_path)
    build_site(str(client))
    site = client / "site"
    assert (site / "index.html").exists()
    assert (site / "about.html").exists()
    assert (site / "reviews.html").exists()
    assert (site / "contact.html").exists()
    assert (site / "services" / "index.html").exists()
    assert (site / "services" / "roof-replacement.html").exists()
    assert (site / "tailwind.config.js").exists()

def test_no_leftover_tokens(tmp_path):
    client = _setup(tmp_path)
    build_site(str(client))
    for f in (client / "site").rglob("*.html"):
        assert "{{" not in f.read_text(), f"leftover token in {f}"

def test_home_has_capstone_sections(tmp_path):
    client = _setup(tmp_path)
    build_site(str(client))
    html = (client / "site" / "index.html").read_text()
    for needle in ["THE FINAL", "REAL REVIEWS FROM REAL", "WHY MORE HOMEOWNERS", "FREQUENTLY ASKED QUESTIONS", "Sarah M."]:
        assert needle in html

def test_theme_color_injected_into_tailwind(tmp_path):
    client = _setup(tmp_path)
    build_site(str(client))
    cfg = (client / "site" / "tailwind.config.js").read_text()
    assert "#C6A75E" in cfg  # gold from theme.json

def test_missing_asset_raises(tmp_path):
    client = _setup(tmp_path)
    (client / "assets" / "processed" / "hero-house.jpg").unlink()
    try:
        build_site(str(client))
        assert False, "expected missing-asset failure"
    except SystemExit as e:
        assert e.code != 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_build.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'factory.build'`

- [ ] **Step 3: Implement `factory/build.py`**

```python
"""Deterministic site builder. python3 -m factory.build <client_dir>"""
import json, sys, shutil
from pathlib import Path
from factory.render import render
from factory.merge import deep_merge
from factory.colors import darken, lighten

ROOT = Path(__file__).resolve().parents[2]
TPL = ROOT / "templates" / "site"
RECIPES = ROOT / "recipes"

DEFAULT_THEME = {
    "colors": {"ink": "#080E1A", "navy": "#0F172A", "navy_2": "#0B1322", "card": "#18243A",
               "gold": "#C6A75E", "gold_light": "#E2C786", "gold_dark": "#A6884A",
               "btn_top": "#E7CE8C", "btn_mid": "#CDAE69", "btn_bottom": "#B0934F",
               "metallic_top": "#ffffff", "metallic_bottom": "#c2cad6"},
    "fonts": {"heading_family": "Anton", "body_family": "Montserrat",
              "google_fonts_url": "https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;500;600;700;800&display=swap"},
}

PAGES = [
    ("home.html", "index.html", "home", "/"),
    ("about.html", "about.html", "about", "/about"),
    ("services-index.html", "services/index.html", "services", "/services/"),
    ("reviews.html", "reviews.html", "reviews", "/reviews"),
    ("contact.html", "contact.html", "contact", "/contact"),
]


def _load_partials():
    d = {}
    for f in (TPL / "partials").glob("*.html"):
        d[f.stem] = f.read_text()
    return d


def _fill_theme(theme):
    t = deep_merge(DEFAULT_THEME, theme or {})
    c = t["colors"]
    c.setdefault("navy_2", darken(c["navy"], 0.25))
    c.setdefault("card", lighten(c["navy"], 0.10))
    c.setdefault("gold_light", lighten(c["gold"], 0.25))
    c.setdefault("gold_dark", darken(c["gold"], 0.20))
    return t


def _derive(content):
    b = content["business"]
    b["short_name_upper"] = b["short_name"].upper()
    b.setdefault("short_name_sub", "SOLUTIONS")
    for m in content.get("manufacturers", []):
        m["style_heading"] = (m.get("style") == "heading")
    content["process"]["steps"] = [{"n": i + 1, "text": s} for i, s in enumerate(content["process"]["steps"])]
    content["faq"] = [{"q": q["q"], "a": q["a"], "open": (i == 0)} for i, q in enumerate(content["faq"])]
    for r in content["reviews"]["featured"]:
        r["stars_str"] = "★" * int(r.get("stars", 5))
    return content


def build_site(client_dir):
    client = Path(client_dir)
    content = json.loads((client / "content.json").read_text())
    theme_path = client / "theme.json"
    theme = json.loads(theme_path.read_text()) if theme_path.exists() else {}
    trade = content.get("business", {}).get("trade", "roofing")
    recipe_path = RECIPES / f"{trade}.json"
    if not recipe_path.exists():
        recipe_path = RECIPES / "roofing.json"
    recipe = json.loads(recipe_path.read_text()) if recipe_path.exists() else {}
    content = deep_merge(recipe, content)
    content["theme"] = _fill_theme(theme)
    content = _derive(content)

    partials = _load_partials()
    base = (TPL / "base.html").read_text()
    site = client / "site"
    if site.exists():
        shutil.rmtree(site)
    (site / "services").mkdir(parents=True)

    def emit(out_rel, body_html, page):
        ctx = dict(content)
        ctx["body"] = body_html
        ctx["page"] = page
        html = render(base, ctx, partials)
        if "{{" in html:
            sys.exit(f"BUILD FAIL: unresolved token in {out_rel}")
        out = site / out_rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html)

    for tpl_name, out_rel, seo_key, path in PAGES:
        seo = content["seo"].get(seo_key, content["seo"]["home"])
        page = {"title": seo["title"], "description": seo["description"], "path": path}
        body = render((TPL / tpl_name).read_text(), content, partials)
        emit(out_rel, body, page)

    detail_tpl = (TPL / "service-detail.html").read_text()
    for svc in content["services"]:
        ctx = dict(content)
        ctx["service"] = svc
        body = render(detail_tpl, ctx, partials)
        seo = content["seo"].get(svc["slug"], content["seo"]["services"])
        page = {"title": seo.get("title", content["seo"]["services"]["title"]),
                "description": seo.get("description", content["seo"]["services"]["description"]),
                "path": f"/services/{svc['slug']}"}
        emit(f"services/{svc['slug']}.html", body, page)

    # tailwind config
    cfg = render((TPL / "tailwind.config.js.tmpl").read_text(), content["theme"], partials)
    (site / "tailwind.config.js").write_text(cfg)

    # assets
    dst = site / "assets"
    dst.mkdir(parents=True, exist_ok=True)
    a = content["assets"]
    names = [a["logo"], a["hero"], a["about"], a["services"], a["why"], a["process"], a["cta"], a["map"]] + a["gallery"] + a["avatars"]
    src = client / "assets" / "processed"
    for n in names:
        s = src / n
        if not s.exists():
            sys.exit(f"BUILD FAIL: missing asset {s}")
        shutil.copy(s, dst / n)


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python3 -m factory.build <client_dir>")
    build_site(sys.argv[1])
    print(f"built {sys.argv[1]}/site")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests; fix template/build mismatches until green**

Run: `pytest tests/test_build.py -q`
Expected: PASS (5 passed). If a token is unresolved, the failure message names the page — fix the template token or add the field/derivation. Iterate until green.

- [ ] **Step 5: Commit**

```bash
git add scripts/factory/build.py tests/test_build.py
git commit -m "feat: deterministic build (render templates + theme + assets)"
```

---

### Task 7: Trade recipes (`recipes/*.json`)

**Files:**
- Create: `recipes/roofing.json`, `recipes/hvac.json`, `recipes/plumbing.json`, `recipes/electrical.json`, `recipes/remodel.json`, `recipes/exteriors.json`
- Delete: `recipes/contractor-*.yml` (6 files)
- Test: `tests/test_recipes.py`

Each `recipes/{trade}.json` is a partial `content.json` providing defaults: `services` (slug/label/icon/card_body/detail_*/included), `why.pillars`, `process.steps`, `offers`, `faq`, `manufacturers` (or `[]`), and `gallery`/`areas_section`/`cta` eyebrow text. Port the content from the existing `recipes/contractor-{trade}.yml` (services_canonical, voice, pricing pillars, etc.). The client delta from intake overrides business-specific fields.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_recipes.py
import json
from pathlib import Path
import pytest

TRADES = ["roofing", "hvac", "plumbing", "electrical", "remodel", "exteriors"]

@pytest.mark.parametrize("trade", TRADES)
def test_recipe_parses_and_has_services(trade):
    data = json.loads(Path(f"recipes/{trade}.json").read_text())
    assert isinstance(data.get("services"), list) and len(data["services"]) >= 3
    for s in data["services"]:
        assert {"slug", "label", "icon", "card_body"} <= set(s)

@pytest.mark.parametrize("trade", TRADES)
def test_recipe_has_faq_and_process(trade):
    data = json.loads(Path(f"recipes/{trade}.json").read_text())
    assert len(data.get("faq", [])) >= 3
    assert len(data.get("process", {}).get("steps", [])) >= 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_recipes.py -q`
Expected: FAIL — `FileNotFoundError: recipes/roofing.json`

- [ ] **Step 3: Create `recipes/roofing.json`** (port from `recipes/contractor-roofing.yml` + the Capstone fixture defaults):

```json
{
  "services": [
    { "slug": "roof-replacement", "label": "ROOF REPLACEMENT", "icon": "⌂", "card_body": "Full tear-off, new underlayment, lifetime architectural shingles, and a warranty you can actually file against.", "detail_h1": "ROOF REPLACEMENT.<br/>DONE RIGHT, ONCE.", "detail_subline": "Full tear-off, premium architectural shingles, ridge ventilation, and a warranty you can actually file against.", "included": ["Full tear-off down to the deck", "Ice & water shield on eaves, valleys, and penetrations", "Lifetime architectural shingles"] },
    { "slug": "roof-repair", "label": "ROOF REPAIR", "icon": "⌂", "card_body": "Honest leak diagnosis, targeted repairs, and a written estimate before we touch your roof.", "detail_h1": "ROOF REPAIR.<br/>DONE HONESTLY.", "detail_subline": "Honest leak diagnosis, targeted repairs, and a written estimate before any work begins.", "included": ["Leak diagnosis with photo documentation", "Targeted shingle and flashing repair", "Written estimate up front"] },
    { "slug": "storm-damage", "label": "STORM DAMAGE", "icon": "⛈", "card_body": "Free post-storm inspection with drone footage, insurance-claim guidance, and same-day tarping.", "detail_h1": "STORM DAMAGE.<br/>HANDLED FAST.", "detail_subline": "Free post-storm inspection with drone footage and insurance-claim guidance.", "included": ["Free drone inspection", "Insurance-claim documentation", "Same-day emergency tarping"] },
    { "slug": "insurance-claims", "label": "INSURANCE CLAIMS", "icon": "✦", "card_body": "We guide you through the entire claims process — start to settlement.", "detail_h1": "INSURANCE CLAIMS.<br/>START TO SETTLEMENT.", "detail_subline": "We document the damage and guide you through the entire claim process.", "included": ["Full damage documentation", "Adjuster-meeting support", "Guidance from filing to settlement"] }
  ],
  "manufacturers": [
    { "name": "TAMKO", "color": "#c8202a", "style": "heading" },
    { "name": "ATLAS", "color": "#1f3b6e", "style": "heading" },
    { "name": "Owens Corning", "color": "#e6007e", "style": "body" },
    { "name": "CertainTeed", "color": "#004a2f", "style": "body" },
    { "name": "MALARKEY", "color": "#5b5b5b", "style": "heading" },
    { "name": "GAF", "color": "#111111", "style": "heading" }
  ],
  "why": { "eyebrow": "WHY US", "h2_lines": ["WHY MORE HOMEOWNERS", "CHOOSE US"], "body": "We are not a faceless franchise. You get a local, owner-operated team that treats your home like their own.", "pillars": [
    { "title": "FREE ROOF INSPECTIONS", "body": "Complete with drone footage and a full photo report." },
    { "title": "INSURANCE CLAIM ASSISTANCE", "body": "We guide you through the entire claims process — start to settlement." },
    { "title": "FLEXIBLE FINANCING OPTIONS", "body": "Trusted lending partners with plans to fit any budget." },
    { "title": "5-STAR RATED & LOCAL", "body": "Top-rated on Google and Facebook by your neighbors." } ] },
  "process": { "eyebrow": "OUR PROCESS", "h2_lines": ["SIMPLE.", "TRANSPARENT."], "body": "From your first call to warranty documentation, you will always know exactly where your project stands.", "steps": ["Contact us by call, form, or referral.", "Free inspection, photo documentation, and insurance guidance.", "Detailed estimate, material selection, and scheduling.", "Professional installation, final walkthrough, and warranty hand-off."] },
  "offers": { "eyebrow": "— SPECIAL OFFERS —", "h2_lines": ["MAKING QUALITY ROOFING", "MORE ACCESSIBLE"], "body": "We believe every homeowner deserves quality roofing without financial stress.", "cards": [
    { "icon": "★", "title": "FIRST RESPONDERS", "body": "Exclusive savings for police, fire, and EMS professionals." },
    { "icon": "✎", "title": "EDUCATORS", "body": "A dedicated discount for teachers and school staff." },
    { "icon": "⚑", "title": "MILITARY & VETERANS", "body": "Special pricing for active-duty service members and veterans." } ], "footnote": "Plus convenient financing through our trusted lending partners." },
  "faq": [
    { "q": "How fast can you complete a roofing project?", "a": "Most residential roof replacements finish in a single day. We give you a clear timeline up front." },
    { "q": "Do you offer roofing financing?", "a": "Yes. We partner with trusted lenders for flexible plans to fit nearly any budget." },
    { "q": "Do you help with insurance claims after storm damage?", "a": "Absolutely. We document all damage and guide you through every step of the claim." },
    { "q": "Is it better to repair or replace my roof?", "a": "We give an honest assessment. If a repair is smarter, we tell you — we never upsell." }
  ],
  "gallery": { "eyebrow": "— OUR WORK —", "h2": "SEE THE DIFFERENCE IN EVERY SHINGLE", "body": "Real projects completed across the area. Quality you can see in every detail." }
}
```

- [ ] **Step 4: Create the other five recipes** following the identical schema, porting services/voice/pillars from each `recipes/contractor-{trade}.yml`. Use trade-appropriate values:
  - `hvac.json` — services: `furnace-repair`, `ac-installation`, `heat-pumps`, `maintenance-plans`, `indoor-air-quality`; icons e.g. `❄`/`♨`; manufacturers `[]`; FAQ about seasonal tune-ups, financing, emergency service; process: contact → diagnostic → estimate → install/repair.
  - `plumbing.json` — services: `drain-cleaning`, `water-heaters`, `leak-repair`, `repiping`, `emergency-plumbing`; icon `▣`/`✦`; FAQ about emergencies, financing, warranties.
  - `electrical.json` — services: `panel-upgrades`, `wiring`, `ev-chargers`, `lighting`, `generators`; FAQ about permits, safety, financing.
  - `remodel.json` — services: `kitchen-remodel`, `bathroom-remodel`, `basement-finishing`, `additions`; FAQ about timelines, design, financing.
  - `exteriors.json` — services: `siding`, `windows`, `gutters`, `decks`, `painting`; FAQ about materials, warranties, financing.

  Each must satisfy the Step 1 tests (≥3 services with slug/label/icon/card_body; ≥3 FAQ; ≥3 process steps).

- [ ] **Step 5: Delete the old YAML recipes**

```bash
git rm recipes/contractor-roofing.yml recipes/contractor-hvac.yml recipes/contractor-plumbing.yml recipes/contractor-electrical.yml recipes/contractor-remodel.yml recipes/contractor-exteriors.yml
```

- [ ] **Step 6: Run recipe + build tests**

Run: `pytest tests/test_recipes.py tests/test_build.py -q`
Expected: PASS (all). The build still passes because the fixture overrides recipe fields.

- [ ] **Step 7: Commit**

```bash
git add recipes/
git commit -m "feat: per-trade JSON recipe defaults; remove YAML recipes"
```

---

### Task 8: QA script (`factory/qa.py`)

**Files:**
- Create: `scripts/factory/qa.py`
- Modify: `quality-gates/checklist.yml` (trim to the deterministic gates; keep as docs)
- Test: `tests/test_qa.py`

CLI: `python3 -m factory.qa <client_dir>`. Runs deterministic gates over `<client_dir>/site/`, writes `<client_dir>/qa/report.json`, exits non-zero if any **critical** gate fails. Uses `html.parser` (stdlib) — no external HTML libs.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_qa.py
import json, shutil
from pathlib import Path
from factory.build import build_site
from factory.qa import run_qa

FIX = Path("tests/fixtures/capstone")

def _built(tmp_path):
    client = tmp_path / "capstone-contracting"
    (client / "assets" / "processed").mkdir(parents=True)
    shutil.copy(FIX / "content.json", client / "content.json")
    shutil.copy(FIX / "theme.json", client / "theme.json")
    content = json.loads((FIX / "content.json").read_text())
    a = content["assets"]
    for n in [a["logo"], a["hero"], a["about"], a["services"], a["why"], a["process"], a["cta"], a["map"]] + a["gallery"] + a["avatars"]:
        (client / "assets" / "processed" / n).write_bytes(b"x")
    build_site(str(client))
    return client

def test_golden_site_passes_all_gates(tmp_path):
    client = _built(tmp_path)
    report = run_qa(str(client))
    crit_fail = [g for g in report["gates"] if g["severity"] == "critical" and not g["passed"]]
    assert crit_fail == [], crit_fail

def test_report_written(tmp_path):
    client = _built(tmp_path)
    run_qa(str(client))
    assert (client / "qa" / "report.json").exists()

def test_broken_link_fails(tmp_path):
    client = _built(tmp_path)
    idx = client / "site" / "index.html"
    idx.write_text(idx.read_text().replace('href="/about"', 'href="/nope-missing.html"'))
    report = run_qa(str(client))
    g03 = next(g for g in report["gates"] if g["id"] == "G-03")
    assert not g03["passed"]

def test_leftover_token_fails(tmp_path):
    client = _built(tmp_path)
    idx = client / "site" / "index.html"
    idx.write_text(idx.read_text() + "{{oops}}")
    report = run_qa(str(client))
    g14 = next(g for g in report["gates"] if g["id"] == "G-14")
    assert not g14["passed"]

def test_missing_alt_fails(tmp_path):
    client = _built(tmp_path)
    idx = client / "site" / "index.html"
    idx.write_text(idx.read_text().replace('alt="Customer avatar — Sarah M."', 'alt=""').replace('role="presentation"', ''))
    report = run_qa(str(client))
    g24 = next(g for g in report["gates"] if g["id"] == "G-24")
    assert not g24["passed"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_qa.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'factory.qa'`

- [ ] **Step 3: Implement `factory/qa.py`**

```python
"""Deterministic QA. python3 -m factory.qa <client_dir>"""
import json, re, sys
from html.parser import HTMLParser
from pathlib import Path
from factory.colors import contrast_ratio


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.imgs = []          # list of dict(alt, presentation)
        self.links = []         # href/src values
        self.inputs = []        # (tag, has_label_assoc)
        self.labels_for = set()
        self.titles = []
        self.h1 = 0
        self.has_viewport = False
        self.has_desc = False
        self.desc_len = 0
        self._in_title = False
        self.ids_for = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "img":
            self.imgs.append({"alt": a.get("alt"), "presentation": a.get("role") == "presentation" or a.get("aria-hidden") == "true"})
        if tag in ("a", "link"):
            if a.get("href"):
                self.links.append(a["href"])
        if tag in ("img", "script") and a.get("src"):
            self.links.append(a["src"])
        if tag in ("input", "select", "textarea"):
            labeled = bool(a.get("aria-label") or a.get("id"))
            self.inputs.append({"id": a.get("id"), "aria": bool(a.get("aria-label"))})
        if tag == "label" and a.get("for"):
            self.labels_for.add(a["for"])
        if tag == "title":
            self._in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "meta":
            if a.get("name") == "viewport":
                self.has_viewport = True
            if a.get("name") == "description":
                self.has_desc = True
                self.desc_len = len(a.get("content", ""))

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title and data.strip():
            self.titles.append(data.strip())


def _gate(gates, gid, name, severity, passed, detail=""):
    gates.append({"id": gid, "name": name, "severity": severity, "passed": bool(passed), "detail": detail})


def run_qa(client_dir):
    client = Path(client_dir)
    site = client / "site"
    content = json.loads((client / "content.json").read_text())
    pages = sorted(site.rglob("*.html"))
    gates = []

    # G-14 leftover tokens
    leftover = [str(p) for p in pages if "{{" in p.read_text()]
    _gate(gates, "G-14", "No leftover tokens", "critical", not leftover, ",".join(leftover))

    titles = []
    broken = []
    alt_fail = []
    label_fail = []
    multi_h1 = []
    no_viewport = []
    desc_fail = []

    for p in pages:
        parser = _Parser()
        parser.feed(p.read_text())
        titles += parser.titles
        # G-03 links
        for href in parser.links:
            if href.startswith(("http://", "https://", "tel:", "mailto:", "#", "data:")):
                continue
            target = href.split("#")[0].split("?")[0]
            if not target:
                continue
            if target.startswith("/"):
                rel = target.lstrip("/")
                cand = site / rel
                if target.endswith("/"):
                    cand = site / rel / "index.html"
                elif "." not in Path(rel).name:
                    cand = site / (rel + ".html")
            else:
                cand = (p.parent / target)
            if not (cand.exists() or Path(str(cand) + ".html").exists()):
                broken.append(f"{p.name}:{href}")
        # G-24 alt
        for img in parser.imgs:
            if not img["presentation"] and not (img["alt"] and img["alt"].strip()):
                alt_fail.append(p.name)
        # G-25 labels
        for inp in parser.inputs:
            if not (inp["aria"] or (inp["id"] and inp["id"] in parser.labels_for)):
                label_fail.append(p.name)
        # G-23 one h1
        if parser.h1 != 1:
            multi_h1.append(f"{p.name}={parser.h1}")
        # G-27 viewport
        if not parser.has_viewport:
            no_viewport.append(p.name)
        # G-21 desc
        if not parser.has_desc or parser.desc_len > 160:
            desc_fail.append(f"{p.name}={parser.desc_len}")

    _gate(gates, "G-03", "All internal links resolve", "critical", not broken, ";".join(broken))
    _gate(gates, "G-24", "Every img has alt", "critical", not alt_fail, ";".join(sorted(set(alt_fail))))
    _gate(gates, "G-25", "Form inputs labeled", "major", not label_fail, ";".join(sorted(set(label_fail))))
    _gate(gates, "G-23", "Exactly one h1 per page", "major", not multi_h1, ";".join(multi_h1))
    _gate(gates, "G-27", "Viewport meta present", "critical", not no_viewport, ";".join(no_viewport))
    _gate(gates, "G-21", "Meta description <= 160", "major", not desc_fail, ";".join(desc_fail))
    _gate(gates, "G-20", "Unique page titles", "critical", len(titles) == len(set(titles)), ";".join(titles))

    # G-04/G-06 reviews + ratings traceable
    home = (site / "index.html").read_text()
    rev_ok = all(r["text"][:40] in home for r in content["reviews"]["featured"])
    _gate(gates, "G-04", "Review quotes trace to content", "critical", rev_ok)
    ratings = set(re.findall(r"\b([0-5]\.[0-9])\b", home))
    allowed = {content["reviews"]["google"]["rating"], content["reviews"]["facebook"]["rating"]}
    _gate(gates, "G-06", "Star ratings traceable", "critical", ratings <= allowed | {""}, str(ratings - allowed))

    # G-30 phone click-to-call on every page
    phone = content["business"]["phone_e164"]
    no_phone = [p.name for p in pages if f"tel:{phone}" not in p.read_text()]
    _gate(gates, "G-30", "Phone click-to-call on every page", "critical", not no_phone, ";".join(no_phone))

    # G-26 contrast (theme body text white over navy)
    navy = content["theme"]["colors"]["navy"]
    ratio = contrast_ratio("#FFFFFF", navy)
    _gate(gates, "G-26", "Body text contrast >= 4.5", "major", ratio >= 4.5, f"{ratio:.1f}:1")

    report = {"slug": content["meta"]["slug"], "gates": gates,
              "passed": all(g["passed"] for g in gates if g["severity"] == "critical")}
    (client / "qa").mkdir(exist_ok=True)
    (client / "qa" / "report.json").write_text(json.dumps(report, indent=2))
    return report


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python3 -m factory.qa <client_dir>")
    report = run_qa(sys.argv[1])
    fails = [g for g in report["gates"] if not g["passed"]]
    for g in fails:
        print(f"  {'✗' if g['severity']=='critical' else '⚠'} {g['id']} {g['name']}: {g['detail']}")
    crit = [g for g in fails if g["severity"] == "critical"]
    print(f"QA {report['slug']}: {'PASS' if report['passed'] else 'FAIL'} ({len(fails)} issues, {len(crit)} critical)")
    sys.exit(1 if crit else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests; iterate until green**

Run: `pytest tests/test_qa.py -q`
Expected: PASS (5 passed). If `test_golden_site_passes_all_gates` flags a real template bug (e.g. duplicate h1, missing alt), fix the **template** in Task 5, rebuild, re-run.

- [ ] **Step 5: Trim `quality-gates/checklist.yml`** to document only the gates qa.py implements (G-03, G-04, G-06, G-14, G-20, G-21, G-23, G-24, G-25, G-26, G-27, G-30) with a header note: "Enforced deterministically by scripts/factory/qa.py. The fixed master template guarantees the structural gates."

- [ ] **Step 6: Commit**

```bash
git add scripts/factory/qa.py tests/test_qa.py quality-gates/checklist.yml
git commit -m "feat: deterministic QA gates over built site"
```

---

### Task 9: Sales walkthrough (`factory/walkthrough.py` + template)

**Files:**
- Create: `scripts/factory/walkthrough.py`
- Create: `templates/walkthrough/walkthrough.html.tmpl`
- Delete: `templates/walkthrough/walkthrough.html.template`, `templates/walkthrough/README.md`, `templates/proposal/README.md`
- Test: `tests/test_walkthrough.py`

CLI: `python3 -m factory.walkthrough <client_dir> <preview_url>`. Renders a self-contained HTML sales page with **live-editable** price + script blocks (contenteditable + localStorage persistence + reset), embedding the live site in an iframe.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_walkthrough.py
import json, shutil
from pathlib import Path
from factory.walkthrough import build_walkthrough

FIX = Path("tests/fixtures/capstone")

def _client(tmp_path):
    client = tmp_path / "capstone-contracting"
    client.mkdir()
    shutil.copy(FIX / "content.json", client / "content.json")
    return client

def test_walkthrough_written(tmp_path):
    client = _client(tmp_path)
    build_walkthrough(str(client), "https://capstone-contracting.actiondesignstudio.com")
    assert (client / "proposal" / "walkthrough.html").exists()

def test_price_is_editable_and_seeded(tmp_path):
    client = _client(tmp_path)
    build_walkthrough(str(client), "https://x.example.com")
    html = (client / "proposal" / "walkthrough.html").read_text()
    assert "contenteditable" in html
    assert 'data-editable="price"' in html
    assert "$8,500" in html            # seeded from content.walkthrough.price

def test_localstorage_persistence_present(tmp_path):
    client = _client(tmp_path)
    build_walkthrough(str(client), "https://x.example.com")
    html = (client / "proposal" / "walkthrough.html").read_text()
    assert "localStorage" in html and "Reset" in html

def test_embeds_preview_url(tmp_path):
    client = _client(tmp_path)
    build_walkthrough(str(client), "https://x.example.com")
    html = (client / "proposal" / "walkthrough.html").read_text()
    assert "https://x.example.com" in html

def test_no_leftover_tokens(tmp_path):
    client = _client(tmp_path)
    build_walkthrough(str(client), "https://x.example.com")
    assert "{{" not in (client / "proposal" / "walkthrough.html").read_text()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_walkthrough.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'factory.walkthrough'`

- [ ] **Step 3: Create `templates/walkthrough/walkthrough.html.tmpl`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{business.name}} — Website Walkthrough</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { background:#0F172A; color:#fff; font-family: system-ui, sans-serif; }
  [contenteditable]{ border-bottom:1px dashed rgba(198,167,94,.6); cursor:text; outline:none; }
  [contenteditable]:focus{ background:rgba(198,167,94,.12); }
</style>
</head>
<body class="max-w-5xl mx-auto px-6 py-10">
  <header class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-bold">{{business.name}}</h1>
    <button id="reset" class="text-xs px-3 py-1 border border-white/30 rounded">Reset to default</button>
  </header>

  <section class="mb-8">
    {{#walkthrough.script_blocks}}
    <p class="mb-4 text-lg"><span class="text-[#C6A75E] text-xs uppercase tracking-widest block mb-1">{{label}}</span>
      <span contenteditable="true" data-editable="script-{{label}}">{{text}}</span></p>
    {{/walkthrough.script_blocks}}
  </section>

  <section class="mb-8 p-6 bg-white/5 rounded">
    <div class="text-xs uppercase tracking-widest text-[#C6A75E] mb-2">Your Price</div>
    <div class="text-4xl font-bold"><span contenteditable="true" data-editable="price">{{walkthrough.price}}</span></div>
    <p class="mt-2 text-white/70" contenteditable="true" data-editable="price-note">{{walkthrough.price_note}}</p>
  </section>

  <section>
    <div class="text-xs uppercase tracking-widest text-[#C6A75E] mb-2">The Website</div>
    <iframe src="{{preview_url}}" class="w-full h-[600px] rounded border border-white/10"></iframe>
    <a href="{{preview_url}}" target="_blank" class="inline-block mt-3 text-[#C6A75E] underline">Open full site →</a>
  </section>

<script>
  var KEY = "walkthrough:{{meta.slug}}";
  function load(){ try { return JSON.parse(localStorage.getItem(KEY)||"{}"); } catch(e){ return {}; } }
  function save(d){ localStorage.setItem(KEY, JSON.stringify(d)); }
  var saved = load();
  document.querySelectorAll("[data-editable]").forEach(function(el){
    var k = el.getAttribute("data-editable");
    if (saved[k] != null) el.textContent = saved[k];
    el.addEventListener("input", function(){ var d = load(); d[k] = el.textContent; save(d); });
  });
  document.getElementById("reset").addEventListener("click", function(){ localStorage.removeItem(KEY); location.reload(); });
</script>
</body>
</html>
```

- [ ] **Step 4: Implement `factory/walkthrough.py`**

```python
"""Deterministic sales walkthrough. python3 -m factory.walkthrough <client_dir> <preview_url>"""
import json, sys
from pathlib import Path
from factory.render import render

ROOT = Path(__file__).resolve().parents[2]
TPL = ROOT / "templates" / "walkthrough" / "walkthrough.html.tmpl"


def build_walkthrough(client_dir, preview_url):
    client = Path(client_dir)
    content = json.loads((client / "content.json").read_text())
    content.setdefault("walkthrough", {"price": "Contact for quote", "price_note": "", "script_blocks": []})
    ctx = dict(content)
    ctx["preview_url"] = preview_url
    html = render(TPL.read_text(), ctx)
    if "{{" in html:
        sys.exit("WALKTHROUGH FAIL: unresolved token")
    out = client / "proposal"
    out.mkdir(exist_ok=True)
    (out / "walkthrough.html").write_text(html)
    return out / "walkthrough.html"


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: python3 -m factory.walkthrough <client_dir> <preview_url>")
    path = build_walkthrough(sys.argv[1], sys.argv[2])
    print(f"walkthrough: {path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run tests; delete old walkthrough/proposal docs**

Run: `pytest tests/test_walkthrough.py -q`
Expected: PASS (5 passed)

```bash
git rm templates/walkthrough/walkthrough.html.template templates/walkthrough/README.md templates/proposal/README.md
```

- [ ] **Step 6: Commit**

```bash
git add scripts/factory/walkthrough.py templates/walkthrough/walkthrough.html.tmpl tests/test_walkthrough.py
git commit -m "feat: live-editable HTML sales walkthrough (price/script editable on call)"
```

---

### Task 10: Intake SOP + agent + content schema doc

**Files:**
- Create: `sops/intake.md`
- Create: `.claude/agents/intake.md`
- Create: `docs/content-schema.md`
- Modify: `.claude/settings.json` (register intake agent if it enumerates agents)

No automated test (prompt content); verification is structural.

- [ ] **Step 1: Write `docs/content-schema.md`** documenting the full `content.json` + `theme.json` schema. Copy the field list from the spec's Data Contracts section and annotate each field's source (extracted vs written vs recipe-default) and which gate consumes it.

- [ ] **Step 2: Write `sops/intake.md`** — the single intake procedure. Sections:
  - **Inputs:** URL (crawl) or business-name + pasted reviews (`evidence/reviews-raw.txt`).
  - **Procedure:** (1) identify trade → note `recipes/{trade}.json` will supply defaults; (2) gather identity (name/phone/email/hours/city/metro/state/years); (3) services actually offered (pick from recipe canon + any extras); (4) service areas; (5) reviews → ratings, counts, **3 real featured quotes** into `content.reviews`; (6) assets — extract logo + ≥6 photos (URL mode) via `skills/asset-scraper`, or generate placeholders (name-and-reviews mode) via `skills/ai-image-generator`; derive palette via `skills/color-extractor`, choose font pairing; (7) write the **business-specific copy delta** (hero/about/why overrides only where the recipe default doesn't fit) + per-page SEO + walkthrough price defaults.
  - **Outputs (only these):** `content.json` (delta), `theme.json`, `assets/processed/*` (named to match `content.assets`), `assets/manifest.json`.
  - **Halt conditions:** can't identify trade; no logo; <6 photos; <10 reviews. Write `halt.md`.
  - **Hard rule:** emit ONLY the delta — do not restate recipe defaults; do not write HTML; do not write the 9 v1 strategy/brand docs.

- [ ] **Step 3: Write `.claude/agents/intake.md`** — agent definition: role (single intake specialist), reads `sops/intake.md` + `docs/content-schema.md` + the matching recipe, lists tools (web fetch, the asset/color/review skills), and the one-line completion report contract.

- [ ] **Step 4: Verify referenced skills still exist**

Run: `ls skills/asset-scraper skills/color-extractor skills/review-scraper skills/ai-image-generator`
Expected: all four directories exist.

- [ ] **Step 5: Commit**

```bash
git add sops/intake.md .claude/agents/intake.md docs/content-schema.md .claude/settings.json
git commit -m "feat: single intake SOP + agent + content schema doc"
```

---

### Task 11: Worker rewrite (`scripts/worker-once.sh`)

**Files:**
- Modify: `scripts/worker-once.sh`
- Test: manual dry-run + `bash -n`

Replace the 8-phase loop (lines ~56–141) with: one `claude -p` intake call, then `build` → `qa` → `walkthrough` → `deploy`, updating `runs/{run-id}.json` after each and committing/pushing. One Claude invocation per run.

- [ ] **Step 1: Replace the phase loop.** Swap the `PHASE_SOPS`/`PHASE_NAMES` arrays and the `for phase in 1..8` block with this run body (keep the existing queue-scan/pending logic above it):

```bash
  STEPS=("intake" "build" "qa" "deploy" "walkthrough")

  # 1. Intake — the ONLY claude call
  PROMPT="Run intake for queue job queue/${run_id}.json. Follow CLAUDE.md and sops/intake.md. Produce clients/${slug}/content.json, theme.json, and assets/processed/. Update runs/${run_id}.json after intake. Commit and push. Do not build HTML — that is a script step."
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] intake (claude) for $run_id"
  if ! claude -p --dangerously-skip-permissions "$PROMPT" 2>&1 | tee -a "$ROOT/.runs/${run_id}.log" >> "$ROOT/.worker.out.log"; then
    echo "  ❌ intake failed for $run_id"; continue
  fi
  git pull --rebase --quiet 2>/dev/null || true

  CLIENT="$ROOT/clients/${slug}"
  export PYTHONPATH="$ROOT/scripts"

  # 2. Build (deterministic)
  if ! python3 -m factory.build "$CLIENT"; then echo "  ❌ build failed"; continue; fi
  # 3. QA (deterministic; non-zero on critical fail)
  if ! python3 -m factory.qa "$CLIENT"; then echo "  ⚠ QA critical failures — see clients/${slug}/qa/report.json"; fi
  # 4. Deploy
  PREVIEW_URL="$(scripts/deploy.sh "$slug" 2>>"$ROOT/.worker.out.log" | tail -1)"
  echo "$PREVIEW_URL" > "$CLIENT/deploy/preview-url.txt" 2>/dev/null || true
  # 5. Walkthrough
  python3 -m factory.walkthrough "$CLIENT" "${PREVIEW_URL:-https://${slug}.actiondesignstudio.com}" || true

  python3 - "$run_id" "$slug" "$PREVIEW_URL" << 'PYEOF'
import json, sys, datetime, os
run_id, slug, url = sys.argv[1], sys.argv[2], sys.argv[3]
path = f"runs/{run_id}.json"
d = json.load(open(path)) if os.path.isfile(path) else {"run_id": run_id, "slug": slug}
d.update({"status": "complete", "preview_url": url,
          "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
json.dump(d, open(path, "w"), indent=2)
PYEOF
  git add "runs/${run_id}.json" && git commit -q -m "run(${slug}): complete" && git push -q || true
```

- [ ] **Step 2: Syntax-check**

Run: `bash -n scripts/worker-once.sh`
Expected: no output (valid syntax)

- [ ] **Step 3: Dry-run guard.** Confirm the worker still no-ops cleanly when the queue is empty:

Run: `bash scripts/worker-once.sh`
Expected: prints `no pending jobs` (working tree must be clean) — no claude call.

- [ ] **Step 4: Commit**

```bash
git add scripts/worker-once.sh
git commit -m "feat: worker runs single intake + deterministic build/qa/deploy/walkthrough"
```

---

### Task 12: Orchestrator docs + delete superseded files

**Files:**
- Modify: `CLAUDE.md` (rewrite to the 5-step flow)
- Modify: `sops/00-orchestrator-contract.md` (slim to: parse trigger → intake → build → qa → deploy → walkthrough)
- Delete: `sops/01-brief.md`, `02-research.md`, `03-asset-extraction.md`, `04-brand-audit.md`, `05-content-architecture.md`, `06-information-design.md`, `07-seo-content.md`, `08-design-intelligence.md`, `09-creative-direction.md`, `10-build.md`, `11-qa-audit.md`, `12-auto-iterate.md`, `13-proposal.md`
- Delete agents: `.claude/agents/{content-architect,seo-strategist,design-director,brand-auditor,qa-auditor,iterator,site-builder,proposal-writer,asset-extractor,discovery-researcher}.md`
- Delete: `templates/sections/`, `templates/pages/`, `templates/shared/`

- [ ] **Step 1: Rewrite `CLAUDE.md`** — replace the "8 phases" table and delegation rules with the v2 flow: trigger patterns (unchanged), then "one intake delegation → deterministic build/qa/deploy/walkthrough scripts." Keep file conventions, brand-voice, and halt rules. Point to `sops/intake.md` and `docs/content-schema.md`.

- [ ] **Step 2: Slim `sops/00-orchestrator-contract.md`** to the 5-step contract (intake delegation + the three script invocations + verification: `qa/report.json.passed == true`, `deploy/preview-url.txt` HEAD 200, `proposal/walkthrough.html` exists).

- [ ] **Step 3: Delete superseded SOPs, agents, and template dirs**

```bash
git rm sops/01-brief.md sops/02-research.md sops/03-asset-extraction.md sops/04-brand-audit.md sops/05-content-architecture.md sops/06-information-design.md sops/07-seo-content.md sops/08-design-intelligence.md sops/09-creative-direction.md sops/10-build.md sops/11-qa-audit.md sops/12-auto-iterate.md sops/13-proposal.md
git rm .claude/agents/content-architect.md .claude/agents/seo-strategist.md .claude/agents/design-director.md .claude/agents/brand-auditor.md .claude/agents/qa-auditor.md .claude/agents/iterator.md .claude/agents/site-builder.md .claude/agents/proposal-writer.md .claude/agents/asset-extractor.md .claude/agents/discovery-researcher.md
git rm -r templates/sections templates/pages templates/shared
```

- [ ] **Step 4: Check for dangling references** to deleted files in remaining docs:

Run: `grep -rn "sops/0[1-9]\|sops/1[0-3]\|design-director\|site-builder\|qa-auditor\|templates/sections\|templates/pages\|templates/shared" CLAUDE.md sops/ docs/ README.md .claude/ 2>/dev/null || echo "clean"`
Expected: `clean` — fix any stragglers (e.g. in `docs/architecture.md`, `docs/phase-reference.md`, `sops/14-deploy.md`, `sops/15-worker-run.md`) before committing.

- [ ] **Step 5: Run the full test suite**

Run: `pytest -q`
Expected: PASS (all tests across render/colors/merge/build/recipes/qa/walkthrough)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: rewrite orchestrator to v2 flow; remove superseded SOPs/agents/templates"
```

---

### Task 13: Operator app step labels (`web/`)

**Files:**
- Modify: the `web/` file(s) that enumerate the 8 phase names for the run dashboard.

- [ ] **Step 1: Find where phases are listed**

Run: `grep -rln "Discovery\|Brand DNA\|Sales-Ready\|phases\|phase_name" web/app web/components web/lib 2>/dev/null`
Expected: one or more files listing the phase labels.

- [ ] **Step 2: Replace the 8-phase label list** with the 5 steps: `Intake`, `Build`, `QA`, `Deploy`, `Walkthrough`. Match the existing data shape (array/enum). If the dashboard reads `runs/{id}.json.phases`, update it to read the new `status`/`steps` keys the worker writes.

- [ ] **Step 3: Type-check the web app**

Run: `cd web && npm run build 2>&1 | tail -20 || npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat(web): dashboard reflects v2 5-step flow"
```

---

### Task 14: End-to-end verification + token check + finish

**Files:**
- Create: `docs/v2-verification.md` (results)
- Modify: re-enable worker

- [ ] **Step 1: Golden build + QA from CLI**

```bash
mkdir -p /tmp/golden/capstone-contracting/assets/processed
cp tests/fixtures/capstone/content.json tests/fixtures/capstone/theme.json /tmp/golden/capstone-contracting/
python3 - << 'PY'
import json
a=json.load(open('/tmp/golden/capstone-contracting/content.json'))['assets']
import pathlib
d=pathlib.Path('/tmp/golden/capstone-contracting/assets/processed')
for n in [a['logo'],a['hero'],a['about'],a['services'],a['why'],a['process'],a['cta'],a['map']]+a['gallery']+a['avatars']:
    (d/n).write_bytes(b'x')
PY
PYTHONPATH=scripts python3 -m factory.build /tmp/golden/capstone-contracting
PYTHONPATH=scripts python3 -m factory.qa /tmp/golden/capstone-contracting
```
Expected: build prints `built …/site`; qa prints `QA capstone-contracting: PASS`.

- [ ] **Step 2: Visual spot-check** — open `/tmp/golden/capstone-contracting/site/index.html` in a browser; confirm it matches the archived Capstone layout (hero, reviews, about, services, why, gallery, process, offers, FAQ, areas, CTA, footer, sticky mobile bar). Note any drift in `docs/v2-verification.md`.

- [ ] **Step 3: Token comparison** — record the intake-run token/cost from one real run (or estimate from the worker log) vs a v1 run from `.runs/` in the archive. Write the ratio into `docs/v2-verification.md`. Target: ≤25%.

- [ ] **Step 4: Re-enable the launchd worker**

```bash
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/com.actionstudio.factory-worker.plist" 2>/dev/null || launchctl load "$HOME/Library/LaunchAgents/com.actionstudio.factory-worker.plist" 2>/dev/null || echo "worker plist not installed"
```

- [ ] **Step 5: Commit + finish branch**

```bash
git add docs/v2-verification.md
git commit -m "docs: v2 end-to-end verification + token comparison"
```

Then use the `superpowers:finishing-a-development-branch` skill to merge `v2-deterministic` → `main` (only after Steps 1–3 are green).

---

## Self-Review

**Spec coverage:**
- Data contracts (theme.json/content.json) → Tasks 4, 10, `docs/content-schema.md`. ✓
- Master template from Capstone → Task 5. ✓
- Renderer → Task 1. ✓
- build.py → Task 6. ✓
- Recipes as JSON defaults + merge → Tasks 3, 7. ✓
- qa.py + trimmed checklist → Task 8. ✓
- Intake SOP + agent → Task 10. ✓
- Walkthrough HTML, live-editable price/script + localStorage → Task 9. ✓
- Worker single-intake rewrite → Task 11. ✓
- CLAUDE.md/SOP rewrite + deletions → Task 12. ✓
- Operator app labels → Task 13. ✓
- Token math / verification → Task 14. ✓

**Placeholder scan:** Task 5 (template tokenization) and Task 7 (5 non-roofing recipes) describe transformations rather than pasting full files — unavoidable for an 865-line HTML lift and 6 data files, but each gives exact substitutions/required fields and is gated by a concrete test (golden build, recipe schema test). No code step is left as prose.

**Type/name consistency:** `render(template, context, partials)`, `deep_merge(base, override)`, `build_site(client_dir)`, `run_qa(client_dir)`, `build_walkthrough(client_dir, preview_url)`, `contrast_ratio/darken/lighten/hex_to_rgb/relative_luminance` — used identically across tasks. `content.json` keys in the fixture (Task 4) match the template tokens (Task 5), build derivations (Task 6), and qa checks (Task 8).
