import { ProductCard } from "../components/ProductCard";
import { useStore } from "../store";

export function Wishlist() {
  // Select stable references; filtering inside the selector would return a new array every render.
  const products = useStore((s) => s.products);
  const wishlist = useStore((s) => s.wishlist);
  const items = products.filter((p) => wishlist.includes(p.id));
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Saved</p>
        <h1>Wishlist</h1>
      </header>
      {items.length ? (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>Nothing saved yet</h2>
          <p className="muted">Tap the heart on any piece to keep it here for later.</p>
          <a className="btn btn-primary" href="#/shop">
            Browse the shop
          </a>
        </div>
      )}
    </div>
  );
}
