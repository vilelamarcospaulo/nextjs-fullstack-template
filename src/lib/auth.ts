import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { member } from "@/lib/schema";
import { env } from "@/lib/env";

// Derive the trusted origin from the canonical app URL so better-auth's
// CSRF / origin-check middleware accepts requests originating from this host.
// Additional origins (e.g. a CDN or preview URL) can be appended to the array.
const trustedOrigins = [new URL(env.BETTER_AUTH_URL).origin];

// ── Organization databaseHooks, extracted as standalone functions ──────────
//
// Both are wired into `databaseHooks` below but exported here so they can be
// exercised directly in tests against the real test Postgres DB (a real OAuth
// signup can't be driven locally — Google is the only provider configured).
// See src/app/org/auth-hooks.test.ts (placed under src/app/org/ rather than
// colocated here so it runs in Vitest's DB-backed "integration" project —
// src/lib/**/*.test.ts is the "unit" project, which has no database).

// Auto-creates a personal "workspace" organization for every new signup
// (`databaseHooks.user.create.after`). Deterministic slug (`user.id` is
// already globally unique) avoids any collision/retry logic.
//
// IMPORTANT: `auth.api.createOrganization` is called with NO `headers` key at
// all (not even `headers: new Headers()`). better-auth's create-organization
// route only skips its session check when *both* `ctx.headers` and
// `ctx.request` are falsy (i.e. treats the call as a trusted "system action"
// authenticated by the explicit `userId` in the body instead of a session) —
// see the `!session && (ctx.request || ctx.headers)` guard in
// node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs.
// There is no session yet at this point in the signup flow, so passing any
// headers here makes that guard throw UNAUTHORIZED. Don't "fix" this later by
// adding a headers object.
export async function createPersonalOrgForUser(user: {
  id: string;
  name: string;
}): Promise<void> {
  await auth.api.createOrganization({
    body: {
      name: `${user.name}'s workspace`,
      slug: `user-${user.id}`,
      userId: user.id,
    },
  });
}

// Defaults a brand-new session's activeOrganizationId to the user's earliest
// membership (`databaseHooks.session.create.before`). createPersonalOrgForUser
// above ran with no session, so it couldn't call setActiveOrganization itself
// — this backfills the first real session created after signup. A no-op
// (returns undefined) once a session already carries an active org, or if the
// user somehow has no memberships yet.
export async function defaultActiveOrganization(session: {
  userId: string;
  activeOrganizationId?: string | null;
}): Promise<{ data: { activeOrganizationId: string } } | undefined> {
  if (session.activeOrganizationId) return undefined;

  const [firstMembership] = await db
    .select()
    .from(member)
    .where(eq(member.userId, session.userId))
    .orderBy(asc(member.createdAt))
    .limit(1);
  if (!firstMembership) return undefined;

  return { data: { activeOrganizationId: firstMembership.organizationId } };
}

// Server-side Better Auth instance. Persistence runs through Drizzle (node-postgres).
// Google is the only provider for now.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
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
    window: 10, // seconds
    max: 100, // requests per window
    storage: "memory",
  },

  // Default owner/admin/member roles + built-in permission statements — no
  // custom `ac`/`roles`, no `teams`, no `dynamicAccessControl`. Every signup
  // gets a personal org (databaseHooks below); allowUserToCreateOrganization
  // additionally lets users create further orgs beyond that one.
  plugins: [organization({ allowUserToCreateOrganization: true })],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createPersonalOrgForUser(user);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // `session.activeOrganizationId` isn't part of better-auth's base
          // Session type (it's added at runtime by the organization plugin —
          // see the field-def comment on Session.activeOrganizationId in
          // src/lib/schema.ts), so the databaseHooks callback type only
          // knows about it via the callback's `& Record<string, unknown>`
          // component, which types the value as `unknown`. Cast it to what it
          // actually is at runtime.
          return defaultActiveOrganization({
            userId: session.userId,
            activeOrganizationId: session.activeOrganizationId as
              string | null | undefined,
          });
        },
      },
    },
  },
});
