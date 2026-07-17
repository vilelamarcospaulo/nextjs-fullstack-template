// Integration-test DB helpers. Imports the SAME Prisma instance the app uses
// (@/lib/prisma), so resets/seeds and the code under test share one connection
// to the throwaway Postgres database provisioned in test/global-setup.ts.
import { prisma } from "@/lib/prisma";

// Wipe every table between tests. Children (which carry FKs to user) go before
// user; verification is standalone. Order matters for FK integrity.
//
// member/invitation carry FKs to both organization and user, so both must be
// deleted before either parent — deleted first, ahead of organization/user.
// organization itself has no FK to user, so its position relative to user is
// otherwise unconstrained.
export async function resetDb() {
  await prisma.member.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
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
  return prisma.user.create({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      image: user.image ?? null,
    },
  });
}

type SeedProfile = {
  userId: string;
  birthdate?: Date | null;
  bio?: string | null;
  location?: string | null;
};

// Insert a profile row for an existing user.
export function seedProfile(profile: SeedProfile) {
  return prisma.profile.create({
    data: {
      userId: profile.userId,
      birthdate: profile.birthdate ?? null,
      bio: profile.bio ?? null,
      location: profile.location ?? null,
    },
  });
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
  return prisma.organization.create({
    data: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo ?? null,
      metadata: organization.metadata ?? null,
    },
  });
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
  return prisma.member.create({
    data: {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role ?? "member",
      ...(member.createdAt ? { createdAt: member.createdAt } : {}),
    },
  });
}
