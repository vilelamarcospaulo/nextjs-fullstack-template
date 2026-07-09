import { parseHelloJobPayload } from "@/internal/domain/jobs";

describe("parseHelloJobPayload", () => {
  describe("happy path", () => {
    it("accepts a valid payload", () => {
      const result = parseHelloJobPayload({ message: "Hello, world!" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.message).toBe("Hello, world!");
    });

    it("trims whitespace from message", () => {
      const result = parseHelloJobPayload({ message: "  Hello  " });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.message).toBe("Hello");
    });

    it("accepts a message at the maximum length (500 chars)", () => {
      const message500 = "a".repeat(500);
      expect(message500.length).toBe(500);
      const result = parseHelloJobPayload({ message: message500 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.message).toBe(message500);
    });
  });

  describe("message field", () => {
    it("rejects an empty string message", () => {
      const result = parseHelloJobPayload({ message: "" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.message).toBeDefined();
    });

    it("rejects a whitespace-only message", () => {
      const result = parseHelloJobPayload({ message: "   " });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.message).toBeDefined();
    });

    it("rejects a missing message field", () => {
      const result = parseHelloJobPayload({});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.message).toBeDefined();
    });

    it("rejects a message exceeding the max length (501 chars)", () => {
      const message501 = "a".repeat(501);
      expect(message501.length).toBe(501);
      const result = parseHelloJobPayload({ message: message501 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.message).toBeDefined();
    });

    it("rejects a non-string message", () => {
      const result = parseHelloJobPayload({ message: 123 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.message).toBeDefined();
    });
  });

  describe("invalid input shapes", () => {
    it("rejects null input", () => {
      const result = parseHelloJobPayload(null);
      expect(result.ok).toBe(false);
    });

    it("rejects a non-object input", () => {
      const result = parseHelloJobPayload("just a string");
      expect(result.ok).toBe(false);
    });
  });
});
