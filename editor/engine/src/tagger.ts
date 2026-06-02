import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Field } from "./types";
import { pageSlug, IdCounter } from "./ids";

const TEXT_SELECTOR = "h1, h2, h3, h4, p, li, blockquote";

export type TaggedField = Omit<Field, "clientEditable" | "section"> & { section: string };

export interface TagPageResult {
  html: string;
  fields: TaggedField[];
}

function sectionLabel($: cheerio.CheerioAPI, el: AnyNode): string {
  const sec = $(el as AnyNode).closest("section");
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

  const inNav = (el: AnyNode) => $(el as AnyNode).closest("nav").length > 0;

  // Text + richtext
  $(TEXT_SELECTOR).each((_, el) => {
    if (inNav(el)) return;
    const text = $(el as AnyNode).text().trim();
    if (!text) return;
    const tag = (el as any).tagName.toLowerCase();
    const existing = $(el as AnyNode).attr("data-edit");
    const id = existing ?? counter.next(tag);
    $(el as AnyNode).attr("data-edit", id);
    fields.push({
      id, page: relPath, section: sectionLabel($, el),
      label: text.slice(0, 40), type: $(el as AnyNode).is("[data-rich]") ? "richtext" : "text",
      value: $(el as AnyNode).is("[data-rich]") ? ($(el as AnyNode).html() ?? "") : text,
    });
  });

  // CTA links
  $("a[data-cta]").each((_, el) => {
    if (inNav(el)) return;
    const existing = $(el as AnyNode).attr("data-edit");
    const id = existing ?? counter.next("a");
    $(el as AnyNode).attr("data-edit", id);
    fields.push({
      id, page: relPath, section: sectionLabel($, el),
      label: $(el as AnyNode).text().trim().slice(0, 40) || "Link", type: "link",
      value: { label: $(el as AnyNode).text().trim(), href: $(el as AnyNode).attr("href") ?? "" },
    });
  });

  // Images
  $("img").each((_, el) => {
    if (inNav(el)) return;
    const existing = $(el as AnyNode).attr("data-edit");
    const id = existing ?? counter.next("img");
    $(el as AnyNode).attr("data-edit", id);
    fields.push({
      id, page: relPath, section: sectionLabel($, el),
      label: $(el as AnyNode).attr("alt")?.slice(0, 40) || "Image", type: "image",
      value: $(el as AnyNode).attr("src") ?? "",
    });
  });

  return { html: $.html(), fields };
}
