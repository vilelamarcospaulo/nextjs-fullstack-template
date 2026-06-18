import { generateGreeting } from "@/app/actions";

describe("generateGreeting", () => {
  test("GR-01: named argument produces correct greeting prefix", async () => {
    const result = await generateGreeting("Alice");

    expect(result).toContain("Hello, Alice —");
    expect(result).toContain(" — generated on the server at ");
  });

  test("GR-02: empty string falls back to world", async () => {
    const result = await generateGreeting("");

    expect(result).toContain("Hello, world —");
  });

  test("GR-03: whitespace-only string falls back to world", async () => {
    const result = await generateGreeting("   ");

    expect(result).toContain("Hello, world —");
  });

  test("GR-04: name with surrounding spaces is trimmed", async () => {
    const result = await generateGreeting("  Bob  ");

    expect(result).toContain("Hello, Bob —");
    expect(result).not.toContain("  Bob  ");
  });

  describe("GR-05: pinned clock produces exact output", () => {
    afterEach(() => vi.useRealTimers());

    test("returns exact string with pinned timestamp", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-17T09:00:00.000Z"));

      const result = await generateGreeting("Carol");

      expect(result).toBe(
        "Hello, Carol — generated on the server at 2026-06-17T09:00:00.000Z.",
      );
    });
  });

  test("GR-06: embedded timestamp is a valid date", async () => {
    const result = await generateGreeting("Dave");

    const atIndex = result.indexOf(" at ");
    const trailingDot = result.lastIndexOf(".");
    const timestamp = result.substring(atIndex + 4, trailingDot);

    expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
  });
});
