import { useState } from "react";
import { LuHeart, LuSearch, LuShoppingBag, LuX } from "react-icons/lu";
import { BRAND } from "@store/shared";
import { Logo } from "../brand/Logo";
import { cx } from "../lib/format";
import { go, type Route } from "../lib/router";
import { actions, useStore } from "../store";

export function Header({ route }: { route: Route }) {
  const count = useStore((s) => s.cart.reduce((a, l) => a + l.qty, 0));
  const saved = useStore((s) => s.wishlist.length);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const active = route.page === "shop" ? route.category : null;

  return (
    <header className="header">
      <div className="header-inner">
        <a href="#/" className="brand-link" aria-label={`${BRAND.name} home`}>
          <Logo />
        </a>
        <nav className="nav" aria-label="Categories">
          <a href="#/shop" className={cx(route.page === "shop" && !active && "active")}>
            Shop all
          </a>
          {BRAND.categories.map((c) => (
            <a key={c.id} href={`#/shop/${c.id}`} className={cx(active === c.id && "active")}>
              {c.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {searching ? (
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                go(`/shop?q=${encodeURIComponent(q)}`);
                setSearching(false);
              }}
            >
              <LuSearch aria-hidden />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search products" onKeyDown={(e) => e.key === "Escape" && setSearching(false)} />
              <button type="button" className="icon-btn" aria-label="Close search" onClick={() => setSearching(false)}>
                <LuX />
              </button>
            </form>
          ) : (
            <button className="icon-btn" aria-label="Search" onClick={() => setSearching(true)}>
              <LuSearch />
            </button>
          )}
          <a href="#/wishlist" className="icon-btn" aria-label={`Wishlist, ${saved} saved`}>
            <LuHeart />
            {saved > 0 && <span className="dot-count">{saved}</span>}
          </a>
          <button className="icon-btn" aria-label={`Bag, ${count} items`} onClick={() => actions.openCart(true)}>
            <LuShoppingBag />
            {count > 0 && <span className="dot-count">{count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
