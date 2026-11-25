import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface Ctx {
  req: IncomingMessage;
  params: Record<string, string>;
  query: URLSearchParams;
  ip: string;
  /** Parses and validates the JSON body with a Zod schema. */
  body<T>(schema: ZodType<T, ZodTypeDef, unknown>): Promise<T>;
}

export type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler; status: number };

const MAX_BODY_BYTES = 100_000;

async function readJson(req: IncomingMessage): Promise<unknown> {
  const type = req.headers["content-type"] ?? "";
  if (!type.includes("application/json")) throw new HttpError(415, "Content-Type must be application/json");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Malformed JSON");
  }
}

/** A tiny typed router: `/api/tasks/:id` style paths, JSON in and out, consistent error shape. */
export class Router {
  private routes: Route[] = [];

  /** `status` is the success code, e.g. 201 for routes that create a resource. */
  on(method: string, path: string, handler: Handler, status = 200) {
    const keys: string[] = [];
    const pattern = new RegExp(
      "^" + path.replace(/:([a-zA-Z]+)/g, (_, k: string) => (keys.push(k), "([^/]+)")) + "/?$",
    );
    this.routes.push({ method, pattern, keys, handler, status });
    return this;
  }
  get = (p: string, h: Handler) => this.on("GET", p, h);
  post = (p: string, h: Handler, status?: number) => this.on("POST", p, h, status);
  patch = (p: string, h: Handler) => this.on("PATCH", p, h);
  delete = (p: string, h: Handler) => this.on("DELETE", p, h);

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
    let matchedPath = false;
    try {
      for (const r of this.routes) {
        const m = r.pattern.exec(url.pathname);
        if (!m) continue;
        matchedPath = true;
        if (r.method !== req.method) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const ctx: Ctx = {
          req,
          params,
          query: url.searchParams,
          ip,
          body: async (schema) => schema.parse(await readJson(req)),
        };
        const result = await r.handler(ctx);
        return send(res, result === undefined ? 204 : r.status, result);
      }
      throw new HttpError(matchedPath ? 405 : 404, matchedPath ? "Method not allowed" : "Not found");
    } catch (err) {
      if (err instanceof ZodError) {
        return send(res, 400, { error: "Validation failed", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      }
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, details: err.details });
      console.error(JSON.stringify({ level: "error", msg: "unhandled", path: url.pathname, err: String(err) }));
      return send(res, 500, { error: "Internal server error" });
    }
  }
}

export function send(res: ServerResponse, status: number, body?: unknown) {
  if (res.headersSent) return;
  if (status === 204 || body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify(body));
}
