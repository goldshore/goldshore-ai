export function mountStarfield(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let raf = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const stars = Array.from({ length: 220 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.2 + 0.2,
    a: Math.random() * 0.7 + 0.15,
    tw: Math.random() * 0.02 + 0.005,
  }));

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function tick(t: number) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // subtle vignette / haze
    const g = ctx.createRadialGradient(w * 0.3, h * 0.35, 0, w * 0.3, h * 0.35, Math.max(w, h));
    g.addColorStop(0, "rgba(56,189,248,0.09)");
    g.addColorStop(0.45, "rgba(37,99,235,0.06)");
    g.addColorStop(1, "rgba(2,6,23,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      s.a += Math.sin(t * 0.001) * s.tw;
      const x = s.x * w;
      const y = s.y * h;
      ctx.beginPath();
      ctx.fillStyle = `rgba(226,232,240,${Math.max(0.05, Math.min(0.9, s.a))})`;
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}
