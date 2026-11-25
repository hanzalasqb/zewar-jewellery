import { createServer } from "node:http";
import { z } from "zod";
import { BRAND, CartLineSchema, ORDER_STATUSES, PRODUCTS, quote } from "@store/shared";
import { bearer, RateLimiter, signToken, verifyPassword, verifyToken } from "./auth";
import { Store } from "./db";
import { HttpError, Router, type Ctx } from "./http";

export interface AppConfig {
  jwtSecret: string;
  adminEmail: string;
  adminPasswordHash: string; // scrypt hash from auth.hashPassword
  databaseFile?: string;
  corsOrigins?: string[];
}

const QuoteInput = z.object({ lines: z.array(CartLineSchema).max(30), coupon: z.string().max(30).nullable().default(null), payment: z.enum(["cod", "bank"]).default("cod") });
const TrackInput = z.object({ number: z.string().min(3).max(30), email: z.string().email() });
const StatusInput = z.object({ status: z.enum(ORDER_STATUSES) });
const StockInput = z.object({ variant: z.string(), stock: z.number().int().min(0).max(10_000) });

export function createApp(config: AppConfig) {
  const store = new Store(config.databaseFile);
  const router = new Router();
  const limiter = new RateLimiter(10, 15 * 60 * 1000);
  const orderLimiter = new RateLimiter(20, 60 * 60 * 1000);

  const server = createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    const origin = req.headers.origin;
    if (origin && config.corsOrigins?.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    }
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    void router.handle(req, res);
  });

  const admin = (ctx: Ctx) => {
    const claims = verifyToken(bearer(ctx.req.headers.authorization), config.jwtSecret);
    if (claims.name !== "admin") throw new HttpError(403, "Admins only");
  };

  router
    .get("/api/health", () => ({ ok: true, brand: BRAND.id }))
    .get("/api/products", () => ({ products: PRODUCTS, stock: store.allStock() }))
    .get("/api/products/:slug", (ctx) => {
      const p = PRODUCTS.find((x) => x.slug === ctx.params.slug);
      if (!p) throw new HttpError(404, "Product not found");
      return { product: p, stock: store.stock(p.id) };
    })
    .post("/api/cart/quote", async (ctx) => {
      const input = await ctx.body(QuoteInput);
      try {
        const q = quote(input.lines, PRODUCTS, { coupons: BRAND.coupons, couponCode: input.coupon, shipping: BRAND.shipping, payment: input.payment });
        return { ...q, lines: q.lines.map(({ product, ...l }) => ({ ...l, name: product.name })) };
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
    })
    .post(
      "/api/orders",
      async (ctx) => {
        orderLimiter.take(ctx.ip);
        return store.placeOrder(await ctx.body(z.any()));
      },
      201,
    )
    .post("/api/orders/track", async (ctx) => {
      limiter.take(`track:${ctx.ip}`);
      const { number, email } = await ctx.body(TrackInput);
      return store.track(number, email);
    })

    /* admin */
    .post("/api/admin/login", async (ctx) => {
      limiter.take(`admin:${ctx.ip}`);
      const { email, password } = await ctx.body(z.object({ email: z.string(), password: z.string() }));
      if (email.toLowerCase() !== config.adminEmail.toLowerCase() || !verifyPassword(password, config.adminPasswordHash)) throw new HttpError(401, "Wrong email or password");
      return { token: signToken("admin", "admin", config.jwtSecret, 60 * 60 * 4) };
    })
    .get("/api/admin/orders", (ctx) => (admin(ctx), store.orders()))
    .patch("/api/admin/orders/:number", async (ctx) => {
      admin(ctx);
      return store.setStatus(ctx.params.number, (await ctx.body(StatusInput)).status);
    })
    .get("/api/admin/inventory", (ctx) => (admin(ctx), store.allStock()))
    .patch("/api/admin/inventory/:productId", async (ctx) => {
      admin(ctx);
      const { variant, stock } = await ctx.body(StockInput);
      store.setStock(ctx.params.productId, variant, stock);
      return store.stock(ctx.params.productId);
    });

  return {
    server,
    store,
    close: () => new Promise<void>((r) => server.close(() => (store.close(), r()))),
  };
}
