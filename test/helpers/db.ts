// Integration-test DB helpers. Imports the SAME Drizzle instance the app uses
// (@/lib/db), so resets/seeds and the code under test share one connection
// to the throwaway Postgres database provisioned in test/global-setup.ts.
import { createId } from "@paralleldrive/cuid2";
import { eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

// Wipe every table between tests. Children (which carry FKs to user) go before
// user; verification is standalone. Order matters for FK integrity.
//
// member/invitation carry FKs to both organization and user, so both must be
// deleted before either parent — deleted first, ahead of organization/user.
// organization itself has no FK to user, so its position relative to user is
// otherwise unconstrained.
export async function resetDb() {
  await db.delete(schema.member);
  await db.delete(schema.invitation);
  await db.delete(schema.organization);
  await db.delete(schema.profile);
  await db.delete(schema.session);
  await db.delete(schema.account);
  await db.delete(schema.verification);
  await db.delete(schema.user);
}

type SeedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

// Insert a user row. emailVerified is set so the row mirrors a real signed-in
// account; the integration tests mock the session rather than Better Auth.
export function seedUser(user: SeedUser) {
  return db
    .insert(schema.user)
    .values({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      image: user.image ?? null,
    })
    .returning();
}

type SeedProfile = {
  userId: string;
  birthdate?: Date | null;
  bio?: string | null;
  location?: string | null;
};

// Insert a profile row for an existing user.
export function seedProfile(profile: SeedProfile) {
  return db
    .insert(schema.profile)
    .values({
      id: createId(),
      userId: profile.userId,
      birthdate: profile.birthdate ?? null,
      bio: profile.bio ?? null,
      location: profile.location ?? null,
    })
    .returning();
}

type SeedOrganization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: string | null;
};

// Insert an organization row.
export function seedOrganization(organization: SeedOrganization) {
  return db
    .insert(schema.organization)
    .values({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo ?? null,
      metadata: organization.metadata ?? null,
    })
    .returning();
}

type SeedMember = {
  id: string;
  organizationId: string;
  userId: string;
  role?: string;
  // Optional explicit createdAt so tests asserting "earliest membership"
  // ordering aren't at the mercy of same-millisecond default timestamps.
  createdAt?: Date;
};

// Insert a member row linking an existing user to an existing organization.
export function seedMember(member: SeedMember) {
  return db
    .insert(schema.member)
    .values({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role ?? "member",
      ...(member.createdAt ? { createdAt: member.createdAt } : {}),
    })
    .returning();
}

// Query helpers for assertions in tests.

export async function getProfile(userId: string) {
  const results = await db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.userId, userId));
  return results[0] ?? null;
}

export async function getUser(userId: string) {
  const results = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId));
  return results[0] ?? null;
}

export async function countProfiles(userId: string) {
  const results = await db
    .select({ count: count() })
    .from(schema.profile)
    .where(eq(schema.profile.userId, userId));
  return results[0]?.count ?? 0;
}
