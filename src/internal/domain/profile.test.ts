import { inputToProfile } from "@/internal/domain/profile";

describe("inputToProfile", () => {
  beforeEach(() => vi.useFakeTimers());
  beforeEach(() => vi.setSystemTime(new Date(2025, 5, 17, 12, 0, 0)));
  afterEach(() => vi.useRealTimers());

  describe("happy path", () => {
    it("accepts a fully-populated valid input", () => {
      const result = inputToProfile({
        name: "Alice",
        image: "https://x.com/a.png",
        birthdate: "1990-06-15",
        bio: "Hello",
        location: "NYC",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Alice");
      expect(result.value.image).toBe("https://x.com/a.png");
      expect(result.value.birthdate).not.toBeNull();
      expect(result.value.birthdate!.getUTCFullYear()).toBe(1990);
      expect(result.value.birthdate!.getUTCMonth()).toBe(5);
      expect(result.value.birthdate!.getUTCDate()).toBe(15);
      expect(result.value.bio).toBe("Hello");
      expect(result.value.location).toBe("NYC");
    });

    it("accepts name-only input; all optional fields are null", () => {
      const result = inputToProfile({ name: "Bob" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.image).toBeNull();
      expect(result.value.birthdate).toBeNull();
      expect(result.value.bio).toBeNull();
      expect(result.value.location).toBeNull();
    });

    it("treats empty-string optionals as null", () => {
      const result = inputToProfile({
        name: "Bob",
        image: "",
        birthdate: "",
        bio: "",
        location: "",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.image).toBeNull();
      expect(result.value.birthdate).toBeNull();
      expect(result.value.bio).toBeNull();
      expect(result.value.location).toBeNull();
    });
  });

  describe("name field", () => {
    it("trims whitespace from name", () => {
      const result = inputToProfile({ name: "  Alice  " });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Alice");
    });

    it("accepts a 1-character name", () => {
      expect(inputToProfile({ name: "A" }).ok).toBe(true);
    });

    it("accepts an 80-character name", () => {
      const name80 = "A".repeat(80);
      expect(name80.length).toBe(80);
      expect(inputToProfile({ name: name80 }).ok).toBe(true);
    });

    it("rejects an 81-character name", () => {
      const name81 = "A".repeat(81);
      expect(name81.length).toBe(81);
      const result = inputToProfile({ name: name81 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBeDefined();
    });

    it("rejects empty string name with 'Name is required.'", () => {
      const result = inputToProfile({ name: "" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBe("Name is required.");
    });

    it("rejects whitespace-only name", () => {
      const result = inputToProfile({ name: "   " });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBeDefined();
    });

    it("rejects missing name field", () => {
      const result = inputToProfile({});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBeDefined();
    });

    it("rejects null name", () => {
      const result = inputToProfile({ name: null });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBeDefined();
    });

    it("coerces numeric name to string", () => {
      const result = inputToProfile({ name: 123 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("123");
    });
  });

  describe("image field", () => {
    it("accepts an exactly 2048-character http(s) URL", () => {
      // "https://x.com/" is 15 chars; pad to exactly 2048
      const base = "https://x.com/";
      const image2048 = base + "a".repeat(2048 - base.length);
      expect(image2048.length).toBe(2048);
      expect(inputToProfile({ name: "Alice", image: image2048 }).ok).toBe(true);
    });

    it("rejects a 2049-character URL", () => {
      const base = "https://x.com/";
      const image2049 = base + "a".repeat(2049 - base.length);
      expect(image2049.length).toBe(2049);
      const result = inputToProfile({ name: "Alice", image: image2049 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.image).toBeDefined();
    });

    it("rejects an ftp:// URL", () => {
      const result = inputToProfile({
        name: "Alice",
        image: "ftp://cdn.example.com/img.jpg",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.image).toBeDefined();
    });

    it("rejects a relative path", () => {
      const result = inputToProfile({ name: "Alice", image: "/img/photo.jpg" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.image).toBeDefined();
    });
  });

  describe("birthdate field", () => {
    it("accepts a valid past date", () => {
      expect(
        inputToProfile({ name: "Alice", birthdate: "1990-06-15" }).ok,
      ).toBe(true);
    });

    it("rejects slash-separated date format", () => {
      const result = inputToProfile({ name: "Alice", birthdate: "1990/06/15" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.birthdate).toBeDefined();
    });

    it("rejects an impossible date like Feb 30", () => {
      const result = inputToProfile({ name: "Alice", birthdate: "1990-02-30" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.birthdate).toBeDefined();
    });

    it("accepts the minimum allowed year 1900-01-01", () => {
      expect(
        inputToProfile({ name: "Alice", birthdate: "1900-01-01" }).ok,
      ).toBe(true);
    });

    it("rejects 1899-12-31 (before 1900)", () => {
      const result = inputToProfile({ name: "Alice", birthdate: "1899-12-31" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.birthdate).toBeDefined();
    });

    it("rejects tomorrow (2025-06-18) vs pinned clock", () => {
      const result = inputToProfile({ name: "Alice", birthdate: "2025-06-18" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.birthdate).toBeDefined();
    });

    it("accepts today (2025-06-17) vs pinned clock", () => {
      expect(
        inputToProfile({ name: "Alice", birthdate: "2025-06-17" }).ok,
      ).toBe(true);
    });

    it("accepts leap-year 2020-02-29", () => {
      expect(
        inputToProfile({ name: "Alice", birthdate: "2020-02-29" }).ok,
      ).toBe(true);
    });

    it("rejects non-leap 2021-02-29", () => {
      const result = inputToProfile({ name: "Alice", birthdate: "2021-02-29" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.birthdate).toBeDefined();
    });
  });

  describe("bio field", () => {
    it("accepts a 280-character bio", () => {
      const bio280 = "a".repeat(280);
      expect(bio280.length).toBe(280);
      const result = inputToProfile({ name: "Alice", bio: bio280 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.bio).toBe(bio280);
    });

    it("rejects a 281-character bio", () => {
      const bio281 = "a".repeat(281);
      expect(bio281.length).toBe(281);
      const result = inputToProfile({ name: "Alice", bio: bio281 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.bio).toBeDefined();
    });

    it("treats empty bio as null", () => {
      const result = inputToProfile({ name: "Alice", bio: "" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.bio).toBeNull();
    });
  });

  describe("location field", () => {
    it("accepts a 120-character location", () => {
      const loc120 = "a".repeat(120);
      expect(loc120.length).toBe(120);
      const result = inputToProfile({ name: "Alice", location: loc120 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.location).toBe(loc120);
    });

    it("rejects a 121-character location", () => {
      const loc121 = "a".repeat(121);
      expect(loc121.length).toBe(121);
      const result = inputToProfile({ name: "Alice", location: loc121 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.location).toBeDefined();
    });

    it("treats empty location as null", () => {
      const result = inputToProfile({ name: "Alice", location: "" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.location).toBeNull();
    });
  });

  describe("multi-field errors", () => {
    it("reports exactly name, image, and birthdate errors together", () => {
      const result = inputToProfile({
        name: "",
        image: "ftp://x.com",
        birthdate: "2099-01-01",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.errors).length).toBe(3);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.image).toBeDefined();
      expect(result.errors.birthdate).toBeDefined();
    });

    it("reports all five field errors when everything is invalid", () => {
      const bio281 = "a".repeat(281);
      expect(bio281.length).toBe(281);
      const loc121 = "a".repeat(121);
      expect(loc121.length).toBe(121);
      const result = inputToProfile({
        name: "",
        image: "ftp://x.com",
        birthdate: "2099-01-01",
        bio: bio281,
        location: loc121,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.errors).length).toBe(5);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.image).toBeDefined();
      expect(result.errors.birthdate).toBeDefined();
      expect(result.errors.bio).toBeDefined();
      expect(result.errors.location).toBeDefined();
    });
  });
});
