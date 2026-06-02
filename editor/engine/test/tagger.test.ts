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

  it("types a data-rich element as richtext with inner HTML as value", () => {
    const html = `<section id="s"><p data-rich>Bold <strong>text</strong></p></section>`;
    const { fields } = tagPage("index.html", html);
    const rich = fields.find((f) => f.id === "index__p__1")!;
    expect(rich.type).toBe("richtext");
    expect(rich.value).toBe("Bold <strong>text</strong>");
  });

  it("derives section from heading text when no id, and 'Page' when outside any section", () => {
    const withHeading = `<section><h2>Our Story</h2><p>Founded here.</p></section>`;
    const { fields: f1 } = tagPage("about.html", withHeading);
    expect(f1.find((f) => f.id === "about__p__1")!.section).toBe("Our Story");

    const noSection = `<div><p>Loose paragraph.</p></div>`;
    const { fields: f2 } = tagPage("loose.html", noSection);
    expect(f2.find((f) => f.id === "loose__p__1")!.section).toBe("Page");
  });
});
