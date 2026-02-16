import { describe, it, expect } from "vitest";
import { parseDate, formatParsedDate, formatParsedDateForInput } from "./dateParser";
import { addDays, startOfDay, format } from "date-fns";

const TZ = "America/Denver";

describe("parseDate", () => {
  it("returns null for empty text", () => {
    const result = parseDate("");
    expect(result.date).toBeNull();
    expect(result.matchedText).toBeNull();
    expect(result.pattern).toBeNull();
  });

  it("returns null for text with no date", () => {
    const result = parseDate("fix the login bug");
    expect(result.date).toBeNull();
  });

  it("parses 'tomorrow'", () => {
    const result = parseDate("do this tomorrow", TZ);
    expect(result.date).not.toBeNull();
    expect(result.matchedText).toBe("tomorrow");
    expect(result.pattern).toBe("tomorrow");
  });

  it("parses 'today'", () => {
    const result = parseDate("do this today", TZ);
    expect(result.date).not.toBeNull();
    expect(result.matchedText).toBe("today");
    expect(result.pattern).toBe("today");
  });

  it("parses 'in 3 days'", () => {
    const result = parseDate("finish in 3 days", TZ);
    expect(result.date).not.toBeNull();
    expect(result.matchedText).toBe("in 3 days");
    expect(result.pattern).toBe("in 3 days");
  });

  it("parses 'in 1 day'", () => {
    const result = parseDate("finish in 1 day", TZ);
    expect(result.date).not.toBeNull();
    expect(result.matchedText).toBe("in 1 day");
  });

  it("parses day of week names", () => {
    const result = parseDate("meet on monday", TZ);
    expect(result.date).not.toBeNull();
    expect(result.pattern).toBe("Monday");
  });

  it("parses 'next week'", () => {
    const result = parseDate("review next week", TZ);
    expect(result.date).not.toBeNull();
    expect(result.matchedText).toBe("next week");
    expect(result.pattern).toBe("next week");
  });

  it("parses 'end of week'", () => {
    const result = parseDate("finish by end of week", TZ);
    expect(result.date).not.toBeNull();
    expect(result.pattern).toBe("end of week");
  });

  it("parses 'eow'", () => {
    const result = parseDate("finish eow", TZ);
    expect(result.date).not.toBeNull();
    expect(result.pattern).toBe("end of week");
  });

  it("parses month + day", () => {
    const result = parseDate("deadline Dec 25", TZ);
    expect(result.date).not.toBeNull();
    expect(result.date!.getMonth()).toBe(11); // December
    expect(result.date!.getDate()).toBe(25);
  });

  it("parses full month name + day with ordinal", () => {
    const result = parseDate("due January 1st", TZ);
    expect(result.date).not.toBeNull();
    expect(result.date!.getMonth()).toBe(0);
    expect(result.date!.getDate()).toBe(1);
  });

  it("prioritizes 'tomorrow' over day-of-week", () => {
    // "tomorrow" pattern is checked first
    const result = parseDate("tomorrow monday", TZ);
    expect(result.pattern).toBe("tomorrow");
  });
});

describe("formatParsedDate", () => {
  it("returns empty for null date", () => {
    expect(formatParsedDate({ date: null, matchedText: null, pattern: null })).toBe("");
  });

  it("formats date as 'MMM d, yyyy'", () => {
    const date = new Date(2026, 5, 15); // June 15, 2026
    const result = formatParsedDate({ date, matchedText: "test", pattern: "test" });
    expect(result).toBe("Jun 15, 2026");
  });
});

describe("formatParsedDateForInput", () => {
  it("returns empty for null date", () => {
    expect(formatParsedDateForInput({ date: null, matchedText: null, pattern: null })).toBe("");
  });

  it("formats date as 'yyyy-MM-dd'", () => {
    const date = new Date(2026, 5, 15);
    const result = formatParsedDateForInput({ date, matchedText: "test", pattern: "test" });
    expect(result).toBe("2026-06-15");
  });
});
