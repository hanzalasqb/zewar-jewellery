import { useCallback, useEffect, useState } from "react";
import { LuLogOut, LuRefreshCw } from "react-icons/lu";
import { describeSelection, formatPrice, STATUS_FLOW, STATUS_LABEL, type Order, type OrderStatus, type Product } from "@store/shared";
import { client, IS_DEMO } from "../api";
import type { Stock } from "../api/client";
import { DEMO_ADMIN } from "../api/demo";
import { Field } from "../components/ui";
import { cx, fmtDate } from "../lib/format";
import { actions, errorText, toast, useStore } from "../store";

const ACTION_LABEL: Record<OrderStatus, string> = { placed: "", confirmed: "Confirm", shipped: "Mark shipped", delivered: "Mark delivered", cancelled: "Cancel" };

export function Admin() {
  const [authed, setAuthed] = useState(client.isAdmin());
  return authed ? <Dashboard onLogout={() => (client.adminLogout(), setAuthed(false))} /> : <Login onDone={() => setAuthed(true)} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(IS_DEMO ? DEMO_ADMIN.email : "");
  const [password, setPassword] = useState(IS_DEMO ? DEMO_ADMIN.password : "");
  const [error, setError] = useState("");
  return (
    <div className="page narrow">
      <header className="page-head">
        <p className="eyebrow">Staff only</p>
        <h1>Store admin</h1>
        {IS_DEMO && <p className="muted">Live demo: the demo admin login is filled in for you. On the real API, admin credentials come from environment variables.</p>}
      </header>
      <form
        className="panel track-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await client.adminLogin(email, password);
            onDone();
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <Field label="Email">
          <input value={email} type="email" autoComplete="username" onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" error={error}>
          <input value={password} type="password" autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn btn-primary">Sign in</button>
      </form>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const products = useStore((s) => s.products);
  const [tab, setTab] = useState<"orders" | "inventory">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<Stock>({});
  const refresh = useCallback(async () => {
    const [o, s] = await Promise.all([client.adminOrders(), client.adminInventory()]);
    setOrders([...o]);
    setStock(structuredClone(s));
  }, []);
  useEffect(() => void refresh(), [refresh]);

  const revenue = orders.filter((o) => o.status !== "cancelled").reduce((a, o) => a + o.total, 0);
  const open = orders.filter((o) => o.status === "placed" || o.status === "confirmed").length;

  async function move(o: Order, to: OrderStatus) {
    try {
      await client.adminSetStatus(o.number, to);
      toast(`${o.number}: ${STATUS_LABEL[to]}`);
      await refresh();
      if (to === "cancelled") void actions.refreshStock();
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  return (
    <div className="page admin">
      <header className="page-head row">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Store dashboard</h1>
        </div>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => void refresh()}>
            <LuRefreshCw /> Refresh
          </button>
          <button className="btn btn-ghost" onClick={onLogout}>
            <LuLogOut /> Sign out
          </button>
        </div>
      </header>
      <div className="stats">
        <div className="stat">
          <span>Revenue</span>
          <strong>{formatPrice(revenue)}</strong>
        </div>
        <div className="stat">
          <span>Orders</span>
          <strong>{orders.length}</strong>
        </div>
        <div className="stat">
          <span>To fulfil</span>
          <strong>{open}</strong>
        </div>
        <div className="stat">
          <span>Sold-out variants</span>
          <strong>{Object.values(stock).reduce((a, v) => a + Object.values(v).filter((n) => n === 0).length, 0)}</strong>
        </div>
      </div>
      <nav className="pills" aria-label="Admin sections">
        <button className={cx("pill", tab === "orders" && "on")} onClick={() => setTab("orders")}>
          Orders
        </button>
        <button className={cx("pill", tab === "inventory" && "on")} onClick={() => setTab("inventory")}>
          Inventory
        </button>
      </nav>
      {tab === "orders" ? (
        orders.length === 0 ? (
          <div className="empty">
            <h2>No orders yet</h2>
            <p className="muted">Place an order from the shop and it will appear here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th className="right">Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.number}>
                    <td>
                      <strong className="mono">{o.number}</strong>
                      <small className="muted block">{fmtDate(o.createdAt)}</small>
                    </td>
                    <td>
                      {o.customer.name}
                      <small className="muted block">
                        {o.customer.city} · {o.payment === "cod" ? "COD" : "Bank"}
                      </small>
                    </td>
                    <td className="small">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</td>
                    <td className="right num">{formatPrice(o.total)}</td>
                    <td>
                      <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="row-actions">
                      {STATUS_FLOW[o.status].map((to) => (
                        <button key={to} className={cx("btn btn-sm", to === "cancelled" ? "btn-ghost" : "btn-primary")} onClick={() => void move(o, to)}>
                          {ACTION_LABEL[to]}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <Inventory products={products} stock={stock} onChange={refresh} />
      )}
    </div>
  );
}

function Inventory({ products, stock, onChange }: { products: Product[]; stock: Stock; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null);
  const label = (p: Product, key: string) => {
    const ids = key.split("/");
    return describeSelection(p, Object.fromEntries(p.options.map((o, i) => [o.id, ids[i]])));
  };
  async function save(p: Product, variant: string, n: number) {
    await client.adminSetStock(p.id, variant, Math.max(0, Math.round(n)));
    await onChange();
    void actions.refreshStock();
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="right">Units</th>
            <th className="right">Sold-out variants</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const variants = Object.entries(stock[p.id] ?? {});
            const out = variants.filter(([, n]) => n === 0);
            return [
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td className="right num">{variants.reduce((a, [, n]) => a + n, 0)}</td>
                <td className={cx("right num", out.length > 0 && "warn")}>{out.length}</td>
                <td className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
                    {open === p.id ? "Hide" : "Edit stock"}
                  </button>
                  {out.length > 0 && (
                    <button className="btn btn-sm btn-primary" onClick={async () => (await Promise.all(out.map(([v]) => client.adminSetStock(p.id, v, 5))), await onChange(), void actions.refreshStock(), toast(`Restocked ${out.length} variants of ${p.name}`))}>
                      Restock sold out
                    </button>
                  )}
                </td>
              </tr>,
              open === p.id && (
                <tr key={`${p.id}-v`} className="sub">
                  <td colSpan={4}>
                    <div className="variant-grid">
                      {variants
                        .sort((a, b) => a[1] - b[1])
                        .slice(0, 24)
                        .map(([v, n]) => (
                          <label key={v} className={cx("variant", n === 0 && "out")}>
                            <span>{label(p, v)}</span>
                            <input type="number" min={0} defaultValue={n} onBlur={(e) => Number(e.target.value) !== n && void save(p, v, Number(e.target.value))} aria-label={`Stock for ${label(p, v)}`} />
                          </label>
                        ))}
                    </div>
                    {variants.length > 24 && <p className="muted small">Showing the 24 lowest-stock variants of {variants.length}.</p>}
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
