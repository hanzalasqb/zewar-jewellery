import { ApiError, type StoreClient } from "./client";

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const KEY = "store.admin";

export function createHttpClient(): StoreClient {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(KEY);
  } catch {
    token = null;
  }
  async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(API + path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? res.statusText, res.status, data.issues);
    return data as T;
  }
  return {
    mode: "live",
    catalog: () => req("GET", "/api/products"),
    placeOrder: (input) => req("POST", "/api/orders", input),
    track: (number, email) => req("POST", "/api/orders/track", { number, email }),
    async adminLogin(email, password) {
      token = (await req<{ token: string }>("POST", "/api/admin/login", { email, password })).token;
      try {
        sessionStorage.setItem(KEY, token);
      } catch {
        /* memory only */
      }
    },
    adminOrders: () => req("GET", "/api/admin/orders"),
    adminSetStatus: (number, status) => req("PATCH", `/api/admin/orders/${encodeURIComponent(number)}`, { status }),
    adminInventory: () => req("GET", "/api/admin/inventory"),
    async adminSetStock(productId, variant, stock) {
      await req("PATCH", `/api/admin/inventory/${productId}`, { variant, stock });
    },
    isAdmin: () => !!token,
    adminLogout() {
      token = null;
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
