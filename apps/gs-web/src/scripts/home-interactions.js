document.documentElement.classList.add('js-ready');

const orb = document.createElement('div');
orb.className = 'cursor-orb';
document.body.appendChild(orb);

window.addEventListener('pointermove', (e) => {
  orb.style.setProperty('--x', `${e.clientX}px`);
  orb.style.setProperty('--y', `${e.clientY}px`);
});

const revealItems = document.querySelectorAll(
  '[data-reveal], .surface-card, .cap-list article, .telemetry-grid article, .sector-grid article'
);

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }
}, { threshold: 0.16 });

revealItems.forEach((el, i) => {
  el.style.setProperty('--delay', `${Math.min(i * 55, 420)}ms`);
  observer.observe(el);
});

document.querySelectorAll('.magnetic, .btn, .text-link, .cap-list article, .ticker-grid button').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(e.clientX - r.left - r.width / 2) * 0.06}px`);
    el.style.setProperty('--my', `${(e.clientY - r.top - r.height / 2) * 0.06}px`);
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--mx', '0px');
    el.style.setProperty('--my', '0px');
  });
});

setInterval(() => {
  const cards = document.querySelectorAll('.anomaly, .ticker-grid article, .telemetry-grid article');
  const card = cards[Math.floor(Math.random() * cards.length)];
  if (!card) return;
  card.classList.add('is-pinged');
  setTimeout(() => card.classList.remove('is-pinged'), 520);
}, 2400);
