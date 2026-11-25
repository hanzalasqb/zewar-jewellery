import { optionValue, type Product, type Selection } from "@store/shared";
import { buildJewelry, JEWELRY_VIEW, STONES, type JewelryKind, type StoneSpec } from "../gl/jewelry";
import type { Item, ViewOptions } from "../gl/renderer";

/** Maps a product + chosen options to the procedural jewellery model. */
export function buildModel(product: Product, selection: Selection, _opts: { still?: boolean } = {}): Item[] {
  const kind = product.model.kind as JewelryKind;
  const metal = optionValue(product, "metal", selection)?.hex ?? "#e2bf78";
  const stoneValue = optionValue(product, "stone", selection);
  let stone: StoneSpec;
  if (kind === "pearl-drops") stone = { kind: "pearl", hex: stoneValue?.hex ?? "#f3ece2" };
  else {
    const base = STONES[stoneValue?.id ?? "diamond"] ?? STONES.diamond;
    stone = { ...base, cut: product.model.cut === "emerald" ? "emerald" : base.cut };
  }
  return buildJewelry({ kind, metal, stone });
}

export function viewFor(product: Product, mode: "thumb" | "detail" | "hero"): ViewOptions {
  const v = JEWELRY_VIEW[product.model.kind as JewelryKind];
  const common = { target: v.target, yaw: v.yaw, pitch: v.pitch, exposure: 1.25, warmth: 0.7 };
  if (mode === "thumb") return { ...common, distance: v.distance * 1.08 };
  return { ...common, distance: v.distance, minDistance: v.distance * 0.55, maxDistance: v.distance * 1.5, autoRotate: mode === "hero" ? 0.4 : 0.28, interactive: true };
}
