import { useMemo, useState } from "react";
import { LuBanknote, LuLock, LuTruck } from "react-icons/lu";
import { BRAND, CheckoutSchema, CITIES, describeSelection, formatPrice, quote } from "@store/shared";
import { client } from "../api";
import { ApiError } from "../api/client";
import { Field } from "../components/ui";
import { cx } from "../lib/format";
import { go } from "../lib/router";
import { actions, errorText, toast, useStore } from "../store";
import { useThumbnail } from "../three/thumbnails";
import type { Product } from "@store/shared";

const Thumb = ({ product, selection }: { product: Product; selection: Record<string, string> }) => {
  const url = useThumbnail(product, selection);
  return <span className="line-thumb sm">{url && <img src={url} alt="" />}</span>;
};

export function Checkout() {
  const { cart, products, coupon } = useStore((s) => s);
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", address: "", notes: "", payment: "cod" as "cod" | "bank" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const q = useMemo(() => {
    try {
      return quote(cart, products, { coupons: [...BRAND.coupons], couponCode: coupon, shipping: BRAND.shipping, payment: form.payment });
    } catch {
      return null;
    }
  }, [cart, products, coupon, form.payment]);

  if (!q || q.lines.length === 0)
    return (
      <div className="page empty">
        <h1>Your bag is empty</h1>
        <a className="btn btn-primary" href="#/shop">
          Continue shopping
        </a>
      </div>
    );

  async function submit() {
    const input = { ...form, coupon: q?.coupon?.code ?? null, lines: cart };
    const parsed = CheckoutSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setBusy(true);
    try {
      const order = await client.placeOrder(parsed.data);
      actions.rememberOrder(order.number, order.customer.email);
      actions.clearCart();
      void actions.refreshStock();
      go(`/order/${order.number}`);
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) setErrors(Object.fromEntries(e.issues.map((i) => [i.path.split(".")[0], i.message])));
      toast(errorText(e), "error");
      setBusy(false);
    }
  }

  return (
    <div className="page checkout">
      <header className="page-head">
        <p className="eyebrow">
          <LuLock aria-hidden /> Secure checkout
        </p>
        <h1>Checkout</h1>
      </header>
      <div className="checkout-grid">
        <form className="checkout-form" noValidate onSubmit={(e) => (e.preventDefault(), void submit())}>
          <section className="panel">
            <h2>Contact</h2>
            <div className="field-grid">
              <Field label="Full name" error={errors.name}>
                <input value={form.name} autoComplete="name" aria-invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Mobile number" error={errors.phone} hint="We'll text you delivery updates">
                <input value={form.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" aria-invalid={!!errors.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>
            <Field label="Email" error={errors.email} hint="For your receipt and order tracking">
              <input value={form.email} type="email" autoComplete="email" aria-invalid={!!errors.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </section>
          <section className="panel">
            <h2>Delivery address</h2>
            <Field label="City" error={errors.city}>
              <select value={form.city} aria-invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2">
                <option value="">Choose your city…</option>
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Address" error={errors.address}>
              <textarea rows={2} value={form.address} autoComplete="street-address" placeholder="House, street, area" aria-invalid={!!errors.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Delivery notes (optional)">
              <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Call before arriving" />
            </Field>
          </section>
          <section className="panel">
            <h2>Payment</h2>
            <div className="pay-options" role="radiogroup" aria-label="Payment method">
              {(
                [
                  ["cod", <LuTruck key="i" />, "Cash on delivery", BRAND.shipping.codFee ? `${formatPrice(BRAND.shipping.codFee)} handling fee` : "Pay the rider at your door"],
                  ["bank", <LuBanknote key="i" />, "Bank transfer", "Details on the next screen · no fee"],
                ] as const
              ).map(([id, icon, title, sub]) => (
                <label key={id} className={cx("pay-option", form.payment === id && "on")}>
                  <input type="radio" name="payment" value={id} checked={form.payment === id} onChange={() => set("payment", id)} />
                  {icon}
                  <span>
                    <strong>{title}</strong>
                    <small className="muted">{sub}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? "Placing your order…" : `Place order · ${formatPrice(q.total)}`}
          </button>
        </form>

        <aside className="panel summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <ul className="lines compact">
            {q.lines.map((l) => (
              <li key={l.key}>
                <Thumb product={l.product} selection={l.selection} />
                <div className="line-info">
                  <p className="line-name">{l.product.name}</p>
                  <p className="muted small">
                    {describeSelection(l.product, l.selection)} · × {l.qty}
                  </p>
                </div>
                <span className="num">{formatPrice(l.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <dt>Subtotal</dt>
            <dd className="num">{formatPrice(q.subtotal)}</dd>
            {q.discount > 0 && (
              <>
                <dt>Discount ({q.coupon?.code})</dt>
                <dd className="num">−{formatPrice(q.discount)}</dd>
              </>
            )}
            <dt>Delivery</dt>
            <dd className="num">{q.shipping ? formatPrice(q.shipping) : "Free"}</dd>
            {q.codFee > 0 && (
              <>
                <dt>Cash on delivery fee</dt>
                <dd className="num">{formatPrice(q.codFee)}</dd>
              </>
            )}
            <dt className="total">Total</dt>
            <dd className="total num">{formatPrice(q.total)}</dd>
          </dl>
          <button type="button" className="link-btn small" onClick={() => actions.openCart(true)}>
            Edit bag or add a promo code
          </button>
        </aside>
      </div>
    </div>
  );
}
