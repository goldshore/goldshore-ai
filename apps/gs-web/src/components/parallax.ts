export type ParallaxOptions = {
  selector?: string;
  speedAttribute?: string;
  factor?: number;
};

export const initParallax = (options: ParallaxOptions = {}) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return () => undefined;
  }

  const {
    selector = '[data-parallax]',
    speedAttribute = 'data-parallax',
    factor = -0.12
  } = options;

  // Bolt: Track visibility state for optimization
  const layers = Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element) => ({
    element,
    speed: parseFloat(element.getAttribute(speedAttribute) || '0'),
    isVisible: false
  }));

  if (elements.length === 0) {
    return () => undefined;
  }

  // Bolt: Use IntersectionObserver to skip updates for off-screen elements
  const observer = new IntersectionObserver((entries) => {
    let needsUpdate = false;
    entries.forEach((entry) => {
      const layer = layers.find(l => l.element === entry.target);
      if (layer) {
        if (layer.isVisible !== entry.isIntersecting) {
          layer.isVisible = entry.isIntersecting;
          needsUpdate = true;
        }
      }
    });

    // Trigger update if visibility changed (e.g. initial load)
    if (needsUpdate) {
      updateParallax();
    }
  }, { rootMargin: '200px' });

  layers.forEach(l => observer.observe(l.element));

  let ticking = false;
  const updateParallax = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    layers.forEach(({ element, speed, isVisible }) => {
      if (!isVisible) return;
      const offset = scrollY * speed * factor;
      element.style.setProperty('--gs-parallax-offset', `${offset}px`);
    });
    ticking = false;
  };

  // Initial update (might be redundant if observer fires, but safe)
  updateParallax();

  const handleScroll = () => {
    // Bolt: Bail out early if no parallax elements are visible
    if (!layers.some(l => l.isVisible)) return;

    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', updateParallax);

  return () => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', updateParallax);
    observer.disconnect();
  };
};
