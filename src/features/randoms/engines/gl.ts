/** Small helpers for the hand-written Randoms (Ink Flow, Murmuration, Falling Sand, Galaxy Forge). */

export type Prog = {
  u: Record<string, WebGLUniformLocation | null>;
  bind(): void;
};

/** Compiles a program whose vertex attribute 0 is `aPosition` (and 1 `aCol` when used). */
export function program(
  gl: WebGLRenderingContext,
  vs: string,
  fs: string,
): Prog {
  const sh = (type: number, src: string) => {
    const o = gl.createShader(type)!;
    gl.shaderSource(o, src);
    gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(o) ?? "shader");
    return o;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPosition");
  gl.bindAttribLocation(p, 1, "aCol");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? "program");
  const u: Prog["u"] = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i)!.name.replace(/\[0\]$/, "");
    u[name] = gl.getUniformLocation(p, name);
  }
  return { u, bind: () => gl.useProgram(p) };
}

/** Frees the GPU context now instead of waiting for the garbage collector. */
export const loseContext = (gl: WebGLRenderingContext) =>
  gl.getExtension("WEBGL_lose_context")?.loseContext();

export type Pointer = {
  /** Position in canvas pixels, and the one before. */
  x: number;
  y: number;
  px: number;
  py: number;
  down: boolean;
  /** Moved since the scene last looked. */
  moved: boolean;
  /** A mouse is over the box (touch has no hover). */
  over: boolean;
  off(): void;
};

/** One finger (or the mouse) over `el`, in the canvas's pixels. */
export function pointer(el: HTMLElement, cv: HTMLCanvasElement): Pointer {
  let id: number | null = null;
  const p: Pointer = {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    down: false,
    moved: false,
    over: false,
    off: () => {},
  };
  const pos = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * cv.width,
      ((e.clientY - r.top) / r.height) * cv.height,
    ];
  };
  const down = (e: PointerEvent) => {
    if (id !== null) return;
    id = e.pointerId;
    [p.x, p.y] = pos(e);
    p.px = p.x;
    p.py = p.y;
    p.down = true;
    p.moved = true;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
  };
  const move = (e: PointerEvent) => {
    if (id !== null && e.pointerId !== id) return;
    p.over = e.pointerType === "mouse";
    p.px = p.x;
    p.py = p.y;
    [p.x, p.y] = pos(e);
    p.moved = true;
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    p.down = false;
  };
  const leave = () => (p.over = false);
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", leave);
  p.off = () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("pointerleave", leave);
  };
  return p;
}

/** A canvas filling `el` that takes touches without scrolling the page. */
export function addCanvas(el: HTMLElement) {
  const cv = document.createElement("canvas");
  cv.style.touchAction = "none";
  el.prepend(cv);
  return cv;
}
