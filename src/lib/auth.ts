import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

// Derive the trusted origin from the canonical app URL so better-auth's
// CSRF / origin-check middleware accepts requests originating from this host.
// Additional origins (e.g. a CDN or preview URL) can be appended to the array.
const trustedOrigins = [new URL(env.BETTER_AUTH_URL).origin];

// Server-side Better Auth instance. Persistence runs through Prisma (typed
// client, SQLite). Google is the only provider for now.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  // Origins that better-auth will accept for CSRF and callback-URL checks.
  // Verified in node_modules/@better-auth/core/dist/types/init-options.d.mts:
  //   trustedOrigins?: string[] | ((request?) => Awaitable<string[]>)
  trustedOrigins,

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  // Rate limiting — config shape verified in
  //   node_modules/@better-auth/core/dist/types/init-options.d.mts (BetterAuthRateLimitOptions)
  // and in the runtime defaults in
  //   node_modules/better-auth/dist/context/create-context.mjs.
  //
  // Enabled explicitly in all environments (the default is production-only).
  // window: 10 s, max: 100 requests — same as the library defaults, made
  // explicit here so future tuning is visible in code review.
  rateLimit: {
    enabled: true,
    window: 10,  // seconds
    max: 100,    // requests per window
    storage: "memory",
  },
});
