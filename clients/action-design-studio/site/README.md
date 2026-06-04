# Action Design Studio — Site Editable Placeholders

Everything below must be swapped before the site goes live. Check each item off as you complete it.

## Editable Placeholders Checklist

- [ ] **Logo** — `assets/logo.svg`
  Already done (faithful vector wordmark). Drop in the full original art here if preferred.

- [x] **Prices** — `pricing.html`
  Set: Contractor Advanced $297 USD/mo + add-ons (Stone Systems style). Edit here to change.

- [x] **Project screenshots / results** — `work.html`
  Now shows 3 live factory-built sites (Sask Air, Platinum Plumbing & Heating, Wind Rose Mechanical) with live screenshots (WordPress mShots) linking to the deployed sites. Add more cards as you ship new sites; swap mShots for committed screenshots if you want them self-hosted.

- [ ] **Testimonials** — `testimonials.html` and `index.html`
  Replace placeholder quote cards with real reviews, OR paste a live review-widget embed into the `<div id="live-reviews">` slot (see the `LIVE REVIEW WIDGET DROP-IN` comment) and remove the placeholder carousel.

- [ ] **Social links** — `_shared/footer.html`
  Replace the `href="#"` social links with real Facebook/Instagram/YouTube URLs.

- [ ] **Contact form endpoint** — `contact.html`
  Replace `REPLACE_ME` in the Formspree `action` URL with your Formspree form ID.

- [ ] **Founder bio** — `about.html`
  Replace the bio placeholder line and photo placeholder.

- [x] **Legal name + effective date** — `privacy.html` / `terms.html` — set to "Action Design Studio", effective June 4, 2026.
- [ ] **Governing-law jurisdiction** — `terms.html` (one `PLACEHOLDER (jurisdiction)` remains — set your province/state).

---

## Local Preview

```
cd clients/action-design-studio/site && python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.
