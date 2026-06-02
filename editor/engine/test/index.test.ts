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
