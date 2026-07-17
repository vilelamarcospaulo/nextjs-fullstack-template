// Drizzle's real query-builder types are far stricter than a unit test needs
// (chained generics for select/insert/update builders). We mock @/lib/db's
// getDb() with a minimal chainable stand-in and view each mocked link through
// Vitest's loose `Mock` type so resolved values and recorded call args stay
// assertable without reconstructing exact Drizzle builder types. Per this
// repo's mocking convention, this partial mock (it only implements the subset
// of getDb()'s return value the use case actually calls) is cast as
// `as unknown as ReturnType<typeof getDb>` at the module boundary, and
// individual chain links are viewed through `Mock` (via the `asMock` helper)
// when a test needs to inspect raw call args — not a direct cast — since
// TypeScript's strict mode rejects a direct cast when the mock only partially
// overlaps the real type.
//
// Built with `vi.hoisted` so the same chain-link mocks are visible both to
// the `vi.mock("@/lib/db", ...)` factory (which Vitest hoists above imports)
// and to the test bodies below that configure/assert on them.
const hoisted = vi.hoisted(() => {
  // getProfile's chain: db.select({...}).from(user).leftJoin(profile, ...).where(...).limit(1)
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));
  const select = vi.fn(() => ({ from }));

  // updateProfile's tx.update(...) chain: tx.update(user).set(...).where(...).returning(...)
  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  // updateProfile's tx.insert(...) chain:
  // tx.insert(profile).values(...).onConflictDoUpdate(...).returning(...)
  const insertReturning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  // db.transaction(cb) — invokes the real callback from profile.ts with a tx
  // stand-in exposing the two chains above, mirroring node-postgres's actual
  // transaction shape closely enough for this use case's needs.
  const transaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({ update, insert }),
  );

  return {
    select,
    from,
    leftJoin,
    where,
    limit,
    update,
    updateSet,
    updateWhere,
    updateReturning,
    insert,
    values,
    onConflictDoUpdate,
    insertReturning,
    transaction,
  };
});

import type { getDb } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getDb: () =>
    ({
      select: hoisted.select,
      transaction: hoisted.transaction,
    }) as unknown as ReturnType<typeof getDb>,
}));

import type { Mock } from "vitest";
import { user, profile } from "@/lib/schema";
import { getProfile, updateProfile } from "@/internal/use_case/profile";

// Each hoisted chain link is a zero-arg-typed `vi.fn(() => ({...}))` (it never
// declares the args it's called with, since the chain only cares about the
// return shape) — viewing raw `.mock.calls[n][0]` through Vitest's loose
// `Mock` type keeps that indexing assertable, per this repo's mocking
// convention (see block comment above).
const asMock = (fn: unknown) => fn as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  // Restore the default (real-callback-invoking) transaction implementation
  // every test, so a test that overrides it (e.g. U-07's rejection) can't
  // leak into a later test that expects the happy-path behavior.
  hoisted.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ update: hoisted.update, insert: hoisted.insert }),
  );
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

describe("getProfile", () => {
  it("G-01: user found with profile returns merged view", async () => {
    hoisted.limit.mockResolvedValue([
      {
        name: "Alice",
        email: "a@x.com",
        image: "https://x.com/a.png",
        birthdate: new Date(Date.UTC(1990, 5, 15)),
        bio: "Hi",
        location: "NYC",
      },
    ]);

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
    hoisted.limit.mockResolvedValue([
      {
        name: "Bob",
        email: "b@x.com",
        image: null,
        birthdate: null,
        bio: null,
        location: null,
      },
    ]);

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
    hoisted.limit.mockResolvedValue([]);

    const result = await getProfile("ghost");

    expect(result).toBeNull();
  });

  it("G-05: select/from/limit are called with the exact shape", async () => {
    hoisted.limit.mockResolvedValue([]);

    await getProfile("user-5");

    expect(hoisted.select).toHaveBeenCalledWith({
      name: user.name,
      email: user.email,
      image: user.image,
      birthdate: profile.birthdate,
      bio: profile.bio,
      location: profile.location,
    });
    expect(hoisted.from).toHaveBeenCalledWith(user);
    expect(hoisted.limit).toHaveBeenCalledWith(1);
  });

  it("G-06: birthdate with single-digit month/day is zero-padded", async () => {
    hoisted.limit.mockResolvedValue([
      {
        name: "Charlie",
        email: "c@x.com",
        image: null,
        birthdate: new Date(Date.UTC(2000, 0, 5)), // 2000-01-05
        bio: null,
        location: null,
      },
    ]);

    const result = await getProfile("user-6");

    expect(result?.birthdate).toBe("2000-01-05");
  });

  it("G-04: db error propagates", async () => {
    hoisted.limit.mockRejectedValue(new Error("DB down"));

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
    expect(hoisted.transaction).not.toHaveBeenCalled();
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
      hoisted.updateReturning.mockResolvedValue([userRow]);
      hoisted.insertReturning.mockResolvedValue([profileRow]);
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

    it("U-03: user update chain is called once with the correct args", async () => {
      await updateProfile(userId, input);

      expect(hoisted.update).toHaveBeenCalledOnce();
      expect(hoisted.update).toHaveBeenCalledWith(user);
      expect(hoisted.updateSet).toHaveBeenCalledWith({
        name: "Alice",
        image: "https://x.com/a.png",
      });
      expect(hoisted.updateWhere).toHaveBeenCalledOnce();
      expect(hoisted.updateReturning).toHaveBeenCalledWith({
        name: user.name,
        email: user.email,
        image: user.image,
      });
    });

    it("U-04: profile insert chain is called once with the correct args (Date checked by components)", async () => {
      await updateProfile(userId, input);

      expect(hoisted.insert).toHaveBeenCalledOnce();
      expect(hoisted.insert).toHaveBeenCalledWith(profile);

      // Verify the Date fields by their year/month/day components rather than
      // identity, because strToDate constructs a new instance each call.
      const checkDate = (d: Date) => {
        expect(d.getUTCFullYear()).toBe(1990);
        expect(d.getUTCMonth()).toBe(5);
        expect(d.getUTCDate()).toBe(15);
      };

      const valuesCall = asMock(hoisted.values).mock.calls[0][0];
      expect(valuesCall.id).toEqual(expect.any(String));
      expect(valuesCall.userId).toBe(userId);
      checkDate(valuesCall.birthdate);
      expect(valuesCall).toMatchObject({ bio: "Hi", location: "NYC" });

      const onConflictCall = asMock(hoisted.onConflictDoUpdate).mock
        .calls[0][0];
      expect(onConflictCall.target).toBe(profile.userId);
      checkDate(onConflictCall.set.birthdate);
      expect(onConflictCall.set).toMatchObject({ bio: "Hi", location: "NYC" });

      expect(hoisted.insertReturning).toHaveBeenCalledWith({
        birthdate: profile.birthdate,
        bio: profile.bio,
        location: profile.location,
      });
    });

    it("U-04: transaction is called once", async () => {
      await updateProfile(userId, input);

      expect(hoisted.transaction).toHaveBeenCalledOnce();
    });
  });

  it("U-05: empty optional strings coerce to null", async () => {
    const userRow = { name: "Alice", email: "alice@x.com", image: null };
    const profileRow = { birthdate: null, bio: null, location: null };

    hoisted.updateReturning.mockResolvedValue([userRow]);
    hoisted.insertReturning.mockResolvedValue([profileRow]);

    const result = await updateProfile("u", {
      name: "Alice",
      image: "",
      birthdate: "",
      bio: "",
      location: "",
    });

    expect(result.ok).toBe(true);

    // Assert tx.update(...).set(...) received image: null
    const updateSetCall = asMock(hoisted.updateSet).mock.calls[0][0];
    expect(updateSetCall.image).toBeNull();

    // Assert tx.insert(...).values(...) and onConflictDoUpdate(...) received
    // null for all optional fields
    const valuesCall = asMock(hoisted.values).mock.calls[0][0];
    expect(valuesCall.birthdate).toBeNull();
    expect(valuesCall.bio).toBeNull();
    expect(valuesCall.location).toBeNull();

    const onConflictCall = asMock(hoisted.onConflictDoUpdate).mock.calls[0][0];
    expect(onConflictCall.set.birthdate).toBeNull();
    expect(onConflictCall.set.bio).toBeNull();
    expect(onConflictCall.set.location).toBeNull();
  });

  it("U-07: transaction rejection propagates", async () => {
    hoisted.transaction.mockRejectedValueOnce(new Error("TX fail"));

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

  it("U-09: multi-field validation returns all errors without calling transaction", async () => {
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
    expect(hoisted.transaction).not.toHaveBeenCalled();
  });
});
