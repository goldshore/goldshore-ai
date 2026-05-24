import VanillaTilt from 'vanilla-tilt';

let tiltInstances: Array<{ destroy: () => void }> = [];
let cleanupStarField: (() => void) | null = null;
let cleanupBriefingModal: (() => void) | null = null;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initTilt(selector = '[data-tilt]') {
  if (prefersReducedMotion() || window.innerWidth < 768) {
    return;
  }

  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

  elements.forEach((element) => {
    VanillaTilt.init(element, {
      max: 12,
      speed: 450,
      scale: 1.03,
      glare: true,
      'max-glare': 0.2
    });

    const instance = (element as HTMLElement & { vanillaTilt?: { destroy: () => void } }).vanillaTilt;
    if (instance) {
      tiltInstances.push(instance);
    }
  });
}

function createStarField(canvas: HTMLCanvasElement, trigger?: HTMLElement | null) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};

  let width = 0;
  let height = 0;
  let animationId = 0;
  let boost = 1;

  const stars: Array<{ x: number; y: number; size: number; speed: number }> = [];

  const generateStars = () => {
    stars.length = 0;
    const starCount = Math.max(120, Math.floor((width * height) / 12000));
    for (let i = 0; i < starCount; i += 1) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.2,
        speed: Math.random() * 0.35 + 0.08
      });
    }
  };

  const resize = () => {
    width = canvas.width = canvas.offsetWidth || window.innerWidth;
    height = canvas.height = canvas.offsetHeight || window.innerHeight;
    generateStars();
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(240,244,255,0.85)';

    stars.forEach((star) => {
      context.beginPath();
      context.arc(star.x, star.y, star.size * boost, 0, Math.PI * 2);
      context.fill();
      star.y -= star.speed * boost;

      if (star.y < -4) {
        star.y = height + 4;
        star.x = Math.random() * width;
      }
    });

    animationId = window.requestAnimationFrame(draw);
  };

  let hoverTimeout = 0;
  const onTriggerEnter = () => {
    boost = 1.5;
    window.clearTimeout(hoverTimeout);
  };

  const onTriggerLeave = () => {
    hoverTimeout = window.setTimeout(() => {
      boost = 1;
    }, 180);
  };

  window.addEventListener('resize', resize);
  trigger?.addEventListener('pointerenter', onTriggerEnter);
  trigger?.addEventListener('pointerleave', onTriggerLeave);

  resize();
  draw();

  return () => {
    window.cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resize);
    trigger?.removeEventListener('pointerenter', onTriggerEnter);
    trigger?.removeEventListener('pointerleave', onTriggerLeave);
    window.clearTimeout(hoverTimeout);
  };
}

export function initStarField(id = 'hero-stars') {
  if (prefersReducedMotion()) {
    return;
  }

  const canvas = document.getElementById(id);
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const trigger = document.querySelector<HTMLElement>('.briefing-trigger');
  cleanupStarField = createStarField(canvas, trigger);
}

export function cleanupUI() {
  tiltInstances.forEach((instance) => instance.destroy());
  tiltInstances = [];

  cleanupStarField?.();
  cleanupStarField = null;

  cleanupBriefingModal?.();
  cleanupBriefingModal = null;
}

export function initBriefingModal() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-briefing-modal]');
  const openButton = document.querySelector<HTMLElement>('.briefing-trigger');
  const closeButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-close-briefing]'));

  if (!dialog || !openButton) {
    return;
  }

  const openModal = () => {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'true');
    }
  };

  const closeModal = () => dialog.close();

  openButton.addEventListener('click', openModal);
  closeButtons.forEach((button) => button.addEventListener('click', closeModal));

  cleanupBriefingModal = () => {
    openButton.removeEventListener('click', openModal);
    closeButtons.forEach((button) => button.removeEventListener('click', closeModal));
  };
}
