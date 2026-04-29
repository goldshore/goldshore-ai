export type WaveController = {
  getEnergy: (x: number, y: number) => number;
  destroy: () => void;
};

export function initWave(canvas: HTMLCanvasElement): WaveController {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      getEnergy: () => 0,
      destroy: () => undefined,
    };
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId = 0;
  let t = 0;

  const getEnergy = (x: number, y: number) =>
    Math.abs(
      Math.sin(x * 0.01 + t) * 0.55 +
        Math.cos(y * 0.02 + t * 0.82) * 0.3 +
        Math.sin((x + y) * 0.004 + t * 0.5) * 0.2,
    );

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    width = Math.max(canvas.clientWidth, canvas.parentElement?.clientWidth || 0);
    height = Math.max(canvas.clientHeight, canvas.parentElement?.clientHeight || 0);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawFrame = () => {
    ctx.clearRect(0, 0, width, height);

    const rowGap = width < 900 ? 18 : 14;
    const colGap = width < 900 ? 22 : 18;

    for (let y = -20; y <= height + 20; y += rowGap) {
      ctx.beginPath();

      for (let x = -10; x <= width + 10; x += colGap) {
        const energy = getEnergy(x, y);
        const waveOffset =
          Math.sin(x * 0.009 + t * 1.1) * 10 +
          Math.cos(y * 0.018 + t * 0.7) * 6 +
          energy * 8;
        const py = y + waveOffset;

        if (x === -10) {
          ctx.moveTo(x, py);
        } else {
          ctx.lineTo(x, py);
        }
      }

      const alpha = 0.04 + (y / Math.max(height, 1)) * 0.06;
      ctx.strokeStyle = `rgba(90, 162, 255, ${Math.max(0.02, alpha).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const render = () => {
    t += 0.016;
    drawFrame();
    rafId = window.requestAnimationFrame(render);
  };

  const syncMotion = () => {
    if (prefersReducedMotion.matches) {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      t = 0;
      drawFrame();
      return;
    }

    if (!rafId) {
      render();
    }
  };

  resize();
  syncMotion();

  const onResize = () => {
    resize();
    if (prefersReducedMotion.matches) {
      drawFrame();
    }
  };

  window.addEventListener('resize', onResize);
  prefersReducedMotion.addEventListener('change', syncMotion);

  return {
    getEnergy,
    destroy: () => {
      window.removeEventListener('resize', onResize);
      prefersReducedMotion.removeEventListener('change', syncMotion);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    },
  };
}
