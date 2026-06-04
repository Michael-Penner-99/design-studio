# Action Design Studio — Site Editable Placeholders

Everything below must be swapped before the site goes live. Check each item off as you complete it.

## Editable Placeholders Checklist

- [ ] **Logo** — `assets/logo.svg`
  Already done (faithful vector wordmark). Drop in the full original art here if preferred.

- [ ] **Prices** — `pricing.html`
  Replace each `$PLACEHOLDER` with real monthly prices.

- [ ] **Project screenshots / results** — `work.html`
  Replace the 6 sample portfolio cards with real screenshots, client names, and result stats.

- [ ] **Testimonials** — `testimonials.html` and `index.html`
  Replace placeholder quote cards with real reviews, OR paste a live review-widget embed into the `<div id="live-reviews">` slot (see the `LIVE REVIEW WIDGET DROP-IN` comment) and remove the placeholder carousel.

- [ ] **Social links** — `_shared/footer.html`
  Replace the `href="#"` social links with real Facebook/Instagram/YouTube URLs.

- [ ] **Contact form endpoint** — `contact.html`
  Replace `REPLACE_ME` in the Formspree `action` URL with your Formspree form ID.

- [ ] **Founder bio** — `about.html`
  Replace the bio placeholder line and photo placeholder.

- [ ] **Legal details** — `privacy.html` and `terms.html`
  Fill the company legal name, effective date, and governing-law placeholders.

---

## Local Preview

```
cd clients/action-design-studio/site && python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.
