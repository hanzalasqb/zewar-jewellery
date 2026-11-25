import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { BRAND, defaultSelection, PRODUCTS, quote, rupees, unitPrice, variantKey, type Order } from "@store/shared";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";

const app = createApp({ jwtSecret: "store-test-secret".padEnd(40, "x"), adminEmail: "admin@example.com", adminPasswordHash: hashPassword("correct-horse-battery") });
let base = "";
const call = async <T = unknown>(method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : undefined) as T };
};

const product = PRODUCTS[0];
const sel = defaultSelection(product);
const customer = { name: "Ayesha Khan", email: "ayesha@example.com", phone: "0300 1234567", city: "Lahore", address: "House 12, Street 4, Gulberg III", payment: "cod" };

describe("pricing", () => {
  it("adds option deltas to the base price", () => {
    const expensive = { ...sel };
    for (const o of product.options) expensive[o.id] = o.values.reduce((a, b) => ((b.priceDelta ?? 0) > (a.priceDelta ?? 0) ? b : a)).id;
    assert.ok(unitPrice(product, expensive) >= unitPrice(product, sel));
  });

  it("merges duplicate lines and caps quantity at 10", () => {
    const q = quote([{ productId: product.id, selection: sel, qty: 7 }, { productId: product.id, selection: sel, qty: 7 }], PRODUCTS, { coupons: BRAND.coupons, shipping: BRAND.shipping });
    assert.equal(q.lines.length, 1);
    assert.equal(q.lines[0].qty, 10);
  });

  it("applies coupons only above their minimum and reports why not", () => {
    const pct = BRAND.coupons.find((c) => c.kind === "percent")!;
    const small = quote([{ productId: product.id, selection: sel, qty: 1 }], PRODUCTS, { coupons: BRAND.coupons, couponCode: "nope", shipping: BRAND.shipping });
    assert.equal(small.couponError, "That code isn't valid");
    const qty = Math.ceil(pct.minSubtotal / unitPrice(product, sel));
    const big = quote([{ productId: product.id, selection: sel, qty: Math.min(10, qty) }], PRODUCTS, { coupons: BRAND.coupons, couponCode: pct.code.toLowerCase(), shipping: BRAND.shipping });
    assert.equal(big.discount, Math.round((big.subtotal * pct.value) / 100));
    assert.equal(big.total, big.subtotal - big.discount + big.shipping + big.codFee);
  });

  it("charges the COD fee only for cash on delivery", () => {
    const line = [{ productId: product.id, selection: sel, qty: 1 }];
    const cod = quote(line, PRODUCTS, { coupons: [], shipping: BRAND.shipping, payment: "cod" });
    const bank = quote(line, PRODUCTS, { coupons: [], shipping: BRAND.shipping, payment: "bank" });
    assert.equal(cod.total - bank.total, BRAND.shipping.codFee);
  });

  it("rejects incomplete selections", () => {
    assert.throws(() => quote([{ productId: product.id, selection: {}, qty: 1 }], PRODUCTS, { coupons: [], shipping: BRAND.shipping }), /Choose all options/);
  });
});

describe("store API", () => {
  let adminToken = "";
  before(async () => {
    await new Promise<void>((r) => app.server.listen(0, r));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });
  after(() => app.close());

  it("lists products with stock", async () => {
    const r = await call<{ products: unknown[]; stock: Record<string, Record<string, number>> }>("GET", "/api/products");
    assert.equal(r.data.products.length, PRODUCTS.length);
    assert.ok(Object.keys(r.data.stock[product.id]).length > 0);
  });

  it("validates checkout fields", async () => {
    const r = await call<{ issues: { path: string }[] }>("POST", "/api/orders", { ...customer, phone: "12345", city: "Paris", lines: [] });
    assert.equal(r.status, 400);
    const paths = r.data.issues.map((i) => i.path);
    for (const f of ["phone", "city", "lines"]) assert.ok(paths.includes(f), f);
  });

  it("prices orders on the server and ignores client-sent prices", async () => {
    const r = await call<Order>("POST", "/api/orders", { ...customer, lines: [{ productId: product.id, selection: sel, qty: 1, unit: 1, total: 1 }] });
    assert.equal(r.status, 201);
    assert.match(r.data.number, new RegExp(`^${BRAND.orderPrefix}-\\d{4}$`));
    assert.equal(r.data.lines[0].unit, unitPrice(product, sel));
    assert.equal(r.data.customer.phone, "03001234567");
  });

  it("decrements stock and refuses to oversell", async () => {
    const before = (await call<{ stock: Record<string, number> }>("GET", `/api/products/${product.slug}`)).data.stock[variantKey(product, sel)];
    await call("POST", "/api/orders", { ...customer, lines: [{ productId: product.id, selection: sel, qty: 1 }] });
    const afterOne = (await call<{ stock: Record<string, number> }>("GET", `/api/products/${product.slug}`)).data.stock[variantKey(product, sel)];
    assert.equal(afterOne, before - 1);
    const r = await call<{ error: string }>("POST", "/api/orders", { ...customer, lines: [{ productId: product.id, selection: sel, qty: 10 }, { productId: product.id, selection: sel, qty: 10 }] });
    if (afterOne < 10) {
      assert.equal(r.status, 409);
      assert.match(r.data.error, /left|sold out/);
    }
  });

  it("tracks an order only with the matching email", async () => {
    const order = (await call<Order>("POST", "/api/orders", { ...customer, payment: "bank", lines: [{ productId: product.id, selection: sel, qty: 1 }] })).data;
    assert.equal((await call("POST", "/api/orders/track", { number: order.number, email: "someone@else.com" })).status, 404);
    const ok = await call<Order>("POST", "/api/orders/track", { number: order.number.toLowerCase(), email: customer.email.toUpperCase() });
    assert.equal(ok.data.number, order.number);
  });

  it("protects admin routes and runs the order workflow", async () => {
    assert.equal((await call("GET", "/api/admin/orders")).status, 401);
    assert.equal((await call("POST", "/api/admin/login", { email: "admin@example.com", password: "wrong" })).status, 401);
    adminToken = (await call<{ token: string }>("POST", "/api/admin/login", { email: "admin@example.com", password: "correct-horse-battery" })).data.token;
    const orders = (await call<Order[]>("GET", "/api/admin/orders", undefined, adminToken)).data;
    assert.ok(orders.length >= 2);
    const n = orders[0].number;
    assert.equal((await call("PATCH", `/api/admin/orders/${n}`, { status: "delivered" }, adminToken)).status, 409, "can't skip steps");
    assert.equal((await call<Order>("PATCH", `/api/admin/orders/${n}`, { status: "confirmed" }, adminToken)).data.status, "confirmed");
  });

  it("returns stock when an order is cancelled", async () => {
    const key = variantKey(product, sel);
    const order = (await call<Order>("POST", "/api/orders", { ...customer, lines: [{ productId: product.id, selection: sel, qty: 1 }] })).data;
    const mid = (await call<Record<string, Record<string, number>>>("GET", "/api/admin/inventory", undefined, adminToken)).data[product.id][key];
    await call("PATCH", `/api/admin/orders/${order.number}`, { status: "cancelled" }, adminToken);
    const end = (await call<Record<string, Record<string, number>>>("GET", "/api/admin/inventory", undefined, adminToken)).data[product.id][key];
    assert.equal(end, mid + 1);
    assert.ok(rupees(1) === 100);
  });
});
