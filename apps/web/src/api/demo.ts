import { BRAND, canMove, CheckoutSchema, describeSelection, initialStock, PRODUCTS, quote, variantKey, type Order, type Product } from "@store/shared";
import { ApiError, toApiError, type Stock, type StoreClient } from "./client";

const KEY = `${BRAND.id}.demo.v1`;
export const DEMO_ADMIN = { email: "admin@demo.store", password: "demo-admin" };

interface State {
  stock: Stock;
  orders: Order[];
  seq: number;
}

function variants(p: Product) {
  let all: Record<string, string>[] = [{}];
  for (const o of p.options) all = all.flatMap((k) => o.values.map((v) => ({ ...k, [o.id]: v.id })));
  return all.map((s) => variantKey(p, s));
}

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as State | null;
    if (s?.stock) return s;
  } catch {
    /* fresh */
  }
  const stock: Stock = {};
  for (const p of PRODUCTS) stock[p.id] = Object.fromEntries(variants(p).map((v) => [v, initialStock(p, v)]));
  return { stock, orders: [], seq: 0 };
}

const pause = (ms = 250) => new Promise((r) => setTimeout(r, ms + Math.random() * 150));

/** Live-demo backend: same validation, pricing and stock rules as the API, stored in this browser. */
export function createDemoClient(): StoreClient {
  let s = load();
  let admin = false;
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* memory only */
    }
  };
  const find = (n: string) => {
    const o = s.orders.find((x) => x.number === n);
    if (!o) throw new ApiError("Order not found", 404);
    return o;
  };
  return {
    mode: "demo",
    async catalog() {
      await pause(120);
      return { products: PRODUCTS, stock: s.stock };
    },
    async placeOrder(raw) {
      await pause(700);
      let input;
      try {
        input = CheckoutSchema.parse(raw);
      } catch (e) {
        throw toApiError(e);
      }
      const q = quote(input.lines, PRODUCTS, { coupons: [...BRAND.coupons], couponCode: input.coupon, shipping: BRAND.shipping, payment: input.payment });
      if (q.couponError) throw new ApiError(q.couponError, 400);
      for (const l of q.lines) {
        const left = s.stock[l.product.id]?.[variantKey(l.product, l.selection)] ?? 0;
        if (left < l.qty) throw new ApiError(left ? `Only ${left} left of ${l.product.name} (${describeSelection(l.product, l.selection)})` : `${l.product.name} (${describeSelection(l.product, l.selection)}) just sold out`, 409);
      }
      for (const l of q.lines) s.stock[l.product.id][variantKey(l.product, l.selection)] -= l.qty;
      s.seq += 1;
      const now = new Date().toISOString();
      const order: Order = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        number: `${BRAND.orderPrefix}-${1000 + s.seq}`,
        status: "placed",
        history: [{ status: "placed", at: now }],
        customer: { name: input.name, email: input.email, phone: input.phone, city: input.city, address: input.address, notes: input.notes },
        payment: input.payment,
        lines: q.lines.map((l) => ({ productId: l.product.id, name: l.product.name, variant: describeSelection(l.product, l.selection), selection: l.selection, qty: l.qty, unit: l.unit, total: l.total })),
        subtotal: q.subtotal,
        discount: q.discount,
        shipping: q.shipping,
        codFee: q.codFee,
        total: q.total,
        coupon: q.coupon?.code ?? null,
        createdAt: now,
      };
      s.orders.unshift(order);
      save();
      return order;
    },
    async track(number, email) {
      await pause();
      const o = s.orders.find((x) => x.number === number.trim().toUpperCase() && x.customer.email === email.trim().toLowerCase());
      if (!o) throw new ApiError("No order matches that number and email", 404);
      return o;
    },
    async adminLogin(email, password) {
      await pause();
      if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) throw new ApiError("Wrong email or password", 401);
      admin = true;
    },
    async adminOrders() {
      return s.orders;
    },
    async adminSetStatus(number, to) {
      await pause(200);
      const o = find(number);
      if (!canMove(o.status, to)) throw new ApiError(`Can't move an order from ${o.status} to ${to}`, 409);
      if (to === "cancelled") for (const l of o.lines) {
        const p = PRODUCTS.find((x) => x.id === l.productId);
        if (p) s.stock[p.id][variantKey(p, l.selection)] += l.qty;
      }
      o.status = to;
      o.history.push({ status: to, at: new Date().toISOString() });
      save();
      return { ...o };
    },
    async adminInventory() {
      return s.stock;
    },
    async adminSetStock(productId, variant, stock) {
      s.stock[productId][variant] = stock;
      save();
    },
    isAdmin: () => admin,
    adminLogout() {
      admin = false;
    },
  };
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(`${BRAND.id}.cart`);
    localStorage.removeItem(`${BRAND.id}.wishlist`);
  } catch {
    /* ignore */
  }
}
