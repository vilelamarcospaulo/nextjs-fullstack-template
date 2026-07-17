vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn(),
      addMember: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { addMemberByEmail } from "@/app/org/actions";
import {
  resetDb,
  seedUser,
  seedOrganization,
  seedMember,
} from "../../../test/helpers/db";

const getSession = auth.api.getSession as unknown as ReturnType<typeof vi.fn>;
const hasPermission = auth.api.hasPermission as unknown as ReturnType<
  typeof vi.fn
>;
const addMember = auth.api.addMember as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
});

describe("addMemberByEmail", () => {
  it("no session → unauthenticated", async () => {
    getSession.mockResolvedValue(null);

    const result = await addMemberByEmail("org-1", "bob@example.com", "member");

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("invalid email → invalid_email, no permission check", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const result = await addMemberByEmail("org-1", "not-an-email", "member");

    expect(result).toEqual({ ok: false, error: "invalid_email" });
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("invalid role → invalid_role, no permission check", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const result = await addMemberByEmail(
      "org-1",
      "bob@example.com",
      // @ts-expect-error -- intentionally invalid role at the boundary
      "owner",
    );

    expect(result).toEqual({ ok: false, error: "invalid_role" });
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("hasPermission success:false → forbidden", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });
    hasPermission.mockResolvedValue({ error: null, success: false });

    const result = await addMemberByEmail("org-1", "bob@example.com", "member");

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(addMember).not.toHaveBeenCalled();
  });

  it("unknown email → no_account_with_that_email", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });
    hasPermission.mockResolvedValue({ error: null, success: true });

    const result = await addMemberByEmail(
      "org-1",
      "ghost@example.com",
      "member",
    );

    expect(result).toEqual({ ok: false, error: "no_account_with_that_email" });
    expect(addMember).not.toHaveBeenCalled();
  });

  it("already a member → already_a_member when addMember throws", async () => {
    await seedUser({ id: "user-b", name: "Bob", email: "bob@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });
    hasPermission.mockResolvedValue({ error: null, success: true });
    addMember.mockRejectedValue(
      new Error("USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION"),
    );

    const result = await addMemberByEmail("org-1", "bob@example.com", "member");

    expect(result).toEqual({ ok: false, error: "already_a_member" });
  });

  it("success path → resolves userId by email, calls addMember, returns ok", async () => {
    await seedOrganization({ id: "org-1", name: "Org One", slug: "org-one" });
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    await seedMember({
      id: "member-a",
      organizationId: "org-1",
      userId: "user-a",
    });
    await seedUser({ id: "user-b", name: "Bob", email: "bob@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });
    hasPermission.mockResolvedValue({ error: null, success: true });
    addMember.mockResolvedValue({});

    const result = await addMemberByEmail("org-1", "bob@example.com", "admin");

    expect(result).toEqual({ ok: true });
    expect(addMember).toHaveBeenCalledWith({
      body: { organizationId: "org-1", userId: "user-b", role: "admin" },
    });
  });
});
