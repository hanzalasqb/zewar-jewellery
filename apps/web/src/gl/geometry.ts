import { transformDir, transformPoint, type Mat4, type Vec3 } from "./math";

/** Plain indexed triangle mesh data. Builders below generate everything procedurally — no model files. */
export interface Geometry {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

const empty = (): Geometry => ({ positions: [], normals: [], uvs: [], indices: [] });

/** Torus around the Y axis (a ring lying flat); `arc` < 2π makes a partial hoop. */
export function torus(R: number, r: number, radial = 24, tubular = 96, arc = Math.PI * 2): Geometry {
  const g = empty();
  for (let j = 0; j <= radial; j++)
    for (let i = 0; i <= tubular; i++) {
      const u = (i / tubular) * arc;
      const v = (j / radial) * Math.PI * 2;
      const cx = Math.cos(u) * R, cz = Math.sin(u) * R;
      const nx = Math.cos(v) * Math.cos(u), ny = Math.sin(v), nz = Math.cos(v) * Math.sin(u);
      g.positions.push(cx + r * nx, r * ny, cz + r * nz);
      g.normals.push(nx, ny, nz);
      g.uvs.push(i / tubular, j / radial);
    }
  for (let j = 1; j <= radial; j++)
    for (let i = 1; i <= tubular; i++) {
      const a = (tubular + 1) * j + i - 1, b = (tubular + 1) * (j - 1) + i - 1, c = (tubular + 1) * (j - 1) + i, d = (tubular + 1) * j + i;
      g.indices.push(a, b, d, b, c, d);
    }
  return g;
}

/** Revolves a [radius, y] profile around Y. With `flat`, every face gets its own normal (faceted gems). */
export function lathe(profile: [number, number][], segments: number, flat = false, phase = 0): Geometry {
  const g = empty();
  if (!flat) {
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2 + phase;
      const c = Math.cos(a), s = Math.sin(a);
      profile.forEach(([r, y], k) => {
        const [pr, py] = profile[Math.max(0, k - 1)];
        const [nr, ny] = profile[Math.min(profile.length - 1, k + 1)];
        const dy = ny - py, dr = nr - pr;
        const len = Math.hypot(dy, dr) || 1;
        g.positions.push(r * c, y, r * s);
        g.normals.push((dy / len) * c, -dr / len, (dy / len) * s);
        g.uvs.push(i / segments, k / (profile.length - 1));
      });
    }
    const n = profile.length;
    for (let i = 0; i < segments; i++)
      for (let k = 0; k < n - 1; k++) {
        const a = i * n + k, b = (i + 1) * n + k;
        g.indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    return g;
  }
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2 + phase, a1 = ((i + 1) / segments) * Math.PI * 2 + phase;
    for (let k = 0; k < profile.length - 1; k++) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
      const p = [
        [r0 * Math.cos(a0), y0, r0 * Math.sin(a0)],
        [r0 * Math.cos(a1), y0, r0 * Math.sin(a1)],
        [r1 * Math.cos(a1), y1, r1 * Math.sin(a1)],
        [r1 * Math.cos(a0), y1, r1 * Math.sin(a0)],
      ] as Vec3[];
      pushFlatQuad(g, p);
    }
  }
  return g;
}

function pushFlatQuad(g: Geometry, p: Vec3[]) {
  // Normal from the two diagonals, oriented outwards from the Y axis / upwards.
  const e1: Vec3 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  const e2: Vec3 = [p[3][0] - p[1][0], p[3][1] - p[1][1], p[3][2] - p[1][2]];
  let n: Vec3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const c: Vec3 = [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2, (p[0][2] + p[2][2]) / 2];
  const l = Math.hypot(...n) || 1;
  n = [n[0] / l, n[1] / l, n[2] / l];
  if (n[0] * c[0] + n[2] * c[2] + n[1] * Math.sign(c[1] || 1) * 0.0001 < 0) n = [-n[0], -n[1], -n[2]];
  const base = g.positions.length / 3;
  for (const q of p) {
    g.positions.push(...q);
    g.normals.push(...n);
    g.uvs.push(0, 0);
  }
  g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/** Round brilliant cut: pavilion → girdle → crown → table, faceted. Height ≈ 0.62 × diameter. */
export function brilliant(diameter = 1, facets = 16): Geometry {
  const r = diameter / 2;
  return lathe(
    [
      [0.001, -0.43 * diameter],
      [r * 0.55, -0.2 * diameter],
      [r, 0],
      [r, 0.02 * diameter],
      [r * 0.78, 0.12 * diameter],
      [r * 0.56, 0.17 * diameter],
      [0.001, 0.17 * diameter],
    ],
    facets,
    true,
    Math.PI / facets,
  );
}

/** Emerald (step) cut approximated with 8 facets and a wide table. */
export const stepCut = (diameter = 1) =>
  lathe(
    [
      [0.001, -0.32 * diameter],
      [diameter * 0.34, -0.12 * diameter],
      [diameter * 0.5, 0],
      [diameter * 0.5, 0.03 * diameter],
      [diameter * 0.38, 0.15 * diameter],
      [0.001, 0.15 * diameter],
    ],
    8,
    true,
    Math.PI / 8,
  );

export const sphere = (r: number, w = 32, h = 20): Geometry =>
  lathe(
    Array.from({ length: h + 1 }, (_, i) => {
      const t = (i / h) * Math.PI;
      return [Math.max(0.0001, Math.sin(t) * r), -Math.cos(t) * r] as [number, number];
    }),
    w,
  );

export const cylinder = (r: number, h: number, segs = 16): Geometry =>
  lathe(
    [
      [0.0001, -h / 2],
      [r, -h / 2],
      [r, h / 2],
      [0.0001, h / 2],
    ],
    segs,
  );

/** A tube swept along a polyline (necklace chains, prongs, hoops). */
export function tube(points: Vec3[], radius: number, radial = 10, closed = false): Geometry {
  const g = empty();
  const n = points.length;
  let prevN: Vec3 = [0, 0, 1];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let t: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const tl = Math.hypot(...t) || 1;
    t = [t[0] / tl, t[1] / tl, t[2] / tl];
    // Parallel-transport frame to avoid twisting.
    const d = prevN[0] * t[0] + prevN[1] * t[1] + prevN[2] * t[2];
    let nn: Vec3 = [prevN[0] - d * t[0], prevN[1] - d * t[1], prevN[2] - d * t[2]];
    const nl = Math.hypot(...nn);
    nn = nl < 1e-4 ? (Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]) : [nn[0] / nl, nn[1] / nl, nn[2] / nl];
    prevN = nn;
    const bn: Vec3 = [t[1] * nn[2] - t[2] * nn[1], t[2] * nn[0] - t[0] * nn[2], t[0] * nn[1] - t[1] * nn[0]];
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const nx = Math.cos(v) * nn[0] + Math.sin(v) * bn[0];
      const ny = Math.cos(v) * nn[1] + Math.sin(v) * bn[1];
      const nz = Math.cos(v) * nn[2] + Math.sin(v) * bn[2];
      g.positions.push(p[0] + radius * nx, p[1] + radius * ny, p[2] + radius * nz);
      g.normals.push(nx, ny, nz);
      g.uvs.push(i / (n - 1), j / radial);
    }
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = ((i + 1) % n) * (radial + 1) + j;
      g.indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return g;
}

/** A w×h grid in the XY plane, centred, with UVs (garments displace it in the vertex shader). */
export function grid(w: number, h: number, nx: number, ny: number): Geometry {
  const g = empty();
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      g.positions.push((i / nx - 0.5) * w, (0.5 - j / ny) * h, 0);
      g.normals.push(0, 0, 1);
      g.uvs.push(i / nx, j / ny);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      g.indices.push(a, c, b, b, c, d);
    }
  return g;
}

/** Bakes a transform into a copy of the geometry. */
export function transformed(src: Geometry, m: Mat4): Geometry {
  const g = empty();
  for (let i = 0; i < src.positions.length; i += 3) {
    const p = transformPoint(m, [src.positions[i], src.positions[i + 1], src.positions[i + 2]]);
    const n = transformDir(m, [src.normals[i], src.normals[i + 1], src.normals[i + 2]]);
    g.positions.push(p[0], p[1], p[2]);
    g.normals.push(n[0], n[1], n[2]);
  }
  g.uvs = src.uvs.slice();
  g.indices = src.indices.slice();
  return g;
}

/** Merges several geometries into one draw call (loops, not spreads: big meshes overflow argument limits). */
export function merge(parts: Geometry[]): Geometry {
  const g = empty();
  for (const p of parts) {
    const base = g.positions.length / 3;
    for (const v of p.positions) g.positions.push(v);
    for (const v of p.normals) g.normals.push(v);
    for (const v of p.uvs) g.uvs.push(v);
    for (const i of p.indices) g.indices.push(i + base);
  }
  return g;
}
