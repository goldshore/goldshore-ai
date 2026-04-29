export function initWebGLField() {
  const c = document.querySelector<HTMLCanvasElement>('[data-gs-webgl]');
  if (!c) return;

  const rm = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const pointerFine = window.matchMedia?.('(pointer: fine)')?.matches;
  if (rm || !pointerFine) return;

  const gl = c.getContext('webgl', { premultipliedAlpha: true, antialias: true });
  if (!gl) return;

  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const resize = () => {
    const w = Math.floor(c.clientWidth * DPR);
    const h = Math.floor(c.clientHeight * DPR);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const VERT = `
    attribute vec2 aPos;
    attribute float aSize;
    attribute float aDepth;
    uniform float uTime;
    void main(){
      vec2 p = aPos;
      float dy = mod(uTime * (0.008 + aDepth*0.02), 1.2);
      p.y = p.y - dy;
      if (p.y < -0.2) p.y += 1.4;

      vec2 ndc = vec2(p.x*2.0-1.0, p.y*2.0-1.0);
      gl_Position = vec4(ndc, 0.0, 1.0);
      gl_PointSize = aSize * (1.0 + aDepth*1.8);
    }
  `;

  const FRAG = `
    precision mediump float;
    uniform vec3 uColor;
    void main(){
      vec2 uv = gl_PointCoord.xy - vec2(0.5);
      float d = length(uv);
      float core = smoothstep(0.10, 0.00, d);
      float bloom = smoothstep(0.50, 0.12, d) * 0.35;
      float a = core + bloom;
      gl_FragColor = vec4(uColor, a);
    }
  `;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  if (!prog) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aSize = gl.getAttribLocation(prog, 'aSize');
  const aDepth = gl.getAttribLocation(prog, 'aDepth');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uColor = gl.getUniformLocation(prog, 'uColor');

  const COUNT = 90;
  const data = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    const o = i * 4;
    data[o] = Math.random();
    data[o + 1] = Math.random() * 1.2 - 0.1;
    data[o + 2] = 1.6 + Math.random() * 2.8;
    data[o + 3] = Math.random();
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const STRIDE = 16;
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(aSize);
  gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, STRIDE, 8);
  gl.enableVertexAttribArray(aDepth);
  gl.vertexAttribPointer(aDepth, 1, gl.FLOAT, false, STRIDE, 12);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  let t0 = performance.now();
  const loop = (t: number) => {
    resize();
    const time = (t - t0) * 0.001;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (uTime) gl.uniform1f(uTime, time);
    if (uColor) gl.uniform3f(uColor, 90 / 255, 140 / 255, 1);
    gl.drawArrays(gl.POINTS, 0, COUNT);
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
  window.addEventListener('resize', resize, { passive: true });
}
