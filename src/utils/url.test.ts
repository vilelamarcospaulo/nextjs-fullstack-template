import { isHttpUrl } from "@/utils/url";

describe("isHttpUrl", () => {
  describe("valid http/https URLs", () => {
    it('returns true for "http://example.com"', () => {
      expect(isHttpUrl("http://example.com")).toBe(true);
    });

    it('returns true for "https://example.com/path?q=1"', () => {
      expect(isHttpUrl("https://example.com/path?q=1")).toBe(true);
    });

    it('returns true for "http://example.com:8080/api"', () => {
      expect(isHttpUrl("http://example.com:8080/api")).toBe(true);
    });

    it('returns true for "https://x.com/p?a=1#top"', () => {
      expect(isHttpUrl("https://x.com/p?a=1#top")).toBe(true);
    });

    it('returns true for "HTTP://example.com" (URL lowercases the protocol)', () => {
      // The URL constructor normalises the protocol to lowercase, so
      // new URL("HTTP://example.com").protocol === "http:" — this should pass.
      expect(isHttpUrl("HTTP://example.com")).toBe(true);
    });
  });

  describe("non-http/https schemes", () => {
    it('returns false for "ftp://example.com"', () => {
      expect(isHttpUrl("ftp://example.com")).toBe(false);
    });

    it('returns false for "mailto:user@example.com"', () => {
      expect(isHttpUrl("mailto:user@example.com")).toBe(false);
    });

    it('returns false for "file:///etc/hosts"', () => {
      expect(isHttpUrl("file:///etc/hosts")).toBe(false);
    });

    it('returns false for "data:text/plain;base64,abc"', () => {
      expect(isHttpUrl("data:text/plain;base64,abc")).toBe(false);
    });
  });

  describe("non-URL strings", () => {
    it('returns false for "//example.com"', () => {
      expect(isHttpUrl("//example.com")).toBe(false);
    });

    it('returns false for "/some/path"', () => {
      expect(isHttpUrl("/some/path")).toBe(false);
    });

    it('returns false for "some/path"', () => {
      expect(isHttpUrl("some/path")).toBe(false);
    });

    it('returns false for ""', () => {
      expect(isHttpUrl("")).toBe(false);
    });

    it('returns false for "not a url at all"', () => {
      expect(isHttpUrl("not a url at all")).toBe(false);
    });
  });
});
