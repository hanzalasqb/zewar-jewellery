import { useEffect, useMemo, useRef, useState } from "react";
import { LuShoppingBag, LuTag, LuTrash2, LuX } from "react-icons/lu";
import { BRAND, describeSelection, formatPrice, quote, type Product } from "@store/shared";
import { go } from "../lib/router";
import { actions, useStore } from "../store";
import { useThumbnail } from "../three/thumbnails";
import { Qty } from "./ui";

function LineThumb({ product, selection }: { product: Product; selection: Record<string, string> }) {
  const url = useThumbnail(product, selection);
  return <span className="line-thumb">{url ? <img src={url} alt="" /> : null}</span>;
}

export function CartDrawer() {
  const { cart, products, coupon, cartOpen } = useStore((s) => s);
  const [code, setCode] = useState(coupon ?? "");
  const panel = useRef<HTMLDivElement>(null);

  const q = useMemo(() => {
    try {
      return quote(cart, products, { coupons: [...BRAND.coupons], couponCode: coupon, shipping: BRAND.shipping });
    } catch {
      return null;
    }
  }, [cart, products, coupon]);

  useEffect(() => {
    if (!cartOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && actions.openCart(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [cartOpen]);

  if (!cartOpen) return null;
  const freeOver = BRAND.shipping.freeOver;

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && actions.openCart(false)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Shopping bag" tabIndex={-1} ref={panel}>
        <header className="drawer-head">
          <h2>
            Your bag <span className="muted">({q?.itemCount ?? 0})</span>
          </h2>
          <button className="icon-btn" aria-label="Close bag" onClick={() => actions.openCart(false)}>
            <LuX />
          </button>
        </header>

        {!q || q.lines.length === 0 ? (
          <div className="drawer-empty">
            <LuShoppingBag aria-hidden />
            <p>Your bag is empty.</p>
            <button className="btn btn-primary" onClick={() => (actions.openCart(false), go("/shop"))}>
              Start shopping
            </button>
          </div>
        ) : (
          <>
            {freeOver != null && freeOver > 0 && (
              <div className="ship-meter">
                <p>{q.freeShippingGap ? <>Add {formatPrice(q.freeShippingGap)} more for free delivery</> : <>You've unlocked free delivery</>}</p>
                <span className="meter">
                  <span style={{ width: `${Math.min(100, ((q.subtotal - q.discount) / freeOver) * 100)}%` }} />
                </span>
              </div>
            )}
            <ul className="lines">
              {q.lines.map((l) => {
                const index = cart.findIndex((c) => c.productId === l.productId && JSON.stringify(c.selection) === JSON.stringify(l.selection));
                return (
                  <li key={l.key}>
                    <a href={`#/p/${l.product.slug}`} onClick={() => actions.openCart(false)}>
                      <LineThumb product={l.product} selection={l.selection} />
                    </a>
                    <div className="line-info">
                      <p className="line-name">{l.product.name}</p>
                      <p className="muted small">{describeSelection(l.product, l.selection)}</p>
                      <Qty value={l.qty} onChange={(n) => actions.setQty(index, n)} label={`Quantity of ${l.product.name}`} />
                    </div>
                    <div className="line-end">
                      <span className="num">{formatPrice(l.total)}</span>
                      <button className="icon-btn subtle" aria-label={`Remove ${l.product.name}`} onClick={() => actions.setQty(index, 0)}>
                        <LuTrash2 />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <footer className="drawer-foot">
              <form
                className="coupon"
                onSubmit={(e) => {
                  e.preventDefault();
                  actions.setCoupon(code.trim() ? code.trim().toUpperCase() : null);
                }}
              >
                <LuTag aria-hidden />
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Promo code" aria-label="Promo code" />
                <button className="btn btn-ghost btn-sm">Apply</button>
              </form>
              {q.couponError && <p className="field-error">{q.couponError}</p>}
              {q.coupon && <p className="ok small">{q.coupon.description} applied</p>}
              <dl className="totals">
                <dt>Subtotal</dt>
                <dd className="num">{formatPrice(q.subtotal)}</dd>
                {q.discount > 0 && (
                  <>
                    <dt>Discount</dt>
                    <dd className="num">−{formatPrice(q.discount)}</dd>
                  </>
                )}
                <dt>Delivery</dt>
                <dd className="num">{q.shipping ? formatPrice(q.shipping) : "Free"}</dd>
                <dt className="total">Total</dt>
                <dd className="total num">{formatPrice(q.total)}</dd>
              </dl>
              <button className="btn btn-primary btn-block" onClick={() => (actions.openCart(false), go("/checkout"))}>
                Checkout
              </button>
              <p className="muted small center">Cash on delivery or bank transfer · Delivery across Pakistan</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
