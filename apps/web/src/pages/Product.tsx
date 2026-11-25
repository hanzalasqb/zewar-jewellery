import { useEffect, useMemo, useState } from "react";
import { LuHeart, LuRotateCcw, LuShieldCheck, LuTruck } from "react-icons/lu";
import { defaultSelection, describeSelection, unitPrice, type Selection } from "@store/shared";
import { buildModel, viewFor } from "../brand/model";
import { PRODUCT_PROMISES } from "../brand/copy";
import { OptionPicker } from "../components/OptionPicker";
import { ProductCard } from "../components/ProductCard";
import { Price, Qty, Stars } from "../components/ui";
import { cx } from "../lib/format";
import { actions, stockOf, useStore } from "../store";
import { Stage } from "../three/Stage";

export function ProductPage({ slug }: { slug: string }) {
  const state = useStore((s) => s);
  const product = state.products.find((p) => p.slug === slug);
  const [selection, setSelection] = useState<Selection>(() => (product ? defaultSelection(product) : {}));
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState<string | null>("details");

  useEffect(() => {
    if (product) {
      setSelection(defaultSelection(product));
      setQty(1);
      document.title = `${product.name} · ${document.title.split(" · ").pop()}`;
    }
  }, [product?.id]); // re-init when navigating between products

  const items = useMemo(() => (product ? buildModel(product, selection) : []), [product, selection]);

  if (state.phase === "loading") return <div className="page" aria-busy="true" />;
  if (!product)
    return (
      <div className="page empty">
        <h1>We couldn't find that piece</h1>
        <a className="btn btn-primary" href="#/shop">
          Back to the shop
        </a>
      </div>
    );

  const left = stockOf(state, product, selection);
  const price = unitPrice(product, selection);
  const compare = product.compareAt ? product.compareAt + (price - product.price) : undefined;
  const saved = state.wishlist.includes(product.id);
  const related = state.products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="page product">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/shop">Shop</a> / <a href={`#/shop/${product.category}`}>{product.category}</a> / <span>{product.name}</span>
      </nav>
      <div className="product-grid">
        <div className="product-stage">
          <Stage key={product.id} items={items} view={viewFor(product, "detail")} label={`3D view of ${product.name}, ${describeSelection(product, selection)}`} controls />
        </div>
        <div className="product-info">
          {product.badges[0] && <p className="eyebrow">{product.badges[0]}</p>}
          <h1>{product.name}</h1>
          <p className="lede">{product.tagline}</p>
          <div className="product-meta">
            <Price value={price} compareAt={compare} className="price-lg" />
            <Stars rating={product.rating} reviews={product.reviews} />
          </div>
          <OptionPicker product={product} selection={selection} onChange={setSelection} stockFor={(s) => stockOf(state, product, s)} />
          <p className={cx("stock", left === 0 ? "stock-out" : left <= 2 ? "stock-low" : "stock-ok")} aria-live="polite">
            {left === 0 ? "Sold out in this option" : left <= 2 ? `Only ${left} left` : "In stock, ready to ship"}
          </p>
          <div className="buy">
            <Qty value={qty} onChange={(n) => setQty(Math.max(1, n))} max={Math.max(1, Math.min(10, left))} label="Quantity" />
            <button className="btn btn-primary btn-lg" disabled={left === 0} onClick={() => actions.addToCart(product, selection, qty)}>
              {left === 0 ? "Sold out" : "Add to bag"}
            </button>
            <button className={cx("icon-btn icon-btn-lg", saved && "on")} aria-pressed={saved} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} onClick={() => actions.toggleWishlist(product)}>
              <LuHeart />
            </button>
          </div>
          <ul className="promises">
            <li>
              <LuTruck aria-hidden /> {PRODUCT_PROMISES[0]}
            </li>
            <li>
              <LuRotateCcw aria-hidden /> {PRODUCT_PROMISES[1]}
            </li>
            <li>
              <LuShieldCheck aria-hidden /> {PRODUCT_PROMISES[2]}
            </li>
          </ul>
          <div className="accordion">
            {[
              { id: "details", title: "Details", body: <ul>{product.details.map((d) => <li key={d}>{d}</li>)}</ul> },
              { id: "about", title: "About this piece", body: <p>{product.description}</p> },
            ].map((s) => (
              <section key={s.id}>
                <h3>
                  <button aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                    {s.title} <span aria-hidden>{open === s.id ? "−" : "+"}</span>
                  </button>
                </h3>
                {open === s.id && <div className="accordion-body">{s.body}</div>}
              </section>
            ))}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="related">
          <h2>You may also like</h2>
          <div className="grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
