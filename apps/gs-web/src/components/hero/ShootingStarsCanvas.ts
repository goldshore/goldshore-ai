type ShootingStar = {
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
};

export function mountShootingStars(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let raf = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const stars: ShootingStar[] = [];

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawn(w: number, h: number) {
    // spawn offscreen upper-left-ish, travel down-right
    const startX = Math.random() * w * 0.6;
    const startY = -20 - Math.random() * 120;
    const speed = 7 + Math.random() * 6;
    stars.push({
      x: startX, y: startY,
      vx: speed, vy: speed * (0.55 + Math.random() * 0.25),
      life: 0, max: 55 + Math.random() * 35,
    });
  }

  let lastSpawn = 0;
  function tick(t: number) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // spawn cadence
    if (t - lastSpawn > 800 + Math.random() * 1400) {
      spawn(w, h);
      lastSpawn = t;
    }

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.life += 1;
      s.x += s.vx;
      s.y += s.vy;

      const k = 1 - s.life / s.max;
      const len = 120 * k;

      // tail gradient
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - len, s.y - len * 0.55);
      grad.addColorStop(0, `rgba(56,189,248,${0.75 * k})`);
      grad.addColorStop(0.5, `rgba(147,197,253,${0.35 * k})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - len, s.y - len * 0.55);
      ctx.stroke();

      // head glow
      ctx.fillStyle = `rgba(226,232,240,${0.75 * k})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
      ctx.fill();

      if (s.life > s.max || s.x > w + 200 || s.y > h + 200) stars.splice(i, 1);
    }

    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  raf = requestAnimationFrame(tick);

  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
