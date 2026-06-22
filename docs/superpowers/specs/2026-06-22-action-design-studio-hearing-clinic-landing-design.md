# Action Design Studio — Hearing-Clinic Patient-Recovery Landing Page

**Date:** 2026-06-22
**Status:** Approved — ready for implementation
**File touched:** `clients/action-design-studio/site/index.html` (full overwrite)

---

## 1. Goal & repositioning

Reposition Action Design Studio's homepage from a generic contractor-marketing studio
into a **specialist patient-recovery system for independent hearing clinics / audiology
practices**. The page must read as built by someone inside the audiology world.

**The one and only conversion goal:** book a free 15-minute "Patient Recovery Audit."
Every section ends pointing at this. ONE primary CTA wording everywhere:
**"Book your free Patient Recovery Audit →"** → `[BOOKING_LINK]`.
Single secondary micro-CTA: the ROI calculator.

**Audience:** owner of an independent hearing clinic (Au.D. / hearing-instrument
specialist, ~45–65), busy, proud of patient care, skeptical of marketers, pressured by
OTC hearing aids and Costco. They want a full schedule of qualified evaluations.

**Core message (spine of every section):** "You already spent the money to get these
patients in the door once. We bring them back — and you only pay when it books
evaluations." Sell recovery of existing patients (tested-not-sold, upgrade-due,
annual-recall), not new-patient ads.

---

## 2. Placement & scope decisions

- **Replace root `index.html`.** New landing is the primary experience at the site root.
- **Self-contained page.** Does NOT use the existing `_shared/` multi-page header/footer
  (they link to the old generic pages and contradict the new positioning). The page ships
  its own sticky header (wordmark · phone · one CTA) and its own minimal footer.
- **Old sub-pages** (about, pricing, work, services, faq, etc.) are left untouched in this
  pass — reworked later.
- **Stack:** static HTML + Tailwind via CDN (matches existing Vercel static-deploy
  pipeline). ROI calculator is vanilla client-side JS with live updates. No build step.

---

## 3. Design system (this page only)

- **Colors:** navy `#0E2A47` (primary), teal/blue accent `#2E8BC0`, warm off-white/cream
  backgrounds (`#FBF8F3` / `#FFFFFF`), and ONE warm action color `#E8A33D` (amber) for all
  buttons/CTAs. No neon, no gradients-as-gimmick, no dark-edgy look.
- **Typography:** Inter (Google Fonts). Base **18px** body. Strong, large heading
  hierarchy. Humanist, calm, premium "specialist healthcare consultancy" feel.
- **Layout:** generous whitespace, single-column on mobile, ~1100px max content width,
  clear vertical rhythm, large buttons with obvious affordance.
- **Implementation:** Tailwind CDN + inline `tailwind.config` mapping the tokens, plus a
  small `<style>` block for button styles, focus rings, and the FAQ accordion.

---

## 4. Sections (build in this order; copy is exact)

- **(A) Sticky header** — left: "Action Design Studio" wordmark (small, clean). Right:
  phone `[PHONE]` + button "Book your free Patient Recovery Audit →".
- **(B) Hero**
  - H1: *The patients you already tested are worth six figures. We bring them back.*
  - Subhead: *Action Design Studio helps independent hearing clinics recover
    tested-not-sold and upgrade-due patients from their existing database — booked
    straight onto your calendar. No new ad spend. You only pay when it books evaluations.*
  - Primary CTA + trust strip: *HIPAA-conscious · Works with Sycle, Blueprint OMS &
    CounselEAR · Built only for hearing care.*
  - Visual: results-dashboard mockup ("Evaluations booked this month: [XX]"),
    placeholder labeled `[DASHBOARD_SCREENSHOT]`.
- **(C) Proof band** — one testimonial slot, clearly labeled PLACEHOLDER:
  *"[In 14 days we booked 11 evaluations from our existing patient list.]" — [Owner Name],
  [Clinic Name], [City]*. Optional logo-row placeholder: *Trusted by independent clinics
  using [Sycle / Blueprint OMS / CounselEAR].*
- **(D) The leak — "Where independent hearing clinics lose money"** — four cards:
  1. 97% of tested-not-sold patients never come back — not because they bought elsewhere,
     but because no one followed up. (Source: Hearing Review, 500-patient study.)
  2. Upgrade-due patients drift to OTC and Costco while their 4-year-old aids fail —
     because no one reminded them.
  3. Roughly 1 in 5 evaluations no-shows — and most are never rebooked.
  4. New leads sit unanswered while the clinic across town texts back in five minutes.
- **(E) How it works — 3 steps**
  1. We pull your lists from Sycle, Blueprint OMS, or CounselEAR — tested-not-sold,
     upgrade-due, warranty-expiring.
  2. We run a respectful, multi-channel recovery — voicemail, text, email, and a
     front-desk call list — inviting patients in for a complimentary hearing check.
  3. Patients book themselves onto your calendar. You just watch evaluations appear.
- **(F) Always-on system** — heading: *After the recovery, we keep your schedule full —
  automatically.* Bullets: 5-minute response on every new lead and missed call ·
  No-show rescue · Monthly recall reactivation · Review generation · All HIPAA-conscious,
  all done for you.
- **(G) ROI calculator (interactive)** — heading: *How much is your tested-not-sold list
  worth?* See §5.
- **(H) Risk reversal** (bold, centered, own band): *We only get paid when it works. If
  your first recovery campaign doesn't book at least 8 evaluations in 21 days, you don't
  pay. Simple as that.*
- **(I) About / founder** — *Action Design Studio is run by [FOUNDER NAME]. We work with
  one kind of business — independent hearing clinics — because the patients you've already
  tested are the most overlooked revenue in your practice, and almost no one is helping you
  recover them. We build the system, we run it, and we tie our pay to your results.*
  Include `[FOUNDER_PHOTO]` and `[CITY]`.
- **(J) FAQ (accordion)** — five Q&A pairs (exact copy in brief):
  buying group / older patients & texts / HIPAA / already-have-Sycle / how-fast.
- **(K) Final CTA band** — headline: *Your next 10 patients are already in your database.*
  Subhead: *Let's go get them. Book a free 15-minute Patient Recovery Audit and we'll show
  you what your list is worth.* Button + phone `[PHONE]`.
- **(L) Footer** — wordmark · `[EMAIL]` · `[PHONE]` · "HIPAA-conscious workflows" ·
  small print: *Results vary by clinic, list size, and market. Industry statistics cited
  from published research.* · `[PRIVACY_POLICY_LINK]`.

---

## 5. ROI calculator logic

**Inputs** (sliders with synced number readouts):
- `patientsTestedPerMonth` — default 25
- `sameDayBuyRate` (%) — default 35
- `avgPairPrice` ($) — default 3600

**Computation (live, on every input change):**
```
nonBuyersPerYear   = patientsTestedPerMonth * (1 - sameDayBuyRate/100) * 12
revenueWalkingOut  = nonBuyersPerYear * avgPairPrice
realisticRecoverable = revenueWalkingOut * 0.10   // conservative 10%
```

**Output** (large, bold, live): *Roughly **[revenueWalkingOut]** walks out your door each
year. We typically help clinics recover around **[realisticRecoverable]** of it.*
Numbers formatted as rounded USD currency. CTA on the result: *"Book your free Patient
Recovery Audit to go get it →"*.

---

## 6. SEO / metadata

- Title: `Patient Recovery for Hearing Clinics | Action Design Studio`
- Meta description: *We help independent hearing clinics recover tested-not-sold and
  upgrade-due patients from their existing database — booked onto your calendar. Pay only
  when it books evaluations.*
- One H1 (hero). Logical H2/H3 hierarchy.
- Naturally woven phrases: "marketing for hearing clinics," "audiology patient recovery,"
  "hearing clinic patient reactivation," "tested not sold follow-up," "fill audiology
  schedule."
- `LocalBusiness`/`Organization` JSON-LD schema with `[BUSINESS NAME, CITY, PHONE]`.

---

## 7. Technical & accessibility requirements

- Fast: lazy-load images, minimal JS, semantic HTML.
- ROI calculator works client-side with live updates.
- All CTAs link to `[BOOKING_LINK]`. Phone numbers are click-to-call (`tel:`) on mobile.
- Labeled placeholders for everything not yet real: `[BOOKING_LINK]`, `[PHONE]`,
  `[EMAIL]`, `[FOUNDER NAME]`, `[FOUNDER_PHOTO]`, `[CITY]`, `[DASHBOARD_SCREENSHOT]`,
  testimonial, `[PRIVACY_POLICY_LINK]`.
- Accessibility (audience skews older): WCAG AA contrast minimum, 18px+ body, large tap
  targets (≥44px), visible focus states, alt text on all images, semantic landmarks,
  keyboard-operable accordion.

---

## 8. Hard "do NOT" list

- No generic agency language ("we grow your business," "full-service digital marketing,"
  "award-winning design").
- No fabricated testimonials, client logos, or statistics — labeled placeholders only.
- Don't bury the offer under design. Clarity and proof beat cleverness.
- No competing CTAs — one action: book the audit (calculator is the only secondary).
- No tiny text, low-contrast color, or dark neon themes.
