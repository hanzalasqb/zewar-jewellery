import type { Geometry } from "./geometry";
import { lookAt, perspective, transformPoint, type Mat4, type Vec3 } from "./math";
import { FABRIC_FS, FABRIC_VS, GEM_FS, MESH_VS, METAL_FS, PEARL_FS, SHADOW_FS } from "./shaders";

export type Material =
  | { kind: "metal"; color: Vec3; rough: number }
  | { kind: "gem"; color: Vec3; ior: number; dispersion: number }
  | { kind: "pearl"; color: Vec3 }
  | { kind: "shadow"; opacity: number }
  | { kind: "fabric"; albedo: TexImageSource; height: TexImageSource; mask: TexImageSource; puff: number; side: 1 | -1; size: [number, number]; sway: number };

export interface Item {
  geometry: Geometry;
  material: Material;
  matrix: Mat4;
}

export interface ViewOptions {
  fov?: number;
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  yaw?: number;
  pitch?: number;
  pitchLimits?: [number, number];
  target?: Vec3;
  autoRotate?: number; // radians per second, 0 = off
  interactive?: boolean;
  exposure?: number;
  warmth?: number;
  preserve?: boolean; // keep the drawing buffer (needed for snapshots)
  size?: [number, number]; // fixed pixel size for off-screen canvases
}

interface GpuMesh {
  vao: WebGLVertexArrayObject;
  count: number;
  buffers: WebGLBuffer[];
}

const PROGRAMS = { metal: [MESH_VS, METAL_FS], gem: [MESH_VS, GEM_FS], pearl: [MESH_VS, PEARL_FS], shadow: [MESH_VS, SHADOW_FS], fabric: [FABRIC_VS, FABRIC_FS] } as const;
type ProgramKind = keyof typeof PROGRAMS;

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A small WebGL2 renderer with orbit controls. One instance per <canvas>.
 * Meshes and textures are uploaded once and cached; the scene re-renders only while something moves.
 */
export class Viewer {
  readonly gl: WebGL2RenderingContext;
  private programs = new Map<ProgramKind, { prog: WebGLProgram; loc: Map<string, WebGLUniformLocation | null> }>();
  private meshes = new WeakMap<Geometry, GpuMesh>();
  private ownedMeshes: GpuMesh[] = [];
  private textures = new Map<TexImageSource, WebGLTexture>();
  private items: Item[] = [];
  private raf = 0;
  private start = performance.now();
  private last = 0;
  private idleUntil = 0;
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  private visible = true;
  /** Render scale, lowered automatically on slow GPUs so animation stays smooth. */
  private quality = 1;
  private slowFrames = 0;
  private fastFrames = 0;
  private cleanup: (() => void)[] = [];
  /** Called every frame with elapsed seconds; return true to keep animating. */
  onFrame?: (t: number, dt: number) => boolean | void;

  yaw: number;
  pitch: number;
  distance: number;
  private targetYaw: number;
  private targetPitch: number;
  private targetDistance: number;
  private opts: Required<Omit<ViewOptions, "target">> & { target: Vec3 };

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: ViewOptions = {},
  ) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.preserve });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    this.opts = {
      fov: 0.6,
      distance: 4,
      minDistance: 2,
      maxDistance: 8,
      yaw: 0.4,
      pitch: 0.25,
      pitchLimits: [-0.6, 1.2],
      target: [0, 0, 0],
      autoRotate: 0.35,
      interactive: true,
      exposure: 1,
      warmth: 0.5,
      preserve: false,
      size: [0, 0],
      ...opts,
    };
    if (reducedMotion()) this.opts.autoRotate = 0;
    this.yaw = this.targetYaw = this.opts.yaw;
    this.pitch = this.targetPitch = this.opts.pitch;
    this.distance = this.targetDistance = this.opts.distance;
    gl.enable(gl.DEPTH_TEST);
    // Procedural meshes are closed; depth testing alone hides back faces, so winding never matters.
    gl.disable(gl.CULL_FACE);
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
    // Stop drawing while the canvas is scrolled out of view; resume when it comes back.
    if (typeof IntersectionObserver !== "undefined" && !this.opts.size[0]) {
      this.io = new IntersectionObserver(([e]) => {
        this.visible = e.isIntersecting;
        if (this.visible) this.invalidate();
      });
      this.io.observe(canvas);
    }
    if (this.opts.interactive) this.bindControls();
    this.resize();
  }

  /* ---------- scene ---------- */

  setItems(items: Item[]) {
    // Free textures no longer referenced (e.g. after a colour change re-draws a garment).
    const keep = new Set<TexImageSource>();
    for (const it of items) if (it.material.kind === "fabric") [it.material.albedo, it.material.height, it.material.mask].forEach((t) => keep.add(t));
    for (const [src, tex] of this.textures) if (!keep.has(src)) (this.gl.deleteTexture(tex), this.textures.delete(src));
    this.items = items;
    this.invalidate();
  }

  setView(v: { yaw?: number; pitch?: number; distance?: number; target?: Vec3 }, immediate = false) {
    if (v.target) this.opts.target = v.target;
    if (v.yaw != null) this.targetYaw = v.yaw;
    if (v.pitch != null) this.targetPitch = v.pitch;
    if (v.distance != null) this.targetDistance = v.distance;
    if (immediate) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.distance = this.targetDistance;
    }
    this.invalidate();
  }

  zoom(factor: number) {
    this.targetDistance = Math.min(this.opts.maxDistance, Math.max(this.opts.minDistance, this.targetDistance * factor));
    this.poke();
  }

  set autoRotate(speed: number) {
    this.opts.autoRotate = reducedMotion() ? 0 : speed;
    this.invalidate();
  }

  /* ---------- loop ---------- */

  invalidate() {
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private poke() {
    this.idleUntil = performance.now() + 2500;
    this.invalidate();
  }

  private frame(now: number) {
    this.raf = 0;
    if (!this.visible) {
      this.last = 0;
      return;
    }
    const t = (now - this.start) / 1000;
    const raw = this.last ? now - this.last : 16;
    const dt = Math.min(0.05, raw / 1000);
    this.last = now;
    this.adapt(raw);
    let moving = false;
    if (this.opts.autoRotate && now > this.idleUntil) {
      this.targetYaw += this.opts.autoRotate * dt;
      moving = true;
    }
    const k = 1 - Math.pow(0.0015, dt);
    const ease = (a: number, b: number) => (Math.abs(b - a) < 1e-4 ? b : a + (b - a) * k);
    const before = this.yaw + this.pitch + this.distance;
    this.yaw = ease(this.yaw, this.targetYaw);
    this.pitch = ease(this.pitch, this.targetPitch);
    this.distance = ease(this.distance, this.targetDistance);
    if (Math.abs(before - (this.yaw + this.pitch + this.distance)) > 1e-5) moving = true;
    const custom = this.onFrame?.(t, dt);
    this.draw(t);
    // onFrame/setView or a resize may already have queued the next frame; never queue two.
    if (moving || custom) this.raf ||= requestAnimationFrame((x) => this.frame(x));
    else if (!this.raf) this.last = 0;
  }

  /** Renders one frame now (used for snapshots and first paint). */
  draw(t = (performance.now() - this.start) / 1000) {
    const gl = this.gl;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const [tx, ty, tz] = this.opts.target;
    const cp = Math.cos(this.pitch);
    const eye: Vec3 = [tx + this.distance * cp * Math.sin(this.yaw), ty + this.distance * Math.sin(this.pitch), tz + this.distance * cp * Math.cos(this.yaw)];
    const proj = perspective(this.opts.fov, aspect, 0.05, 100);
    const view = lookAt(eye, this.opts.target);

    // Shadows first (transparent, no depth write), then solid materials.
    // Shadows first, then solid materials, then fabric sheets far-to-near so their soft edges blend over what is behind.
    const rank = (it: Item) => (it.material.kind === "shadow" ? 0 : it.material.kind === "fabric" ? 2 : 1);
    const farness = (it: Item) => {
      const side = it.material.kind === "fabric" ? it.material.side : 0;
      const [x, y, z] = transformPoint(it.matrix, [0, 0, side * 0.2]);
      return (x - eye[0]) ** 2 + (y - eye[1]) ** 2 + (z - eye[2]) ** 2;
    };
    const ordered = [...this.items].sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? farness(b) - farness(a) : 0));
    for (const it of ordered) {
      const m = it.material;
      const { prog, loc } = this.program(m.kind);
      gl.useProgram(prog);
      const u = (n: string) => loc.get(n) ?? null;
      gl.uniformMatrix4fv(u("uProj"), false, proj);
      gl.uniformMatrix4fv(u("uView"), false, view);
      gl.uniformMatrix4fv(u("uModel"), false, it.matrix);
      gl.uniform3fv(u("uEye"), eye);
      gl.uniform1f(u("uTime"), t);
      gl.uniform1f(u("uExposure"), this.opts.exposure);
      gl.uniform1f(u("uWarmth"), this.opts.warmth);
      if (m.kind === "shadow") {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(u("uOpacity"), m.opacity);
      } else if (m.kind === "fabric") {
        // Opaque inside; the shader fades the one-pixel silhouette edge (premultiplied).
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(true);
      } else {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
      if (m.kind === "metal") {
        gl.uniform3fv(u("uColor"), m.color);
        gl.uniform1f(u("uRough"), m.rough);
      } else if (m.kind === "gem") {
        gl.uniform3fv(u("uColor"), m.color);
        gl.uniform1f(u("uIor"), m.ior);
        gl.uniform1f(u("uDisp"), m.dispersion);
      } else if (m.kind === "pearl") {
        gl.uniform3fv(u("uColor"), m.color);
      } else if (m.kind === "fabric") {
        this.bindTexture(0, m.albedo, u("uAlbedo"));
        this.bindTexture(1, m.height, u("uHeight"));
        this.bindTexture(2, m.mask, u("uMask"));
        const w = "width" in m.height ? (m.height as { width: number }).width : 256;
        const h = "height" in m.height ? (m.height as { height: number }).height : 256;
        gl.uniform2f(u("uTexel"), 1 / w, 1 / h);
        gl.uniform2f(u("uSize"), m.size[0], m.size[1]);
        gl.uniform1f(u("uPuff"), m.puff);
        gl.uniform1f(u("uSide"), m.side);
        gl.uniform1f(u("uSway"), reducedMotion() ? 0 : m.sway);
      }
      const mesh = this.mesh(it.geometry);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    }
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  /** Renders the current scene and returns it as an image (canvas must use `preserve: true`). */
  snapshot(type = "image/webp", quality = 0.9): string {
    this.draw();
    return this.canvas.toDataURL(type, quality);
  }

  /* ---------- GPU resources ---------- */

  private program(kind: ProgramKind) {
    let p = this.programs.get(kind);
    if (p) return p;
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${kind} shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, PROGRAMS[kind][0]));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, PROGRAMS[kind][1]));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`${kind} link: ${gl.getProgramInfoLog(prog)}`);
    const loc = new Map<string, WebGLUniformLocation | null>();
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i)!;
      loc.set(info.name, gl.getUniformLocation(prog, info.name));
    }
    p = { prog, loc };
    this.programs.set(kind, p);
    return p;
  }

  private mesh(g: Geometry): GpuMesh {
    const cached = this.meshes.get(g);
    if (cached) return cached;
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    const attr = (index: number, data: number[], size: number) => {
      const b = gl.createBuffer()!;
      buffers.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, 0, 0);
    };
    attr(0, g.positions, 3);
    attr(1, g.normals, 3);
    attr(2, g.uvs.length ? g.uvs : new Array((g.positions.length / 3) * 2).fill(0), 2);
    const ib = gl.createBuffer()!;
    buffers.push(ib);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const m = { vao, count: g.indices.length, buffers };
    this.meshes.set(g, m);
    this.ownedMeshes.push(m);
    return m;
  }

  private bindTexture(unit: number, src: TexImageSource, loc: WebGLUniformLocation | null) {
    const gl = this.gl;
    let tex = this.textures.get(src);
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (!tex) {
      tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.textures.set(src, tex);
    } else gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  /** Drop resolution after a run of slow frames; creep back up once frames are consistently fast. */
  private adapt(ms: number) {
    if (this.opts.size[0] > 0) return;
    if (ms > 40) (this.slowFrames++, (this.fastFrames = 0));
    else if (ms < 20) (this.fastFrames++, (this.slowFrames = 0));
    if (this.slowFrames >= 6 && this.quality > 0.4) {
      this.quality = Math.max(0.4, this.quality * 0.7);
      this.slowFrames = 0;
    } else if (this.fastFrames >= 120 && this.quality < 1) {
      this.quality = Math.min(1, this.quality * 1.15);
      this.fastFrames = 0;
    }
  }

  private resize() {
    const dpr = Math.min(2, typeof devicePixelRatio === "number" ? devicePixelRatio : 1) * this.quality;
    const fixed = this.opts.size[0] > 0;
    const w = fixed ? this.opts.size[0] : Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = fixed ? this.opts.size[1] : Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
    }
  }

  /* ---------- controls: drag to orbit, pinch / buttons to zoom, arrow keys for keyboard users ---------- */

  private bindControls() {
    const c = this.canvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    c.style.touchAction = "pan-y";
    c.style.cursor = "grab";
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture(e.pointerId);
      c.style.cursor = "grabbing";
      this.poke();
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoom(pinch / d);
        pinch = d;
      } else {
        this.targetYaw -= (e.clientX - p.x) * 0.008;
        this.targetPitch = Math.min(this.opts.pitchLimits[1], Math.max(this.opts.pitchLimits[0], this.targetPitch + (e.clientY - p.y) * 0.006));
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.poke();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
      c.style.cursor = "grab";
    };
    const key = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = {
        ArrowLeft: () => (this.targetYaw += 0.25),
        ArrowRight: () => (this.targetYaw -= 0.25),
        ArrowUp: () => (this.targetPitch = Math.min(this.opts.pitchLimits[1], this.targetPitch + 0.15)),
        ArrowDown: () => (this.targetPitch = Math.max(this.opts.pitchLimits[0], this.targetPitch - 0.15)),
        "+": () => this.zoom(0.85),
        "=": () => this.zoom(0.85),
        "-": () => this.zoom(1.18),
      };
      const fn = map[e.key];
      if (!fn) return;
      e.preventDefault();
      fn();
      this.poke();
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("keydown", key);
    this.cleanup.push(() => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.removeEventListener("keydown", key);
    });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.io?.disconnect();
    this.cleanup.forEach((f) => f());
    const gl = this.gl;
    for (const m of this.ownedMeshes) {
      gl.deleteVertexArray(m.vao);
      m.buffers.forEach((b) => gl.deleteBuffer(b));
    }
    for (const t of this.textures.values()) gl.deleteTexture(t);
    for (const p of this.programs.values()) gl.deleteProgram(p.prog);
    this.items = [];
  }
}

