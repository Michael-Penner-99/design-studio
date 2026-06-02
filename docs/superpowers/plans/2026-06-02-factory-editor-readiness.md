# Factory Editor-Readiness (Plan 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make factory-built sites fully editable by the engine: mark genuine CTA links with `data-cta` so they become editable `link` fields, and add a deterministic check that every built page carries the inline Tailwind color block (so color edits reach every page).

**Architecture:** Two parts. (1) Static template edits — add `data-cta` to the real CTA anchors in three section templates. (2) A new `checkEditorReadiness(siteDir)` function + `check` CLI command in the existing `@action-studio/editor-engine` package that scans built HTML and reports any page missing the color block plus the link/color field counts; this is wired into the QA gates (`quality-gates/checklist.yml`, SOP 11) and the build SOP (SOP 10) so the agent-driven build is held to it.

**Tech Stack:** Existing factory templates (`templates/`), the engine package (TypeScript + vitest + commander, at `editor/engine/`), and the YAML quality-gates + markdown SOPs.

**Builds on:** [App design spec §3 Plan 2a](../specs/2026-06-02-client-site-editor-app-design.md) and the merged engine (`editor/engine/`). The engine's `readColors`, `tagPage`, and `htmlFiles` (in `fs-walk.ts`) are reused.

---

## Background the engineer needs

- The factory does **not** build sites with a deterministic script — the `site-builder` subagent assembles pages from templates per `sops/10-build.md`, splicing `{{section:name}}` placeholders (including `{{section:head}}`, which carries the inline `<script>tailwind.config = {...}</script>` color block from `templates/shared/head.html.template`). Because it's agent-driven, a page can end up missing the head block (observed: a built `clients/windrosemechanical/site/reviews.html` had no color block). We cannot unit-test "the build"; instead we add a deterministic **gate** that fails QA when any page lacks the block.
- The engine's tagger only turns an anchor into an editable `link` field if it has a `data-cta` attribute (`a[data-cta]`). The current templates don't emit `data-cta`, so built sites produce zero link fields. We add `data-cta` to the genuine CTA anchors only.
- CTA anchors confirmed by inspection:
  - `templates/sections/cta/index.html.template` — two `<a>`: `href="tel:{{phone_tel}}"` and `href="#quote"`.
  - `templates/sections/contact/index.html.template` — two `<a>`: `href="tel:{{phone_tel}}"` and `href="#quote"`.
  - `templates/sections/offers/index.html.template` — one `<a href="#quote">` (the process CTA).
  - The hero "CTA" is a `<button type="submit">` (a form), not an anchor — correctly left alone. Nav, footer, and review-badge links must NOT get `data-cta`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `templates/sections/cta/index.html.template` | Modify | `data-cta` on its 2 CTA anchors |
| `templates/sections/contact/index.html.template` | Modify | `data-cta` on its 2 CTA anchors |
| `templates/sections/offers/index.html.template` | Modify | `data-cta` on its 1 CTA anchor |
| `editor/engine/src/readiness.ts` | Create | `checkEditorReadiness(siteDir)` — scan pages, report missing color block + link/color counts |
| `editor/engine/test/readiness.test.ts` | Create | Tests for the readiness check |
| `editor/engine/src/cli.ts` | Modify | Add `check <siteDir>` command (exit 1 if any page missing block) |
| `editor/engine/src/index.ts` | Modify | Re-export `readiness` |
| `quality-gates/checklist.yml` | Modify | New gate G-EDIT-01 (color block on every page) |
| `sops/10-build.md` | Modify | Reminder: every page must include `{{section:head}}` |
| `sops/11-qa-audit.md` | Modify | Run `editor-engine check` as part of QA |

---

### Task 1: Mark genuine CTA anchors with `data-cta`

**Files:**
- Modify: `templates/sections/cta/index.html.template`
- Modify: `templates/sections/contact/index.html.template`
- Modify: `templates/sections/offers/index.html.template`

These are static template edits (no unit-test runner exists for templates); verification is exact grep assertions.

- [ ] **Step 1: Edit `templates/sections/cta/index.html.template`**

Add ` data-cta` to both CTA anchors. The two lines become:
```html
      <a href="tel:{{phone_tel}}" data-cta class="btn-gold font-body font-bold text-[11px] uppercase tracking-wider px-6 py-3.5">{{cta_phone_label}}</a>
      <a href="#quote" data-cta class="glass font-body font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 hover:border-[{{brand.color.accent}}] transition-colors">{{cta_secondary_label}}</a>
```

- [ ] **Step 2: Edit `templates/sections/contact/index.html.template`**

Add ` data-cta` to both CTA anchors (the `tel:` and `#quote` ones):
```html
          <a href="tel:{{phone_tel}}" data-cta class="btn-gold font-body font-bold text-[11px] uppercase tracking-wider px-6 py-3.5">{{contact_cta_phone_label}}</a>
          <a href="#quote" data-cta class="glass font-body font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 hover:border-[{{brand.color.accent}}] transition-colors">{{contact_cta_secondary_label}}</a>
```

- [ ] **Step 3: Edit `templates/sections/offers/index.html.template`**

Add ` data-cta` to the process CTA anchor:
```html
        <a href="#quote" data-cta class="mt-7 inline-flex items-center gap-2 btn-gold font-body font-bold text-[11px] uppercase tracking-wider px-6 py-3.5">
```

- [ ] **Step 4: Verify the right anchors were marked (and only those)**

Run:
```bash
cd /Users/michaelpenner/code/design-studio
echo "cta=$(grep -c 'data-cta' templates/sections/cta/index.html.template) (expect 2)"
echo "contact=$(grep -c 'data-cta' templates/sections/contact/index.html.template) (expect 2)"
echo "offers=$(grep -c 'data-cta' templates/sections/offers/index.html.template) (expect 1)"
echo "header=$(grep -c 'data-cta' templates/shared/header.html.template) (expect 0)"
echo "footer=$(grep -c 'data-cta' templates/shared/footer.html.template) (expect 0)"
```
Expected: `cta=2`, `contact=2`, `offers=1`, `header=0`, `footer=0`.

- [ ] **Step 5: Commit**

```bash
git add templates/sections/cta/index.html.template templates/sections/contact/index.html.template templates/sections/offers/index.html.template
git commit -m "feat(factory): mark CTA anchors with data-cta for editor link fields"
```

---

### Task 2: `checkEditorReadiness` in the engine

**Files:**
- Create: `editor/engine/src/readiness.ts`
- Test: `editor/engine/test/readiness.test.ts`

Run all commands from `editor/engine`. The engine already exports `readColors` (`./colors`), `tagPage` (`./tagger`), and `htmlFiles` (`./fs-walk`).

- [ ] **Step 1: Write the failing test** at `editor/engine/test/readiness.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEditorReadiness } from "../src/readiness";

const withColors = (cta = false) =>
  `<!DOCTYPE html><html><head><script>` +
  `tailwind.config={theme:{extend:{colors:{primary:'#E5524F'}}}};` +
  `</script></head><body>` +
  (cta ? `<a data-cta href="tel:1">Call</a>` : `<h1>Hi</h1>`) +
  `</body></html>`;
const noColors = `<!DOCTYPE html><html><head></head><body><p>Hi</p></body></html>`;

describe("checkEditorReadiness", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ready-")); });

  it("flags pages that lack the inline color block", () => {
    writeFileSync(join(dir, "index.html"), withColors(), "utf8");
    writeFileSync(join(dir, "reviews.html"), noColors, "utf8");
    const r = checkEditorReadiness(dir);
    expect(r.pages.sort()).toEqual(["index.html", "reviews.html"]);
    expect(r.pagesMissingColorBlock).toEqual(["reviews.html"]);
    expect(r.ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports ok with link + color counts when every page has the block", () => {
    writeFileSync(join(dir, "index.html"), withColors(true), "utf8");
    mkdirSync(join(dir, "services"), { recursive: true });
    writeFileSync(join(dir, "services", "a.html"), withColors(false), "utf8");
    const r = checkEditorReadiness(dir);
    expect(r.pagesMissingColorBlock).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.colorCount).toBe(1);     // primary
    expect(r.linkFieldCount).toBe(1); // the one data-cta anchor
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/readiness.test.ts`
Expected: FAIL — `Cannot find module '../src/readiness'`.

- [ ] **Step 3: Write `editor/engine/src/readiness.ts`:**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlFiles } from "./fs-walk";
import { readColors } from "./colors";
import { tagPage } from "./tagger";

export interface EditorReadiness {
  pages: string[];
  pagesMissingColorBlock: string[];
  colorCount: number;
  linkFieldCount: number;
  ok: boolean;
}

/**
 * Scan a built site directory and report editor-readiness:
 * which pages lack the inline Tailwind color block, plus link/color field counts.
 * `ok` is false when any page is missing the color block.
 */
export function checkEditorReadiness(siteDir: string): EditorReadiness {
  const pages = htmlFiles(siteDir).sort();
  const pagesMissingColorBlock: string[] = [];
  let colorCount = 0;
  let linkFieldCount = 0;

  for (const rel of pages) {
    const html = readFileSync(join(siteDir, rel), "utf8");
    const colors = readColors(html);
    if (Object.keys(colors).length === 0) {
      pagesMissingColorBlock.push(rel);
    } else if (colorCount === 0) {
      colorCount = Object.keys(colors).length;
    }
    const { fields } = tagPage(rel, html);
    linkFieldCount += fields.filter((f) => f.type === "link").length;
  }

  return {
    pages,
    pagesMissingColorBlock,
    colorCount,
    linkFieldCount,
    ok: pagesMissingColorBlock.length === 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd editor/engine && npx vitest run test/readiness.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add editor/engine/src/readiness.ts editor/engine/test/readiness.test.ts
git commit -m "feat(engine): checkEditorReadiness scans pages for color block + link/color counts"
```

---

### Task 3: `check` CLI command + barrel export

**Files:**
- Modify: `editor/engine/src/cli.ts`
- Modify: `editor/engine/src/index.ts`
- Test: `editor/engine/test/cli-check.test.ts`

- [ ] **Step 1: Write the failing test** at `editor/engine/test/cli-check.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const CLI = join(__dirname, "..", "src", "cli.ts");
const run = (args: string[]) =>
  execFileSync("npx", ["tsx", CLI, ...args], { encoding: "utf8" });

const withColors = `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#E5524F'}}}};</script></head><body><h1>Hi</h1></body></html>`;
const noColors = `<html><head></head><body><p>Hi</p></body></html>`;

describe("cli check", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chk-")); });

  it("exits 0 and reports ok when every page has the color block", () => {
    writeFileSync(join(dir, "index.html"), withColors, "utf8");
    const out = run(["check", dir]);
    expect(out).toMatch(/ok/i);
    rmSync(dir, { recursive: true, force: true });
  }, 30000);

  it("exits non-zero when a page lacks the color block", () => {
    writeFileSync(join(dir, "index.html"), withColors, "utf8");
    writeFileSync(join(dir, "reviews.html"), noColors, "utf8");
    expect(() => run(["check", dir])).toThrow();
    rmSync(dir, { recursive: true, force: true });
  }, 30000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd editor/engine && npx vitest run test/cli-check.test.ts`
Expected: FAIL — the `check` command doesn't exist (commander errors / no "ok" output).

- [ ] **Step 3: Add the `check` command to `editor/engine/src/cli.ts`**

Add the import near the other engine imports at the top of the file:
```ts
import { checkEditorReadiness } from "./readiness";
```
Then add this command block before the final `program.parse();` line:
```ts
program
  .command("check")
  .argument("<siteDir>", "built site dir to check for editor-readiness")
  .action((siteDir) => {
    const r = checkEditorReadiness(siteDir);
    console.log(
      `Editor-readiness: ${r.pages.length} pages, ${r.colorCount} colors, ${r.linkFieldCount} link fields.`
    );
    if (!r.ok) {
      console.error(
        `NOT ready — ${r.pagesMissingColorBlock.length} page(s) missing the color block: ${r.pagesMissingColorBlock.join(", ")}`
      );
      process.exitCode = 1;
      return;
    }
    console.log("ok");
  });
```

- [ ] **Step 4: Add the barrel export in `editor/engine/src/index.ts`**

Add this line with the other `export *` lines:
```ts
export * from "./readiness";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd editor/engine && npx vitest run test/cli-check.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite + typecheck (no regressions)**

Run: `cd editor/engine && npm run typecheck && npx vitest run`
Expected: typecheck exits 0; all tests pass (the prior 35 + readiness 2 + cli-check 2 = 39).

- [ ] **Step 7: Commit**

```bash
git add editor/engine/src/cli.ts editor/engine/src/index.ts editor/engine/test/cli-check.test.ts
git commit -m "feat(engine): add 'check' CLI command for editor-readiness"
```

---

### Task 4: Wire the gate into QA + build SOPs

**Files:**
- Modify: `quality-gates/checklist.yml`
- Modify: `sops/11-qa-audit.md`
- Modify: `sops/10-build.md`

- [ ] **Step 1: Read the current gate format**

Run: `sed -n '1,40p' /Users/michaelpenner/code/design-studio/quality-gates/checklist.yml`
Note the existing `- id:` / `name:` / `severity:` / `check:` / `pass_when:` shape (e.g. G-01, G-02).

- [ ] **Step 2: Add a new gate to `quality-gates/checklist.yml`**

Add this entry within the `gates:` list, in the "Structure & files" group (right after the `G-02` tailwind.config gate):
```yaml
  - id: G-EDIT-01
    name: "Every page is editor-ready (carries the inline color block)"
    severity: critical
    check: "Run `node editor/engine/src/cli.ts check clients/{slug}/site` (via tsx). Every built page must contain the inline tailwind.config color block so client color edits propagate to all pages."
    pass_when: "command reports ok (exit 0); pagesMissingColorBlock is empty"
```

- [ ] **Step 3: Reference the check in `sops/11-qa-audit.md`**

Add a line in the QA procedure instructing the auditor to run the editor-readiness check as part of gate evaluation. Add under the gate-running section:
```markdown
- **Editor-readiness (G-EDIT-01).** From the repo root run `cd editor/engine && npx tsx src/cli.ts check ../../clients/{slug}/site`. It must print `ok` and exit 0. If it lists pages missing the color block, that is a critical FAIL — route to the iterator to re-inject `{{section:head}}` into those pages.
```

- [ ] **Step 4: Add a build reminder in `sops/10-build.md`**

Add a bullet in the page-assembly steps emphasizing the head block on every page:
```markdown
- **Every page MUST include `{{section:head}}`** (it carries the inline Tailwind color block). Do not omit it on any page — the editor relies on it for color edits, and QA gate G-EDIT-01 fails the build if any page lacks it.
```

- [ ] **Step 5: Verify the edits landed**

Run:
```bash
cd /Users/michaelpenner/code/design-studio
grep -q "G-EDIT-01" quality-gates/checklist.yml && echo "gate added"
grep -q "G-EDIT-01\|editor-readiness" sops/11-qa-audit.md && echo "SOP 11 updated"
grep -q "section:head" sops/10-build.md && echo "SOP 10 reminder present"
```
Expected: all three echo lines print.

- [ ] **Step 6: Commit**

```bash
git add quality-gates/checklist.yml sops/11-qa-audit.md sops/10-build.md
git commit -m "feat(factory): add G-EDIT-01 editor-readiness gate to QA + build SOPs"
```

---

### Task 5: Verify against the real built site

**Files:** none (verification + a one-time legacy remediation note).

- [ ] **Step 1: Run the check against the existing Wind Rose build**

Run:
```bash
cd /Users/michaelpenner/code/design-studio/editor/engine
npx tsx src/cli.ts check ../../clients/windrosemechanical/site; echo "exit=$?"
```
Expected: it reports the page count and **lists `reviews.html` as missing the color block, exiting non-zero** — this demonstrates the gate correctly catches the real bug we set out to fix.

- [ ] **Step 2: Remediate the legacy page (one-time data fix)**

`reviews.html` in this already-built site predates the gate. Re-inject the head block so this client is editor-ready. Copy the `<head>...</head>` block from a sibling page that has it (e.g. `index.html`) into `reviews.html`, replacing `reviews.html`'s `<head>...</head>`:
```bash
cd /Users/michaelpenner/code/design-studio
node -e '
const fs=require("fs");
const dir="clients/windrosemechanical/site/";
const idx=fs.readFileSync(dir+"index.html","utf8");
const head=idx.match(/<head>[\s\S]*?<\/head>/i)[0];
let rev=fs.readFileSync(dir+"reviews.html","utf8");
rev=rev.replace(/<head>[\s\S]*?<\/head>/i, head);
fs.writeFileSync(dir+"reviews.html",rev);
console.log("reviews.html head replaced");
'
```
Note: this borrows index.html's `<title>`/meta too; that is acceptable for restoring editor-readiness, but if the reviews page needs its own title, adjust the two meta lines by hand afterward. (Going forward, the SOP + gate prevent this for new builds.)

- [ ] **Step 3: Re-run the check — expect ok now**

Run:
```bash
cd /Users/michaelpenner/code/design-studio/editor/engine
npx tsx src/cli.ts check ../../clients/windrosemechanical/site; echo "exit=$?"
```
Expected: prints `ok`, `exit=0`. (Note: `linkFieldCount` will still be 0 for this client because it was built before Task 1's `data-cta` templates — future builds will produce link fields. That's expected; do not treat it as a failure.)

- [ ] **Step 4: Commit the remediated client page**

```bash
cd /Users/michaelpenner/code/design-studio
git add clients/windrosemechanical/site/reviews.html
git commit -m "fix(windrosemechanical): restore head/color block on reviews.html for editor-readiness"
```

---

## Self-Review

**1. Spec coverage (Plan 2a in app spec §3):**
- `data-cta` on genuine CTA anchors, not nav/footer → Task 1 (+ grep verification of both inclusion and exclusion). ✔
- Head/color block on every page; fix the build path; build-time assertion → Tasks 2–4 (deterministic `check` + QA gate G-EDIT-01 + SOP 10/11 updates). ✔
- Verification: re-tag/built site yields link fields + colors on every page → Task 5 (real-site check; link-field generation covered by the engine's existing `a[data-cta]` tagging, now fed by Task 1 templates). ✔

**2. Placeholder scan:** No TBDs; every code/edit step shows the exact content; every test step has real assertions and expected output. ✔

**3. Type/name consistency:** `checkEditorReadiness` and the `EditorReadiness` fields (`pages`, `pagesMissingColorBlock`, `colorCount`, `linkFieldCount`, `ok`) are used identically in `readiness.ts`, its test, the CLI command, and the CLI test. The CLI command name `check` matches across cli.ts, both SOPs, and the gate. Reused engine exports (`htmlFiles`, `readColors`, `tagPage`) match their existing signatures. ✔

**Note on test count:** Task 3 Step 6 expects 39 total (35 existing + 4 new). If a future change alters the baseline, adjust the expected count to `baseline + 4`.
