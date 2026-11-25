import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  BRAND,
  canMove,
  CartError,
  CheckoutSchema,
  describeSelection,
  initialStock,
  PRODUCTS,
  quote,
  variantKey,
  type CheckoutInput,
  type Order,
  type OrderStatus,
  type Product,
} from "@store/shared";
import { HttpError } from "./http";

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS inventory (
  product_id TEXT NOT NULL, variant TEXT NOT NULL, stock INTEGER NOT NULL CHECK (stock >= 0),
  PRIMARY KEY (product_id, variant)
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, email TEXT NOT NULL, status TEXT NOT NULL,
  data TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
`;

/** Orders and inventory in SQLite. Placing an order checks and decrements stock in one transaction. */
export class Store {
  readonly db: DatabaseSync;
  readonly catalog: Product[] = PRODUCTS;

  constructor(file = ":memory:") {
    this.db = new DatabaseSync(file);
    this.db.exec(SCHEMA);
    const insert = this.db.prepare("INSERT OR IGNORE INTO inventory (product_id, variant, stock) VALUES (?, ?, ?)");
    for (const p of this.catalog) for (const v of allVariants(p)) insert.run(p.id, v, initialStock(p, v));
  }

  private tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  stock(productId: string): Record<string, number> {
    const rows = this.db.prepare("SELECT variant, stock FROM inventory WHERE product_id = ?").all(productId) as { variant: string; stock: number }[];
    return Object.fromEntries(rows.map((r) => [r.variant, r.stock]));
  }

  allStock(): Record<string, Record<string, number>> {
    const rows = this.db.prepare("SELECT product_id, variant, stock FROM inventory").all() as { product_id: string; variant: string; stock: number }[];
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) (out[r.product_id] ??= {})[r.variant] = r.stock;
    return out;
  }

  setStock(productId: string, variant: string, stock: number) {
    const r = this.db.prepare("UPDATE inventory SET stock = ? WHERE product_id = ? AND variant = ?").run(stock, productId, variant);
    if (!r.changes) throw new HttpError(404, "Variant not found");
  }

  placeOrder(raw: CheckoutInput): Order {
    const input = CheckoutSchema.parse(raw);
    let q;
    try {
      q = quote(input.lines, this.catalog, { coupons: BRAND.coupons, couponCode: input.coupon, shipping: BRAND.shipping, payment: input.payment });
    } catch (e) {
      if (e instanceof CartError) throw new HttpError(400, e.message);
      throw e;
    }
    if (q.couponError) throw new HttpError(400, q.couponError);
    return this.tx(() => {
      const take = this.db.prepare("UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND variant = ? AND stock >= ?");
      for (const l of q.lines) {
        const v = variantKey(l.product, l.selection);
        if (!take.run(l.qty, l.product.id, v, l.qty).changes) {
          const left = this.stock(l.product.id)[v] ?? 0;
          throw new HttpError(409, left ? `Only ${left} left of ${l.product.name} (${describeSelection(l.product, l.selection)})` : `${l.product.name} (${describeSelection(l.product, l.selection)}) just sold out`);
        }
      }
      this.db.prepare("INSERT INTO counters (name, value) VALUES ('order', 1) ON CONFLICT(name) DO UPDATE SET value = value + 1").run();
      const n = (this.db.prepare("SELECT value FROM counters WHERE name = 'order'").get() as { value: number }).value;
      const now = new Date().toISOString();
      const order: Order = {
        id: randomUUID(),
        number: `${BRAND.orderPrefix}-${String(1000 + n)}`,
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
      this.db.prepare("INSERT INTO orders (id, number, email, status, data, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(order.id, order.number, order.customer.email, order.status, JSON.stringify(order), now);
      return order;
    });
  }

  /** Public tracking needs the order number and the email used at checkout. */
  track(number: string, email: string): Order {
    const r = this.db.prepare("SELECT data FROM orders WHERE number = ? AND email = ?").get(number.trim().toUpperCase(), email.trim().toLowerCase()) as { data: string } | undefined;
    if (!r) throw new HttpError(404, "No order matches that number and email");
    return JSON.parse(r.data);
  }

  orders(): Order[] {
    return (this.db.prepare("SELECT data FROM orders ORDER BY created_at DESC").all() as { data: string }[]).map((r) => JSON.parse(r.data));
  }

  setStatus(number: string, to: OrderStatus): Order {
    return this.tx(() => {
      const r = this.db.prepare("SELECT data FROM orders WHERE number = ?").get(number) as { data: string } | undefined;
      if (!r) throw new HttpError(404, "Order not found");
      const order = JSON.parse(r.data) as Order;
      if (!canMove(order.status, to)) throw new HttpError(409, `Can't move an order from ${order.status} to ${to}`);
      // Cancelling puts the stock back.
      if (to === "cancelled") {
        const give = this.db.prepare("UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND variant = ?");
        for (const l of order.lines) {
          const p = this.catalog.find((x) => x.id === l.productId);
          if (p) give.run(l.qty, p.id, variantKey(p, l.selection));
        }
      }
      order.status = to;
      order.history.push({ status: to, at: new Date().toISOString() });
      this.db.prepare("UPDATE orders SET status = ?, data = ? WHERE number = ?").run(to, JSON.stringify(order), number);
      return order;
    });
  }

  close() {
    this.db.close();
  }
}

export function allVariants(p: Product): string[] {
  let keys: Record<string, string>[] = [{}];
  for (const o of p.options) keys = keys.flatMap((k) => o.values.map((v) => ({ ...k, [o.id]: v.id })));
  return keys.map((sel) => variantKey(p, sel));
}
