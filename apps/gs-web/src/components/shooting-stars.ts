const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function spawnShootingStars(): void {
  if (typeof window === 'undefined') return;

  const container = document.querySelector<HTMLElement>('[data-shooting-stars]');
  if (!container) return;

  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    container.setAttribute('data-stars-initialized', 'reduced-motion');
    return;
  }

  if (container.dataset.starsInitialized === 'true') return;

  const STAR_COUNT = 18;
  container.innerHTML = '';

  for (let index = 0; index < STAR_COUNT; index += 1) {
    const star = document.createElement('span');
    star.className = 'star';
    star.style.setProperty('--star-left', `${Math.random() * 100}%`);
    star.style.setProperty('--star-delay', `${Math.random() * 9}s`);
    star.style.setProperty('--star-duration', `${3 + Math.random() * 6}s`);
    container.appendChild(star);
  }

  container.dataset.starsInitialized = 'true';
}
