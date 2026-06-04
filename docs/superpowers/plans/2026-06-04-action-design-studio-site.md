# Action Design Studio Marketing Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Action Design Studio's own ~17-page static marketing website (Stone-Systems-style), in a silver/dark-blue/gold theme, with placeholder-but-polished content the owner can edit later.

**Architecture:** Hand-built static HTML in `clients/action-design-studio/site/`. Tailwind via CDN with an inline `tailwind.config` per page (matching `clients/saskair/site/`). No build step — shared markup lives in `_shared/*.html` reference files and is pasted into each served page. A Node validation script (`tools/check-site.mjs`) enforces structural invariants and acts as the test harness. Tiny vanilla JS (`assets/site.js`) powers nav toggle, FAQ accordion, testimonials carousel, and footer year.

**Tech Stack:** HTML5, Tailwind CSS (CDN), Google Fonts (Barlow / Barlow Condensed), vanilla JS, Node 18+ (for the validation script only).

**Spec:** `docs/superpowers/specs/2026-06-04-action-design-studio-site-design.md`

---

## How to read this plan

The site has identical chrome (head/header/footer) and repeating section shapes across
17 pages. To stay DRY *in the plan* while honoring the "no build step / repeat markup
per page" decision:

- **Section A — Shared Building Blocks** defines the head/styles/header/footer/JS **once, in full**. Task 1–2 create them as `_shared/*.html` reference files. Every page pastes them verbatim.
- **Section B — Section Pattern Library** defines each reusable section shape **once, in full**, with real Tailwind classes. Pages reference patterns by name (e.g. `PATTERN: cta-band`) and supply only the unique copy.
- **Section C — Tasks** builds the validation harness, then assembles each page by composing patterns + copy.

A page file = `_shared/head.html` (with page-specific title/desc filled) + `_shared/styles.html` + `_shared/header.html` + `<main>` of composed patterns + `_shared/footer.html` + closing `<script src="/assets/site.js">`.

**Logo note:** `assets/logo.svg` currently holds a stand-in. The **main agent (not a subagent)** must overwrite it with the real logo SVG from the kickoff-message attachment during Task 1, because only the main session has that attachment in context.

---

## Section A — Shared Building Blocks

### A1. `_shared/styles.html` (paste inside every page `<head>`, after the title/meta)

```html
<link rel="icon" type="image/svg+xml" href="/assets/logo.svg" />
<meta name="theme-color" content="#0A1A33" />
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet" />
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          navy: '#0A1A33', blue: '#16385F', 'blue-bright': '#2C5C92',
          silver: '#C9D0D8', mist: '#EEF1F5', gold: '#C9A23F',
          'gold-deep': '#A8842F', ink: '#14181D',
        },
        fontFamily: {
          heading: ['Barlow Condensed', 'Arial Narrow', 'sans-serif'],
          body: ['Barlow', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        },
        fontSize: {
          h1: ['3.25rem', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
          h2: ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
          h3: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
          body: ['1.0625rem', { lineHeight: '1.65' }],
          small: ['0.875rem', { lineHeight: '1.5' }],
          tiny: ['0.75rem', { lineHeight: '1.45', letterSpacing: '0.04em' }],
        },
      },
    },
  };
</script>
<style>
  html { scroll-behavior: smooth; }
  body { font-family: 'Barlow', sans-serif; color: #14181D; background: #fff; }
  h1, h2, h3, h4, .font-heading { font-family: 'Barlow Condensed', sans-serif; }
  .gold-text { color: #C9A23F; }
  .btn-gold { display: inline-flex; align-items: center; justify-content: center;
    gap: .5rem; background: #C9A23F; color: #0A1A33; font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; letter-spacing: .08em; text-transform: uppercase; border-radius: .5rem;
    transition: background .15s ease; }
  .btn-gold:hover { background: #A8842F; }
  .btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
    border: 1px solid rgba(201,208,216,.5); color: #fff; font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; letter-spacing: .08em; text-transform: uppercase; border-radius: .5rem;
    transition: border-color .15s ease, background .15s ease; }
  .btn-ghost:hover { border-color: #C9A23F; background: rgba(201,162,63,.08); }
  .glass { background: rgba(255,255,255,.04); border: 1px solid rgba(201,208,216,.14);
    backdrop-filter: blur(6px); border-radius: .75rem; }
  .card { background: #fff; border: 1px solid #E2E6EC; border-radius: .9rem;
    box-shadow: 0 1px 2px rgba(10,26,51,.04); }
  .marquee-track { display: flex; gap: 3rem; animation: marquee 28s linear infinite; white-space: nowrap; }
  @keyframes marquee { from { transform: translateX(0);} to { transform: translateX(-50%);} }
  @media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } html { scroll-behavior: auto; } }
</style>
```

### A2. `_shared/header.html` (first child of `<body>`)

```html
<header class="sticky top-0 inset-x-0 z-50 bg-navy/95 backdrop-blur border-b border-white/10">
  <div class="max-w-7xl mx-auto px-6">
    <div class="flex items-center justify-between py-3.5">
      <a href="/" class="flex items-center gap-3">
        <img src="/assets/logo.svg" alt="Action Design Studio" class="h-9 w-auto" />
        <span class="leading-none">
          <span class="block font-heading text-2xl tracking-wide text-white">ACTION</span>
          <span class="block text-[8px] tracking-[0.46em] gold-text font-bold mt-1">DESIGN STUDIO</span>
        </span>
      </a>
      <nav class="hidden lg:flex items-center gap-7 text-[13px] font-semibold" aria-label="Primary">
        <a href="/services/" class="text-white/85 hover:text-gold transition-colors">Services</a>
        <a href="/pricing.html" class="text-white/85 hover:text-gold transition-colors">Pricing</a>
        <a href="/work.html" class="text-white/85 hover:text-gold transition-colors">Our Work</a>
        <a href="/testimonials.html" class="text-white/85 hover:text-gold transition-colors">Testimonials</a>
        <a href="/process.html" class="text-white/85 hover:text-gold transition-colors">Process</a>
        <a href="/about.html" class="text-white/85 hover:text-gold transition-colors">About</a>
      </nav>
      <div class="flex items-center gap-4">
        <a href="tel:+16395713298" class="hidden md:flex items-center gap-2 text-sm font-bold text-white">
          <span class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]"></span>
          639-571-3298
        </a>
        <a href="/contact.html" class="btn-gold text-sm px-5 py-2.5">Book a Call</a>
        <button id="navToggle" class="lg:hidden text-white p-2" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
      </div>
    </div>
    <nav id="mobileNav" class="hidden lg:hidden pb-4 flex-col gap-1 text-sm font-semibold" aria-label="Mobile">
      <a href="/services/" class="block py-2 text-white/85 hover:text-gold">Services</a>
      <a href="/pricing.html" class="block py-2 text-white/85 hover:text-gold">Pricing</a>
      <a href="/work.html" class="block py-2 text-white/85 hover:text-gold">Our Work</a>
      <a href="/testimonials.html" class="block py-2 text-white/85 hover:text-gold">Testimonials</a>
      <a href="/process.html" class="block py-2 text-white/85 hover:text-gold">Process</a>
      <a href="/about.html" class="block py-2 text-white/85 hover:text-gold">About</a>
      <a href="/faq.html" class="block py-2 text-white/85 hover:text-gold">FAQ</a>
      <a href="/contact.html" class="block py-2 text-gold">Book a Call</a>
    </nav>
  </div>
</header>
```

### A3. `_shared/footer.html` (last child of `<body>`, before `<script>`)

```html
<footer class="bg-navy text-white">
  <div class="max-w-7xl mx-auto px-6 py-14">
    <div class="grid md:grid-cols-4 gap-10">
      <div>
        <a href="/" class="flex items-center gap-3 mb-4">
          <img src="/assets/logo.svg" alt="Action Design Studio" class="h-9 w-auto" />
          <span class="leading-none">
            <span class="block font-heading text-2xl tracking-wide">ACTION</span>
            <span class="block text-[8px] tracking-[0.46em] gold-text font-bold mt-1">DESIGN STUDIO</span>
          </span>
        </a>
        <p class="text-xs text-white/45 leading-relaxed">Agency-grade contractor marketing systems — built fast, backed by real results.</p>
        <div class="mt-5 flex gap-3">
          <!-- PLACEHOLDER: replace # with real social URLs -->
          <a href="#" class="w-9 h-9 glass flex items-center justify-center gold-text text-xs font-bold" aria-label="Facebook">f</a>
          <a href="#" class="w-9 h-9 glass flex items-center justify-center gold-text text-xs font-bold" aria-label="Instagram">ig</a>
          <a href="#" class="w-9 h-9 glass flex items-center justify-center gold-text text-xs font-bold" aria-label="YouTube">yt</a>
        </div>
      </div>
      <div>
        <h4 class="font-heading text-base tracking-widest mb-4">Company</h4>
        <ul class="space-y-2.5 text-xs text-white/45">
          <li><a href="/about.html" class="hover:text-gold transition-colors">About</a></li>
          <li><a href="/process.html" class="hover:text-gold transition-colors">Process</a></li>
          <li><a href="/work.html" class="hover:text-gold transition-colors">Our Work</a></li>
          <li><a href="/blog/" class="hover:text-gold transition-colors">Blog</a></li>
          <li><a href="/contact.html" class="hover:text-gold transition-colors">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-heading text-base tracking-widest mb-4">Services</h4>
        <ul class="space-y-2.5 text-xs text-white/45">
          <li><a href="/services/conversion-website.html" class="hover:text-gold transition-colors">Conversion Website</a></li>
          <li><a href="/services/review-engine.html" class="hover:text-gold transition-colors">5-Star Review Engine</a></li>
          <li><a href="/services/missed-call-text-back.html" class="hover:text-gold transition-colors">Missed-Call Text-Back</a></li>
          <li><a href="/services/local-seo.html" class="hover:text-gold transition-colors">Local SEO</a></li>
          <li><a href="/services/one-click-campaigns.html" class="hover:text-gold transition-colors">One-Click Campaigns</a></li>
          <li><a href="/services/all-in-one-inbox.html" class="hover:text-gold transition-colors">All-In-One Inbox</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-heading text-base tracking-widest mb-4">Get Started</h4>
        <ul class="space-y-2.5 text-xs text-white/45">
          <li><a href="/pricing.html" class="hover:text-gold transition-colors">Pricing</a></li>
          <li><a href="/contact.html" class="hover:text-gold transition-colors">Book a Call</a></li>
          <li><a href="mailto:michael@actiondesignstudio.com" class="hover:text-gold transition-colors">michael@actiondesignstudio.com</a></li>
          <li><a href="tel:+16395713298" class="hover:text-gold transition-colors">639-571-3298</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-xs text-white/35">
      <p>&copy; <span data-year>2026</span> Action Design Studio. All rights reserved.</p>
      <p class="flex gap-4"><a href="/privacy.html" class="hover:text-gold">Privacy</a><a href="/terms.html" class="hover:text-gold">Terms</a></p>
    </div>
  </div>
</footer>
```

### A4. `_shared/head.html` (template for the top of every page — fill the 3 ALL-CAPS slots)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PAGE_TITLE</title>
<meta name="description" content="PAGE_DESCRIPTION" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Action Design Studio" />
<meta property="og:title" content="PAGE_TITLE" />
<meta property="og:description" content="PAGE_DESCRIPTION" />
<meta property="og:url" content="https://actiondesignstudio.com/PAGE_PATH" />
<!-- then paste _shared/styles.html here -->
</head>
<body class="antialiased">
<!-- then paste _shared/header.html, then <main>…</main>, then _shared/footer.html -->
<script src="/assets/site.js"></script>
</body>
</html>
```

### A5. `assets/site.js`

```js
// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const mobileNav = document.getElementById('mobileNav');
if (navToggle && mobileNav) {
  navToggle.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('hidden') === false;
    mobileNav.classList.toggle('flex', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });
}
// FAQ accordion
document.querySelectorAll('[data-acc-trigger]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panel = btn.nextElementSibling;
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    panel.classList.toggle('hidden', open);
    const icon = btn.querySelector('[data-acc-icon]');
    if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(45deg)';
  });
});
// Testimonials carousel
const track = document.querySelector('[data-carousel-track]');
if (track) {
  const slides = Array.from(track.children);
  let i = 0;
  const go = (n) => { i = (n + slides.length) % slides.length; track.style.transform = `translateX(-${i * 100}%)`; };
  document.querySelector('[data-carousel-prev]')?.addEventListener('click', () => go(i - 1));
  document.querySelector('[data-carousel-next]')?.addEventListener('click', () => go(i + 1));
  let timer = setInterval(() => go(i + 1), 6000);
  track.parentElement.addEventListener('pointerenter', () => clearInterval(timer));
}
// Footer year
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
```

---

## Section B — Section Pattern Library

Each pattern is full, copy-pasteable markup. Pages list which patterns to use and the copy to fill. Replace `CAPS_SLOTS`. `<main>` wraps page sections.

### PATTERN: hero-band (dark)
```html
<section class="bg-navy text-white relative overflow-hidden">
  <div class="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_30%_20%,#C9A23F,transparent_55%)]"></div>
  <div class="max-w-7xl mx-auto px-6 py-20 md:py-28 relative">
    <p class="font-heading tracking-[0.3em] text-gold text-tiny uppercase mb-4">EYEBROW</p>
    <h1 class="font-heading text-4xl md:text-h1 max-w-3xl">HEADLINE</h1>
    <p class="mt-5 text-white/70 text-lg max-w-2xl">SUBHEAD</p>
    <div class="mt-8 flex flex-wrap gap-4">
      <a href="/contact.html" class="btn-gold px-7 py-3.5 text-sm">Book a Call</a>
      <a href="SECONDARY_HREF" class="btn-ghost px-7 py-3.5 text-sm">SECONDARY_LABEL</a>
    </div>
  </div>
</section>
```

### PATTERN: stars-badges (use inside hero or a strip)
```html
<div class="flex flex-wrap items-center gap-6 mt-10">
  <!-- PLACEHOLDER review badges — swap counts/links when live -->
  <div class="flex items-center gap-2"><span class="gold-text text-lg">★★★★★</span><span class="text-white/70 text-sm">Google <span class="text-white/40">(reviews coming soon)</span></span></div>
  <div class="flex items-center gap-2"><span class="gold-text text-lg">★★★★★</span><span class="text-white/70 text-sm">Facebook <span class="text-white/40">(reviews coming soon)</span></span></div>
</div>
```

### PATTERN: section-heading (light section)
```html
<div class="text-center max-w-2xl mx-auto mb-12">
  <p class="font-heading tracking-[0.3em] gold-text text-tiny uppercase mb-3">EYEBROW</p>
  <h2 class="font-heading text-3xl md:text-h2 text-ink">HEADING</h2>
  <p class="mt-3 text-ink/60">SUBHEAD</p>
</div>
```

### PATTERN: services-grid (6 cards)
```html
<section class="bg-white">
  <div class="max-w-7xl mx-auto px-6 py-20">
    <!-- PATTERN: section-heading here -->
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- repeat this card x6, one per service -->
      <a href="SERVICE_HREF" class="card p-7 block hover:-translate-y-1 transition-transform">
        <div class="w-11 h-11 rounded-lg bg-navy flex items-center justify-center gold-text font-heading text-xl mb-4">ICON</div>
        <h3 class="font-heading text-xl text-ink">SERVICE_NAME</h3>
        <p class="mt-2 text-ink/60 text-small">SERVICE_BLURB</p>
        <span class="mt-4 inline-block gold-text text-sm font-bold">Learn more →</span>
      </a>
    </div>
  </div>
</section>
```

### PATTERN: marquee (trades served)
```html
<section class="bg-mist border-y border-silver/40 py-7 overflow-hidden">
  <div class="marquee-track font-heading text-ink/40 text-lg tracking-wide uppercase">
    <!-- duplicate the full list twice for seamless loop -->
    <span>Roofing</span><span>HVAC</span><span>Plumbing</span><span>Landscaping</span><span>Remodeling</span><span>Electrical</span><span>Concrete</span><span>Painting</span><span>Fencing</span><span>Cleaning</span>
    <span>Roofing</span><span>HVAC</span><span>Plumbing</span><span>Landscaping</span><span>Remodeling</span><span>Electrical</span><span>Concrete</span><span>Painting</span><span>Fencing</span><span>Cleaning</span>
  </div>
</section>
```

### PATTERN: process-3step
```html
<section class="bg-white">
  <div class="max-w-7xl mx-auto px-6 py-20">
    <!-- PATTERN: section-heading -->
    <div class="grid md:grid-cols-3 gap-8">
      <!-- repeat x3 -->
      <div class="relative">
        <div class="font-heading text-5xl text-silver">01</div>
        <h3 class="font-heading text-xl text-ink mt-2">STEP_TITLE</h3>
        <p class="mt-2 text-ink/60 text-small">STEP_BODY</p>
      </div>
    </div>
  </div>
</section>
```

### PATTERN: why-us-grid (feature bullets)
```html
<section class="bg-navy text-white">
  <div class="max-w-7xl mx-auto px-6 py-20">
    <!-- section-heading variant on dark: use text-white / text-white/60 -->
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- repeat per differentiator -->
      <div class="glass p-6">
        <div class="gold-text font-heading text-lg mb-2">✦ ITEM_TITLE</div>
        <p class="text-white/60 text-small">ITEM_BODY</p>
      </div>
    </div>
  </div>
</section>
```

### PATTERN: testimonials-carousel
```html
<section class="bg-mist">
  <div class="max-w-5xl mx-auto px-6 py-20">
    <!-- PATTERN: section-heading -->
    <div class="relative overflow-hidden">
      <div data-carousel-track class="flex transition-transform duration-500">
        <!-- repeat slide; PLACEHOLDER content until real reviews arrive -->
        <figure class="min-w-full px-2">
          <div class="card p-8 text-center max-w-2xl mx-auto">
            <div class="gold-text text-xl mb-4">★★★★★</div>
            <blockquote class="text-ink text-lg italic">“QUOTE_PLACEHOLDER — your real customer testimonial will appear here.”</blockquote>
            <figcaption class="mt-5 flex items-center justify-center gap-3">
              <span class="w-10 h-10 rounded-full bg-silver/60"></span>
              <span class="text-left"><span class="block font-bold text-ink text-sm">Client Name</span><span class="block text-ink/50 text-xs">Trade · City</span></span>
            </figcaption>
          </div>
        </figure>
      </div>
      <button data-carousel-prev class="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 card flex items-center justify-center" aria-label="Previous testimonial">‹</button>
      <button data-carousel-next class="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 card flex items-center justify-center" aria-label="Next testimonial">›</button>
    </div>
    <!-- ===================================================================
         LIVE REVIEW WIDGET DROP-IN
         Paste your Google / Trustindex / Elfsight embed code below, then
         delete the placeholder carousel above. The container is pre-styled.
    ==================================================================== -->
    <div id="live-reviews" class="mt-10"><!-- LIVE REVIEW WIDGET EMBED GOES HERE --></div>
  </div>
</section>
```

### PATTERN: faq-accordion (one item; repeat per Q)
```html
<div class="card divide-y divide-silver/40">
  <!-- repeat item -->
  <div>
    <button data-acc-trigger aria-expanded="false" class="w-full flex items-center justify-between text-left p-5 font-heading text-lg text-ink">
      <span>QUESTION</span>
      <span data-acc-icon class="gold-text text-2xl leading-none transition-transform">+</span>
    </button>
    <div class="hidden px-5 pb-5 text-ink/65 text-small">ANSWER</div>
  </div>
</div>
```

### PATTERN: cta-band
```html
<section class="bg-navy text-white">
  <div class="max-w-4xl mx-auto px-6 py-20 text-center">
    <h2 class="font-heading text-3xl md:text-h2">CTA_HEADLINE</h2>
    <p class="mt-3 text-white/70">CTA_SUB</p>
    <div class="mt-8 flex flex-wrap justify-center gap-4">
      <a href="/contact.html" class="btn-gold px-8 py-4 text-sm">Book a Call</a>
      <a href="tel:+16395713298" class="btn-ghost px-8 py-4 text-sm">639-571-3298</a>
    </div>
  </div>
</section>
```

### PATTERN: pricing-tier (one card; repeat x3)
```html
<div class="card p-8 flex flex-col HIGHLIGHT_CLASSES">
  <p class="font-heading text-tiny tracking-[0.25em] uppercase text-ink/50">TIER_NAME</p>
  <div class="mt-3"><span class="font-heading text-4xl text-ink">$PLACEHOLDER</span><span class="text-ink/50 text-sm">/mo</span></div>
  <p class="mt-1 text-ink/50 text-xs">⚠ placeholder price — edit in pricing.html</p>
  <p class="mt-4 text-ink/60 text-small">TIER_BLURB</p>
  <ul class="mt-5 space-y-2 text-small text-ink/70 flex-1">
    <li class="flex gap-2"><span class="gold-text">✓</span> FEATURE</li>
  </ul>
  <a href="/contact.html" class="btn-gold w-full mt-6 py-3 text-sm">Book a Call</a>
</div>
```
> Middle (Growth) tier `HIGHLIGHT_CLASSES` = `ring-2 ring-gold relative` and add `<span class="absolute -top-3 left-1/2 -translate-x-1/2 btn-gold text-xs px-3 py-1 rounded-full">Most Popular</span>`.

### PATTERN: portfolio-card (Our Work; repeat in grid)
```html
<div class="card overflow-hidden">
  <div class="aspect-[16/10] bg-mist flex items-center justify-center text-ink/30 text-sm">screenshot placeholder</div>
  <div class="p-5">
    <h3 class="font-heading text-lg text-ink">PROJECT_NAME <span class="text-ink/30 text-xs">(sample)</span></h3>
    <p class="text-ink/55 text-small">TRADE · CITY</p>
    <p class="mt-2 gold-text text-sm font-bold">RESULT_STAT</p>
  </div>
</div>
```

### PATTERN: service-detail-body (used by each /services/*.html)
```html
<section class="bg-white">
  <div class="max-w-4xl mx-auto px-6 py-20">
    <h2 class="font-heading text-3xl text-ink">What it is</h2>
    <p class="mt-3 text-ink/65">WHAT_PARAGRAPH</p>
    <h2 class="font-heading text-3xl text-ink mt-12">Why it matters</h2>
    <ul class="mt-4 space-y-3">
      <li class="flex gap-3"><span class="gold-text">✓</span><span class="text-ink/70">BENEFIT_1</span></li>
      <li class="flex gap-3"><span class="gold-text">✓</span><span class="text-ink/70">BENEFIT_2</span></li>
      <li class="flex gap-3"><span class="gold-text">✓</span><span class="text-ink/70">BENEFIT_3</span></li>
    </ul>
    <div class="mt-10 card p-6 bg-mist">
      <p class="font-heading text-ink text-lg">The outcome</p>
      <p class="text-ink/65 mt-1">OUTCOME_LINE</p>
    </div>
  </div>
</section>
```

---

## Section C — Tasks

### Task 1: Scaffold, real logo, validation harness

**Files:**
- Create: `clients/action-design-studio/site/robots.txt`
- Create: `clients/action-design-studio/site/README.md`
- Create: `clients/action-design-studio/tools/check-site.mjs`
- Overwrite: `clients/action-design-studio/site/assets/logo.svg` (real logo — **main agent only**)

- [ ] **Step 1: Overwrite the logo with the real SVG (MAIN AGENT, not subagent).** The main session pastes the exact logo SVG from the kickoff-message attachment into `clients/action-design-studio/site/assets/logo.svg`, replacing the stand-in. Verify it opens and shows the wordmark.

- [ ] **Step 2: Create `robots.txt`:**
```
User-agent: *
Allow: /
Sitemap: https://actiondesignstudio.com/sitemap.xml
```

- [ ] **Step 3: Create `README.md`** listing every editable placeholder (logo done; prices in `pricing.html`; screenshots in `work.html`; real quotes / live widget in `testimonials.html` + home; social URLs in `_shared/footer.html`; Formspree endpoint in `contact.html`; founder bio in `about.html`; legal company details in `privacy.html`/`terms.html`) and the swap instructions.

- [ ] **Step 4: Create the validation harness `tools/check-site.mjs`:**
```js
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

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
  // internal link resolution
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
```

- [ ] **Step 5: Run the harness (no pages yet).**
Run: `node clients/action-design-studio/tools/check-site.mjs`
Expected: `PASS — all pages valid` (0 pages, exit 0).

- [ ] **Step 6: Commit.**
```bash
git add clients/action-design-studio
git commit -m "feat(ads-site): scaffold, real logo, validation harness"
```

### Task 2: Shared building blocks

**Files:** Create `_shared/styles.html`, `_shared/header.html`, `_shared/footer.html`, `_shared/head.html`, `assets/site.js` (all under `clients/action-design-studio/site/`).

- [ ] **Step 1:** Create each `_shared/*.html` with the exact markup from Section A1–A4, and `assets/site.js` from A5.
- [ ] **Step 2: Sanity check the JS parses.**
Run: `node --check clients/action-design-studio/site/assets/site.js`
Expected: no output, exit 0.
- [ ] **Step 3: Commit.**
```bash
git add clients/action-design-studio/site/_shared clients/action-design-studio/site/assets/site.js
git commit -m "feat(ads-site): shared head/header/footer/styles + site.js"
```

### Task 3: Home page (`index.html`)

**Files:** Create `clients/action-design-studio/site/index.html`.

- [ ] **Step 1: Assemble `index.html`** from `_shared` blocks + these sections in order:
  - **head:** title `Action Design Studio | Marketing Systems That Get Contractors Booked`; description `Websites, reviews, and automation that turn local contractors into the obvious choice. Built fast, backed by real results.`; path `` (root).
  - **PATTERN: hero-band** — EYEBROW `MARKETING SYSTEMS FOR CONTRACTORS`; HEADLINE `Stop chasing leads. Become the contractor everyone calls.`; SUBHEAD `We build the website, reviews, and follow-up system that makes your phone ring — and we back every claim with real results, not promises.`; SECONDARY_HREF `/services/`; SECONDARY_LABEL `See What We Do`. Include **PATTERN: stars-badges** inside the hero.
  - **PATTERN: services-grid** — section-heading EYEBROW `WHAT WE BUILD` / HEADING `One system. Six moving parts.` / SUBHEAD `Each piece works on its own. Together they make you unbeatable locally.` Cards (name / blurb / href / ICON letter):
    1. Conversion Website / `A fast, bespoke site built to turn visitors into booked jobs.` / `/services/conversion-website.html` / W
    2. 5-Star Review Engine / `Automatically turn happy customers into public 5-star reviews.` / `/services/review-engine.html` / ★
    3. Missed-Call Text-Back / `Every missed call gets an instant auto-text so no lead goes cold.` / `/services/missed-call-text-back.html` / T
    4. Local SEO / `Rank in the local map pack for your trade and city.` / `/services/local-seo.html` / S
    5. One-Click Campaigns / `Blast seasonal offers to your whole customer list in one click.` / `/services/one-click-campaigns.html` / C
    6. All-In-One Inbox / `Calls, texts, emails, web chat, and DMs in a single inbox.` / `/services/all-in-one-inbox.html` / I
  - **PATTERN: marquee** (trades served).
  - **PATTERN: process-3step** — heading EYEBROW `HOW IT WORKS` / `Live in days, not months.` Steps: 01 `Book a call` / `We learn your trade, your market, and your goals on a quick demo call.` — 02 `We build your system` / `We design and assemble your site and automations — backed by real assets and reviews.` — 03 `You launch` / `Go live, start capturing leads, and watch the system work while you work.`
  - **PATTERN: why-us-grid** — heading `Why contractors pick us`. Items: `Evidence-backed` / `Every claim on your site traces to a real review or a real photo — never stock.`; `Built fast` / `Agency-grade sites shipped in days, not months.`; `No long contracts` / `Stay because it works, not because you're locked in.`; `Done-for-you` / `We build and run the system so you can stay on the tools.`; `Local-first` / `Everything is tuned to win your city, your trade.`; `One partner` / `Website, reviews, SEO, and follow-up under one roof.`
  - **PATTERN: testimonials-carousel** (3 placeholder slides).
  - **PATTERN: faq-accordion** teaser — 3 items (see Task 11 for copy; reuse first 3) + a centered `<a href="/faq.html" class="...">See all FAQs →</a>`.
  - **PATTERN: cta-band** — CTA_HEADLINE `Ready to be the contractor everyone calls?`; CTA_SUB `Book a free 15-minute call. We'll show you exactly what your system would look like.`
- [ ] **Step 2: Validate.** Run: `node clients/action-design-studio/tools/check-site.mjs` — Expected: `PASS`.
- [ ] **Step 3: Visual spot-check (optional).** Open `index.html` in a browser; confirm hero, gold CTAs, nav, footer render.
- [ ] **Step 4: Commit.**
```bash
git add clients/action-design-studio/site/index.html
git commit -m "feat(ads-site): home page"
```

### Task 4: Services index + 6 detail pages

**Files:** Create `services/index.html` and `services/{conversion-website,review-engine,missed-call-text-back,local-seo,one-click-campaigns,all-in-one-inbox}.html`.

- [ ] **Step 1: `services/index.html`** — head title `Services | Action Design Studio`, desc `The six pieces of a contractor marketing system: website, reviews, missed-call text-back, local SEO, campaigns, and inbox.`, path `services/`. Sections: **hero-band** (EYEBROW `SERVICES` / HEADLINE `Everything you need to dominate your local market.` / SUBHEAD `Six services, one system. Start with what you need most.` / SECONDARY_HREF `/pricing.html` / SECONDARY_LABEL `See Pricing`); **services-grid** (same 6 cards as home); **cta-band** (`Not sure where to start?` / `Book a call and we'll tell you which piece moves the needle first.`).
- [ ] **Step 2: Each detail page** — head title `SERVICE_NAME | Action Design Studio`, path `services/SLUG.html`. Sections: **hero-band** (EYEBROW `SERVICE` / HEADLINE = service promise / SUBHEAD = one line / SECONDARY_HREF `/services/` / SECONDARY_LABEL `All Services`); **PATTERN: service-detail-body** with the copy below; a small "related services" row of 2 links; **cta-band** (`Want this running for your business?` / `Book a call.`). Copy per service:

| Slug | Promise (HEADLINE) | WHAT_PARAGRAPH | BENEFIT_1 / 2 / 3 | OUTCOME_LINE |
|---|---|---|---|---|
| conversion-website | A website built to book jobs, not win awards. | A fast, mobile-first site designed around one goal: turning a visitor into a booked call. Real photos, real reviews, clear calls to action on every screen. | Loads fast on phones where your customers actually are / Built around your trade and service area / Clear "call now" and quote paths everywhere | More of the people who find you actually call you. |
| review-engine | Turn happy customers into a wall of 5-star reviews. | An automated funnel that asks every satisfied customer for a review at the right moment and routes them straight to Google or Facebook. | Sends review requests automatically after a job / Routes happy customers to public reviews / Helps you rank and build trust at once | A steady stream of fresh 5-star reviews without chasing anyone. |
| missed-call-text-back | Never lose a job to a missed call again. | When you can't pick up, the system instantly texts the caller back so the conversation — and the job — stays alive. | Auto-texts every missed call in seconds / Keeps leads warm while you're on the tools / Captures jobs that used to go to voicemail | Fewer missed calls turn into lost jobs. |
| local-seo | Show up first when locals search your trade. | We optimize your site and Google profile so you rank in the local map pack for the searches that bring in work. | Targets your trade + city keywords / Optimizes your Google Business Profile / Builds the local signals that rank | You become the obvious local choice in search. |
| one-click-campaigns | Fill slow weeks with one click. | Send seasonal offers, tune-up reminders, and promos to your entire customer list — by text and email — in a single click. | Reach your whole list instantly / Pre-built seasonal campaign templates / Bring back past customers on demand | Turn your existing customer list into repeat revenue. |
| all-in-one-inbox | Every message in one place. | Calls, texts, emails, web chat, and social DMs land in a single inbox so nothing slips through the cracks. | One inbox for every channel / Respond faster, win more jobs / Full history on every customer | Faster replies and zero dropped conversations. |

- [ ] **Step 3: Validate.** Run: `node clients/action-design-studio/tools/check-site.mjs` — Expected: `PASS`.
- [ ] **Step 4: Commit.**
```bash
git add clients/action-design-studio/site/services
git commit -m "feat(ads-site): services index + 6 detail pages"
```

### Task 5: Pricing (`pricing.html`)

**Files:** Create `pricing.html`.
- [ ] **Step 1:** head title `Pricing | Action Design Studio`, desc `Simple, transparent pricing for contractor marketing systems. No long contracts.`, path `pricing.html`. Sections: **hero-band** (EYEBROW `PRICING` / HEADLINE `Simple pricing. No long contracts.` / SUBHEAD `Pick a plan or book a call for a custom quote.` / SECONDARY_HREF `/services/` / SECONDARY_LABEL `See Services`); a 3-column grid of **PATTERN: pricing-tier**:
  - Starter — `$PLACEHOLDER` — `For contractors who need a pro website that books jobs.` — features: Conversion website / Mobile-first design / Contact + quote forms / Basic local SEO.
  - Growth (**Most Popular**, highlight classes) — `$PLACEHOLDER` — `Website plus the systems that make your phone ring.` — features: Everything in Starter / 5-Star Review Engine / Missed-Call Text-Back / All-In-One Inbox.
  - Pro — `$PLACEHOLDER` — `The full system, fully managed.` — features: Everything in Growth / Local SEO program / One-Click Campaigns / Priority support.
  - Below grid: a centered note `Prices are placeholders — edit them in pricing.html. Not sure which plan fits? <a href="/contact.html" class="gold-text font-bold">Book a call.</a>`
  - **faq-accordion** teaser (reuse 3 pricing-related Qs from Task 11) + **cta-band** (`Let's price your system.` / `Book a free call.`).
- [ ] **Step 2: Validate** → Expected `PASS`. **Step 3: Commit** `feat(ads-site): pricing page`.

### Task 6: Our Work (`work.html`)

**Files:** Create `work.html`.
- [ ] **Step 1:** head title `Our Work | Action Design Studio`, desc `Recent contractor websites and marketing systems we've built.`, path `work.html`. Sections: **hero-band** (EYEBROW `OUR WORK` / HEADLINE `Built for contractors who mean business.` / SUBHEAD `A look at the kind of work we ship. Real case studies coming soon.` / SECONDARY_HREF `/contact.html` / SECONDARY_LABEL `Start Your Project`); a `grid md:grid-cols-2 lg:grid-cols-3 gap-6` of 6 **PATTERN: portfolio-card** (sample: `Sample Roofing Co.` / `Roofing · Regina` / `+38% calls in 60 days`; `Prairie HVAC` / `HVAC · Saskatoon` / `2× booked jobs`; `North Plumbing` / `Plumbing · Regina` / `4.9★ in 90 days`; `Greenline Landscaping` / `Landscaping · Moose Jaw` / `Fully booked season`; `Capstone Remodeling` / `Remodeling · Regina` / `+52 leads/mo`; `Bright Spark Electric` / `Electrical · Saskatoon` / `Top-3 map pack`); a centered muted note `Sample projects shown — your real case studies will replace these.`; **cta-band** (`Want results like these?` / `Book a call.`).
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): our work page`.

### Task 7: Testimonials (`testimonials.html`)

**Files:** Create `testimonials.html`.
- [ ] **Step 1:** head title `Testimonials | Action Design Studio`, desc `What contractors say about working with Action Design Studio.`, path `testimonials.html`. Sections: **hero-band** (EYEBROW `TESTIMONIALS` / HEADLINE `Don't take our word for it.` / SUBHEAD `Real reviews from real contractors — coming soon as we launch.` / SECONDARY_HREF `/work.html` / SECONDARY_LABEL `See Our Work`); a `grid md:grid-cols-2 lg:grid-cols-3 gap-6` of 6 placeholder testimonial cards (same card body as in **testimonials-carousel** slide but static grid items, each clearly a placeholder quote); then the **LIVE REVIEW WIDGET DROP-IN** comment block + `<div id="live-reviews">` exactly as in the pattern; **cta-band** (`Be one of our success stories.` / `Book a call.`).
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): testimonials page + live widget slot`.

### Task 8: Process (`process.html`)

**Files:** Create `process.html`.
- [ ] **Step 1:** head title `Our Process | Action Design Studio`, desc `How we take you from demo call to a live marketing system in days.`, path `process.html`. Sections: **hero-band** (EYEBROW `PROCESS` / HEADLINE `From call to launch in days.` / SUBHEAD `A clear, done-for-you process with no guesswork.` / SECONDARY_HREF `/pricing.html` / SECONDARY_LABEL `See Pricing`); **process-3step** (same 3 steps as home, expanded bodies); a `why-us-grid`-style "What you get" block (3 items: `A system you own`, `Documented build`, `A real launch plan`); **cta-band** (`Ready to start?` / `Book your demo call.`).
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): process page`.

### Task 9: About (`about.html`)

**Files:** Create `about.html`.
- [ ] **Step 1:** head title `About | Action Design Studio`, desc `Action Design Studio builds evidence-backed marketing systems for local contractors.`, path `about.html`. Sections: **hero-band** (EYEBROW `ABOUT` / HEADLINE `We build marketing that contractors can actually trust.` / SUBHEAD `No jargon, no stock photos, no empty promises — just systems that get you booked.` / SECONDARY_HREF `/contact.html` / SECONDARY_LABEL `Get in Touch`); a prose "Our story" section (2–3 short paragraphs: founded to bring agency-grade marketing to local contractors; every site backed by real reviews and real photos; the whole build documented so you can see exactly what you got); a "Mission" callout card; a founder block with **PLACEHOLDER** photo circle + `Michael` + `Founder` + bio placeholder line; **cta-band** (`Let's build yours.` / `Book a call.`).
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): about page`.

### Task 10: Blog (`blog/index.html`)

**Files:** Create `blog/index.html`.
- [ ] **Step 1:** head title `Blog | Action Design Studio`, desc `Marketing tips and playbooks for local contractors. Coming soon.`, path `blog/`. Sections: **hero-band** (EYEBROW `BLOG` / HEADLINE `Contractor marketing playbooks.` / SUBHEAD `Practical tips to get more jobs. New posts coming soon.` / SECONDARY_HREF `/contact.html` / SECONDARY_LABEL `Book a Call`); a centered "coming soon" empty-state card (`No posts yet — we're cooking up something useful. Check back soon.`); an HTML-commented post-card template for future use:
```html
<!-- POST CARD TEMPLATE — duplicate per post when blog launches
<a href="/blog/SLUG.html" class="card overflow-hidden block">
  <div class="aspect-[16/9] bg-mist"></div>
  <div class="p-5"><p class="text-tiny tracking-widest uppercase gold-text">CATEGORY</p>
  <h3 class="font-heading text-lg text-ink mt-1">POST_TITLE</h3>
  <p class="text-ink/55 text-small mt-1">EXCERPT</p></div>
</a> -->
```
  ; **cta-band** (`Want help now, not later?` / `Book a call.`).
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): blog index (coming soon)`.

### Task 11: FAQ (`faq.html`)

**Files:** Create `faq.html`.
- [ ] **Step 1:** head title `FAQ | Action Design Studio`, desc `Answers to common questions about our contractor marketing systems.`, path `faq.html`. Sections: **hero-band** (EYEBROW `FAQ` / HEADLINE `Questions, answered.` / SUBHEAD `Everything you need to know before we talk.` / SECONDARY_HREF `/contact.html` / SECONDARY_LABEL `Book a Call`); a `max-w-3xl mx-auto` **faq-accordion** with these items:
  1. *How fast can my site go live?* — Most sites launch in days, not months. After our call we build your system and hand you a launch date up front.
  2. *Do I have to sign a long contract?* — No. You stay because the system works, not because you're locked in.
  3. *How much does it cost?* — See our pricing page for plans, or book a call for a custom quote. We're upfront about price before you commit.
  4. *Which trades do you work with?* — Roofing, HVAC, plumbing, landscaping, remodeling, electrical, and most local home-service trades.
  5. *What's included in a marketing system?* — A conversion website plus the pieces you choose: reviews, missed-call text-back, local SEO, campaigns, and a unified inbox.
  6. *Do I own my website?* — Yes. The site and your content are yours.
  7. *Do you use stock photos?* — No. We build around your real photos and real reviews — that's the whole point.
  8. *When will I see results?* — It varies by trade and market, but the systems start capturing leads the day you launch.
  ; **cta-band** (`Still have questions?` / `Book a free call and ask away.`).
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): faq page`.

### Task 12: Contact (`contact.html`)

**Files:** Create `contact.html`.
- [ ] **Step 1:** head title `Contact | Action Design Studio`, desc `Book a call or send a message. We'll show you what your marketing system could look like.`, path `contact.html`. Sections: **hero-band** (EYEBROW `CONTACT` / HEADLINE `Let's get your phone ringing.` / SUBHEAD `Book a free 15-minute call or send a message — we reply fast.` / SECONDARY_HREF `tel:+16395713298` / SECONDARY_LABEL `Call 639-571-3298`); then a 2-column section:
```html
<section class="bg-white"><div class="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12">
  <div>
    <h2 class="font-heading text-3xl text-ink">Send a message</h2>
    <!-- PLACEHOLDER: replace REPLACE_ME with your Formspree form ID -->
    <form action="https://formspree.io/f/REPLACE_ME" method="POST" class="mt-6 space-y-4">
      <div><label for="name" class="block text-sm font-bold text-ink mb-1">Name</label>
        <input id="name" name="name" required class="w-full card px-4 py-3 text-ink" /></div>
      <div><label for="business" class="block text-sm font-bold text-ink mb-1">Business</label>
        <input id="business" name="business" class="w-full card px-4 py-3 text-ink" /></div>
      <div><label for="email" class="block text-sm font-bold text-ink mb-1">Email</label>
        <input id="email" name="email" type="email" required class="w-full card px-4 py-3 text-ink" /></div>
      <div><label for="phone" class="block text-sm font-bold text-ink mb-1">Phone</label>
        <input id="phone" name="phone" type="tel" class="w-full card px-4 py-3 text-ink" /></div>
      <div><label for="message" class="block text-sm font-bold text-ink mb-1">Message</label>
        <textarea id="message" name="message" rows="4" required class="w-full card px-4 py-3 text-ink"></textarea></div>
      <button type="submit" class="btn-gold w-full py-3.5 text-sm">Send Message</button>
    </form>
  </div>
  <div>
    <h2 class="font-heading text-3xl text-ink">Reach us directly</h2>
    <ul class="mt-6 space-y-4 text-ink/75">
      <li><span class="font-bold text-ink">Email</span><br><a href="mailto:michael@actiondesignstudio.com" class="gold-text">michael@actiondesignstudio.com</a></li>
      <li><span class="font-bold text-ink">Phone</span><br><a href="tel:+16395713298" class="gold-text">639-571-3298</a></li>
    </ul>
    <a href="tel:+16395713298" class="btn-gold mt-8 px-7 py-3.5 text-sm">Book a Call</a>
  </div>
</div></section>
```
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): contact page (Formspree-ready)`.

### Task 13: Legal stubs (`privacy.html`, `terms.html`)

**Files:** Create `privacy.html`, `terms.html`.
- [ ] **Step 1:** Each: head title `Privacy Policy | Action Design Studio` / `Terms of Service | Action Design Studio`, matching desc, path. A simple **hero-band** (no secondary CTA — point SECONDARY_HREF `/contact.html`, label `Contact`) + a `max-w-3xl mx-auto px-6 py-16 prose-style` block of standard, readable legal text with **PLACEHOLDER** slots for company legal name, contact email (`michael@actiondesignstudio.com`), and effective date (`Effective date: PLACEHOLDER`). Privacy covers: what we collect (contact form data), how we use it, no selling of data, contact to request deletion. Terms covers: use of site, no guarantee of specific results, IP ownership, governing law placeholder.
- [ ] **Step 2: Validate** → `PASS`. **Step 3: Commit** `feat(ads-site): privacy + terms stubs`.

### Task 14: Sitemap + final integration check

**Files:** Create `sitemap.xml`; finalize `README.md`.
- [ ] **Step 1: Create `sitemap.xml`** listing all 17 public URLs (`/`, `/services/`, 6 service pages, `/pricing.html`, `/work.html`, `/testimonials.html`, `/process.html`, `/about.html`, `/blog/`, `/faq.html`, `/contact.html`, `/privacy.html`, `/terms.html`) with `https://actiondesignstudio.com` prefixes.
- [ ] **Step 2: Run full validation.**
Run: `node clients/action-design-studio/tools/check-site.mjs`
Expected: `PASS — all pages valid` (every page present, no dead internal links, exactly one h1 each, no leftover tokens).
- [ ] **Step 3: Grep for unfilled slots.**
Run: `grep -rIn -E "PAGE_TITLE|PAGE_DESCRIPTION|HEADLINE|EYEBROW|SLUG|CAPS_SLOT|SERVICE_NAME" clients/action-design-studio/site --include=*.html | grep -v "_shared"`
Expected: no output (every pattern slot was filled). Intentional, documented placeholders (`$PLACEHOLDER`, `REPLACE_ME`, `(sample)`, `coming soon`, `PLACEHOLDER`) are allowed.
- [ ] **Step 4: Finalize `README.md`** placeholder checklist and confirm each item is accurate.
- [ ] **Step 5: Commit.**
```bash
git add clients/action-design-studio/site/sitemap.xml clients/action-design-studio/site/README.md
git commit -m "feat(ads-site): sitemap + final integration check"
```

---

## Self-Review

**Spec coverage:** build approach ✓ (T1–2), palette/wordmark ✓ (A1, A2), 6 services ✓ (T4), all 17 pages ✓ (T3–T13 + sitemap T14), testimonials placeholder + widget slot ✓ (T7 + pattern), Formspree contact ✓ (T12), 3 placeholder pricing tiers ✓ (T5), accessibility (one h1, labelled inputs, aria on nav/accordion, alt text) ✓ (patterns + check-site h1 rule), placeholders documented ✓ (README T1/T14), robots+sitemap ✓ (T1/T14), reduced-motion ✓ (A1). No gaps found.

**Placeholder scan:** No plan-level "TBD/TODO/implement later". All code/copy is concrete. Intentional *site-content* placeholders (prices, screenshots, real quotes, social URLs, Formspree ID, founder bio) are explicit, marked, and tracked in README — these are deliberate product placeholders, not plan gaps.

**Type/name consistency:** Service slugs identical across header nav, footer, home grid, services index, detail pages, and sitemap (conversion-website, review-engine, missed-call-text-back, local-seo, one-click-campaigns, all-in-one-inbox). JS hooks consistent: `navToggle`/`mobileNav`, `data-acc-trigger`/`data-acc-icon`, `data-carousel-track`/`-prev`/`-next`, `data-year` — defined in A5, used in A2/A3 and patterns. Validation command path consistent throughout.
