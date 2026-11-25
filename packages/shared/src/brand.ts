import type { Coupon, ShippingRules } from "./cart";
import type { OptionValue, Product, ProductOption } from "./catalog";
import { rupees } from "./money";

/** Zewar — fine jewellery. All products, people and prices are fictional demo content. */
export const BRAND = {
  id: "zewar",
  name: "Zewar",
  tagline: "Fine jewellery, made to be kept",
  orderPrefix: "ZW",
  shipping: { flatFee: 0, freeOver: 0, codFee: rupees(500) } satisfies ShippingRules,
  coupons: [
    { code: "ZEWAR10", kind: "percent", value: 10, minSubtotal: rupees(100_000), description: "10% off orders over Rs 100,000" },
    { code: "WELCOME5000", kind: "fixed", value: rupees(5_000), minSubtotal: rupees(40_000), description: "Rs 5,000 off your first piece" },
  ] satisfies Coupon[],
  categories: [
    { id: "rings", label: "Rings", blurb: "Solitaires, halos and eternity bands" },
    { id: "necklaces", label: "Necklaces", blurb: "Pendants that sit just right" },
    { id: "earrings", label: "Earrings", blurb: "Studs, hoops and pearl drops" },
    { id: "bracelets", label: "Bracelets", blurb: "Tennis bracelets with brilliant-cut stones" },
  ],
} as const;

const v = (id: string, label: string, priceDelta = 0, hex?: string): OptionValue => ({ id, label, priceDelta: rupees(priceDelta), hex });

const METAL: ProductOption = {
  id: "metal",
  label: "Metal",
  kind: "swatch",
  values: [v("yellow-gold", "18k yellow gold", 0, "#ffd27a"), v("rose-gold", "18k rose gold", 0, "#ffc1aa"), v("white-gold", "18k white gold", 6_000, "#e6e7ea"), v("platinum", "Platinum", 38_000, "#d9dde0")],
};
const stone = (first: string): ProductOption => {
  const all = [v("diamond", "Lab diamond", 0, "#f4f7ff"), v("emerald", "Emerald", -12_000, "#1fbf6a"), v("sapphire", "Blue sapphire", -9_000, "#2f5bff"), v("ruby", "Ruby", -6_000, "#ff1f45")];
  return { id: "stone", label: "Stone", kind: "swatch", values: [...all.filter((x) => x.id === first), ...all.filter((x) => x.id !== first)] };
};
const RING_SIZE: ProductOption = { id: "size", label: "Ring size", kind: "chip", values: ["5", "6", "7", "8", "9"].map((s) => v(s, s)) };
const LENGTH: ProductOption = { id: "length", label: "Chain length", kind: "chip", values: [v("16", '16"'), v("18", '18"', 3_500), v("20", '20"', 6_500)] };
const PEARL: ProductOption = { id: "stone", label: "Pearl", kind: "swatch", values: [v("white", "White freshwater", 0, "#f3ece2"), v("golden", "Golden South Sea", 9_000, "#f1d39a"), v("blush", "Blush", 2_000, "#f4d3cf")] };

const p = (x: Omit<Product, "options" | "badges" | "rating" | "reviews"> & Partial<Pick<Product, "badges" | "rating" | "reviews">> & { options: ProductOption[] }): Product => ({ badges: [], rating: 4.8, reviews: 24, ...x });

export const PRODUCTS: Product[] = [
  p({ id: "z1", slug: "aurora-solitaire-ring", name: "Aurora Solitaire", category: "rings", tagline: "A single brilliant-cut stone on a slim four-prong setting", description: "Our signature engagement ring. A round brilliant stone rises above a 1.8 mm band on four claw prongs, letting light in from every side.", details: ["1.0 ct round brilliant, VS1 / F (lab diamond)", "1.8 mm comfort-fit band", "Four-claw basket setting", "Hallmarked, with a certificate of authenticity"], price: rupees(185_000), compareAt: rupees(210_000), options: [METAL, stone("diamond"), RING_SIZE], model: { kind: "solitaire" }, badges: ["Bestseller"], rating: 4.9, reviews: 132, featured: true }),
  p({ id: "z2", slug: "noor-halo-ring", name: "Noor Halo", category: "rings", tagline: "A centre stone framed by a ring of fourteen smaller ones", description: "A halo of pavé stones makes the centre stone look larger and throws light all evening.", details: ["0.8 ct centre + 0.25 ct halo", "Pavé-set micro stones", "1.9 mm band"], price: rupees(235_000), options: [METAL, stone("sapphire"), RING_SIZE], model: { kind: "halo" }, badges: ["New"], rating: 4.8, reviews: 58, featured: true }),
  p({ id: "z3", slug: "infinity-eternity-band", name: "Infinity Eternity Band", category: "rings", tagline: "Stones all the way round, for every day after", description: "Twenty-six stones set edge to edge around a rounded band. Wear it alone or stacked with a solitaire.", details: ["26 × 0.04 ct stones", "Shared-prong setting", "2.2 mm band"], price: rupees(165_000), options: [METAL, stone("diamond"), RING_SIZE], model: { kind: "eternity" }, rating: 4.7, reviews: 41 }),
  p({ id: "z4", slug: "zumurd-emerald-ring", name: "Zumurd Emerald Ring", category: "rings", tagline: "A step-cut emerald with a long, calm sparkle", description: "Step cuts show a gem's colour rather than its fire. This one is all deep, cool green.", details: ["1.2 ct emerald-cut emerald", "Four-claw setting", "1.8 mm band"], price: rupees(198_000), options: [METAL, stone("emerald"), RING_SIZE], model: { kind: "solitaire", cut: "emerald" }, rating: 4.8, reviews: 19 }),
  p({ id: "z5", slug: "mehr-pendant-necklace", name: "Mehr Pendant", category: "necklaces", tagline: "A bezel-set stone on a fine cable chain", description: "A smooth bezel protects the stone and keeps the pendant close to the skin, so it's easy to wear every day.", details: ["0.75 ct stone in a polished bezel", "1.1 mm cable chain", "Lobster clasp"], price: rupees(95_000), options: [METAL, stone("emerald"), LENGTH], model: { kind: "pendant" }, badges: ["Bestseller"], rating: 4.9, reviews: 87, featured: true }),
  p({ id: "z6", slug: "neelam-sapphire-pendant", name: "Neelam Pendant", category: "necklaces", tagline: "Blue sapphire, the colour of a late evening", description: "A round sapphire in a slim bezel, hung from a fine cable chain.", details: ["0.9 ct blue sapphire", "Polished bezel", "1.1 mm cable chain"], price: rupees(118_000), options: [METAL, stone("sapphire"), LENGTH], model: { kind: "pendant" }, rating: 4.7, reviews: 26 }),
  p({ id: "z7", slug: "taara-stud-earrings", name: "Taara Studs", category: "earrings", tagline: "Two bright points of light, every single day", description: "Classic four-prong studs on screw-back posts that stay put.", details: ["2 × 0.5 ct brilliant-cut stones", "Four-prong baskets", "Screw-back posts"], price: rupees(120_000), options: [METAL, stone("diamond")], model: { kind: "studs" }, badges: ["Gift pick"], rating: 4.9, reviews: 112, featured: true }),
  p({ id: "z8", slug: "yaqoot-ruby-studs", name: "Yaqoot Ruby Studs", category: "earrings", tagline: "Pigeon-blood red, set simply", description: "Rich red rubies in a minimal basket so the colour does the talking.", details: ["2 × 0.45 ct rubies", "Four-prong baskets", "Push-back posts"], price: rupees(104_000), options: [METAL, stone("ruby")], model: { kind: "studs" }, rating: 4.6, reviews: 17 }),
  p({ id: "z9", slug: "chand-hoop-earrings", name: "Chand Hoops", category: "earrings", tagline: "Polished hoops with a line of pavé stones", description: "Medium hoops with nine pavé stones on the front of each one. Hinged clicker closure.", details: ["24 mm diameter", "9 pavé stones per hoop", "Hinged clicker"], price: rupees(78_000), options: [METAL, stone("diamond")], model: { kind: "hoops" }, rating: 4.7, reviews: 49 }),
  p({ id: "z10", slug: "moti-pearl-drops", name: "Moti Pearl Drops", category: "earrings", tagline: "Lustrous pearls on a curved gold hook", description: "Hand-matched round pearls with a deep, mirror-like lustre.", details: ["9–10 mm round pearls", "AAA lustre", "Solid gold hooks"], price: rupees(42_000), options: [METAL, PEARL], model: { kind: "pearl-drops" }, badges: ["New"], rating: 4.8, reviews: 33 }),
  p({ id: "z11", slug: "riwayat-tennis-bracelet", name: "Riwayat Tennis Bracelet", category: "bracelets", tagline: "Thirty-four stones in a supple, unbroken line", description: "Each stone sits in its own hinged link so the bracelet drapes like fabric. Box clasp with a safety catch.", details: ["34 × 0.1 ct stones (3.4 ct total)", "Hinged four-prong links", "Box clasp with safety catch"], price: rupees(320_000), compareAt: rupees(355_000), options: [METAL, stone("diamond")], model: { kind: "tennis" }, badges: ["Limited"], rating: 5.0, reviews: 21, featured: true }),
  p({ id: "z12", slug: "gulab-rose-eternity", name: "Gulab Ruby Eternity", category: "rings", tagline: "A full circle of rubies in rose gold", description: "Our eternity band with rubies instead of diamonds, made for stacking.", details: ["26 × 0.04 ct rubies", "Shared-prong setting", "2.2 mm band"], price: rupees(152_000), options: [METAL, stone("ruby"), RING_SIZE], model: { kind: "eternity" }, rating: 4.7, reviews: 12 }),
];

/** Deterministic demo stock: a few variants low or sold out so those states show up. */
export function initialStock(p: Product, variant: string): number {
  let h = 0;
  for (const ch of p.id + variant) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = h % 20;
  return r === 0 ? 0 : r < 3 ? 1 : r < 6 ? 2 : 4 + (r % 5);
}
