import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { getDb, type DrizzleDb } from "@/lib/db";
import * as schema from "@/lib/schema";
import { member } from "@/lib/schema";
import { getEnv } from "@/lib/env";

// Structural rather than `ReturnType<typeof getAuth>` deliberately: getAuth()
// itself calls createPersonalOrgForUser from inside a databaseHooks callback,
// so tying this to getAuth()'s own return type would be circular. Every
// caller (getAuth() internally, and the direct-call integration tests) still
// satisfies this structurally since the organization plugin is always on.
type OrganizationCapableAuth = {
  api: {
    createOrganization: (input: {
      body: { name: string; slug: string; userId: string };
    }) => Promise<unknown>;
  };
};

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
export async function createPersonalOrgForUser(
  auth: OrganizationCapableAuth,
  user: { id: string; name: string },
): Promise<void> {
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
export async function defaultActiveOrganization(
  db: DrizzleDb,
  session: { userId: string; activeOrganizationId?: string | null },
): Promise<{ data: { activeOrganizationId: string } } | undefined> {
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

// Builds a fresh Better Auth instance on every call — deliberately not
// cached as a module-level singleton. betterAuth() captures a concrete
// Drizzle client at construction time, and a cached singleton would keep
// reusing that one client's underlying pg.Pool/socket across every request
// in the isolate — the same cross-request I/O reuse bug fixed in
// src/lib/db.ts, just one level up (a stale connection surfaces here as
// hung or failed requests specifically on routes that hit the database,
// e.g. the OAuth callback). betterAuth() itself has no lazy/async form, so
// getEnv()/getDb() run eagerly on each getAuth() call instead of at module
// scope — safe because both are request-scoped-safe functions themselves
// (see src/lib/env.ts, src/lib/db.ts). Call from request-scoped code (a
// Route Handler, Server Action, or Server Component render) only.
//
// getDb() is called exactly ONCE here, not once per call site — a single
// signup used to open three separate connections (one each for the
// drizzleAdapter, createPersonalOrgForUser, and defaultActiveOrganization),
// since each of those used to call getAuth()/getDb() again independently.
// The one `db` built below is threaded through both databaseHooks instead.
export function getAuth() {
  const authEnv = getEnv();

  // Derive the trusted origin from the canonical app URL so better-auth's
  // CSRF / origin-check middleware accepts requests originating from this
  // host. Additional origins (e.g. a CDN or preview URL) can be appended.
  const trustedOrigins = [new URL(authEnv.BETTER_AUTH_URL).origin];

  const db = getDb();

  const authInstance = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL: authEnv.BETTER_AUTH_URL,
    secret: authEnv.BETTER_AUTH_SECRET,

    // Origins that better-auth will accept for CSRF and callback-URL checks.
    // Verified in node_modules/@better-auth/core/dist/types/init-options.d.mts:
    //   trustedOrigins?: string[] | ((request?) => Awaitable<string[]>)
    trustedOrigins,

    socialProviders: {
      google: {
        clientId: authEnv.GOOGLE_CLIENT_ID,
        clientSecret: authEnv.GOOGLE_CLIENT_SECRET,
      },
    },

    // Rate limiting is explicitly disabled for now: better-auth's built-in
    // "memory" storage is a per-process counter, which doesn't work across
    // Cloudflare Workers isolates (many short-lived, concurrent isolates, no
    // shared memory between them) — leaving it enabled with "memory" storage
    // wouldn't actually rate-limit anything in production, just silently
    // pretend to. Note that simply omitting this block would NOT disable rate
    // limiting: better-auth's own default is enabled-in-production. Revisit
    // with a durable store (Workers KV or D1) backing it in a later phase.
    rateLimit: {
      enabled: false,
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
            await createPersonalOrgForUser(authInstance, user);
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
            return defaultActiveOrganization(db, {
              userId: session.userId,
              activeOrganizationId: session.activeOrganizationId as
                string | null | undefined,
            });
          },
        },
      },
    },
  });

  return authInstance;
}
