// Integration tests for the two better-auth `databaseHooks` extracted as
// standalone, independently-testable functions in src/lib/auth.ts
// (createPersonalOrgForUser, defaultActiveOrganization).
//
// Why here, and why no mocks: this app only has Google OAuth configured (no
// password flow), so there's no way to drive a real signup locally to
// exercise `user.create.after` / `session.create.before` end to end. The
// pragmatic alternative is to call the extracted functions directly against
// the real test Postgres DB and assert their Drizzle side effects. Placed
// under src/app/org/ (rather than colocated as src/lib/auth.test.ts) so this
// file is picked up by Vitest's "integration" project, which is the one that
// provisions the real migrated Postgres DB (see vitest.config.ts) — the
// "unit" project that matches src/lib/**/*.test.ts explicitly has no
// database.
//
// createPersonalOrgForUser is NOT mocked at the auth.api.createOrganization
// boundary: the entire point of that function is the Member/role wiring
// better-auth's real endpoint produces, which a mock would tell us nothing
// about, so we call the real thing and assert the resulting rows.
import { eq, and } from "drizzle-orm";
import {
  createPersonalOrgForUser,
  defaultActiveOrganization,
  getAuth,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/schema";
import {
  resetDb,
  seedUser,
  seedOrganization,
  seedMember,
} from "../../../test/helpers/db";

beforeEach(async () => {
  await resetDb();
});

describe("createPersonalOrgForUser", () => {
  it("creates a personal workspace organization and an owner Member row", async () => {
    await seedUser({
      id: "user-a",
      name: "Alice",
      email: "alice@example.com",
    });

    await createPersonalOrgForUser(getAuth(), { id: "user-a", name: "Alice" });

    const orgs = await getDb()
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.slug, "user-user-a"));
    const org = orgs[0];
    expect(org).not.toBeUndefined();
    expect(org!.name).toBe("Alice's workspace");

    const members = await getDb()
      .select()
      .from(schema.member)
      .where(
        and(
          eq(schema.member.organizationId, org!.id),
          eq(schema.member.userId, "user-a"),
        ),
      );
    const member = members[0];
    expect(member).not.toBeUndefined();
    // better-auth's default creatorRole for auth.api.createOrganization.
    expect(member!.role).toBe("owner");
  });
});

describe("defaultActiveOrganization", () => {
  it("is a no-op when the session already has an active org", async () => {
    const result = await defaultActiveOrganization(getDb(), {
      userId: "user-a",
      activeOrganizationId: "org-existing",
    });

    expect(result).toBeUndefined();
  });

  it("is a no-op when the user has no memberships", async () => {
    await seedUser({
      id: "user-a",
      name: "Alice",
      email: "alice@example.com",
    });

    const result = await defaultActiveOrganization(getDb(), {
      userId: "user-a",
      activeOrganizationId: null,
    });

    expect(result).toBeUndefined();
  });

  it("defaults to the user's earliest membership", async () => {
    await seedUser({
      id: "user-a",
      name: "Alice",
      email: "alice@example.com",
    });
    await seedOrganization({ id: "org-1", name: "Org One", slug: "org-one" });
    await seedOrganization({ id: "org-2", name: "Org Two", slug: "org-two" });
    // Explicit createdAt values so "earliest" ordering isn't at the mercy of
    // same-millisecond default timestamps.
    await seedMember({
      id: "member-2",
      organizationId: "org-2",
      userId: "user-a",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    });
    await seedMember({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-a",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const result = await defaultActiveOrganization(getDb(), {
      userId: "user-a",
      activeOrganizationId: undefined,
    });

    expect(result).toEqual({ data: { activeOrganizationId: "org-1" } });
  });
});
