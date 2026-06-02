import type { Field, Manifest } from "@action-studio/editor-engine";

export function visibleFields(manifest: Manifest, role: "operator" | "client"): Field[] {
  return role === "operator" ? manifest.fields : manifest.fields.filter((f) => f.clientEditable);
}

export interface SectionGroup { section: string; fields: Field[]; }
export interface PageGroup { page: string; sections: SectionGroup[]; }

/** Group fields by page, then section, preserving first-seen order at each level. */
export function groupFields(fields: Field[]): PageGroup[] {
  const pages: PageGroup[] = [];
  for (const f of fields) {
    let page = pages.find((p) => p.page === f.page);
    if (!page) { page = { page: f.page, sections: [] }; pages.push(page); }
    let section = page.sections.find((s) => s.section === f.section);
    if (!section) { section = { section: f.section, fields: [] }; page.sections.push(section); }
    section.fields.push(f);
  }
  return pages;
}
