import { z } from "zod";

export const OptionValueSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Swatch colour shown in the picker and fed to the 3D model. */
  hex: z.string().optional(),
  priceDelta: z.number().int().default(0),
});
export type OptionValue = z.infer<typeof OptionValueSchema>;

export const ProductOptionSchema = z.object({
  id: z.string(), // "color", "size", "metal", "stone"...
  label: z.string(),
  kind: z.enum(["swatch", "chip"]),
  values: z.array(OptionValueSchema).min(1),
});
export type ProductOption = z.infer<typeof ProductOptionSchema>;

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  details: string[];
  price: number; // paisa, before option deltas
  compareAt?: number;
  options: ProductOption[];
  /** Brand-specific 3D model parameters (garment kind, jewellery kind, print...). */
  model: Record<string, string | number>;
  badges: string[];
  rating: number;
  reviews: number;
  featured?: boolean;
}

export type Selection = Record<string, string>;

export const defaultSelection = (p: Product): Selection => Object.fromEntries(p.options.map((o) => [o.id, o.values[0].id]));

/** Stable key for a product variant, e.g. "black/m". Used for stock and cart lines. */
export const variantKey = (p: Product, sel: Selection) => p.options.map((o) => sel[o.id]).join("/");

export function isValidSelection(p: Product, sel: Selection): boolean {
  return p.options.every((o) => o.values.some((v) => v.id === sel[o.id]));
}

export function unitPrice(p: Product, sel: Selection): number {
  return p.options.reduce((sum, o) => sum + (o.values.find((v) => v.id === sel[o.id])?.priceDelta ?? 0), p.price);
}

export function describeSelection(p: Product, sel: Selection): string {
  return p.options.map((o) => o.values.find((v) => v.id === sel[o.id])?.label ?? "").filter(Boolean).join(" · ");
}

export function optionValue(p: Product, optionId: string, sel: Selection): OptionValue | undefined {
  return p.options.find((o) => o.id === optionId)?.values.find((v) => v.id === sel[optionId]);
}
