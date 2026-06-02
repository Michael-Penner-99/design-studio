# Client Site Editor — Engine (Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, fully-tested TypeScript library + CLI that tags a factory-built static site with stable edit ids, generates an `editable.json` manifest, resolves the two-layer (tier + per-field) permission model, and merges overrides (text, image, color, link) back into the served HTML — with a retrofit command for already-deployed sites.

**Architecture:** A pure-function core (`tagger`, `manifest`, `merger`, `permissions`) wrapped by a thin CLI. No database, no network, no UI — those belong to Plan 2 (the editor app). The engine operates on a site directory of HTML files plus the inline `tailwind.config` color block each page carries. Original factory HTML is treated as immutable input; the merger always produces output into a separate directory.

**Tech Stack:** Node 20+, TypeScript (ESM), [cheerio](https://cheerio.js.org/) for HTML parsing/manipulation, [zod](https://zod.dev/) for schema validation (already used in `web/`), [vitest](https://vitest.dev/) for tests, [commander](https://github.com/tj/commander.js) for the CLI.

This plan is the foundation for **Plan 2 (the editor app)**, which will import this package for its Store, Merger, and Publisher needs. The `list` field type and structural section editing are explicitly **out of scope** here (deferred to a later plan).

---

## File Structure

All new code lives in a self-contained package at `editor/engine/`:

| File | Responsibility |
|---|---|
| `editor/engine/package.json` | Package manifest, scripts, deps |
| `editor/engine/tsconfig.json` | TS config (ESM, strict) |
| `editor/engine/vitest.config.ts` | Test runner config |
| `editor/engine/src/types.ts` | Zod schemas + inferred types for fields, manifest, overrides, tiers |
| `editor/engine/src/ids.ts` | Deterministic edit-id generation |
| `editor/engine/src/tagger.ts` | Inject `data-edit` attrs into HTML; detect color block |
| `editor/engine/src/colors.ts` | Read/rewrite the inline `tailwind.config` colors block |
| `editor/engine/src/manifest.ts` | Build a manifest from a tagged site directory |
| `editor/engine/src/merger.ts` | Apply overrides to a site directory → output directory |
| `editor/engine/src/permissions.ts` | Tier → editable-types map; resolve effective `clientEditable` |
| `editor/engine/src/index.ts` | Public API re-exports |
| `editor/engine/src/cli.ts` | `tag`, `merge`, `retrofit` commands |
| `editor/engine/test/fixtures/` | Sample HTML pages for tests |
| `editor/engine/test/*.test.ts` | One test file per source module |

---

## Conventions used throughout

- **Edit id format:** `<pageSlug>__<tag>__<nth>` where `pageSlug` is the HTML filename without `.html` and with `/` → `-` (e.g. `services/index.html` → `services-index`), `tag` is the lowercased element tag, and `nth` is the 1-based occurrence among tagged elements of that tag on that page. Example: `index__h1__1`, `services-index__p__4`, `index__img__2`. Color field ids use `color__<name>` (e.g. `color__primary`, `color__surface-alt`).
- **Field value types:** `text`/`richtext`/`image`/`color` → `string`; `link` → `{ label: string, href: string }`.
- **Tagged selectors (text/link/image):** `h1, h2, h3, h4, p, li, blockquote` → `text` (or `richtext` if the element has a `data-rich` attribute); `a[data-cta]` → `link`; `img` → `image`. Elements inside `<nav>` or `<script>`/`<style>` are skipped. Text elements whose trimmed `.text()` is empty are skipped.

---

### Task 0: Scaffold the engine package

**Files:**
- Create: `editor/engine/package.json`
- Create: `editor/engine/tsconfig.json`
- Create: `editor/engine/vitest.config.ts`
- Create: `editor/engine/src/index.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@action-studio/editor-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "editor-engine": "./dist/cli.js" },
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json",
    "cli": "tsx src/cli.ts"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "commander": "^12.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.16.10",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 4: Create a placeholder `src/index.ts`**

```ts
export const ENGINE_VERSION = "0.1.0";
```

- [ ] **Step 5: Install deps and verify the toolchain**

Run: `cd editor/engine && npm install && npm run typecheck`
Expected: install completes; `tsc --noEmit` exits 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add editor/engine/package.json editor/engine/tsconfig.json editor/engine/vitest.config.ts editor/engine/src/index.ts editor/engine/package-lock.json
git commit -m "chore: scaffold editor engine package"
```

---

### Task 1: Field, manifest, and override schemas

**Files:**
- Create: `editor/engine/src/types.ts`
- Test: `editor/engine/test/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { FieldSchema, ManifestSchema, parseManifest } from "../src/types";

describe("FieldSchema", () => {
  it("accepts a valid text field", () => {
    const field = {
      id: "index__h1__1",
      page: "index.html",
      section: "Hero",
      label: "Main headline",
      type: "text",
      value: "Hello",
      clientEditable: true,
      constraints: { maxLength: 60 },
    };
    expect(FieldSchema.parse(field).id).toBe("index__h1__1");
  });

  it("accepts a link field whose value is {label, href}", () => {
    const field = {
      id: "index__a__1",
      page: "index.html",
      section: "Hero",
      label: "CTA",
      type: "link",
      value: { label: "Call now", href: "tel:3065551234" },
      clientEditable: false,
    };
    expect(FieldSchema.parse(field).type).toBe("link");
  });

  it("rejects an unknown field type", () => {
    expect(() =>
      FieldSchema.parse({
        id: "x", page: "p", section: "s", label: "l",
        type: "video", value: "v", clientEditable: true,
      })
    ).toThrow();
  });
});

describe("parseManifest", () => {
  it("round-trips a manifest with tier metadata", () => {
    const m = parseManifest({
      slug: "acme",
      tier: "Text + Pictures",
      fields: [{
        id: "index__p__1", page: "index.html", section: "About",
        label: "Intro", type: "text", value: "Hi", clientEditable: true,
      }],
    });
    expect(m.fields).toHaveLength(1);
    expect(m.tier).toBe("Text + Pictures");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/types.test.ts`
Expected: FAIL — `Cannot find module '../src/types'`.

- [ ] **Step 3: Write `src/types.ts`**

```ts
import { z } from "zod";

export const FIELD_TYPES = ["text", "richtext", "image", "color", "link", "list"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const TIERS = [
  "Text only",
  "Text + Pictures",
  "Text + Pictures + Colours",
  "Everything",
  "custom",
] as const;
export type Tier = (typeof TIERS)[number];

export const LinkValueSchema = z.object({ label: z.string(), href: z.string() });
export type LinkValue = z.infer<typeof LinkValueSchema>;

export const ConstraintsSchema = z
  .object({
    maxLength: z.number().int().positive().optional(),
    palette: z.array(z.string()).optional(),
    maxFileSizeKb: z.number().int().positive().optional(),
    aspectRatio: z.string().optional(),
  })
  .optional();

export const FieldSchema = z.object({
  id: z.string().min(1),
  page: z.string().min(1),
  section: z.string(),
  label: z.string(),
  type: z.enum(FIELD_TYPES),
  // text/richtext/image/color → string; link → {label, href}
  value: z.union([z.string(), LinkValueSchema]),
  clientEditable: z.boolean(),
  constraints: ConstraintsSchema,
});
export type Field = z.infer<typeof FieldSchema>;

export const ManifestSchema = z.object({
  slug: z.string().min(1),
  tier: z.enum(TIERS),
  fields: z.array(FieldSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const OverridesSchema = z.record(z.string(), z.union([z.string(), LinkValueSchema]));
export type Overrides = z.infer<typeof OverridesSchema>;

export function parseManifest(input: unknown): Manifest {
  return ManifestSchema.parse(input);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/types.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/types.ts editor/engine/test/types.test.ts
git commit -m "feat(engine): field, manifest, and override schemas"
```

---

### Task 2: Deterministic edit-id generation

**Files:**
- Create: `editor/engine/src/ids.ts`
- Test: `editor/engine/test/ids.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { pageSlug, IdCounter } from "../src/ids";

describe("pageSlug", () => {
  it("strips .html and replaces slashes", () => {
    expect(pageSlug("index.html")).toBe("index");
    expect(pageSlug("services/index.html")).toBe("services-index");
    expect(pageSlug("areas/regina.html")).toBe("areas-regina");
  });
});

describe("IdCounter", () => {
  it("numbers occurrences per tag, 1-based, per page", () => {
    const c = new IdCounter("index");
    expect(c.next("h1")).toBe("index__h1__1");
    expect(c.next("p")).toBe("index__p__1");
    expect(c.next("p")).toBe("index__p__2");
    expect(c.next("h1")).toBe("index__h1__2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/ids.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/ids.ts`**

```ts
export function pageSlug(relPath: string): string {
  return relPath.replace(/\.html$/i, "").replace(/\//g, "-");
}

export function colorId(name: string): string {
  return `color__${name}`;
}

export class IdCounter {
  private counts = new Map<string, number>();
  constructor(private readonly slug: string) {}

  next(tag: string): string {
    const n = (this.counts.get(tag) ?? 0) + 1;
    this.counts.set(tag, n);
    return `${this.slug}__${tag}__${n}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/ids.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/ids.ts editor/engine/test/ids.test.ts
git commit -m "feat(engine): deterministic edit-id generation"
```

---

### Task 3: Color block read/rewrite

**Files:**
- Create: `editor/engine/src/colors.ts`
- Test: `editor/engine/test/colors.test.ts`

The browser uses the inline `tailwind.config = { theme: { extend: { colors: {...} } } }` block. We read color name→hex pairs from it, and rewrite specific hexes by name without disturbing the rest of the document.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { readColors, rewriteColors } from "../src/colors";

const HTML = `<head><script>
  tailwind.config = { theme: { extend: { colors: {
    primary: '#E5524F',
    'surface-alt': '#F1EFE9',
  } } } };
</script></head>`;

describe("readColors", () => {
  it("extracts name→hex pairs, including quoted keys", () => {
    const colors = readColors(HTML);
    expect(colors).toEqual({ primary: "#E5524F", "surface-alt": "#F1EFE9" });
  });
  it("returns empty object when no color block is present", () => {
    expect(readColors("<head></head>")).toEqual({});
  });
});

describe("rewriteColors", () => {
  it("replaces only the named colors, leaving others untouched", () => {
    const out = rewriteColors(HTML, { primary: "#000000" });
    expect(out).toContain("primary: '#000000'");
    expect(out).toContain("'surface-alt': '#F1EFE9'");
  });
  it("is a no-op for color names not present", () => {
    const out = rewriteColors(HTML, { nope: "#123456" });
    expect(out).toBe(HTML);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/colors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/colors.ts`**

```ts
// Matches `name: '#hex'` or `'quoted-name': "#hex"` inside the colors block.
const COLOR_PAIR = /(['"]?)([A-Za-z0-9-]+)\1\s*:\s*(['"])(#[0-9A-Fa-f]{3,8})\3/g;

function colorsBlock(html: string): string | null {
  const m = html.match(/colors\s*:\s*\{/);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return depth === 0 ? html.slice(start, i - 1) : null;
}

export function readColors(html: string): Record<string, string> {
  const block = colorsBlock(html);
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const match of block.matchAll(COLOR_PAIR)) {
    out[match[2]] = match[4];
  }
  return out;
}

export function rewriteColors(html: string, updates: Record<string, string>): string {
  const block = colorsBlock(html);
  if (!block) return html;
  const newBlock = block.replace(COLOR_PAIR, (full, q1, name, q2, hex) =>
    name in updates ? `${q1}${name}${q1}: ${q2}${updates[name]}${q2}` : full
  );
  return html.replace(block, newBlock);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/colors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/colors.ts editor/engine/test/colors.test.ts
git commit -m "feat(engine): read and rewrite inline tailwind color block"
```

---

### Task 4: Tagger — inject `data-edit` attributes into one HTML page

**Files:**
- Create: `editor/engine/src/tagger.ts`
- Test: `editor/engine/test/tagger.test.ts`

`tagPage` returns the tagged HTML plus the list of fields discovered on that page (without `clientEditable`, which is decided later by the manifest builder).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { tagPage } from "../src/tagger";

const PAGE = `<!DOCTYPE html><html><body>
  <nav><a href="/">Home</a></nav>
  <section id="hero">
    <h1>Welcome</h1>
    <p>We fix things.</p>
    <p></p>
    <a data-cta href="tel:123">Call now</a>
    <img src="assets/team.jpg" alt="team">
  </section>
</body></html>`;

describe("tagPage", () => {
  it("tags headings, non-empty paragraphs, cta links, and images", () => {
    const { html, fields } = tagPage("index.html", PAGE);
    const ids = fields.map((f) => f.id);
    expect(ids).toContain("index__h1__1");
    expect(ids).toContain("index__p__1");
    expect(ids).toContain("index__a__1");
    expect(ids).toContain("index__img__1");
    // empty <p> is skipped, so there is no second p
    expect(ids).not.toContain("index__p__2");
  });

  it("skips elements inside <nav>", () => {
    const { fields } = tagPage("index.html", PAGE);
    expect(fields.find((f) => f.type === "link" && f.value && (f.value as any).label === "Home")).toBeUndefined();
  });

  it("captures correct values and types", () => {
    const { fields } = tagPage("index.html", PAGE);
    const h1 = fields.find((f) => f.id === "index__h1__1")!;
    expect(h1.type).toBe("text");
    expect(h1.value).toBe("Welcome");
    const cta = fields.find((f) => f.id === "index__a__1")!;
    expect(cta.type).toBe("link");
    expect(cta.value).toEqual({ label: "Call now", href: "tel:123" });
    const img = fields.find((f) => f.id === "index__img__1")!;
    expect(img.value).toBe("assets/team.jpg");
  });

  it("writes data-edit attributes into the returned html", () => {
    const { html } = tagPage("index.html", PAGE);
    const $ = cheerio.load(html);
    expect($('[data-edit="index__h1__1"]').length).toBe(1);
  });

  it("is idempotent: re-tagging keeps the same ids", () => {
    const first = tagPage("index.html", PAGE);
    const second = tagPage("index.html", first.html);
    expect(second.fields.map((f) => f.id)).toEqual(first.fields.map((f) => f.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/tagger.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/tagger.ts`**

```ts
import * as cheerio from "cheerio";
import type { Field } from "./types";
import { pageSlug, IdCounter } from "./ids";

const TEXT_SELECTOR = "h1, h2, h3, h4, p, li, blockquote";

export type TaggedField = Omit<Field, "clientEditable" | "section"> & { section: string };

export interface TagPageResult {
  html: string;
  fields: TaggedField[];
}

function sectionLabel($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const sec = $(el).closest("section");
  if (sec.length) {
    const id = sec.attr("id");
    if (id) return id;
    const heading = sec.find("h1,h2,h3").first().text().trim();
    if (heading) return heading;
  }
  return "Page";
}

export function tagPage(relPath: string, html: string): TagPageResult {
  const $ = cheerio.load(html);
  const slug = pageSlug(relPath);
  const counter = new IdCounter(slug);
  const fields: TaggedField[] = [];

  const inNav = (el: cheerio.Element) => $(el).closest("nav").length > 0;

  // Text + richtext
  $(TEXT_SELECTOR).each((_, el) => {
    if (inNav(el)) return;
    const text = $(el).text().trim();
    if (!text) return;
    const tag = (el as any).tagName.toLowerCase();
    const existing = $(el).attr("data-edit");
    const id = existing ?? counter.next(tag);
    $(el).attr("data-edit", id);
    fields.push({
      id, page: relPath, section: sectionLabel($, el),
      label: text.slice(0, 40), type: $(el).is("[data-rich]") ? "richtext" : "text",
      value: $(el).is("[data-rich]") ? ($(el).html() ?? "") : text,
    });
  });

  // CTA links
  $("a[data-cta]").each((_, el) => {
    if (inNav(el)) return;
    const existing = $(el).attr("data-edit");
    const id = existing ?? counter.next("a");
    $(el).attr("data-edit", id);
    fields.push({
      id, page: relPath, section: sectionLabel($, el),
      label: $(el).text().trim().slice(0, 40) || "Link", type: "link",
      value: { label: $(el).text().trim(), href: $(el).attr("href") ?? "" },
    });
  });

  // Images
  $("img").each((_, el) => {
    if (inNav(el)) return;
    const existing = $(el).attr("data-edit");
    const id = existing ?? counter.next("img");
    $(el).attr("data-edit", id);
    fields.push({
      id, page: relPath, section: sectionLabel($, el),
      label: $(el).attr("alt")?.slice(0, 40) || "Image", type: "image",
      value: $(el).attr("src") ?? "",
    });
  });

  return { html: $.html(), fields };
}
```

Note: when an element already carries a `data-edit` attribute (re-tagging), we reuse it and do **not** advance the counter, preserving id stability.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/tagger.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/tagger.ts editor/engine/test/tagger.test.ts
git commit -m "feat(engine): tag a single HTML page with stable edit ids"
```

---

### Task 5: Manifest builder over a site directory

**Files:**
- Create: `editor/engine/src/manifest.ts`
- Create: `editor/engine/test/fixtures/site/index.html`
- Create: `editor/engine/test/fixtures/site/about.html`
- Test: `editor/engine/test/manifest.test.ts`

`buildManifest` walks a directory of `.html` files, tags each (writing tagged HTML back to an output dir), extracts color fields from the first page that has a color block, and assembles a `Manifest` with a default tier.

- [ ] **Step 1: Create fixture `test/fixtures/site/index.html`**

```html
<!DOCTYPE html><html><head><script>
tailwind.config = { theme: { extend: { colors: { primary: '#E5524F', ink: '#1A1A1A' } } } };
</script></head><body>
<section id="hero"><h1>Wind Rose</h1><p>Regina mechanical pros.</p>
<img src="assets/hero.jpg" alt="hero"></section>
</body></html>
```

- [ ] **Step 2: Create fixture `test/fixtures/site/about.html`**

```html
<!DOCTYPE html><html><head></head><body>
<section id="story"><h2>Our Story</h2><p>Founded in Regina.</p></section>
</body></html>
```

- [ ] **Step 3: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildManifest } from "../src/manifest";

const SITE = join(__dirname, "fixtures", "site");

describe("buildManifest", () => {
  let out: string;
  beforeEach(() => { out = mkdtempSync(join(tmpdir(), "tagged-")); });

  it("discovers fields across all pages and writes tagged html to outDir", () => {
    const m = buildManifest({ slug: "acme", siteDir: SITE, outDir: out });
    const pages = m.fields.map((f) => f.page);
    expect(pages).toContain("index.html");
    expect(pages).toContain("about.html");
    expect(readdirSync(out).sort()).toEqual(["about.html", "index.html"]);
    rmSync(out, { recursive: true, force: true });
  });

  it("includes color fields from the inline tailwind block", () => {
    const m = buildManifest({ slug: "acme", siteDir: SITE, outDir: out });
    const colorIds = m.fields.filter((f) => f.type === "color").map((f) => f.id).sort();
    expect(colorIds).toEqual(["color__ink", "color__primary"]);
    const primary = m.fields.find((f) => f.id === "color__primary")!;
    expect(primary.value).toBe("#E5524F");
    rmSync(out, { recursive: true, force: true });
  });

  it("defaults the tier to 'Text only' and marks all fields clientEditable accordingly", () => {
    const m = buildManifest({ slug: "acme", siteDir: SITE, outDir: out });
    expect(m.tier).toBe("Text only");
    const colorField = m.fields.find((f) => f.type === "color")!;
    expect(colorField.clientEditable).toBe(false); // color not in 'Text only'
    const textField = m.fields.find((f) => f.type === "text")!;
    expect(textField.clientEditable).toBe(true);
    rmSync(out, { recursive: true, force: true });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/manifest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Write `src/manifest.ts`**

```ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Field, Manifest, Tier } from "./types";
import { tagPage } from "./tagger";
import { readColors } from "./colors";
import { colorId } from "./ids";
import { applyTier } from "./permissions";

export interface BuildManifestOptions {
  slug: string;
  siteDir: string;
  outDir: string;
  tier?: Tier;
}

function htmlFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full, base));
    else if (entry.name.endsWith(".html")) out.push(relative(base, full));
  }
  return out;
}

export function buildManifest(opts: BuildManifestOptions): Manifest {
  const tier: Tier = opts.tier ?? "Text only";
  const fields: Field[] = [];
  let colorsCaptured = false;

  for (const rel of htmlFiles(opts.siteDir).sort()) {
    const src = readFileSync(join(opts.siteDir, rel), "utf8");
    const { html, fields: pageFields } = tagPage(rel, src);

    const destPath = join(opts.outDir, rel);
    mkdirSync(join(destPath, ".."), { recursive: true });
    writeFileSync(destPath, html, "utf8");

    for (const f of pageFields) fields.push({ ...f, clientEditable: false });

    if (!colorsCaptured) {
      const colors = readColors(src);
      const names = Object.keys(colors);
      if (names.length) {
        colorsCaptured = true;
        for (const name of names) {
          fields.push({
            id: colorId(name), page: rel, section: "Brand Colors",
            label: name, type: "color", value: colors[name], clientEditable: false,
          });
        }
      }
    }
  }

  return applyTier({ slug: opts.slug, tier, fields }, tier);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/manifest.test.ts`
Expected: PASS (3 tests). (Depends on `applyTier` from Task 6 — implement Task 6 first if running in strict order; see note below.)

> **Ordering note:** `buildManifest` imports `applyTier` from `permissions.ts` (Task 6). If you implement tasks strictly in order, write a minimal `applyTier` stub in Task 6 before running this test, or reorder Task 6 ahead of Task 5. Recommended: implement Task 6 first, then Task 5.

- [ ] **Step 7: Commit**

```bash
git add editor/engine/src/manifest.ts editor/engine/test/manifest.test.ts editor/engine/test/fixtures/site
git commit -m "feat(engine): build manifest across a site directory"
```

---

### Task 6: Permission tiers (implement before Task 5)

**Files:**
- Create: `editor/engine/src/permissions.ts`
- Test: `editor/engine/test/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { applyTier, resolveTierLabel, TIER_TYPES } from "../src/permissions";
import type { Manifest } from "../src/types";

function manifest(): Manifest {
  return {
    slug: "acme", tier: "Text only",
    fields: [
      { id: "t1", page: "p", section: "s", label: "t", type: "text", value: "x", clientEditable: false },
      { id: "i1", page: "p", section: "s", label: "i", type: "image", value: "x", clientEditable: false },
      { id: "c1", page: "p", section: "s", label: "c", type: "color", value: "#000", clientEditable: false },
    ],
  };
}

describe("applyTier", () => {
  it("Text + Pictures enables text and image but not color", () => {
    const m = applyTier(manifest(), "Text + Pictures");
    const byId = Object.fromEntries(m.fields.map((f) => [f.id, f.clientEditable]));
    expect(byId).toEqual({ t1: true, i1: true, c1: false });
    expect(m.tier).toBe("Text + Pictures");
  });

  it("Text + Pictures + Colours enables all three", () => {
    const m = applyTier(manifest(), "Text + Pictures + Colours");
    expect(m.fields.every((f) => f.clientEditable)).toBe(true);
  });

  it("Everything enables all editable types", () => {
    const m = applyTier(manifest(), "Everything");
    expect(m.fields.every((f) => f.clientEditable)).toBe(true);
  });
});

describe("resolveTierLabel", () => {
  it("returns the tier when all fields match the tier defaults", () => {
    const m = applyTier(manifest(), "Text + Pictures");
    expect(resolveTierLabel(m.fields, "Text + Pictures")).toBe("Text + Pictures");
  });

  it("returns 'custom' when a field diverges from its tier default", () => {
    const m = applyTier(manifest(), "Text + Pictures");
    m.fields.find((f) => f.id === "c1")!.clientEditable = true; // color on, but tier says off
    expect(resolveTierLabel(m.fields, "Text + Pictures")).toBe("custom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/permissions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/permissions.ts`**

```ts
import type { Field, FieldType, Manifest, Tier } from "./types";

const TEXTISH: FieldType[] = ["text", "richtext", "link", "list"];

export const TIER_TYPES: Record<Exclude<Tier, "custom">, FieldType[]> = {
  "Text only": TEXTISH,
  "Text + Pictures": [...TEXTISH, "image"],
  "Text + Pictures + Colours": [...TEXTISH, "image", "color"],
  "Everything": [...TEXTISH, "image", "color", "section"],
};

export function tierAllows(tier: Exclude<Tier, "custom">, type: FieldType): boolean {
  return TIER_TYPES[tier].includes(type);
}

export function applyTier(manifest: Manifest, tier: Exclude<Tier, "custom">): Manifest {
  return {
    ...manifest,
    tier,
    fields: manifest.fields.map((f) => ({ ...f, clientEditable: tierAllows(tier, f.type) })),
  };
}

export function resolveTierLabel(fields: Field[], tier: Exclude<Tier, "custom">): Tier {
  const diverges = fields.some((f) => f.clientEditable !== tierAllows(tier, f.type));
  return diverges ? "custom" : tier;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/permissions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/permissions.ts editor/engine/test/permissions.test.ts
git commit -m "feat(engine): two-layer permission tier resolution"
```

---

### Task 7: Merger — apply overrides to a site directory

**Files:**
- Create: `editor/engine/src/merger.ts`
- Test: `editor/engine/test/merger.test.ts`

The Merger reads the tagged site (output of `buildManifest`), applies an `Overrides` map (field-id → value) plus a separate color map, and writes the result to a new output dir. Text/image/link overrides are matched by `data-edit`; color overrides rewrite the inline block on every page.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeSite } from "../src/merger";

const TAGGED = `<!DOCTYPE html><html><head><script>
tailwind.config = { theme: { extend: { colors: { primary: '#E5524F' } } } };
</script></head><body>
<h1 data-edit="index__h1__1">Old</h1>
<a data-edit="index__a__1" href="tel:1">Call</a>
<img data-edit="index__img__1" src="old.jpg">
</body></html>`;

describe("mergeSite", () => {
  let src: string, out: string;
  beforeEach(() => {
    src = mkdtempSync(join(tmpdir(), "src-"));
    out = mkdtempSync(join(tmpdir(), "out-"));
    writeFileSync(join(src, "index.html"), TAGGED, "utf8");
  });

  it("applies text, link, image, and color overrides", () => {
    mergeSite({
      siteDir: src, outDir: out,
      overrides: {
        "index__h1__1": "New Headline",
        "index__a__1": { label: "Call Today", href: "tel:999" },
        "index__img__1": "https://blob/new.jpg",
        "color__primary": "#000000",
      },
    });
    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(html).toContain(">New Headline<");
    expect(html).toContain("tel:999");
    expect(html).toContain("Call Today");
    expect(html).toContain('src="https://blob/new.jpg"');
    expect(html).toContain("primary: '#000000'");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it("leaves fields without an override untouched", () => {
    mergeSite({ siteDir: src, outDir: out, overrides: {} });
    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(html).toContain(">Old<");
    expect(html).toContain("old.jpg");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it("logs (does not throw) when an override id is missing in the html", () => {
    const result = mergeSite({ siteDir: src, outDir: out, overrides: { "ghost__id__9": "x" } });
    expect(result.orphans).toContain("ghost__id__9");
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/merger.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/merger.ts`**

```ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import * as cheerio from "cheerio";
import type { Overrides, LinkValue } from "./types";
import { rewriteColors } from "./colors";

export interface MergeOptions {
  siteDir: string;
  outDir: string;
  overrides: Overrides;
}

export interface MergeResult {
  pages: string[];
  applied: string[];
  orphans: string[];
}

function htmlFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full, base));
    else if (entry.name.endsWith(".html")) out.push(relative(base, full));
  }
  return out;
}

function isLink(v: unknown): v is LinkValue {
  return typeof v === "object" && v !== null && "href" in v;
}

export function mergeSite(opts: MergeOptions): MergeResult {
  const applied = new Set<string>();
  const colorUpdates: Record<string, string> = {};
  for (const [id, value] of Object.entries(opts.overrides)) {
    if (id.startsWith("color__") && typeof value === "string") {
      colorUpdates[id.replace(/^color__/, "")] = value;
    }
  }

  const pages = htmlFiles(opts.siteDir).sort();
  for (const rel of pages) {
    let html = readFileSync(join(opts.siteDir, rel), "utf8");
    if (Object.keys(colorUpdates).length) {
      const before = html;
      html = rewriteColors(html, colorUpdates);
      if (html !== before) for (const k of Object.keys(colorUpdates)) applied.add(`color__${k}`);
    }

    const $ = cheerio.load(html);
    for (const [id, value] of Object.entries(opts.overrides)) {
      if (id.startsWith("color__")) continue;
      const el = $(`[data-edit="${id}"]`);
      if (!el.length) continue;
      if (el.is("img")) {
        el.attr("src", String(value));
      } else if (el.is("a") && isLink(value)) {
        el.attr("href", value.href).text(value.label);
      } else if (el.is("[data-rich]")) {
        el.html(String(value));
      } else {
        el.text(String(value));
      }
      applied.add(id);
    }

    const dest = join(opts.outDir, rel);
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, $.html(), "utf8");
  }

  const orphans = Object.keys(opts.overrides).filter((id) => !applied.has(id));
  return { pages, applied: [...applied], orphans };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/merger.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/merger.ts editor/engine/test/merger.test.ts
git commit -m "feat(engine): merge overrides into a site directory"
```

---

### Task 8: Public API surface

**Files:**
- Modify: `editor/engine/src/index.ts`
- Test: `editor/engine/test/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import * as engine from "../src/index";

describe("public API", () => {
  it("exports the core functions", () => {
    expect(typeof engine.buildManifest).toBe("function");
    expect(typeof engine.mergeSite).toBe("function");
    expect(typeof engine.applyTier).toBe("function");
    expect(typeof engine.parseManifest).toBe("function");
    expect(typeof engine.readColors).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/index.test.ts`
Expected: FAIL — exports are undefined.

- [ ] **Step 3: Rewrite `src/index.ts`**

```ts
export const ENGINE_VERSION = "0.1.0";
export * from "./types";
export * from "./ids";
export * from "./colors";
export * from "./tagger";
export * from "./manifest";
export * from "./merger";
export * from "./permissions";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/index.ts editor/engine/test/index.test.ts
git commit -m "feat(engine): public API re-exports"
```

---

### Task 9: CLI — `tag`, `merge`, `retrofit`

**Files:**
- Create: `editor/engine/src/cli.ts`
- Test: `editor/engine/test/cli.test.ts`

The CLI is a thin wrapper. `tag <siteDir> <outDir> --slug <slug>` writes tagged HTML + `<outDir>/editable.json`. `merge <siteDir> <outDir> --overrides <file>` applies overrides. `retrofit <clientSlug>` is a convenience that tags `clients/<slug>/site` into `clients/<slug>/editor/tagged` and writes the manifest next to it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const CLI = join(__dirname, "..", "src", "cli.ts");
const run = (args: string[]) =>
  execFileSync("npx", ["tsx", CLI, ...args], { encoding: "utf8" });

describe("cli tag", () => {
  let src: string, out: string;
  beforeEach(() => {
    src = mkdtempSync(join(tmpdir(), "csrc-"));
    out = mkdtempSync(join(tmpdir(), "cout-"));
    writeFileSync(join(src, "index.html"),
      `<html><body><h1>Hi</h1></body></html>`, "utf8");
  });

  it("writes tagged html and editable.json", () => {
    run(["tag", src, out, "--slug", "acme"]);
    expect(existsSync(join(out, "index.html"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(out, "editable.json"), "utf8"));
    expect(manifest.slug).toBe("acme");
    expect(manifest.fields.length).toBeGreaterThan(0);
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/cli.test.ts`
Expected: FAIL — `cli.ts` not found / no command output.

- [ ] **Step 3: Write `src/cli.ts`**

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildManifest } from "./manifest";
import { mergeSite } from "./merger";
import type { Tier } from "./types";

const program = new Command();
program.name("editor-engine").description("Action Studio client-site editor engine");

program
  .command("tag")
  .argument("<siteDir>", "directory of built HTML")
  .argument("<outDir>", "directory to write tagged HTML + editable.json")
  .requiredOption("--slug <slug>", "client slug")
  .option("--tier <tier>", "initial permission tier", "Text only")
  .action((siteDir, outDir, opts) => {
    mkdirSync(outDir, { recursive: true });
    const manifest = buildManifest({ slug: opts.slug, siteDir, outDir, tier: opts.tier as Tier });
    writeFileSync(join(outDir, "editable.json"), JSON.stringify(manifest, null, 2), "utf8");
    console.log(`Tagged ${manifest.fields.length} fields → ${outDir}/editable.json`);
  });

program
  .command("merge")
  .argument("<siteDir>", "tagged site dir")
  .argument("<outDir>", "output dir")
  .requiredOption("--overrides <file>", "overrides JSON file")
  .action((siteDir, outDir, opts) => {
    const overrides = JSON.parse(readFileSync(opts.overrides, "utf8"));
    const result = mergeSite({ siteDir, outDir, overrides });
    console.log(`Applied ${result.applied.length} overrides across ${result.pages.length} pages.`);
    if (result.orphans.length) console.warn(`Orphan ids (no match): ${result.orphans.join(", ")}`);
  });

program
  .command("retrofit")
  .argument("<slug>", "client slug under clients/")
  .option("--root <root>", "repo root", process.cwd())
  .option("--tier <tier>", "initial permission tier", "Text only")
  .action((slug, opts) => {
    const siteDir = join(opts.root, "clients", slug, "site");
    const outDir = join(opts.root, "clients", slug, "editor", "tagged");
    mkdirSync(outDir, { recursive: true });
    const manifest = buildManifest({ slug, siteDir, outDir, tier: opts.tier as Tier });
    writeFileSync(join(opts.root, "clients", slug, "editor", "editable.json"),
      JSON.stringify(manifest, null, 2), "utf8");
    console.log(`Retrofitted ${slug}: ${manifest.fields.length} fields.`);
  });

program.parse();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/cli.test.ts`
Expected: PASS. (This test shells out via `npx tsx`; allow extra time on first run.)

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/cli.ts editor/engine/test/cli.test.ts
git commit -m "feat(engine): tag/merge/retrofit CLI"
```

---

### Task 10: Retrofit one real deployed site (manual verification)

**Files:**
- No source changes. Produces `clients/windrosemechanical/editor/` artifacts.

- [ ] **Step 1: Run the full test suite once**

Run: `cd editor/engine && npm test`
Expected: ALL test files PASS.

- [ ] **Step 2: Retrofit the Wind Rose site**

Run: `cd editor/engine && npx tsx src/cli.ts retrofit windrosemechanical --root ../..`
Expected: prints `Retrofitted windrosemechanical: N fields.` (N > 0).

- [ ] **Step 3: Inspect the generated manifest**

Run: `cd /Users/michaelpenner/code/design-studio && head -50 clients/windrosemechanical/editor/editable.json`
Expected: valid JSON with `slug: "windrosemechanical"`, a `tier`, and readable `fields` (headlines, paragraphs, images, and `color__primary` etc. with real hex values). Manually confirm the labels are human-sensible — this is the acceptance check from the spec's "Retrofit coverage" risk.

- [ ] **Step 4: Smoke-test a color + text merge end to end**

Run:
```bash
cd /Users/michaelpenner/code/design-studio
printf '{"color__primary":"#0000FF"}' > /tmp/ov.json
cd editor/engine && npx tsx src/cli.ts merge \
  ../../clients/windrosemechanical/editor/tagged /tmp/wr-merged --overrides /tmp/ov.json
grep -r "primary: '#0000FF'" /tmp/wr-merged/index.html
```
Expected: `merge` reports applied overrides; `grep` finds the rewritten color in the merged output. Confirms the inline-tailwind color rewrite works on a real factory page.

- [ ] **Step 5: Decide whether to commit the retrofit artifacts**

The `clients/<slug>/editor/` artifacts are generated. Add `clients/*/editor/tagged/` to `.gitignore` (regenerable), but commit `clients/<slug>/editor/editable.json` so the manifest is reviewable. Then:

```bash
cd /Users/michaelpenner/code/design-studio
printf '\n# editor engine generated tagged sites (regenerable)\nclients/*/editor/tagged/\n' >> .gitignore
git add .gitignore clients/windrosemechanical/editor/editable.json
git commit -m "chore: retrofit windrosemechanical with editor manifest"
```

---

## Self-Review

**1. Spec coverage:**
- Manifest model (spec §2) → Tasks 1, 4, 5. ✔
- Field types & per-type constraints (§2) → `types.ts` (Task 1); `list` explicitly deferred and noted. ✔
- Two-layer permission tier + per-field + "Custom" label (§3) → Task 6 (`applyTier`, `resolveTierLabel`). ✔
- Tagger as factory sub-step + retrofit (§5, §10) → Tasks 4, 5, 9 (`retrofit`), 10. ✔
- Merger: text/image/color, SEO baked into HTML (§5, §9) → Task 7; color via inline tailwind block. ✔
- Original output immutable / reset to default (§6) → Merger always writes to a separate `outDir`; unset override = factory value preserved (Task 7 test 2). ✔
- Id stability across rebuilds (§11 risk) → Task 4 idempotency test; orphan logging in Task 7. ✔
- Store / Editor app / Publisher / auth (§4, §5, §7, §8) → **Plan 2**, intentionally not here. ✔
- `list` type and section editing → deferred (stated in header & §10 of spec). ✔

**2. Placeholder scan:** No TBDs; every code step contains complete code; every test step has real assertions. ✔

**3. Type consistency:** `buildManifest`/`mergeSite`/`applyTier`/`resolveTierLabel`/`tagPage`/`readColors`/`rewriteColors` signatures match across tasks. `Overrides` (id→string|LinkValue) is consistent between `types.ts`, `merger.ts`, and the CLI. The Task 5↔6 dependency is called out with an ordering note. ✔

---

## What Plan 2 will cover (not this plan)

The editor app (Next.js on Vercel), Postgres + Blob Store, per-client auth + roles, the dashboard form UI with tier/permission controls, image upload, and the Publisher that runs `mergeSite` and deploys via the existing `skills/deploy-vercel` flow. Plan 2 imports `@action-studio/editor-engine` for all tagging/merging/permission logic.
```
