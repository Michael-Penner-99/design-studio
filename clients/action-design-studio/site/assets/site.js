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
