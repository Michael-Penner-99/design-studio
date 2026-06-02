export function pageSlug(relPath: string): string {
  return relPath.replace(/\.html$/i, "").replace(/\//g, "-");
}

export function colorId(name: string): string {
  return `color__${name}`;
}

export class IdCounter {
  private counts = new Map<string, number>();
  constructor(private readonly slug: string) {}

  next(tag: string): string {
    const n = (this.counts.get(tag) ?? 0) + 1;
    this.counts.set(tag, n);
    return `${this.slug}__${tag}__${n}`;
  }
}
