export type ParallaxOptions = {
  selector?: string;
  speedAttribute?: string;
  factor?: number;
};

type ParallaxLayer = {
  element: HTMLElement;
  speed: number;
  isVisible: boolean;
};

export const initParallax = (options: ParallaxOptions = {}) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => undefined;
  }

  const {
    selector = '[data-parallax]',
    speedAttribute = 'data-parallax',
    factor = -0.12,
  } = options;

  const layers: ParallaxLayer[] = Array.from(
    document.querySelectorAll<HTMLElement>(selector),
  ).map((element) => ({
    element,
    speed: Number.parseFloat(element.getAttribute(speedAttribute) || '0') || 0,
    isVisible: false,
  }));

  if (layers.length === 0) {
    return () => undefined;
  }

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

  const observer = new IntersectionObserver(
    (entries) => {
      let needsUpdate = false;

      entries.forEach((entry) => {
        const layer = layers.find((candidate) => candidate.element === entry.target);
        if (!layer) return;

        if (layer.isVisible !== entry.isIntersecting) {
          layer.isVisible = entry.isIntersecting;
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        updateParallax();
      }
    },
    { rootMargin: '200px' },
  );

  layers.forEach((layer) => observer.observe(layer.element));
  updateParallax();

  const handleScroll = () => {
    if (!layers.some((layer) => layer.isVisible) || ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(updateParallax);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', updateParallax);

  return () => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', updateParallax);
    observer.disconnect();
  };
};
