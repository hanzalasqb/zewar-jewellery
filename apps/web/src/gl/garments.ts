import { grid, type Geometry } from "./geometry";
import { compose, rotationX, scaling, translation } from "./math";
import type { Item } from "./renderer";

/**
 * Garments are drawn as 2D sewing patterns on a canvas, then "inflated" into 3D:
 * the silhouette becomes a mask, a blurred copy becomes a height map, and a grid mesh is pushed
 * out front and back by that height so the two halves meet exactly at the seam line.
 * Colour, prints and stitching are just canvas drawing, so colour swaps are instant.
 */

export type GarmentKind = "tee" | "hoodie" | "sweatshirt" | "bomber" | "kurta" | "joggers";
export type PrintKind = "none" | "wordmark" | "stripes" | "graphic" | "embroidery" | "pocket";

export interface GarmentSpec {
  kind: GarmentKind;
  color: string;
  accent?: string;
  print?: PrintKind;
  text?: string;
}

const W = 512;
const H = 640;
export const GARMENT_SIZE: [number, number] = [2, 2.5];

type Pt = [number, number];
type Ctx = CanvasRenderingContext2D;

/* ---------- silhouettes (front view, canvas pixels) ---------- */

function path(ctx: Ctx, pts: (Pt | [Pt, Pt])[]) {
  ctx.beginPath();
  const first = pts[0] as Pt;
  ctx.moveTo(first[0], first[1]);
  for (const p of pts.slice(1)) {
    if (Array.isArray(p[0])) {
      const [c, e] = p as [Pt, Pt];
      ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]);
    } else ctx.lineTo((p as Pt)[0], (p as Pt)[1]);
  }
  ctx.closePath();
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [W - x, y] as Pt).reverse();

function silhouette(ctx: Ctx, kind: GarmentKind) {
  switch (kind) {
    case "tee": {
      const right: Pt[] = [[338, 70], [424, 104], [500, 232], [432, 272], [394, 214], [400, 598]];
      path(ctx, [[174, 70], [[256, 128], [338, 70]], ...right.slice(1), ...mirror(right.slice(1)).map((p) => p)]);
      break;
    }
    case "sweatshirt":
    case "hoodie":
    case "bomber": {
      const long = kind === "bomber" ? 560 : 590;
      const right: Pt[] = [[334, 64], [418, 98], [470, 250], [498, 560], [440, 574], [404, 300], [404, long]];
      const neck: [Pt, Pt] = kind === "bomber" ? [[256, 108], [334, 64]] : [[256, 118], [334, 64]];
      path(ctx, [[178, 64], neck, ...right.slice(1), ...mirror(right.slice(1))]);
      if (kind === "hoodie") {
        ctx.moveTo(168, 82);
        ctx.bezierCurveTo(150, -10, 362, -10, 344, 82);
        ctx.quadraticCurveTo(256, 140, 168, 82);
      }
      break;
    }
    case "kurta": {
      const right: Pt[] = [[300, 52], [392, 88], [446, 240], [476, 470], [424, 482], [384, 268], [404, 632]];
      path(ctx, [[212, 52], [[256, 72], [300, 52]], ...right.slice(1), ...mirror(right.slice(1))]);
      break;
    }
    case "joggers": {
      path(ctx, [[150, 40], [362, 40], [370, 90], [384, 340], [366, 608], [278, 612], [262, 240], [250, 240], [234, 612], [146, 608], [128, 340], [142, 90]]);
      break;
    }
  }
}

/* ---------- details ---------- */

function stitch(ctx: Ctx, pts: Pt[], dark = 0.22) {
  ctx.save();
  ctx.strokeStyle = `rgba(0,0,0,${dark})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.stroke();
  ctx.restore();
}

function rib(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  for (let i = x + 4; i < x + w; i += 7) {
    ctx.beginPath();
    ctx.moveTo(i, y);
    ctx.lineTo(i, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

function details(ctx: Ctx, spec: GarmentSpec, front: boolean) {
  const k = spec.kind;
  const accent = spec.accent ?? "#ffffff";
  // Soft folds: vertical shading bands give the cloth some drape.
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(0,0,0,0.18)");
  g.addColorStop(0.3, "rgba(255,255,255,0.05)");
  g.addColorStop(0.55, "rgba(0,0,0,0.04)");
  g.addColorStop(0.8, "rgba(255,255,255,0.04)");
  g.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (k === "tee") {
    stitch(ctx, [[112, 590], [400, 590]]);
    stitch(ctx, [[432, 262], [500, 224]]);
    stitch(ctx, [[80, 262], [12, 224]]);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(176, 74);
    ctx.quadraticCurveTo(256, front ? 132 : 92, 336, 74);
    ctx.stroke();
  }
  if (k === "hoodie" || k === "sweatshirt" || k === "bomber") {
    rib(ctx, 104, (k === "bomber" ? 560 : 590) - 26, 304, 28);
    rib(ctx, 440, 540, 58, 30);
    rib(ctx, 14, 540, 58, 30);
    stitch(ctx, [[420, 104], [404, 300]]);
    stitch(ctx, [[92, 104], [108, 300]]);
  }
  if (k === "sweatshirt") {
    rib(ctx, 180, 64, 152, 18);
  }
  if (k === "hoodie" && front) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    path(ctx, [[176, 400], [336, 400], [372, 530], [140, 530]]);
    ctx.fill();
    stitch(ctx, [[176, 404], [140, 528], [372, 528], [336, 404], [176, 404]], 0.3);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    for (const x of [232, 280]) {
      ctx.beginPath();
      ctx.moveTo(x, 112);
      ctx.lineTo(x + (x < 256 ? -6 : 6), 220);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(256, 82, 70, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (k === "bomber" && front) {
    rib(ctx, 196, 64, 120, 24);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(252, 96, 8, 440);
    ctx.fillStyle = accent;
    ctx.fillRect(254, 96, 4, 440);
    ctx.fillRect(244, 96, 24, 14);
    stitch(ctx, [[150, 300], [210, 280]], 0.35);
    stitch(ctx, [[362, 300], [302, 280]], 0.35);
  }
  if (k === "kurta") {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(220, 44, 72, 16);
    if (front) {
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(246, 60, 20, 200);
      ctx.fillStyle = accent;
      for (let y = 84; y < 250; y += 38) {
        ctx.beginPath();
        ctx.arc(256, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    stitch(ctx, [[124, 520], [124, 632]], 0.4);
    stitch(ctx, [[388, 520], [388, 632]], 0.4);
    rib(ctx, 424, 462, 52, 16);
    rib(ctx, 36, 462, 52, 16);
  }
  if (k === "joggers") {
    rib(ctx, 144, 40, 224, 44);
    rib(ctx, 148, 584, 88, 26);
    rib(ctx, 276, 584, 88, 26);
    stitch(ctx, [[256, 90], [256, 240]]);
    if (front) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(240, 84);
      ctx.lineTo(232, 160);
      ctx.moveTo(272, 84);
      ctx.lineTo(280, 160);
      ctx.stroke();
      stitch(ctx, [[160, 110], [200, 220]], 0.3);
      stitch(ctx, [[352, 110], [312, 220]], 0.3);
    }
  }

  if (spec.print === "stripes") {
    ctx.fillStyle = accent;
    for (let y = 180; y < 600; y += 64) ctx.fillRect(0, y, W, 20);
  }
  if (!front) return;
  ctx.save();
  switch (spec.print) {
    case "wordmark": {
      ctx.fillStyle = accent;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = spec.text ?? "QABA";
      ctx.font = `${text.length > 6 ? 58 : 84}px Anton, Impact, "Arial Narrow", sans-serif`;
      ctx.fillText(text.toUpperCase(), 256, k === "joggers" ? 460 : 250);
      ctx.font = "600 15px 'DM Sans', Arial, sans-serif";
      ctx.fillText("EST. LAHORE · 2026", 256, k === "joggers" ? 500 : 302);
      break;
    }
    case "graphic": {
      const cx = 256, cy = 260;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 78, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 110, cy + 8, 220, 10);
      ctx.fillRect(cx - 90, cy + 28, 180, 8);
      ctx.fillRect(cx - 70, cy + 44, 140, 6);
      ctx.font = "26px Anton, Impact, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((spec.text ?? "Golden hour").toUpperCase(), cx, cy + 90);
      break;
    }
    case "embroidery": {
      ctx.fillStyle = accent;
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (0.05 + (i / 25) * 0.9);
        ctx.beginPath();
        ctx.arc(256 - Math.cos(a) * 70, 56 + Math.sin(a) * 40, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let y = 300; y < 600; y += 46)
        for (let x = 150; x < 370; x += 46) {
          ctx.beginPath();
          ctx.arc(x + ((y / 46) % 2) * 23, y, 3, 0, Math.PI * 2);
          ctx.globalAlpha = 0.55;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      break;
    }
    case "pocket":
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(298, 170, 64, 70);
      stitch(ctx, [[298, 170], [298, 240], [362, 240], [362, 170]], 0.35);
      ctx.fillStyle = accent;
      ctx.fillRect(320, 200, 20, 3);
      break;
  }
  ctx.restore();
}

/* ---------- textures ---------- */

function canvas(w = W, h = H) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function noise(ctx: Ctx) {
  const img = ctx.getImageData(0, 0, W, H);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed / 2147483647) - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function albedo(spec: GarmentSpec, front: boolean) {
  const c = canvas();
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = spec.color;
  ctx.fillRect(0, 0, W, H);
  details(ctx, spec, front);
  noise(ctx);
  return c;
}

/** Separable box blur repeated three times ≈ Gaussian, on a single channel. */
function blur(src: Float32Array, w: number, h: number, r: number) {
  let a = src, b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (2 * r + 1);
        acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

function shape(kind: GarmentKind) {
  const mask = canvas();
  const mctx = mask.getContext("2d")!;
  mctx.fillStyle = "#000";
  mctx.fillRect(0, 0, W, H);
  mctx.fillStyle = "#fff";
  silhouette(mctx, kind);
  mctx.fill("nonzero");

  // Height from a blurred, quarter-resolution mask: 0 at the seam, rising smoothly inside.
  const hw = W / 4, hh = H / 4;
  const small = canvas(hw, hh);
  const sctx = small.getContext("2d")!;
  sctx.drawImage(mask, 0, 0, hw, hh);
  const px = sctx.getImageData(0, 0, hw, hh);
  const f = new Float32Array(hw * hh);
  for (let i = 0; i < f.length; i++) f[i] = px.data[i * 4] / 255;
  const bl = blur(f, hw, hh, 5);
  for (let i = 0; i < f.length; i++) {
    const v = Math.pow(Math.min(1, Math.max(0, (bl[i] - 0.5) * 2)), 0.6) * (f[i] > 0.5 ? 1 : 0);
    px.data[i * 4] = px.data[i * 4 + 1] = px.data[i * 4 + 2] = v * 255;
    px.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(px, 0, 0);
  return { mask, height: small };
}

const shapeCache = new Map<GarmentKind, ReturnType<typeof shape>>();
const texCache = new Map<string, { front: HTMLCanvasElement; back: HTMLCanvasElement }>();
const gridCache = new Map<GarmentKind, Geometry>();
let shadowGeo: Geometry | null = null;

/**
 * The full grid would rasterise the whole rectangle and throw most fragments away.
 * Keep only triangles that touch the silhouette (with a one-cell margin), so the GPU shades the garment and little else.
 */
function trimmedGrid(kind: GarmentKind, mask: HTMLCanvasElement): Geometry {
  const nx = 96, ny = 120;
  const full = grid(GARMENT_SIZE[0], GARMENT_SIZE[1], nx, ny);
  const ctx = mask.getContext("2d")!;
  const px = ctx.getImageData(0, 0, mask.width, mask.height).data;
  const inside = (i: number, j: number) => {
    const x = Math.min(mask.width - 1, Math.round((i / nx) * (mask.width - 1)));
    const y = Math.min(mask.height - 1, Math.round((j / ny) * (mask.height - 1)));
    return px[(y * mask.width + x) * 4] > 127;
  };
  const keep = new Uint8Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++)
      if (inside(i, j))
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ii = i + di, jj = j + dj;
            if (ii >= 0 && jj >= 0 && ii <= nx && jj <= ny) keep[jj * (nx + 1) + ii] = 1;
          }
  const indices: number[] = [];
  for (let t = 0; t < full.indices.length; t += 3) {
    const [a, b, c] = [full.indices[t], full.indices[t + 1], full.indices[t + 2]];
    if (keep[a] || keep[b] || keep[c]) indices.push(a, b, c);
  }
  const g = { ...full, indices };
  gridCache.set(kind, g);
  return g;
}

export function garmentTextures(spec: GarmentSpec) {
  const s = shapeCache.get(spec.kind) ?? shape(spec.kind);
  shapeCache.set(spec.kind, s);
  const key = JSON.stringify(spec);
  let t = texCache.get(key);
  if (!t) {
    t = { front: albedo(spec, true), back: albedo(spec, false) };
    texCache.set(key, t);
    if (texCache.size > 40) texCache.delete(texCache.keys().next().value as string);
  }
  return { ...s, ...t };
}

export function buildGarment(spec: GarmentSpec, sway = 0.035): Item[] {
  const t = garmentTextures(spec);
  const gridGeo = gridCache.get(spec.kind) ?? trimmedGrid(spec.kind, t.mask);
  shadowGeo ??= grid(1, 1, 1, 1);
  const common = { height: t.height, mask: t.mask, puff: spec.kind === "joggers" ? 0.22 : 0.3, size: GARMENT_SIZE, sway } as const;
  const id = compose();
  return [
    { geometry: shadowGeo, material: { kind: "shadow", opacity: 0.3 }, matrix: compose(translation(0, -1.38, 0), rotationX(-Math.PI / 2), scaling(2.3)) },
    { geometry: gridGeo, material: { kind: "fabric", albedo: t.front, side: 1, ...common }, matrix: id },
    { geometry: gridGeo, material: { kind: "fabric", albedo: t.back, side: -1, ...common }, matrix: id },
  ];
}
