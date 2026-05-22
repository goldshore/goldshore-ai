/**
 * GoldShore Hero — 3D perspective wave field + mouse/scroll parallax.
 *
 * Renders a perspective-projected sine-wave mesh on canvas, then drives
 * multi-layer parallax via CSS transforms so the Penrose mark, copy, and
 * background all drift at different depths.
 */
export const mountHero = (root: ParentNode = document) => {
  const hero   = root.querySelector('[data-gs-hero]') as HTMLElement | null;
  const canvas = hero?.querySelector('[data-gs-wave]') as HTMLCanvasElement | null;
  const mark   = hero?.querySelector('[data-gs-mark]') as HTMLElement | null;
  const copy   = hero?.querySelector('[data-gs-copy]') as HTMLElement | null;
  const gridEl = hero?.querySelector('[data-gs-grid]') as HTMLElement | null;

  if (!hero || !canvas) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  // ── state ──────────────────────────────────────────────────────────────────
  let raf = 0;
  let t   = 0;
  let W = 0, H = 0, dpr = 1;

  const mouse  = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  let scrollY  = 0;

  const prefersReduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── resize ─────────────────────────────────────────────────────────────────
  const resize = () => {
    dpr = Math.max(1, devicePixelRatio || 1);
    const r = hero.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // ── 3-D perspective wave ───────────────────────────────────────────────────
  const COLS  = 40;
  const ROWS  = 22;
  const FOV   = 440;
  const TILT  = 0.46;  // radians — camera tilt looking down into the field
  const AMP   = 40;    // world-unit wave amplitude
  const CAM_Z = 200;   // camera pull-back

  const cosTilt = Math.cos(TILT);
  const sinTilt = Math.sin(TILT);

  const project = (wx: number, wy: number, wz: number) => {
    const ry = wy * cosTilt - wz * sinTilt;
    const rz = wy * sinTilt + wz * cosTilt + CAM_Z;
    const p  = FOV / Math.max(rz, 0.1);
    return { sx: W * 0.5 + wx * p, sy: H * 0.54 + ry * p };
  };

  const waveZ = (col: number, row: number, time: number) =>
    AMP * (
      Math.sin(col * 0.36 + time * 1.9)          * 0.52 +
      Math.cos(row * 0.30 + time * 1.45)         * 0.40 +
      Math.sin((col + row) * 0.17 + time * 1.15) * 0.28 +
      Math.cos(col * 0.50 - time * 0.80)         * 0.18
    );

  const drawWave = (time: number) => {
    ctx.clearRect(0, 0, W, H);

    const spX = (W * 1.12) / COLS;
    const spY = (H * 0.70) / ROWS;

    const pts: { sx: number; sy: number }[] = [];
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const wx = (c - COLS / 2) * spX;
        const wy = (r - ROWS / 2) * spY;
        pts.push(project(wx, wy, waveZ(c, r, time)));
      }
    }

    const idx = (r: number, c: number) => r * (COLS + 1) + c;

    // Horizontal strands
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      for (let c = 0; c <= COLS; c++) {
        const { sx, sy } = pts[idx(r, c)];
        c === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      const depth = r / ROWS;
      const alpha = prefersReduced ? 0.10 : 0.04 + depth * 0.20;
      ctx.strokeStyle = `rgba(90,162,255,${alpha.toFixed(3)})`;
      ctx.lineWidth   = depth < 0.15 ? 0.5 : 0.85;
      ctx.stroke();
    }

    // Vertical strands — sparser, subtler
    for (let c = 0; c <= COLS; c += 2) {
      ctx.beginPath();
      for (let r = 0; r <= ROWS; r++) {
        const { sx, sy } = pts[idx(r, c)];
        r === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = `rgba(120,170,255,${(0.02 + (c / COLS) * 0.05).toFixed(3)})`;
      ctx.lineWidth   = 0.55;
      ctx.stroke();
    }

    // Bright leading edge (front row)
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) {
      const { sx, sy } = pts[idx(ROWS, c)];
      c === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = 'rgba(90,162,255,0.42)';
    ctx.lineWidth   = 1.6;
    ctx.stroke();
  };

  // ── parallax ───────────────────────────────────────────────────────────────
  const applyParallax = () => {
    if (prefersReduced) return;

    const nx = (smooth.x / Math.max(W, 1) - 0.5) * 2;
    const ny = (smooth.y / Math.max(H, 1) - 0.5) * 2;
    const sy = scrollY;

    if (mark) {
      mark.style.transform =
        `translate(${(nx * 16).toFixed(2)}px, ${(ny * 12 + sy * -0.20).toFixed(2)}px)`;
    }
    if (copy) {
      copy.style.transform =
        `translate(${(nx * 5).toFixed(2)}px, ${(ny * 3 + sy * -0.07).toFixed(2)}px)`;
    }
    if (gridEl) {
      gridEl.style.transform =
        `translate(${(nx * -5).toFixed(2)}px, ${(sy * 0.06).toFixed(2)}px)`;
    }

    canvas.style.transform = `
      perspective(1000px)
      rotateX(${(-ny * 2.8 - sy * 0.003).toFixed(2)}deg)
      rotateY(${(nx * 1.6).toFixed(2)}deg)
      scale(1.05)
    `;
  };

  // ── loop ───────────────────────────────────────────────────────────────────
  const frame = () => {
    if (!prefersReduced) t += 0.016;

    smooth.x += (mouse.x - smooth.x) * 0.055;
    smooth.y += (mouse.y - smooth.y) * 0.055;

    drawWave(t);
    applyParallax();
    raf = requestAnimationFrame(frame);
  };

  // ── listeners ──────────────────────────────────────────────────────────────
  const onMouse = (e: MouseEvent) => {
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  const onScroll = () => { scrollY = window.scrollY; };

  const ro = new ResizeObserver(resize);

  resize();
  ro.observe(hero);
  hero.addEventListener('mousemove', onMouse, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  frame();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    hero.removeEventListener('mousemove', onMouse);
    window.removeEventListener('scroll', onScroll);
  };
};
