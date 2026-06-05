// Propagate a new <style> design-system block to every served page + the shared source.
// No build step exists, so the style block is duplicated per page; this rewrites it everywhere.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('clients/action-design-studio/site');

const NEW_STYLE = `<style>
  *,*::before,*::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { font-family: 'Barlow', sans-serif; color: #14181D; background: #fff; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
  h1,h2,h3,h4,.font-heading { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: -0.01em; }
  a { transition: color .15s ease; }
  ::selection { background: #C9A23F; color: #0A1A33; }
  /* squared, premium buttons */
  .btn-gold { display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
    background: linear-gradient(180deg,#D6AE48 0%,#C9A23F 55%,#B68C2C 100%); color: #0A1A33;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    border: 1px solid rgba(0,0,0,.08); border-radius: 2px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 8px 18px -10px rgba(201,162,63,.7);
    transition: transform .16s ease, box-shadow .16s ease, filter .16s ease; }
  .btn-gold:hover { transform: translateY(-2px); filter: brightness(1.05);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 14px 26px -12px rgba(201,162,63,.85); }
  .btn-gold:active { transform: translateY(0); }
  .btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
    border: 1px solid rgba(201,208,216,.45); color: #fff; background: transparent;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; border-radius: 2px;
    transition: transform .16s ease, border-color .16s ease, background .16s ease; }
  .btn-ghost:hover { transform: translateY(-2px); border-color: #C9A23F; background: rgba(201,162,63,.1); }
  .btn-gold:focus-visible,.btn-ghost:focus-visible { outline: 2px solid #C9A23F; outline-offset: 3px; }
  /* squared, refined cards */
  .card { background: #fff; border: 1px solid #E5E9EF; border-radius: 2px; box-shadow: 0 1px 2px rgba(10,26,51,.05);
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
  .card:hover { box-shadow: 0 18px 40px -22px rgba(10,26,51,.30); border-color: #D3DAE3; }
  .glass { background: rgba(255,255,255,.035); border: 1px solid rgba(201,208,216,.16); backdrop-filter: blur(6px); border-radius: 2px;
    transition: border-color .18s ease, background .18s ease; }
  .glass:hover { border-color: rgba(201,162,63,.35); background: rgba(255,255,255,.05); }
  .gold-text { color: #C9A23F; }
  /* depth on full-bleed sections (overrides flat utility via higher specificity) */
  section.bg-navy { background-color: #0A1A33;
    background-image: radial-gradient(1100px 480px at 82% -12%, rgba(44,92,146,.30), transparent 60%),
                      radial-gradient(820px 460px at -5% 112%, rgba(201,162,63,.07), transparent 55%); }
  footer.bg-navy { background-color: #0A1A33; }
  section.bg-mist { background-color: #EEF1F5; border-top: 1px solid #E2E7EE; border-bottom: 1px solid #E2E7EE; }
  /* form fields */
  input,textarea,select { border-radius: 2px; }
  input:focus,textarea:focus { outline: none; border-color: #C9A23F !important; box-shadow: 0 0 0 3px rgba(201,162,63,.18); }
  /* marquee */
  .marquee-track { display: flex; gap: 3.5rem; animation: marquee 30s linear infinite; white-space: nowrap; }
  @keyframes marquee { from { transform: translateX(0);} to { transform: translateX(-50%);} }
  /* scrollbar */
  ::-webkit-scrollbar { width: 11px; height: 11px; }
  ::-webkit-scrollbar-track { background: #0A1A33; }
  ::-webkit-scrollbar-thumb { background: #C9A23F; }
  ::-webkit-scrollbar-thumb:hover { background: #B68C2C; }
  @media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } html { scroll-behavior: auto; } }
</style>`;

const files = [];
(function walk(d){ for (const n of readdirSync(d)) { const p = join(d,n);
  if (statSync(p).isDirectory()) { if (n==='assets') continue; walk(p); }
  else if (n.endsWith('.html')) files.push(p);
} })(ROOT);

let changed = 0;
const re = /<style>[\s\S]*?<\/style>/;
for (const f of files) {
  const html = readFileSync(f,'utf8');
  if (!re.test(html)) { console.log('NO <style>:', f.replace(ROOT+'/','')); continue; }
  const out = html.replace(re, NEW_STYLE);
  if (out !== html) { writeFileSync(f, out); changed++; }
}
console.log(`restyled ${changed}/${files.length} files`);
