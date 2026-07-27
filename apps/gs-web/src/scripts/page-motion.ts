const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(pointer: coarse)');

const revealSelector = [
  '.gs-flow-section__inner > *',
  '.gs-hero__inner > *',
  '.gs-section > *',
  '.page-shell > *',
  '.info-grid > *',
  '.service-grid > *',
].join(',');

const initializePageMotion = () => {
  const root = document.documentElement;
  if (root.dataset.gsMotionBound === 'true') return;
  root.dataset.gsMotionBound = 'true';

  const revealItems = Array.from(document.querySelectorAll<HTMLElement>(revealSelector));
  revealItems.forEach((item, index) => {
    item.dataset.reveal = '';
    item.style.setProperty('--reveal-order', String(index % 5));
  });

  if (reduceMotion.matches) {
    revealItems.forEach((item) => item.dataset.revealState = 'visible');
    return;
  }

  root.classList.add('gs-motion-ready');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.revealState = 'visible';
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  revealItems.forEach((item) => observer.observe(item));

  if (!coarsePointer.matches) {
    document.querySelectorAll<HTMLElement>('.gs-card, .info-card, .service-card').forEach((card) => {
      card.dataset.depth = '';
      card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
        card.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--pointer-x');
        card.style.removeProperty('--pointer-y');
      }, { passive: true });
    });
  }
};

initializePageMotion();
document.addEventListener('astro:page-load', initializePageMotion);
