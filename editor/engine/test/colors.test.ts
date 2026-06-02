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
