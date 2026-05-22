const MAX_TRANSLATE = 2;
const MAX_ROTATION = 1.2;
const MAX_GLOW = 12;
const MAX_OPACITY_SHIFT = 0.15;

export function initReactiveHero(root: ParentNode = document) {
  const hero = root instanceof HTMLElement ? root : root.querySelector('[data-reactive-hero]');
  if (!(hero instanceof HTMLElement)) return undefined;

  const canvas = hero.querySelector('[data-wave-bg]') as HTMLCanvasElement | null;
  const logo = hero.querySelector('.gs-logo-reactive') as SVGElement | null;
  const seam = hero.querySelector('.gs-logo-seam') as SVGPathElement | null;
  if (!canvas || !logo) return undefined;

  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let rafId: number | null = null;
  let time = 0;

  const state = {
    energy: 0,
    targetEnergy: 0,
    dx: 0,
    dy: 0,
    rot: 0,
    seam: 0,
  };

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  const sampleWaveEnergy = (sampleTime: number) => {
    const sx = width * 0.26;
    const sy = height * 0.28;
    const a =
      Math.sin(sx * 0.012 + sampleTime * 1.15) * 0.55 +
      Math.cos(sy * 0.018 + sampleTime * 0.82) * 0.45 +
      Math.sin((sx + sy) * 0.006 + sampleTime * 0.55) * 0.25;

    return Math.abs(a);
  };

  const drawWaveField = (sampleTime: number) => {
    ctx.clearRect(0, 0, width, height);

    const rowGap = width < 768 ? 14 : 10;
    const colGap = width < 768 ? 14 : 10;

    for (let y = 0; y < height; y += rowGap) {
      ctx.beginPath();

      for (let x = 0; x < width; x += colGap) {
        const wave =
          Math.sin(x * 0.0105 + sampleTime * 1.1) * 7 +
          Math.cos(y * 0.018 + sampleTime * 0.75) * 4 +
          Math.sin((x + y) * 0.004 + sampleTime * 0.5) * 3;

        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }

      const alpha = 0.035 + (y / Math.max(height, 1)) * 0.07;
      ctx.strokeStyle = `rgba(90,162,255,${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const updateLogo = (sampleTime: number) => {
    state.targetEnergy = sampleWaveEnergy(sampleTime);
    state.energy += (state.targetEnergy - state.energy) * 0.08;

    const driftX = Math.sin(sampleTime * 1.2) * 1.2 * state.energy;
    const driftY = Math.cos(sampleTime * 0.95) * 1.6 * state.energy;
    const rotation = Math.sin(sampleTime * 0.7) * 0.8 * state.energy;
    const seamPulse = 0.45 + Math.sin(sampleTime * 1.8) * 0.2 * state.energy;

    state.dx += (driftX - state.dx) * 0.12;
    state.dy += (driftY - state.dy) * 0.12;
    state.rot += (rotation - state.rot) * 0.12;
    state.seam += (seamPulse - state.seam) * 0.14;

    const translateX = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, state.dx));
    const translateY = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, state.dy));
    const rotationDeg = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, state.rot));
    const glow = Math.min(MAX_GLOW, 4 + state.energy * 10);
    const glowAlpha = 0.18 + state.energy * 0.28;
    const opacity = Math.min(0.97, 0.82 + state.energy * MAX_OPACITY_SHIFT);

    logo.style.transform = `translate(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px) rotate(${rotationDeg.toFixed(2)}deg)`;
    logo.style.filter = `drop-shadow(0 0 ${glow.toFixed(1)}px rgba(90,162,255,${glowAlpha.toFixed(3)})) brightness(${(1 + state.energy * 0.08).toFixed(3)})`;
    logo.style.opacity = opacity.toFixed(3);

    if (seam) {
      seam.style.opacity = `${Math.min(0.95, 0.5 + state.seam * 0.45)}`;
      seam.style.strokeWidth = `${(2 + state.energy * 0.45).toFixed(2)}`;
    }
  };

  const resetStaticState = () => {
    ctx.clearRect(0, 0, width, height);
    drawWaveField(0);
    logo.style.transform = 'translate(0px, 0px) rotate(0deg)';
    logo.style.filter = 'drop-shadow(0 0 4px rgba(90,162,255,0.22))';
    logo.style.opacity = '0.88';
    if (seam) {
      seam.style.opacity = '0.68';
      seam.style.strokeWidth = '2';
    }
  };

  const frame = () => {
    time += 0.016;
    drawWaveField(time);
    updateLogo(time);
    rafId = window.requestAnimationFrame(frame);
  };

  const handleMotionPreference = () => {
    if (prefersReducedMotion.matches) {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      resetStaticState();
      return;
    }

    if (rafId === null) {
      frame();
    }
  };

  resize();
  handleMotionPreference();

  window.addEventListener('resize', resize);
  prefersReducedMotion.addEventListener('change', handleMotionPreference);

  return () => {
    window.removeEventListener('resize', resize);
    prefersReducedMotion.removeEventListener('change', handleMotionPreference);
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
