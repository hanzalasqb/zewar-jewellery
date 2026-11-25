import { LuCheck } from "react-icons/lu";
import { formatPrice, maskEmail, STATUS_LABEL, type Order } from "@store/shared";
import { BANK_DETAILS } from "../brand/copy";
import { cx, fmtDate } from "../lib/format";

const STEPS = ["placed", "confirmed", "shipped", "delivered"] as const;

export function OrderView({ order }: { order: Order }) {
  const at = Object.fromEntries(order.history.map((h) => [h.status, h.at]));
  const reached = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  return (
    <div className="order">
      {order.status === "cancelled" ? (
        <p className="notice notice-error">This order was cancelled{at.cancelled ? ` on ${fmtDate(at.cancelled)}` : ""}. Any payment will be refunded within 5 working days.</p>
      ) : (
        <ol className="timeline" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} className={cx(i <= reached && "done", i === reached && "current")}>
              <span className="tl-dot">{i <= reached ? <LuCheck aria-hidden /> : i + 1}</span>
              <span className="tl-label">{STATUS_LABEL[s]}</span>
              <span className="tl-time muted">{at[s] ? fmtDate(at[s]) : ""}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="order-grid">
        <section className="panel">
          <h2>Items</h2>
          <ul className="order-lines">
            {order.lines.map((l) => (
              <li key={l.productId + l.variant}>
                <span>
                  <strong>{l.name}</strong>
                  <span className="muted small">
                    {l.variant} · × {l.qty}
                  </span>
                </span>
                <span className="num">{formatPrice(l.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <dt>Subtotal</dt>
            <dd className="num">{formatPrice(order.subtotal)}</dd>
            {order.discount > 0 && (
              <>
                <dt>Discount {order.coupon && `(${order.coupon})`}</dt>
                <dd className="num">−{formatPrice(order.discount)}</dd>
              </>
            )}
            <dt>Delivery</dt>
            <dd className="num">{order.shipping ? formatPrice(order.shipping) : "Free"}</dd>
            {order.codFee > 0 && (
              <>
                <dt>Cash on delivery fee</dt>
                <dd className="num">{formatPrice(order.codFee)}</dd>
              </>
            )}
            <dt className="total">Total</dt>
            <dd className="total num">{formatPrice(order.total)}</dd>
          </dl>
        </section>
        <section className="panel">
          <h2>Delivery</h2>
          <p>
            <strong>{order.customer.name}</strong>
            <br />
            {order.customer.address}
            <br />
            {order.customer.city} · {order.customer.phone}
            <br />
            <span className="muted">{maskEmail(order.customer.email)}</span>
          </p>
          <h2>Payment</h2>
          {order.payment === "cod" ? (
            <p>Cash on delivery. Please keep {formatPrice(order.total)} ready for the rider.</p>
          ) : (
            <div className="bank">
              <p>Bank transfer. Use your order number as the reference:</p>
              <dl>
                {BANK_DETAILS.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
                <div>
                  <dt>Reference</dt>
                  <dd className="mono">{order.number}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
