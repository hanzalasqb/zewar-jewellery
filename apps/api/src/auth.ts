import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

/* ---------- Passwords: scrypt with a per-user salt ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}

/* ---------- JWT (HS256) with no third-party dependency ---------- */

const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");

export interface TokenClaims {
  sub: string;
  name: string;
  iat: number;
  exp: number;
}

export function signToken(sub: string, name: string, secret: string, ttlSeconds = 60 * 60 * 8): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, name, iat: now, exp: now + ttlSeconds } satisfies TokenClaims);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string, secret: string): TokenClaims {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) throw new HttpError(401, "Invalid token");
  const expected = createHmac("sha256", secret).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(401, "Invalid token");
  const header = JSON.parse(Buffer.from(head, "base64url").toString()) as { alg?: string };
  if (header.alg !== "HS256") throw new HttpError(401, "Invalid token");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenClaims;
  if (typeof claims.exp !== "number" || claims.exp < Date.now() / 1000) throw new HttpError(401, "Token expired");
  return claims;
}

export function bearer(authorization: string | undefined): string {
  const m = /^Bearer (.+)$/.exec(authorization ?? "");
  if (!m) throw new HttpError(401, "Sign in required");
  return m[1];
}

/* ---------- Rate limiting: fixed window per key ---------- */

export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  take(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.reset < now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      return;
    }
    if (++entry.count > this.limit) {
      throw new HttpError(429, "Too many attempts, try again later", { retryAfterSeconds: Math.ceil((entry.reset - now) / 1000) });
    }
  }
}
