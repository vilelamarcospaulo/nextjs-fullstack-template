// Mock next/headers and better-auth before the module under test is imported,
// matching the pattern used in src/app/api/profile/route.test.ts.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { generateGreeting } from "@/app/actions";

const getSession = auth.api.getSession as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateGreeting — unauthenticated", () => {
  beforeEach(() => {
    getSession.mockResolvedValue(null);
  });

  test("GR-A-01: no session → ok:false with unauthenticated error", async () => {
    const result = await generateGreeting("Alice");

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  test("GR-A-02: no session with empty name → ok:false (auth checked first)", async () => {
    const result = await generateGreeting("");

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });
});

describe("generateGreeting — authenticated", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  test("GR-01: named argument produces correct greeting prefix", async () => {
    const result = await generateGreeting("Alice");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain("Hello, Alice —");
    expect(result.data).toContain(" — generated on the server at ");
  });

  test("GR-02: empty string falls back to world", async () => {
    const result = await generateGreeting("");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain("Hello, world —");
  });

  test("GR-03: whitespace-only string falls back to world", async () => {
    const result = await generateGreeting("   ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain("Hello, world —");
  });

  test("GR-04: name with surrounding spaces is trimmed", async () => {
    const result = await generateGreeting("  Bob  ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain("Hello, Bob —");
    expect(result.data).not.toContain("  Bob  ");
  });

  describe("GR-05: pinned clock produces exact output", () => {
    afterEach(() => vi.useRealTimers());

    test("returns exact string with pinned timestamp", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-17T09:00:00.000Z"));

      const result = await generateGreeting("Carol");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(
        "Hello, Carol — generated on the server at 2026-06-17T09:00:00.000Z.",
      );
    });
  });

  test("GR-06: embedded timestamp is a valid date", async () => {
    const result = await generateGreeting("Dave");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const atIndex = result.data.indexOf(" at ");
    const trailingDot = result.data.lastIndexOf(".");
    const timestamp = result.data.substring(atIndex + 4, trailingDot);

    expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
  });

  test("GR-07: name over 100 chars → ok:false with length error", async () => {
    const longName = "A".repeat(101);
    const result = await generateGreeting(longName);

    expect(result).toEqual({
      ok: false,
      error: "Name must be 100 characters or fewer.",
    });
  });

  test("GR-08: name at exactly 100 chars is accepted", async () => {
    const result = await generateGreeting("A".repeat(100));

    expect(result.ok).toBe(true);
  });
});
