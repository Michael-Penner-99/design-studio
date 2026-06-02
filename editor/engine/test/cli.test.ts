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
  }, 30000);
});

describe("cli tag tier validation", () => {
  it("rejects an invalid --tier", () => {
    const src = mkdtempSync(join(tmpdir(), "csrc-"));
    const out = mkdtempSync(join(tmpdir(), "cout-"));
    writeFileSync(join(src, "index.html"), `<html><body><h1>Hi</h1></body></html>`, "utf8");
    expect(() => run(["tag", src, out, "--slug", "acme", "--tier", "Banana"])).toThrow();
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }, 30000);
});
