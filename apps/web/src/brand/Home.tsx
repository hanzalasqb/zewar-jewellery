import { useMemo, useState } from "react";
import { LuArrowRight, LuGem, LuHandHeart, LuShieldCheck, LuSparkles, LuTruck } from "react-icons/lu";
import { BRAND, defaultSelection, formatPrice, optionValue, unitPrice, type Product, type Selection } from "@store/shared";
import { OptionPicker } from "../components/OptionPicker";
import { ProductCard } from "../components/ProductCard";
import { actions, stockOf, toast, useStore } from "../store";
import { Stage } from "../three/Stage";
import { useThumbnail } from "../three/thumbnails";
import { buildModel, viewFor } from "./model";

function CategoryTile({ id, label, blurb, product }: { id: string; label: string; blurb: string; product?: Product }) {
  const sel = useMemo(() => (product ? defaultSelection(product) : undefined), [product]);
  const url = useThumbnail(product, sel);
  return (
    <a className="cat-tile" href={`#/shop/${id}`}>
      <span className="cat-media">{url && <img src={url} alt="" />}</span>
      <span className="cat-text">
        <strong>{label}</strong>
        <span>{blurb}</span>
      </span>
      <LuArrowRight className="cat-arrow" aria-hidden />
    </a>
  );
}

export function Home() {
  const state = useStore((s) => s);
  const products = state.products;
  const hero = products.find((p) => p.slug === "aurora-solitaire-ring");
  const studio = products.find((p) => p.slug === "noor-halo-ring");
  const [sel, setSel] = useState<Selection | null>(null);
  const studioSel = sel ?? (studio ? defaultSelection(studio) : {});
  const heroItems = useMemo(() => (hero ? buildModel(hero, defaultSelection(hero)) : []), [hero]);
  const studioItems = useMemo(() => (studio ? buildModel(studio, studioSel) : []), [studio, studioSel]);
  const [email, setEmail] = useState("");

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <LuSparkles aria-hidden /> Fine jewellery · Lahore
          </p>
          <h1>
            Light,
            <br />
            held in <em>gold.</em>
          </h1>
          <p className="lede">Lab-grown diamonds and precious stones set in 18k gold and platinum. Turn every piece in 3D, choose your metal and stone, and see it change in real time.</p>
          <div className="hero-ctas">
            <a className="btn btn-primary btn-lg" href="#/shop/rings">
              Shop rings
            </a>
            <a className="btn btn-lg" href="#studio" onClick={(e) => (e.preventDefault(), document.getElementById("studio")?.scrollIntoView())}>
              Design your ring
            </a>
          </div>
        </div>
        <div className="hero-stage">
          <div className="hero-glow" aria-hidden />
          {hero && <Stage items={heroItems} view={viewFor(hero, "hero")} label="A gold solitaire ring with a brilliant-cut stone, slowly turning" />}
          <p className="hero-caption">
            <span>{hero?.name}</span> · from {hero && formatPrice(hero.price)}
          </p>
        </div>
      </section>

      <ul className="trust" aria-label="Our promises">
        <li>
          <LuGem aria-hidden /> Certified lab diamonds
        </li>
        <li>
          <LuTruck aria-hidden /> Free insured delivery
        </li>
        <li>
          <LuShieldCheck aria-hidden /> Hallmarked 18k gold
        </li>
        <li>
          <LuHandHeart aria-hidden /> Lifetime cleaning
        </li>
      </ul>

      <section className="section">
        <header className="section-head">
          <h2>Shop by category</h2>
          <a href="#/shop" className="text-link">
            View everything <LuArrowRight aria-hidden />
          </a>
        </header>
        <div className="cat-grid">
          {BRAND.categories.map((c) => (
            <CategoryTile key={c.id} {...c} product={products.find((p) => p.category === c.id && p.featured) ?? products.find((p) => p.category === c.id)} />
          ))}
        </div>
      </section>

      {studio && (
        <section className="studio" id="studio" aria-labelledby="studio-title">
          <div className="studio-stage">
            <Stage key="studio" items={studioItems} view={viewFor(studio, "detail")} label={`3D preview of the ${studio.name} in your chosen metal and stone`} controls />
          </div>
          <div className="studio-panel">
            <p className="eyebrow">The ring studio</p>
            <h2 id="studio-title">Design it, then turn it in your hand</h2>
            <p className="muted">Every reflection is rendered live in your browser. Pick a metal and a stone and the ring updates instantly, along with the price.</p>
            <OptionPicker product={studio} selection={studioSel} onChange={setSel} stockFor={(s) => stockOf(state, studio, s)} />
            <div className="studio-buy">
              <div>
                <span className="muted small">
                  {optionValue(studio, "metal", studioSel)?.label} · {optionValue(studio, "stone", studioSel)?.label}
                </span>
                <strong className="studio-price">{formatPrice(unitPrice(studio, studioSel))}</strong>
              </div>
              <button className="btn btn-primary btn-lg" onClick={() => actions.addToCart(studio, studioSel)}>
                Add to bag
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <header className="section-head">
          <h2>Most loved</h2>
          <a href="#/shop" className="text-link">
            Shop all <LuArrowRight aria-hidden />
          </a>
        </header>
        <div className="grid">
          {products
            .filter((p) => p.featured)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>

      <section className="craft">
        <div>
          <p className="eyebrow">Our craft</p>
          <h2>Made slowly, to be worn for decades</h2>
        </div>
        <dl>
          <div>
            <dt>72 hours</dt>
            <dd>of hand finishing in our Lahore workshop for every ring</dd>
          </div>
          <div>
            <dt>100%</dt>
            <dd>recycled 18k gold and conflict-free, lab-grown stones</dd>
          </div>
          <div>
            <dt>Forever</dt>
            <dd>free cleaning, polishing and prong checks, for life</dd>
          </div>
        </dl>
      </section>

      <section className="newsletter">
        <h2>First look at new collections</h2>
        <p className="muted">One email a month. No spam, unsubscribe any time.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Enter a valid email address", "error");
            setEmail("");
            toast("You're on the list. Welcome to Zewar.");
          }}
        >
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" aria-label="Email address" />
          <button className="btn btn-primary">Subscribe</button>
        </form>
      </section>
    </div>
  );
}
