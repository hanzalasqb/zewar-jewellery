import { z } from "zod";
import { isValidSelection, unitPrice, variantKey, type Product, type Selection } from "./catalog";

export const CartLineSchema = z.object({
  productId: z.string(),
  selection: z.record(z.string(), z.string()),
  qty: z.number().int().min(1).max(10),
});
export type CartLine = z.infer<typeof CartLineSchema>;

export interface Coupon {
  code: string;
  kind: "percent" | "fixed" | "shipping";
  value: number; // percent, or paisa for fixed
  minSubtotal: number;
  description: string;
}

export interface ShippingRules {
  flatFee: number;
  freeOver: number | null;
  codFee: number;
}

export interface PricedLine extends CartLine {
  key: string;
  product: Product;
  unit: number;
  total: number;
}

export interface Quote {
  lines: PricedLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  total: number;
  coupon: Coupon | null;
  couponError: string | null;
  freeShippingGap: number | null;
}

export class CartError extends Error {}

/**
 * The single pricing function. The browser uses it for the live cart; the API runs the same code
 * on the server and ignores any prices the client sends.
 */
export function quote(
  lines: CartLine[],
  catalog: Product[],
  opts: { coupons: Coupon[]; couponCode?: string | null; shipping: ShippingRules; payment?: "cod" | "bank" },
): Quote {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const merged = new Map<string, PricedLine>();
  for (const l of lines) {
    const product = byId.get(l.productId);
    if (!product) throw new CartError(`Unknown product ${l.productId}`);
    if (!isValidSelection(product, l.selection)) throw new CartError(`Choose all options for ${product.name}`);
    const key = `${product.id}:${variantKey(product, l.selection)}`;
    const unit = unitPrice(product, l.selection);
    const prev = merged.get(key);
    const qty = Math.min(10, (prev?.qty ?? 0) + l.qty);
    merged.set(key, { productId: product.id, selection: l.selection as Selection, qty, key, product, unit, total: unit * qty });
  }
  const priced = [...merged.values()];
  const subtotal = priced.reduce((s, l) => s + l.total, 0);
  const itemCount = priced.reduce((s, l) => s + l.qty, 0);

  let coupon: Coupon | null = null;
  let couponError: string | null = null;
  const code = opts.couponCode?.trim().toUpperCase();
  if (code) {
    const c = opts.coupons.find((x) => x.code === code);
    if (!c) couponError = "That code isn't valid";
    else if (subtotal < c.minSubtotal) couponError = `Spend ${Math.round(c.minSubtotal / 100).toLocaleString("en-PK")} rupees to use ${c.code}`;
    else coupon = c;
  }

  const discount = !coupon ? 0 : coupon.kind === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.kind === "fixed" ? Math.min(coupon.value, subtotal) : 0;
  const after = subtotal - discount;
  const free = coupon?.kind === "shipping" || (opts.shipping.freeOver != null && after >= opts.shipping.freeOver) || itemCount === 0;
  const shipping = free ? 0 : opts.shipping.flatFee;
  const codFee = opts.payment === "cod" && itemCount > 0 ? opts.shipping.codFee : 0;
  return {
    lines: priced,
    itemCount,
    subtotal,
    discount,
    shipping,
    codFee,
    total: after + shipping + codFee,
    coupon,
    couponError,
    freeShippingGap: opts.shipping.freeOver != null && !free ? opts.shipping.freeOver - after : null,
  };
}
