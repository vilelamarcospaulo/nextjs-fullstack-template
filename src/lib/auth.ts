import Database from "better-sqlite3";
import { betterAuth } from "better-auth";

// Server-side Better Auth instance. Uses a local SQLite file via the built-in
// Kysely adapter (no separate ORM yet). Google is the only provider for now.
export const auth = betterAuth({
  database: new Database("./sqlite.db"),
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
