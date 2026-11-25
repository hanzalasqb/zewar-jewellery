import { useEffect } from "react";
import { BRAND } from "@store/shared";
import { IS_DEMO } from "./api";
import { Home } from "./brand/Home";
import { CartDrawer } from "./components/CartDrawer";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { cx } from "./lib/format";
import { useRoute } from "./lib/router";
import { Admin } from "./pages/Admin";
import { Checkout } from "./pages/Checkout";
import { OrderPage, Track } from "./pages/Orders";
import { ProductPage } from "./pages/Product";
import { Shop } from "./pages/Shop";
import { Wishlist } from "./pages/Wishlist";
import { actions, useStore } from "./store";

const TITLES: Record<string, string> = { home: BRAND.tagline, shop: "Shop", checkout: "Checkout", order: "Your order", track: "Track your order", wishlist: "Wishlist", admin: "Admin" };

export function App() {
  const route = useRoute();
  const toasts = useStore((s) => s.toasts);
  const phase = useStore((s) => s.phase);

  useEffect(() => void actions.load(), []);
  useEffect(() => {
    if (route.page !== "product") document.title = `${TITLES[route.page]} · ${BRAND.name}`;
  }, [route.page]);

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => (e.preventDefault(), document.getElementById("main")?.focus())}>
        Skip to content
      </a>
      {IS_DEMO && (
        <div className="demo-ribbon">
          Live demo · products and prices are fictional and orders stay in your browser · try code <strong>{BRAND.coupons[0].code}</strong>
        </div>
      )}
      <Header route={route} />
      <main id="main" tabIndex={-1} className={cx("main", `page-${route.page}`)}>
        {phase === "error" ? (
          <div className="page empty">
            <h1>We couldn't load the shop</h1>
            <button className="btn btn-primary" onClick={() => actions.load()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            {route.page === "home" && <Home />}
            {route.page === "shop" && <Shop category={route.category} q={route.q} />}
            {route.page === "product" && <ProductPage slug={route.slug} />}
            {route.page === "checkout" && <Checkout />}
            {route.page === "order" && <OrderPage number={route.number} />}
            {route.page === "track" && <Track />}
            {route.page === "wishlist" && <Wishlist />}
            {route.page === "admin" && <Admin />}
          </>
        )}
      </main>
      <Footer />
      <CartDrawer />
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("toast", `toast-${t.tone}`)}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
