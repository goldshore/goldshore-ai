import type { WaveController } from './init-wave';

type ReactiveLogoElement = HTMLElement | SVGElement;

export function initLogo(logo: ReactiveLogoElement, wave: Pick<WaveController, 'getEnergy'>) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let t = 0;
  let rafId = 0;

  const setStatic = () => {
    logo.style.transform = 'translate(0px, 0px) rotate(0deg)';
    logo.style.filter = 'drop-shadow(0 0 8px rgba(90, 162, 255, 0.18))';
  };

  const loop = () => {
    t += 0.016;

    const rect = logo.getBoundingClientRect();
    const energy = wave.getEnergy(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
    const dx = Math.sin(t) * energy * 1.5;
    const dy = Math.cos(t * 0.8) * energy * 1.5;
    const rot = Math.sin(t * 0.6) * energy;

    logo.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
    logo.style.filter = `drop-shadow(0 0 ${(6 + energy * 10).toFixed(1)}px rgba(90, 162, 255, 0.3))`;

    rafId = window.requestAnimationFrame(loop);
  };

  const syncMotion = () => {
    if (prefersReducedMotion.matches) {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      setStatic();
      return;
    }

    if (!rafId) {
      loop();
    }
  };

  syncMotion();
  prefersReducedMotion.addEventListener('change', syncMotion);

  return () => {
    prefersReducedMotion.removeEventListener('change', syncMotion);
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  };
}
