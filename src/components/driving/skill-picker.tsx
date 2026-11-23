import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { lessonSkillsAction } from "@/actions/driving";
import { ActionForm } from "@/components/driving/action-form";
import { SKILLS, type Skill } from "@/server/validation";

/** Skill taps for an attended lesson: one checkbox chip per skill, saved together. */
export async function SkillPicker({ lesson, enrollment, skills }: { lesson: string; enrollment: string; skills: Skill[] }) {
  const t = await getTranslations("skills");
  const ticked = new Set(skills);
  return (
    <details className="group rounded-md border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{t("title")}</span>
        <span className="min-w-0 truncate text-muted-foreground">
          {skills.length === 0 ? t("none") : SKILLS.filter((s) => ticked.has(s)).map((s) => t(`name.${s}`)).join(" · ")}
        </span>
      </summary>
      <ActionForm action={lessonSkillsAction} submitLabel={t("save")} doneLabel={t("saved")} size="sm" variant="secondary" className="grid gap-3 border-t p-3">
        <input type="hidden" name="lesson" value={lesson} />
        <input type="hidden" name="enrollment" value={enrollment} />
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{t("title")}</legend>
          {SKILLS.map((s) => (
            <label
              key={s}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input type="checkbox" name="skill" value={s} defaultChecked={ticked.has(s)} className="peer sr-only" />
              <Check aria-hidden className="hidden size-4 peer-checked:block" />
              {t(`name.${s}`)}
            </label>
          ))}
        </fieldset>
      </ActionForm>
    </details>
  );
}

/** The student's skill progress: every skill, marked once shown in any attended lesson. */
export async function SkillProgress({ gained }: { gained: Skill[] }) {
  const t = await getTranslations("skills");
  const have = new Set(gained);
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">{t("progress", { done: have.size, total: SKILLS.length })}</p>
      <ul className="flex flex-wrap gap-2">
        {SKILLS.map((s) => (
          <li
            key={s}
            className={
              have.has(s)
                ? "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 text-sm text-background"
                : "inline-flex min-h-9 items-center rounded-full border border-dashed px-3 text-sm text-muted-foreground"
            }
          >
            {have.has(s) ? <Check aria-hidden className="size-4" /> : null}
            {t(`name.${s}`)}
            <span className="sr-only">{have.has(s) ? t("shown") : t("notYet")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
