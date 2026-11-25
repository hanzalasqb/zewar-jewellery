import { brilliant, cylinder, grid, merge, sphere, stepCut, torus, transformed, tube, type Geometry } from "./geometry";
import { compose, hexToRgb, rotationX, rotationY, rotationZ, scaling, translation, type Vec3 } from "./math";
import type { Item, Material } from "./renderer";

export type JewelryKind = "solitaire" | "halo" | "eternity" | "pendant" | "studs" | "hoops" | "tennis" | "pearl-drops";

export interface StoneSpec {
  kind: "gem" | "pearl";
  hex: string;
  ior?: number;
  dispersion?: number;
  cut?: "round" | "emerald";
}

export interface JewelrySpec {
  kind: JewelryKind;
  metal: string; // hex
  stone: StoneSpec;
  size?: number; // carat-ish scale, 1 = default
}

const cache = new Map<string, Geometry>();
const memo = (key: string, make: () => Geometry) => cache.get(key) ?? (cache.set(key, make()), cache.get(key)!);

const metalOf = (hex: string, rough = 0.1): Material => ({ kind: "metal", color: hexToRgb(hex), rough });
function stoneOf(s: StoneSpec): Material {
  if (s.kind === "pearl") return { kind: "pearl", color: hexToRgb(s.hex) };
  return { kind: "gem", color: hexToRgb(s.hex), ior: s.ior ?? 2.42, dispersion: s.dispersion ?? 0.03 };
}
const gemGeo = (s: StoneSpec, d: number) => (s.kind === "pearl" ? memo(`pearl-${d}`, () => sphere(d / 2, 40, 24)) : s.cut === "emerald" ? memo(`step-${d}`, () => stepCut(d)) : memo(`gem-${d}`, () => brilliant(d)));

/** Four prongs rising around a stone's girdle. */
function prongs(radius: number, from: number, to: number, thick = 0.022): Geometry {
  const parts: Geometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const pts: Vec3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const r = radius * (0.55 + 0.5 * Math.sin(t * Math.PI * 0.62));
      pts.push([Math.cos(a) * r, from + (to - from) * t, Math.sin(a) * r]);
    }
    parts.push(tube(pts, thick, 8));
  }
  return merge(parts);
}

function shadow(y: number, size: number, opacity = 0.32): Item {
  return { geometry: memo("shadow", () => grid(1, 1, 1, 1)), material: { kind: "shadow", opacity }, matrix: compose(translation(0, y, 0), rotationX(-Math.PI / 2), scaling(size)) };
}

/** Builds every part of a piece as positioned meshes with metal / stone materials. Units ≈ 1 = ring radius. */
export function buildJewelry(spec: JewelrySpec): Item[] {
  const metal = metalOf(spec.metal);
  const stone = stoneOf(spec.stone);
  const s = spec.size ?? 1;
  const items: Item[] = [];
  const add = (geometry: Geometry, material: Material, matrix = compose()) => items.push({ geometry, material, matrix });

  switch (spec.kind) {
    case "solitaire":
    case "halo": {
      // Upright ring: torus in XZ rotated into XY, stone on top facing up.
      const band = memo("band", () => torus(1, 0.085, 28, 140));
      add(band, metal, rotationX(Math.PI / 2));
      const d = 0.56 * Math.cbrt(s);
      const top = 1.05 + d * 0.43;
      add(memo(`prongs-${d}`, () => prongs(d * 0.5, 1.0, top + d * 0.12)), metal);
      add(gemGeo(spec.stone, d), stone, translation(0, top, 0));
      if (spec.kind === "halo") {
        add(memo(`halo-${d}`, () => torus(d * 0.62, 0.035, 12, 64)), metal, translation(0, top - 0.005, 0));
        const small = gemGeo({ ...spec.stone, cut: "round" }, 0.08);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          add(small, stone, compose(translation(Math.cos(a) * d * 0.62, top + 0.03, Math.sin(a) * d * 0.62)));
        }
      }
      items.push(shadow(-1.12, 2.4));
      break;
    }
    case "eternity": {
      add(memo("band-wide", () => torus(1, 0.1, 28, 160)), metal, rotationX(Math.PI / 2));
      const small = gemGeo(spec.stone, 0.17);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        // Each stone sits on the outer edge, table pointing outwards.
        add(small, stone, compose(translation(Math.cos(a) * 1.085, Math.sin(a) * 1.085, 0), rotationZ(a - Math.PI / 2)));
      }
      items.push(shadow(-1.2, 2.6));
      break;
    }
    case "pendant": {
      const chain: Vec3[] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const x = (t - 0.5) * 2.6;
        chain.push([x, 1.25 - (1 - Math.pow(2 * Math.abs(t - 0.5), 1.6)) * 1.35, -0.25 * Math.cos((t - 0.5) * Math.PI)]);
      }
      add(memo("chain", () => tube(chain, 0.016, 8)), metal);
      const d = 0.5 * Math.cbrt(s);
      add(memo("bail", () => torus(0.07, 0.02, 10, 32)), metal, compose(translation(0, -0.1, -0.24), rotationZ(Math.PI / 2)));
      add(memo(`bezel-${d}`, () => torus(d * 0.52, 0.035, 14, 64)), metal, compose(translation(0, -0.17 - d * 0.52, -0.22), rotationX(Math.PI / 2)));
      add(gemGeo(spec.stone, d), stone, compose(translation(0, -0.17 - d * 0.52, -0.2), rotationX(Math.PI / 2)));
      items.push(shadow(-1.3, 2.8, 0.22));
      break;
    }
    case "studs": {
      const d = 0.55 * Math.cbrt(s);
      for (const x of [-0.6, 0.6]) {
        add(memo(`basket-${d}`, () => merge([prongs(d * 0.5, -0.32, 0.06, 0.026), transformed(torus(d * 0.36, 0.02, 10, 40), translation(0, -0.18, 0))])), metal, compose(translation(x, 0, 0), rotationX(Math.PI / 2)));
        add(gemGeo(spec.stone, d), stone, compose(translation(x, 0, 0.02), rotationX(Math.PI / 2)));
        add(memo("post", () => cylinder(0.025, 0.7)), metal, compose(translation(x, 0, -0.45), rotationX(Math.PI / 2)));
      }
      items.push(shadow(-0.75, 2.6, 0.2));
      break;
    }
    case "hoops": {
      const hoop = memo("hoop", () => torus(0.62, 0.07, 18, 96, Math.PI * 1.85));
      const small = gemGeo({ ...spec.stone, kind: spec.stone.kind === "pearl" ? "gem" : spec.stone.kind, hex: spec.stone.kind === "pearl" ? "#ffffff" : spec.stone.hex }, 0.1);
      for (const x of [-0.72, 0.72]) {
        add(hoop, metal, compose(translation(x, 0, 0), rotationX(Math.PI / 2), rotationY(Math.PI * 0.575)));
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI * 0.45 + (i / 8) * Math.PI * 0.9;
          add(small, stone.kind === "pearl" ? { kind: "gem", color: [1, 1, 1], ior: 2.42, dispersion: 0.03 } : stone, compose(translation(x + Math.sin(a) * 0.62, -Math.cos(a) * 0.62, 0.065), rotationX(Math.PI / 2)));
        }
      }
      items.push(shadow(-0.9, 3, 0.2));
      break;
    }
    case "tennis": {
      const tilt = compose(rotationX(0.55));
      add(memo("tennis-band", () => torus(1.2, 0.05, 16, 160)), metal, tilt);
      const small = gemGeo(spec.stone, 0.2);
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * Math.PI * 2;
        add(small, stone, compose(tilt, translation(Math.cos(a) * 1.2, 0.07, Math.sin(a) * 1.2)));
      }
      items.push(shadow(-0.85, 3.2, 0.25));
      break;
    }
    case "pearl-drops": {
      const d = 0.5 * Math.cbrt(s);
      for (const x of [-0.55, 0.55]) {
        const hook: Vec3[] = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const a = Math.PI * 1.3 * t;
          hook.push([x + Math.sin(a) * 0.22 - 0.0, 0.95 - (1 - Math.cos(a)) * 0.22 - t * 0.35, 0]);
        }
        add(memo(`hook-${x}`, () => tube(hook, 0.018, 8)), metal);
        add(memo("cap", () => sphere(0.07, 20, 12)), metal, translation(x, 0.36, 0));
        add(gemGeo(spec.stone, d), stone, translation(x, 0.36 - d * 0.5, 0));
      }
      items.push(shadow(-0.35, 2.4, 0.22));
      break;
    }
  }
  return items;
}

export const METALS = {
  "yellow-gold": "#ffd27a",
  "rose-gold": "#ffc1aa",
  "white-gold": "#e6e7ea",
  platinum: "#d9dde0",
  silver: "#f5f2ec",
} as const;

/** Camera framing per piece so every product fills the viewer the same way. */
export const JEWELRY_VIEW: Record<JewelryKind, { target: Vec3; distance: number; yaw: number; pitch: number }> = {
  solitaire: { target: [0, 0.3, 0], distance: 4.8, yaw: 0.95, pitch: 0.32 },
  halo: { target: [0, 0.3, 0], distance: 4.8, yaw: 0.95, pitch: 0.32 },
  eternity: { target: [0, 0, 0], distance: 4.4, yaw: 0.7, pitch: 0.3 },
  pendant: { target: [0, 0, 0], distance: 4.4, yaw: 0.25, pitch: 0.12 },
  studs: { target: [0, 0, 0], distance: 3.7, yaw: 0.45, pitch: 0.2 },
  hoops: { target: [0, 0, 0], distance: 4.6, yaw: 0.35, pitch: 0.15 },
  tennis: { target: [0, 0, 0], distance: 4.4, yaw: 0.3, pitch: 0.55 },
  "pearl-drops": { target: [0, 0.3, 0], distance: 3.2, yaw: 0.3, pitch: 0.12 },
};

export const STONES: Record<string, StoneSpec> = {
  diamond: { kind: "gem", hex: "#ffffff", ior: 2.42, dispersion: 0.035 },
  emerald: { kind: "gem", hex: "#1fbf6a", ior: 1.58, dispersion: 0.012, cut: "emerald" },
  sapphire: { kind: "gem", hex: "#2f5bff", ior: 1.77, dispersion: 0.015 },
  ruby: { kind: "gem", hex: "#ff1f45", ior: 1.77, dispersion: 0.015 },
  pearl: { kind: "pearl", hex: "#f3ece2" },
};
