import { describe, it, expect } from "vitest";
import {
  dateStringToUTC,
  utcToDateString,
  formatDateInUserTZ,
  getStartOfDayUTC,
  getEndOfDayUTC,
  getTodayString,
  isToday,
} from "./timezone";

const TZ = "America/Denver"; // UTC-7 (MST) or UTC-6 (MDT)

describe("dateStringToUTC", () => {
  it("throws for empty string", () => {
    expect(() => dateStringToUTC("")).toThrow("Date string is required");
  });

  it("converts a date string to UTC", () => {
    const result = dateStringToUTC("2026-06-15", TZ);
    // June 15 midnight in Denver (MDT = UTC-6) should be June 15 06:00 UTC
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5); // June = 5
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCHours()).toBe(6); // MDT offset
  });

  it("handles winter time (MST = UTC-7)", () => {
    const result = dateStringToUTC("2026-01-15", TZ);
    expect(result.getUTCHours()).toBe(7); // MST offset
  });
});

describe("utcToDateString", () => {
  it("returns empty string for null", () => {
    expect(utcToDateString(null, TZ)).toBe("");
  });

  it("converts UTC date to date string in timezone", () => {
    // June 15, 2026 at 06:00 UTC = June 15 midnight MDT
    const utcDate = new Date("2026-06-15T06:00:00Z");
    expect(utcToDateString(utcDate, TZ)).toBe("2026-06-15");
  });

  it("handles date string input", () => {
    expect(utcToDateString("2026-06-15T06:00:00Z", TZ)).toBe("2026-06-15");
  });

  it("handles date boundary correctly", () => {
    // June 15, 2026 at 02:00 UTC = June 14 at 20:00 MDT (previous day)
    const utcDate = new Date("2026-06-15T02:00:00Z");
    expect(utcToDateString(utcDate, TZ)).toBe("2026-06-14");
  });
});

describe("formatDateInUserTZ", () => {
  it("returns empty string for null", () => {
    expect(formatDateInUserTZ(null, undefined, TZ)).toBe("");
  });

  it("formats a UTC date in the given timezone", () => {
    const utcDate = new Date("2026-06-15T06:00:00Z");
    const result = formatDateInUserTZ(utcDate, "MMM d, yyyy", TZ);
    expect(result).toBe("Jun 15, 2026");
  });
});

describe("getStartOfDayUTC", () => {
  it("returns start of day in timezone as UTC", () => {
    const date = new Date("2026-06-15T15:30:00Z");
    const result = getStartOfDayUTC(date, TZ);
    // Start of June 15 in Denver (MDT) = June 15 06:00 UTC
    expect(result.getUTCHours()).toBe(6);
    expect(result.getUTCMinutes()).toBe(0);
  });
});

describe("getEndOfDayUTC", () => {
  it("returns end of day in timezone as UTC", () => {
    const date = new Date("2026-06-15T15:30:00Z");
    const result = getEndOfDayUTC(date, TZ);
    // End of June 15 in Denver (MDT) = June 16 05:59:59 UTC
    expect(result.getUTCDate()).toBe(16);
    expect(result.getUTCHours()).toBe(5);
    expect(result.getUTCMinutes()).toBe(59);
  });
});

describe("getTodayString", () => {
  it("returns today as YYYY-MM-DD string", () => {
    const result = getTodayString(TZ);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isToday", () => {
  it("returns true for a date that is today in the given timezone", () => {
    const todayStr = getTodayString(TZ);
    const todayUTC = dateStringToUTC(todayStr, TZ);
    expect(isToday(todayUTC, TZ)).toBe(true);
  });

  it("returns false for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    expect(isToday(yesterday, TZ)).toBe(false);
  });
});
