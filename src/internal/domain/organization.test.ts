import {
  inputToOrganization,
  inputToOrganizationName,
  slugify,
} from "@/internal/domain/organization";

describe("inputToOrganization", () => {
  describe("happy path", () => {
    it("accepts a valid name + slug", () => {
      const result = inputToOrganization({
        name: "Acme Inc",
        slug: "acme-inc",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Acme Inc");
      expect(result.value.slug).toBe("acme-inc");
    });

    it("accepts a single-segment slug with no hyphens", () => {
      expect(inputToOrganization({ name: "Acme", slug: "acme" }).ok).toBe(true);
    });

    it("accepts a slug with digits", () => {
      expect(inputToOrganization({ name: "Acme", slug: "acme-42" }).ok).toBe(
        true,
      );
    });
  });

  describe("name field", () => {
    it("trims whitespace from name", () => {
      const result = inputToOrganization({ name: "  Acme  ", slug: "acme" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Acme");
    });

    it("rejects empty string name", () => {
      const result = inputToOrganization({ name: "", slug: "acme" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBe("Name is required.");
    });

    it("rejects missing name", () => {
      const result = inputToOrganization({ slug: "acme" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBeDefined();
    });

    it("accepts a 100-character name", () => {
      const name100 = "A".repeat(100);
      expect(name100.length).toBe(100);
      expect(inputToOrganization({ name: name100, slug: "acme" }).ok).toBe(
        true,
      );
    });

    it("rejects a 101-character name", () => {
      const name101 = "A".repeat(101);
      expect(name101.length).toBe(101);
      const result = inputToOrganization({ name: name101, slug: "acme" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.name).toBeDefined();
    });
  });

  describe("slug field", () => {
    it("rejects empty string slug", () => {
      const result = inputToOrganization({ name: "Acme", slug: "" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBe("Slug is required.");
    });

    it("rejects missing slug", () => {
      const result = inputToOrganization({ name: "Acme" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });

    it("rejects uppercase characters", () => {
      const result = inputToOrganization({ name: "Acme", slug: "Acme-Inc" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });

    it("rejects spaces", () => {
      const result = inputToOrganization({ name: "Acme", slug: "acme inc" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });

    it("rejects a leading hyphen", () => {
      const result = inputToOrganization({ name: "Acme", slug: "-acme" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });

    it("rejects a trailing hyphen", () => {
      const result = inputToOrganization({ name: "Acme", slug: "acme-" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });

    it("rejects consecutive hyphens", () => {
      const result = inputToOrganization({ name: "Acme", slug: "acme--inc" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });

    it("rejects underscores", () => {
      const result = inputToOrganization({ name: "Acme", slug: "acme_inc" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });

    it("accepts a 50-character slug", () => {
      const slug50 = "a".repeat(50);
      expect(slug50.length).toBe(50);
      expect(inputToOrganization({ name: "Acme", slug: slug50 }).ok).toBe(true);
    });

    it("rejects a 51-character slug", () => {
      const slug51 = "a".repeat(51);
      expect(slug51.length).toBe(51);
      const result = inputToOrganization({ name: "Acme", slug: slug51 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.slug).toBeDefined();
    });
  });

  describe("multi-field errors", () => {
    it("reports both name and slug errors together", () => {
      const result = inputToOrganization({ name: "", slug: "Bad Slug" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.errors).length).toBe(2);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.slug).toBeDefined();
    });
  });
});

describe("inputToOrganizationName", () => {
  it("accepts a valid name", () => {
    const result = inputToOrganizationName({ name: "Acme Inc" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Acme Inc");
  });

  it("rejects an empty name", () => {
    const result = inputToOrganizationName({ name: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name is required.");
  });

  it("rejects a 101-character name", () => {
    const name101 = "A".repeat(101);
    const result = inputToOrganizationName({ name: name101 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeDefined();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Acme Inc")).toBe("acme-inc");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("Acme & Co.,  Ltd!!")).toBe("acme-co-ltd");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  --Acme--  ")).toBe("acme");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("preserves existing hyphens between words", () => {
    expect(slugify("acme-inc")).toBe("acme-inc");
  });
});
