import { str } from "@/utils/str";

describe("str", () => {
  it("returns a plain string as-is", () => {
    expect(str("hello")).toBe("hello");
  });

  it("trims surrounding whitespace", () => {
    expect(str("  hello  ")).toBe("hello");
  });

  it("returns empty string for all-whitespace input", () => {
    expect(str("   ")).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(str("")).toBe("");
  });

  it("returns empty string for null", () => {
    expect(str(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(str(undefined)).toBe("");
  });

  it("coerces a positive number", () => {
    expect(str(42)).toBe("42");
  });

  it("coerces zero", () => {
    expect(str(0)).toBe("0");
  });

  it("coerces true", () => {
    expect(str(true)).toBe("true");
  });

  it("coerces false", () => {
    expect(str(false)).toBe("false");
  });

  it("coerces a plain object", () => {
    expect(str({})).toBe("[object Object]");
  });

  it("coerces an array", () => {
    expect(str([1, 2])).toBe("1,2");
  });

  it("coerces NaN", () => {
    expect(str(NaN)).toBe("NaN");
  });
});
