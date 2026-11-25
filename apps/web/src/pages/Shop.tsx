import { useMemo, useState } from "react";
import { BRAND, type Product } from "@store/shared";
import { ProductCard } from "../components/ProductCard";
import { cx } from "../lib/format";
import { productStock, useStore } from "../store";

const SORTS = {
  featured: { label: "Featured", fn: (a: Product, b: Product) => Number(!!b.featured) - Number(!!a.featured) },
  "price-asc": { label: "Price: low to high", fn: (a: Product, b: Product) => a.price - b.price },
  "price-desc": { label: "Price: high to low", fn: (a: Product, b: Product) => b.price - a.price },
  rating: { label: "Top rated", fn: (a: Product, b: Product) => b.rating - a.rating || b.reviews - a.reviews },
} as const;

export function Shop({ category, q }: { category: string | null; q: string }) {
  const state = useStore((s) => s);
  const [sort, setSort] = useState<keyof typeof SORTS>("featured");
  const [inStock, setInStock] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const cat = BRAND.categories.find((c) => c.id === category);
  const prices = state.products.map((p) => p.price);
  const ceiling = prices.length ? Math.max(...prices) : 0;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return state.products
      .filter((p) => !category || p.category === category)
      .filter((p) => !term || `${p.name} ${p.tagline} ${p.category}`.toLowerCase().includes(term))
      .filter((p) => !inStock || productStock(state, p) > 0)
      .filter((p) => maxPrice == null || p.price <= maxPrice)
      .sort(SORTS[sort].fn);
  }, [state, category, q, sort, inStock, maxPrice]);

  return (
    <div className="page shop">
      <header className="page-head">
        <p className="eyebrow">{q ? "Search" : "Collection"}</p>
        <h1>{q ? `Results for “${q}”` : (cat?.label ?? "Shop all")}</h1>
        <p className="muted">{cat?.blurb ?? BRAND.tagline}</p>
      </header>

      <div className="filters">
        <nav className="pills" aria-label="Categories">
          <a href="#/shop" className={cx("pill", !category && "on")}>
            All
          </a>
          {BRAND.categories.map((c) => (
            <a key={c.id} href={`#/shop/${c.id}`} className={cx("pill", category === c.id && "on")}>
              {c.label}
            </a>
          ))}
        </nav>
        <div className="filter-tools">
          <label className="check">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> In stock
          </label>
          <label className="range">
            <span>Up to Rs {Math.round((maxPrice ?? ceiling) / 100).toLocaleString("en-PK")}</span>
            <input type="range" min={0} max={ceiling} step={ceiling / 20 || 1} value={maxPrice ?? ceiling} onChange={(e) => setMaxPrice(Number(e.target.value) >= ceiling ? null : Number(e.target.value))} aria-label="Maximum price" />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="Sort products">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.phase === "loading" ? (
        <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card card-loading" />)}</div>
      ) : list.length ? (
        <div className="grid">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>Nothing matches yet</h2>
          <p className="muted">Try another category or clear the filters.</p>
          <a href="#/shop" className="btn btn-ghost" onClick={() => (setInStock(false), setMaxPrice(null))}>
            Clear filters
          </a>
        </div>
      )}
    </div>
  );
}
