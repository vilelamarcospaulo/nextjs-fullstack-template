vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    profile: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import type { Mock } from "vitest";
import { prisma } from "@/lib/prisma";
import { getProfile, updateProfile } from "@/internal/use_case/profile";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
//
// Prisma's real method types are far stricter than a unit test needs (full
// row selections, generics). We view each mocked method through Vitest's loose
// `Mock` type so resolved values and recorded call args stay assertable without
// reconstructing exact Prisma payload shapes.
const asMock = (fn: unknown) => fn as unknown as Mock;
const mockedFindUnique = () => asMock(prisma.user.findUnique);
const mockedUserUpdate = () => asMock(prisma.user.update);
const mockedProfileUpsert = () => asMock(prisma.profile.upsert);
const mockedTransaction = () => asMock(prisma.$transaction);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

describe("getProfile", () => {
  it("G-01: user found with profile returns merged view", async () => {
    mockedFindUnique().mockResolvedValue({
      name: "Alice",
      email: "a@x.com",
      image: "https://x.com/a.png",
      profile: {
        birthdate: new Date(Date.UTC(1990, 5, 15)),
        bio: "Hi",
        location: "NYC",
      },
    });

    const result = await getProfile("user-1");

    expect(result).toEqual({
      name: "Alice",
      email: "a@x.com",
      image: "https://x.com/a.png",
      birthdate: "1990-06-15",
      bio: "Hi",
      location: "NYC",
    });
  });

  it("G-02: profile is null — birthdate/bio/location/image all null", async () => {
    mockedFindUnique().mockResolvedValue({
      name: "Bob",
      email: "b@x.com",
      image: null,
      profile: null,
    });

    const result = await getProfile("user-2");

    expect(result).toEqual({
      name: "Bob",
      email: "b@x.com",
      image: null,
      birthdate: null,
      bio: null,
      location: null,
    });
  });

  it("G-03: user not found — returns null", async () => {
    mockedFindUnique().mockResolvedValue(null);

    const result = await getProfile("ghost");

    expect(result).toBeNull();
  });

  it("G-05: findUnique is called with the exact select shape", async () => {
    mockedFindUnique().mockResolvedValue(null);

    await getProfile("user-5");

    expect(mockedFindUnique()).toHaveBeenCalledWith({
      where: { id: "user-5" },
      select: {
        name: true,
        email: true,
        image: true,
        profile: {
          select: {
            birthdate: true,
            bio: true,
            location: true,
          },
        },
      },
    });
  });

  it("G-06: birthdate with single-digit month/day is zero-padded", async () => {
    mockedFindUnique().mockResolvedValue({
      name: "Charlie",
      email: "c@x.com",
      image: null,
      profile: {
        birthdate: new Date(Date.UTC(2000, 0, 5)), // 2000-01-05
        bio: null,
        location: null,
      },
    });

    const result = await getProfile("user-6");

    expect(result?.birthdate).toBe("2000-01-05");
  });

  it("G-04: prisma error propagates", async () => {
    mockedFindUnique().mockRejectedValue(new Error("DB down"));

    await expect(getProfile("u")).rejects.toThrow("DB down");
  });
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe("updateProfile", () => {
  it("U-01: validation failure short-circuits before transaction", async () => {
    const result = await updateProfile("u", { name: "" });

    expect(result).toEqual({
      ok: false,
      errors: expect.objectContaining({ name: expect.any(String) }),
    });
    expect(mockedTransaction()).not.toHaveBeenCalled();
  });

  describe("U-02/U-03/U-04: happy path with full valid input", () => {
    const userId = "u";
    const input = {
      name: "Alice",
      image: "https://x.com/a.png",
      birthdate: "1990-06-15",
      bio: "Hi",
      location: "NYC",
    };

    const userRow = {
      name: "Alice",
      email: "alice@x.com",
      image: "https://x.com/a.png",
    };
    const profileRow = {
      birthdate: new Date(Date.UTC(1990, 5, 15)),
      bio: "Hi",
      location: "NYC",
    };

    beforeEach(() => {
      mockedUserUpdate().mockResolvedValue(userRow);
      mockedProfileUpsert().mockResolvedValue(profileRow);
      mockedTransaction().mockResolvedValue([userRow, profileRow]);
    });

    it("U-02: result is ok:true with the correct view", async () => {
      const result = await updateProfile(userId, input);

      expect(result).toEqual({
        ok: true,
        value: {
          name: "Alice",
          email: "alice@x.com",
          image: "https://x.com/a.png",
          birthdate: "1990-06-15",
          bio: "Hi",
          location: "NYC",
        },
      });
    });

    it("U-03: user.update is called once with the correct args", async () => {
      await updateProfile(userId, input);

      expect(mockedUserUpdate()).toHaveBeenCalledOnce();
      expect(mockedUserUpdate()).toHaveBeenCalledWith({
        where: { id: userId },
        data: { name: "Alice", image: "https://x.com/a.png" },
        select: { name: true, email: true, image: true },
      });
    });

    it("U-04: profile.upsert is called once with the correct args (Date checked by components)", async () => {
      await updateProfile(userId, input);

      expect(mockedProfileUpsert()).toHaveBeenCalledOnce();

      const call = mockedProfileUpsert().mock.calls[0][0];

      // Verify the Date fields by their year/month/day components rather than
      // identity, because strToDate constructs a new instance each call.
      const checkDate = (d: Date) => {
        expect(d.getUTCFullYear()).toBe(1990);
        expect(d.getUTCMonth()).toBe(5);
        expect(d.getUTCDate()).toBe(15);
      };

      expect(call.where).toEqual({ userId });
      expect(call.select).toEqual({
        birthdate: true,
        bio: true,
        location: true,
      });
      checkDate(call.create.birthdate);
      expect(call.create).toMatchObject({ userId, bio: "Hi", location: "NYC" });
      checkDate(call.update.birthdate);
      expect(call.update).toMatchObject({ bio: "Hi", location: "NYC" });
    });

    it("U-04: $transaction is called once", async () => {
      await updateProfile(userId, input);

      expect(mockedTransaction()).toHaveBeenCalledOnce();
    });
  });

  it("U-05: empty optional strings coerce to null", async () => {
    const userRow = { name: "Alice", email: "alice@x.com", image: null };
    const profileRow = { birthdate: null, bio: null, location: null };

    mockedUserUpdate().mockResolvedValue(userRow);
    mockedProfileUpsert().mockResolvedValue(profileRow);
    mockedTransaction().mockResolvedValue([userRow, profileRow]);

    const result = await updateProfile("u", {
      name: "Alice",
      image: "",
      birthdate: "",
      bio: "",
      location: "",
    });

    expect(result.ok).toBe(true);

    // Assert user.update received image:null
    const userUpdateCall = mockedUserUpdate().mock.calls[0][0];
    expect(userUpdateCall.data.image).toBeNull();

    // Assert profile.upsert received null for all optional fields
    const upsertCall = mockedProfileUpsert().mock.calls[0][0];
    expect(upsertCall.create.birthdate).toBeNull();
    expect(upsertCall.create.bio).toBeNull();
    expect(upsertCall.create.location).toBeNull();
    expect(upsertCall.update.birthdate).toBeNull();
    expect(upsertCall.update.bio).toBeNull();
    expect(upsertCall.update.location).toBeNull();
  });

  it("U-07: transaction rejection propagates", async () => {
    mockedUserUpdate().mockResolvedValue({});
    mockedProfileUpsert().mockResolvedValue({});
    mockedTransaction().mockRejectedValue(new Error("TX fail"));

    await expect(
      updateProfile("u", {
        name: "Alice",
        image: "https://x.com/a.png",
        birthdate: "1990-06-15",
        bio: "Hi",
        location: "NYC",
      }),
    ).rejects.toThrow("TX fail");
  });

  it("U-09: multi-field validation returns all errors without calling $transaction", async () => {
    const result = await updateProfile("u", {
      name: "",
      image: "ftp://x",
      birthdate: "2099-01-01",
      bio: "x".repeat(281),
      location: "y".repeat(121),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors)).toHaveLength(5);
      expect(result.errors).toHaveProperty("name");
      expect(result.errors).toHaveProperty("image");
      expect(result.errors).toHaveProperty("birthdate");
      expect(result.errors).toHaveProperty("bio");
      expect(result.errors).toHaveProperty("location");
    }
    expect(mockedTransaction()).not.toHaveBeenCalled();
  });
});
