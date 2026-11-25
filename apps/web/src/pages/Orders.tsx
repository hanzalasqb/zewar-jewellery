import { useEffect, useState } from "react";
import type { Order } from "@store/shared";
import { client } from "../api";
import { OrderView } from "../components/OrderView";
import { Field } from "../components/ui";
import { errorText, useStore } from "../store";

export function OrderPage({ number }: { number: string }) {
  const recent = useStore((s) => s.recentOrders.find((o) => o.number === number));
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!recent) return;
    client.track(recent.number, recent.email).then(setOrder, (e) => setError(errorText(e)));
  }, [recent?.number]);

  if (!recent) return <Track initial={number} />;
  return (
    <div className="page">
      <header className="page-head center">
        <p className="eyebrow">Order {number}</p>
        <h1>Thank you{order ? `, ${order.customer.name.split(" ")[0]}` : ""}!</h1>
        <p className="muted">We've received your order and sent a confirmation to your email. You can track it any time from the footer.</p>
      </header>
      {error && <p className="notice notice-error">{error}</p>}
      {order && <OrderView order={order} />}
      <p className="center">
        <a className="btn btn-ghost" href="#/shop">
          Continue shopping
        </a>
      </p>
    </div>
  );
}

export function Track({ initial = "" }: { initial?: string }) {
  const recent = useStore((s) => s.recentOrders);
  const [number, setNumber] = useState(initial);
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(n = number, e = email) {
    setBusy(true);
    setError("");
    try {
      setOrder(await client.track(n, e));
    } catch (err) {
      setOrder(null);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <p className="eyebrow">Order status</p>
        <h1>Track your order</h1>
        <p className="muted">Enter the order number from your confirmation and the email you used at checkout.</p>
      </header>
      <form className="panel track-form" onSubmit={(e) => (e.preventDefault(), void lookup())}>
        <Field label="Order number">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. ZW-1001" required />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Looking…" : "Track order"}
        </button>
        {error && <p className="field-error">{error}</p>}
      </form>
      {recent.length > 0 && !order && (
        <p className="muted small">
          Orders from this device:{" "}
          {recent.map((o, i) => (
            <span key={o.number}>
              {i > 0 && ", "}
              <button className="link-btn" onClick={() => (setNumber(o.number), setEmail(o.email), void lookup(o.number, o.email))}>
                {o.number}
              </button>
            </span>
          ))}
        </p>
      )}
      {order && <OrderView order={order} />}
    </div>
  );
}
