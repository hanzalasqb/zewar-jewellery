import { useSyncExternalStore } from "react";
import { BRAND, defaultSelection, variantKey, type CartLine, type Product, type Selection } from "@store/shared";
import { client } from "./api";
import { ApiError, type Stock } from "./api/client";

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}

export interface State {
  phase: "loading" | "ready" | "error";
  products: Product[];
  stock: Stock;
  cart: CartLine[];
  wishlist: string[];
  coupon: string | null;
  cartOpen: boolean;
  recentOrders: { number: string; email: string }[];
  toasts: Toast[];
}

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(`${BRAND.id}.${key}`);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(`${BRAND.id}.${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

let state: State = {
  phase: "loading",
  products: [],
  stock: {},
  cart: read("cart", []),
  wishlist: read("wishlist", []),
  coupon: read("coupon", null),
  cartOpen: false,
  recentOrders: read("orders", []),
  toasts: [],
};

const listeners = new Set<() => void>();
function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
export const getState = () => state;
export const useStore = <T,>(sel: (s: State) => T): T =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => sel(state),
    () => sel(state),
  );

let tid = 0;
export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = ++tid;
  set((s) => ({ toasts: [...s.toasts, { id, message, tone }].slice(-3) }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3600);
}
export const errorText = (e: unknown) => (e instanceof ApiError ? (e.issues[0]?.message ?? e.message) : "Something went wrong. Please try again.");

export const stockOf = (s: State, p: Product, sel: Selection) => s.stock[p.id]?.[variantKey(p, sel)] ?? 0;
export const productStock = (s: State, p: Product) => Object.values(s.stock[p.id] ?? {}).reduce((a, b) => a + b, 0);
const sameLine = (a: CartLine, productId: string, sel: Selection) => a.productId === productId && JSON.stringify(a.selection) === JSON.stringify(sel);

export const actions = {
  async load() {
    try {
      const { products, stock } = await client.catalog();
      // Drop cart lines for products that no longer exist.
      const ids = new Set(products.map((p) => p.id));
      set((s) => ({ phase: "ready", products, stock, cart: s.cart.filter((l) => ids.has(l.productId)) }));
    } catch {
      set({ phase: "error" });
    }
  },
  async refreshStock() {
    const { stock } = await client.catalog();
    set({ stock });
  },
  addToCart(p: Product, selection: Selection, qty = 1) {
    const left = stockOf(state, p, selection);
    const inCart = state.cart.filter((l) => sameLine(l, p.id, selection)).reduce((a, l) => a + l.qty, 0);
    if (inCart + qty > left) {
      toast(left ? `Only ${left} left in this option` : "This option is sold out", "error");
      return false;
    }
    set((s) => {
      const existing = s.cart.find((l) => sameLine(l, p.id, selection));
      const cart = existing ? s.cart.map((l) => (l === existing ? { ...l, qty: Math.min(10, l.qty + qty) } : l)) : [...s.cart, { productId: p.id, selection, qty }];
      write("cart", cart);
      return { cart, cartOpen: true };
    });
    return true;
  },
  setQty(index: number, qty: number) {
    set((s) => {
      const cart = qty <= 0 ? s.cart.filter((_, i) => i !== index) : s.cart.map((l, i) => (i === index ? { ...l, qty: Math.min(10, qty) } : l));
      write("cart", cart);
      return { cart };
    });
  },
  clearCart() {
    write("cart", []);
    set({ cart: [], coupon: null });
    write("coupon", null);
  },
  setCoupon(code: string | null) {
    write("coupon", code);
    set({ coupon: code });
  },
  openCart: (open: boolean) => set({ cartOpen: open }),
  toggleWishlist(p: Product) {
    set((s) => {
      const has = s.wishlist.includes(p.id);
      const wishlist = has ? s.wishlist.filter((x) => x !== p.id) : [...s.wishlist, p.id];
      write("wishlist", wishlist);
      toast(has ? `Removed ${p.name} from your wishlist` : `Saved ${p.name} to your wishlist`, "info");
      return { wishlist };
    });
  },
  rememberOrder(number: string, email: string) {
    set((s) => {
      const recentOrders = [{ number, email }, ...s.recentOrders.filter((o) => o.number !== number)].slice(0, 10);
      write("orders", recentOrders);
      return { recentOrders };
    });
  },
  quickAdd(p: Product) {
    return actions.addToCart(p, defaultSelection(p));
  },
};
