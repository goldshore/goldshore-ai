const PARALLAX_SELECTOR = '.gs-parallax';
const SECTION_SELECTOR = '.parallax-section';

const getTranslateY = (section: Element, speed: number) => {
  const rect = section.getBoundingClientRect();
  const offset = window.innerHeight - rect.top;
  return offset * speed;
};

export const initParallax = () => {
  const layers = Array.from(document.querySelectorAll<HTMLElement>(PARALLAX_SELECTOR));

  if (layers.length === 0) {
    return;
  }

  const sectionByLayer = new WeakMap<HTMLElement, Element>();
  layers.forEach((layer) => {
    const section = layer.closest(SECTION_SELECTOR);
    if (section) {
      sectionByLayer.set(layer, section);
    }
  });

  let rafId = 0;

  const update = () => {
    layers.forEach((layer) => {
      const section = sectionByLayer.get(layer);
      if (!section) {
        return;
      }

      const speed = Number(layer.dataset.parallax ?? 0);
      layer.style.transform = `translate3d(0, ${getTranslateY(section, speed).toFixed(2)}px, 0)`;
    });

    rafId = 0;
  };

  const onScroll = () => {
    if (rafId !== 0) {
      return;
    }

    rafId = window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  update();
};
