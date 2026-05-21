export const initHeroStars = (selector = '[data-hero-stars]'): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const root = document.querySelector<HTMLElement>(selector);
  if (!root) {
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return;
  }

  let timerId: number | undefined;

  const spawnStar = () => {
    const star = document.createElement('span');
    star.className = 'hero-stars__item';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDuration = `${1.8 + Math.random() * 2}s`;
    root.append(star);

    window.setTimeout(() => {
      star.remove();
    }, 3000);
  };

  timerId = window.setInterval(spawnStar, 220);

  const stop = () => {
    if (timerId !== undefined) {
      window.clearInterval(timerId);
    }
  };

  window.addEventListener('pagehide', stop, { once: true });
};
