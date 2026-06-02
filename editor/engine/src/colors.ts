// Matches `name: '#hex'` or `'quoted-name': "#hex"` inside the colors block.
const COLOR_PAIR = /(['"]?)([A-Za-z0-9-]+)\1\s*:\s*(['"])(#[0-9A-Fa-f]{3,8})\3/g;

function colorsBlock(html: string): string | null {
  const m = html.match(/colors\s*:\s*\{/);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return depth === 0 ? html.slice(start, i - 1) : null;
}

export function readColors(html: string): Record<string, string> {
  const block = colorsBlock(html);
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const match of block.matchAll(COLOR_PAIR)) {
    out[match[2]] = match[4];
  }
  return out;
}

export function rewriteColors(html: string, updates: Record<string, string>): string {
  const block = colorsBlock(html);
  if (!block) return html;
  const newBlock = block.replace(COLOR_PAIR, (full, q1, name, q2, hex) =>
    name in updates ? `${q1}${name}${q1}: ${q2}${updates[name]}${q2}` : full
  );
  return html.replace(block, newBlock);
}
