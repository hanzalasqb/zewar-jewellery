import { useState } from "react";
import { LuHeart } from "react-icons/lu";
import { defaultSelection, type Product } from "@store/shared";
import { cx } from "../lib/format";
import { actions, productStock, useStore } from "../store";
import { useThumbnail } from "../three/thumbnails";
import { Badge, Price } from "./ui";

export function ProductCard({ product }: { product: Product }) {
  const [hover, setHover] = useState(false);
  const sel = defaultSelection(product);
  const front = useThumbnail(product, sel, 0);
  const side = useThumbnail(hover ? product : undefined, sel, 0.9);
  const saved = useStore((s) => s.wishlist.includes(product.id));
  const soldOut = useStore((s) => s.phase === "ready" && productStock(s, product) === 0);
  const swatches = product.options.find((o) => o.id === "color" || o.id === "metal")?.values ?? [];

  return (
    <article className="card" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <a href={`#/p/${product.slug}`} className="card-media" aria-label={product.name}>
        {front ? <img src={hover && side ? side : front} alt="" loading="lazy" /> : <span className="card-skeleton" aria-hidden />}
        <span className="card-badges">
          {soldOut ? <Badge>Sold out</Badge> : product.badges.map((b) => <Badge key={b}>{b}</Badge>)}
        </span>
      </a>
      <button className={cx("card-heart", saved && "on")} aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} onClick={() => actions.toggleWishlist(product)}>
        <LuHeart />
      </button>
      <div className="card-body">
        <h3>
          <a href={`#/p/${product.slug}`}>{product.name}</a>
        </h3>
        <p className="card-tagline">{product.tagline}</p>
        <div className="card-foot">
          <Price value={product.price} compareAt={product.compareAt} />
          <span className="card-swatches" aria-label={`${swatches.length} options`}>
            {swatches.slice(0, 4).map((v) => (
              <i key={v.id} style={{ background: v.hex }} title={v.label} />
            ))}
          </span>
        </div>
      </div>
    </article>
  );
}
