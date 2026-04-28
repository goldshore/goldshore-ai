export type SectionLiftOptions = {
  selector?: string;
  rootMargin?: string;
  threshold?: number | number[];
  liftedClass?: string;
};

export const initSectionLift = (options: SectionLiftOptions = {}) => {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return () => undefined;
  }

  const {
    selector = '.gs-section-lift',
    rootMargin = '0px 0px -15% 0px',
    threshold = 0.25,
    liftedClass = 'is-lifted'
  } = options;

  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (elements.length === 0) {
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle(liftedClass, entry.isIntersecting);
      });
    },
    { rootMargin, threshold }
  );

  elements.forEach((element) => observer.observe(element));

  return () => observer.disconnect();
};
