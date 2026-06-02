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
