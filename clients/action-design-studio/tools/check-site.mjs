import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] || 'clients/action-design-studio/site');
const errors = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name === '_shared' || name === 'assets') continue; walk(p); }
    else if (name.endsWith('.html')) check(p);
  }
}
function check(file) {
  const html = readFileSync(file, 'utf8');
  const rel = file.replace(ROOT + '/', '');
  const must = ['<!DOCTYPE html>', '<title>', '<main', '</main>', '<header', '<footer', '/assets/site.js'];
  for (const m of must) if (!html.includes(m)) errors.push(`${rel}: missing ${m}`);
  const h1 = (html.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1) errors.push(`${rel}: expected exactly 1 <h1>, found ${h1}`);
  if (html.includes('{{')) errors.push(`${rel}: leftover {{ template token`);
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    let t = m[1];
    if (t.startsWith('/assets')) continue;
    let target = t.endsWith('/') ? join(ROOT, t, 'index.html') : join(ROOT, t);
    if (!existsSync(target)) errors.push(`${rel}: dead internal link ${t}`);
  }
}
walk(ROOT);
if (errors.length) { console.error('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('PASS — all pages valid');
