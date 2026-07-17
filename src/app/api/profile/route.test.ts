vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET, PUT } from "@/app/api/profile/route";
import {
  resetDb,
  seedUser,
  seedProfile,
  getProfile,
  getUser,
  countProfiles,
} from "../../../../test/helpers/db";

const getSession = auth.api.getSession as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
});

describe("GET /api/profile", () => {
  it("G-01: no session → 401 + auth error body", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      errors: { _auth: "Authentication required." },
    });
  });

  it("G-02: user + full profile → 200 with complete ProfileView", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    await seedProfile({
      userId: "user-a",
      birthdate: new Date(Date.UTC(1990, 4, 7)),
      bio: "Writer",
      location: "Paris",
    });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "Alice",
      email: "alice@example.com",
      image: null,
      birthdate: "1990-05-07",
      bio: "Writer",
      location: "Paris",
    });
  });

  it("G-03: user with no profile → 200 with all optional fields null", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "Alice",
      email: "alice@example.com",
      image: null,
      birthdate: null,
      bio: null,
      location: null,
    });
  });

  it("G-04: DB empty, session for unknown user → 401 + auth error body", async () => {
    getSession.mockResolvedValue({ user: { id: "ghost-99" } });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      errors: { _auth: "Authentication required." },
    });
  });

  it("G-05: birthdate with zero-pad → formatted as YYYY-MM-DD", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    await seedProfile({
      userId: "user-a",
      birthdate: new Date(Date.UTC(2000, 0, 5)),
    });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.birthdate).toBe("2000-01-05");
  });
});

describe("PUT /api/profile", () => {
  it("P-01: no session → 401", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue(null);

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice" }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("P-02: malformed JSON → 400 _body error; no profile written", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: "{not json",
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      errors: { _body: "Request body must be valid JSON." },
    });
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-03: CREATE — no existing profile; body with all fields → 200 + correct view + DB persisted", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: "Alice Updated",
          image: "https://example.com/img.png",
          birthdate: "1990-05-07",
          bio: "Writer",
          location: "Paris",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "Alice Updated",
      email: "alice@example.com",
      image: "https://example.com/img.png",
      birthdate: "1990-05-07",
      bio: "Writer",
      location: "Paris",
    });

    const profile = await getProfile("user-a");
    expect(profile).not.toBeNull();
    expect(profile!.birthdate!.getUTCFullYear()).toBe(1990);
    expect(profile!.birthdate!.getUTCMonth()).toBe(4);
    expect(profile!.birthdate!.getUTCDate()).toBe(7);
    expect(profile!.bio).toBe("Writer");
    expect(profile!.location).toBe("Paris");

    const user = await getUser("user-a");
    expect(user!.name).toBe("Alice Updated");
    expect(user!.image).toBe("https://example.com/img.png");
  });

  it("P-04: UPDATE — existing profile; body updates fields; exactly one profile row", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    await seedProfile({
      userId: "user-a",
      bio: "Old bio",
      location: "London",
    });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: "Alice V2",
          birthdate: "1985-11-20",
          bio: "New bio",
          location: "NYC",
        }),
      }),
    );

    expect(res.status).toBe(200);

    const profile = await getProfile("user-a");
    expect(profile!.bio).toBe("New bio");
    expect(profile!.location).toBe("NYC");
    expect(profile!.birthdate!.getUTCFullYear()).toBe(1985);
    expect(profile!.birthdate!.getUTCMonth()).toBe(10);
    expect(profile!.birthdate!.getUTCDate()).toBe(20);

    const count = await countProfiles("user-a");
    expect(count).toBe(1);
  });

  it("P-05: missing name → 400 with only name error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ image: "https://example.com/a.png" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.name).toBe("Name is required.");
    expect(Object.keys(body.errors)).toHaveLength(1);
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-06: name too long → 400 name error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const longName = "A".repeat(81);
    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: longName }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.name).toBe("Name must be 80 characters or fewer.");
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-07: non-http(s) image URL → 400 image error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: "Alice",
          image: "ftp://example.com/img.png",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.image).toBe("Image must be a valid http(s) URL.");
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-08: image URL exactly 2049 chars → 400 image error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const image = "https://example.com/" + "x".repeat(2029);
    expect(image.length).toBe(2049);

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice", image }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.image).toBeDefined();
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-09: birthdate in the future → 400 birthdate error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice", birthdate: "2099-01-01" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.birthdate).toBe(
      "Birthdate must be a real date in the past.",
    );
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-10: birthdate before 1900 → 400 birthdate error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice", birthdate: "1899-12-31" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.birthdate).toBe(
      "Birthdate must be a real date in the past.",
    );
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-11: birthdate in wrong format (MM/DD/YYYY) → 400 birthdate error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice", birthdate: "07/04/1990" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.birthdate).toBe(
      "Birthdate must be a real date in the past.",
    );
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-12: birthdate with invalid calendar day (Feb 30) → 400 birthdate error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice", birthdate: "1990-02-30" }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.birthdate).toBe(
      "Birthdate must be a real date in the past.",
    );
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-13: bio too long → 400 bio error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice", bio: "B".repeat(281) }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.bio).toBe("Bio must be 280 characters or fewer.");
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-14: location too long → 400 location error; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: "Alice", location: "L".repeat(121) }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.location).toBe(
      "Location must be 120 characters or fewer.",
    );
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-15: multiple field errors at once → 400 with all 5 error keys; no write", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: "",
          image: "ftp://bad",
          birthdate: "2099-01-01",
          bio: "B".repeat(281),
          location: "L".repeat(121),
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.errors)).toHaveLength(5);
    expect(body.errors.name).toBeDefined();
    expect(body.errors.image).toBeDefined();
    expect(body.errors.birthdate).toBeDefined();
    expect(body.errors.bio).toBeDefined();
    expect(body.errors.location).toBeDefined();
    expect(await getProfile("user-a")).toBeNull();
  });

  it("P-16: SECURITY — userId in body is ignored; only session user is updated", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    await seedUser({ id: "user-b", name: "Bob", email: "bob@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: "Hijacked",
          userId: "user-b",
          id: "user-b",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("alice@example.com");

    const userA = await getUser("user-a");
    expect(userA!.name).toBe("Hijacked");

    const userB = await getUser("user-b");
    expect(userB!.name).toBe("Bob");

    expect(await getProfile("user-b")).toBeNull();
  });

  it("P-17: empty-string optionals clear existing profile fields", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    await seedProfile({
      userId: "user-a",
      bio: "real",
      location: "real",
      birthdate: new Date(Date.UTC(1990, 0, 1)),
    });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: "Alice",
          image: "",
          birthdate: "",
          bio: "",
          location: "",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.image).toBeNull();
    expect(body.birthdate).toBeNull();
    expect(body.bio).toBeNull();
    expect(body.location).toBeNull();

    const profile = await getProfile("user-a");
    expect(profile!.birthdate).toBeNull();
    expect(profile!.bio).toBeNull();
    expect(profile!.location).toBeNull();

    const user = await getUser("user-a");
    expect(user!.image).toBeNull();
  });

  it("P-18: boundary success — max-length values all accepted", async () => {
    await seedUser({ id: "user-a", name: "Alice", email: "alice@example.com" });
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const name = "A".repeat(80);
    const image = "https://example.com/" + "x".repeat(2028);
    const bio = "B".repeat(280);
    const location = "L".repeat(120);

    expect(image.length).toBe(2048);

    const res = await PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name,
          image,
          birthdate: "1924-06-17",
          bio,
          location,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name.length).toBe(80);
    expect(body.image).not.toBeNull();
    expect(body.birthdate).toBe("1924-06-17");
    expect(body.bio.length).toBe(280);
    expect(body.location.length).toBe(120);

    const profile = await getProfile("user-a");
    expect(profile).not.toBeNull();
  });
});
