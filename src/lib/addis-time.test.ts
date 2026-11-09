import { describe, expect, it } from "vitest";
import { addDays, addisDay, addisInstant, addisTime } from "./addis-time";

describe("addis-time", () => {
  it("rolls the calendar day at Addis midnight, not UTC midnight", () => {
    expect(addisDay("2026-11-08T20:59:00Z")).toBe("2026-11-08");
    expect(addisDay("2026-11-08T21:00:00Z")).toBe("2026-11-09");
  });
  it("shows the Addis wall clock", () => {
    expect(addisTime("2026-11-09T05:30:00Z")).toBe("08:30");
  });
  it("round-trips a wall-clock time", () => {
    const instant = addisInstant("2026-11-09", "08:30");
    expect(addisDay(instant)).toBe("2026-11-09");
    expect(addisTime(instant)).toBe("08:30");
  });
  it("adds days across a month end", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-01", -1)).toBe("2026-11-30");
  });
});
