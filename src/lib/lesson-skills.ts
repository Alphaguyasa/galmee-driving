import type { Skill } from "@/server/validation";

type LessonLike = { id: string; status: string; starts_at: string };

/** Puts each lesson's ticked skills on it. Skills on a lesson that is no longer attended are ignored. */
export function withSkills<L extends LessonLike>(lessons: L[], skills: { lesson_id: string; skill: string }[]): (L & { skills: Skill[] })[] {
  const byLesson = new Map<string, Skill[]>();
  for (const s of skills) byLesson.set(s.lesson_id, [...(byLesson.get(s.lesson_id) ?? []), s.skill as Skill]);
  return lessons.map((l) => ({ ...l, skills: l.status === "attended" ? (byLesson.get(l.id) ?? []) : [] }));
}

/** First attended lesson in which each skill was shown. */
export function skillsGained(lessons: (LessonLike & { skills: Skill[] })[]): { skill: Skill; firstAt: string }[] {
  const first = new Map<Skill, string>();
  for (const l of lessons) for (const s of l.skills) if (!first.has(s) || l.starts_at < first.get(s)!) first.set(s, l.starts_at);
  return [...first].map(([skill, firstAt]) => ({ skill, firstAt }));
}

