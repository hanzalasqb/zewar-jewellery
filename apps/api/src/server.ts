import { createApp } from "./app";
import { hashPassword } from "./auth";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) {
    console.error(`${k} is required (see .env.example).`);
    process.exit(1);
  }
  return v;
};

const JWT_SECRET = need("JWT_SECRET");
if (JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters.");
  process.exit(1);
}

const app = createApp({
  jwtSecret: JWT_SECRET,
  adminEmail: need("ADMIN_EMAIL"),
  // Prefer a stored hash; a plain password is hashed at boot for local development.
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? hashPassword(need("ADMIN_PASSWORD")),
  databaseFile: process.env.DATABASE_FILE ?? "store.db",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()),
});

const PORT = Number(process.env.PORT ?? 4000);
app.server.listen(PORT, () => console.log(JSON.stringify({ level: "info", msg: "store api listening", port: PORT })));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, async () => (await app.close(), process.exit(0)));
