import { describe, it, expect } from "vitest";
import { mergePages } from "../src/merger";

const page = (id: string) =>
  `<html><head><script>tailwind.config={theme:{extend:{colors:{primary:'#E5524F'}}}};</script></head>` +
  `<body><h1 data-edit="${id}__h1__1">Old</h1></body></html>`;

describe("mergePages", () => {
  it("merges text + color across pages in memory and reports applied/orphans", () => {
    const out = mergePages(
      [{ path: "index.html", html: page("index") }, { path: "a/b.html", html: page("a-b") }],
      { "index__h1__1": "New", "color__primary": "#000000", "ghost__id__1": "x" }
    );
    const idx = out.pages.find((p) => p.path === "index.html")!.html;
    expect(idx).toContain(">New<");
    expect(idx).toContain("primary: '#000000'");
    expect(out.pages.find((p) => p.path === "a/b.html")!.html).toContain("primary: '#000000'");
    expect(out.applied).toContain("index__h1__1");
    expect(out.orphans).toContain("ghost__id__1");
  });
});
