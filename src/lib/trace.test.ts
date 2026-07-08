import { newTraceId } from "@/lib/trace";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("newTraceId", () => {
  it("returns a valid UUID", () => {
    expect(newTraceId()).toMatch(UUID_PATTERN);
  });

  it("returns a different id on every call", () => {
    expect(newTraceId()).not.toBe(newTraceId());
  });
});
