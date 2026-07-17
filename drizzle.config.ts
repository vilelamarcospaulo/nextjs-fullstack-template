import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// DATABASE_URL is asserted here (not via src/lib/env.ts) because drizzle-kit
// runs as a standalone CLI outside the Next.js process — it never imports
// src/lib/env.ts's validated-env module.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "src/lib/schema.ts",
  out: "drizzle/migrations",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
