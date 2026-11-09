import { describe, expect, it } from "vitest";
import { formatBirr } from "./money";

describe("formatBirr", () => {
  it("uses the Amharic prefix for am", () => expect(formatBirr(1250, "am")).toBe("ብር 1,250.00"));
  it("uses the ETB suffix otherwise", () => expect(formatBirr(1250.5, "en")).toBe("1,250.50 ETB"));
});
