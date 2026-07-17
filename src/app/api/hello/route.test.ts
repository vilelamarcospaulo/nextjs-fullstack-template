import { GET } from "@/app/api/hello/route";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("GET /api/hello", () => {
  test("H-01: returns status 200 with message and valid ISO timestamp", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Hello from the Starter Kit API.");
    expect(ISO_REGEX.test(body.timestamp)).toBe(true);
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  describe("H-02: pinned clock returns exact timestamp", () => {
    afterEach(() => vi.useRealTimers());

    test("timestamp equals the pinned time", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

      const res = await GET();
      const body = await res.json();

      expect(body.timestamp).toBe("2026-06-17T12:00:00.000Z");
    });
  });

  test("H-03: two consecutive calls both valid; second timestamp >= first", async () => {
    const res1 = await GET();
    const res2 = await GET();

    const body1 = await res1.json();
    const body2 = await res2.json();

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    expect(Number.isNaN(Date.parse(body1.timestamp))).toBe(false);
    expect(Number.isNaN(Date.parse(body2.timestamp))).toBe(false);

    expect(Date.parse(body2.timestamp)).toBeGreaterThanOrEqual(
      Date.parse(body1.timestamp),
    );
  });
});
