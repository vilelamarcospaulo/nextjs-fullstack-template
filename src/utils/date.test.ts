import { strToDate, dateToStr } from "@/utils/date";

describe("strToDate", () => {
  describe("valid dates", () => {
    it("parses a normal date", () => {
      const result = strToDate("2023-06-15");
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2023);
      expect(result!.getMonth()).toBe(5);
      expect(result!.getDate()).toBe(15);
    });

    it("parses a leap-year Feb 29", () => {
      const result = strToDate("2020-02-29");
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2020);
      expect(result!.getMonth()).toBe(1);
      expect(result!.getDate()).toBe(29);
    });

    it("parses Jan 31 (31-day month)", () => {
      const result = strToDate("2023-01-31");
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2023);
      expect(result!.getMonth()).toBe(0);
      expect(result!.getDate()).toBe(31);
    });

    it("parses the historical boundary 1900-01-01", () => {
      const result = strToDate("1900-01-01");
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(1900);
      expect(result!.getMonth()).toBe(0);
      expect(result!.getDate()).toBe(1);
    });

    it("parses the far future 9999-01-01", () => {
      const result = strToDate("9999-01-01");
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(9999);
      expect(result!.getMonth()).toBe(0);
      expect(result!.getDate()).toBe(1);
    });
  });

  describe("impossible calendar dates return null", () => {
    it("rejects non-leap Feb 29", () => {
      expect(strToDate("2021-02-29")).toBeNull();
    });

    it("rejects Feb 30", () => {
      expect(strToDate("2020-02-30")).toBeNull();
    });

    it("rejects month 13", () => {
      expect(strToDate("2020-13-01")).toBeNull();
    });

    it("rejects day 00", () => {
      expect(strToDate("2020-06-00")).toBeNull();
    });

    it("rejects Apr 31 (30-day month)", () => {
      expect(strToDate("2023-04-31")).toBeNull();
    });
  });

  describe("format rejections return null", () => {
    it("rejects slash-separated date", () => {
      expect(strToDate("2020/06/15")).toBeNull();
    });

    it("rejects single-digit month and day", () => {
      expect(strToDate("2020-1-1")).toBeNull();
    });

    it("rejects ISO datetime string", () => {
      expect(strToDate("2020-06-15T00:00:00Z")).toBeNull();
    });

    it("rejects arbitrary text", () => {
      expect(strToDate("abc")).toBeNull();
    });

    it("rejects empty string", () => {
      expect(strToDate("")).toBeNull();
    });
  });
});

describe("dateToStr", () => {
  it("serialises a mid-year date", () => {
    expect(dateToStr(new Date(2023, 5, 15))).toBe("2023-06-15");
  });

  it("pads single-digit month", () => {
    expect(dateToStr(new Date(2023, 0, 5))).toBe("2023-01-05");
  });

  it("pads single-digit day", () => {
    expect(dateToStr(new Date(2023, 11, 9))).toBe("2023-12-09");
  });

  it("handles Jan 1", () => {
    expect(dateToStr(new Date(2023, 0, 1))).toBe("2023-01-01");
  });

  it("handles Dec 31", () => {
    expect(dateToStr(new Date(2023, 11, 31))).toBe("2023-12-31");
  });

  it("handles leap-year Feb 29", () => {
    expect(dateToStr(new Date(2020, 1, 29))).toBe("2020-02-29");
  });

  it("handles historical boundary 1900-01-01", () => {
    expect(dateToStr(new Date(1900, 0, 1))).toBe("1900-01-01");
  });

  describe("round-trips", () => {
    it("strToDate then dateToStr returns original string", () => {
      expect(dateToStr(strToDate("2023-08-07")!)).toBe("2023-08-07");
    });

    it("dateToStr then strToDate returns non-null date equal to original", () => {
      const original = new Date(2023, 5, 15);
      const str = dateToStr(original);
      const parsed = strToDate(str);
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(original.getFullYear());
      expect(parsed!.getMonth()).toBe(original.getMonth());
      expect(parsed!.getDate()).toBe(original.getDate());
    });
  });
});
