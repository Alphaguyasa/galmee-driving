import { describe, expect, it } from "vitest";
import { skillsGained, withSkills } from "./lesson-skills";

const lessons = [
  { id: "a", status: "attended", starts_at: "2026-11-20T06:00:00Z" },
  { id: "b", status: "attended", starts_at: "2026-11-18T06:00:00Z" },
  { id: "c", status: "missed", starts_at: "2026-11-19T06:00:00Z" },
];

describe("lesson skills", () => {
  it("puts ticked skills on attended lessons only", () => {
    const rows = withSkills(lessons, [
      { lesson_id: "a", skill: "parking" },
      { lesson_id: "a", skill: "mirrors" },
      { lesson_id: "c", skill: "gears" },
    ]);
    expect(rows.map((r) => r.skills)).toEqual([["parking", "mirrors"], [], []]);
  });

  it("dates each skill by the first lesson that showed it", () => {
    const rows = withSkills(lessons, [
      { lesson_id: "a", skill: "mirrors" },
      { lesson_id: "b", skill: "mirrors" },
      { lesson_id: "a", skill: "parking" },
    ]);
    expect(skillsGained(rows)).toEqual([
      { skill: "mirrors", firstAt: "2026-11-18T06:00:00Z" },
      { skill: "parking", firstAt: "2026-11-20T06:00:00Z" },
    ]);
  });
});
