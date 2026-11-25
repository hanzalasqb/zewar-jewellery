import { LuGithub } from "react-icons/lu";
import { BRAND } from "@store/shared";
import { IS_DEMO } from "../api";
import { resetDemo } from "../api/demo";
import { Logo } from "../brand/Logo";
import { FOOTER_NOTE, REPO_URL } from "../brand/copy";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Logo />
          <p className="muted">{FOOTER_NOTE}</p>
        </div>
        <nav aria-label="Shop">
          <h4>Shop</h4>
          {BRAND.categories.map((c) => (
            <a key={c.id} href={`#/shop/${c.id}`}>
              {c.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Help">
          <h4>Help</h4>
          <a href="#/track">Track an order</a>
          <a href="#/wishlist">Wishlist</a>
          <a href="#/admin">Store admin</a>
        </nav>
        <div>
          <h4>About this project</h4>
          <p className="muted small">Portfolio project by Hanzala Saqib. React 19, a custom WebGL2 renderer and a Node.js API. Products, prices and people are fictional.</p>
          <a className="footer-gh" href={REPO_URL} target="_blank" rel="noreferrer">
            <LuGithub /> Source code
          </a>
          {IS_DEMO && (
            <button className="link-btn small" onClick={() => (resetDemo(), (location.hash = ""), location.reload())}>
              Reset demo data
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
