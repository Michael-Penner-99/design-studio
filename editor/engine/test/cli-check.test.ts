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
