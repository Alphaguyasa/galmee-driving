import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, GraduationCap, Plus, Search, UsersRound } from "lucide-react";
import { loadDemoDataAction } from "@/actions/driving";
import { ActionForm } from "@/components/driving/action-form";
import { RoadLine } from "@/components/driving/road-line";
import { EmptyState } from "@/components/galmee/empty-state";
import { ListRow, ListSheet } from "@/components/galmee/list-row";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { addisDay, addisTime } from "@/lib/addis-time";
import { formatEthiopianDate } from "@/lib/ethiopian-date";
import { formatBirr } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listStudents, type BoardFilter } from "@/server/dal/driving";
import { getSession } from "@/server/dal/session";
import { searchParam } from "@/server/validation";

const DEMO_TENANT = "Galmee Driving School Demo";
const FILTERS: BoardFilter[] = ["all", "owes", "exam"];

export default async function StudentBoard({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { q, show } = await searchParams;
  const parsed = searchParam.safeParse(q ?? "");
  const query = parsed.success ? parsed.data : "";
  const filter: BoardFilter = FILTERS.includes(show as BoardFilter) ? (show as BoardFilter) : "all";
  const [t, locale, students, { tenant }] = await Promise.all([getTranslations("board"), getLocale() as Promise<Locale>, listStudents(query, filter), getSession()]);

  const link = (next: BoardFilter) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (next !== "all") params.set("show", next);
    const text = params.toString();
    return text ? `/?${text}` : "/";
  };

  return (
    <div className="grid gap-4">
      <form action="/" className="grid gap-2">
        <Label htmlFor="q" className="sr-only">
          {t("search")}
        </Label>
        {filter !== "all" ? <input type="hidden" name="show" value={filter} /> : null}
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder={t("search")}
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <button type="submit" aria-label={t("searchAction")} className={cn(buttonVariants(), "w-12 shrink-0 px-0")}>
            <Search aria-hidden className="size-5" />
          </button>
        </div>
      </form>

      <nav aria-label={t("filter")} className="flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={link(f)}
            aria-current={f === filter ? "page" : undefined}
            className={cn("flex h-11 items-center rounded-md px-3 text-sm", f === filter ? "bg-primary font-semibold text-primary-foreground" : "bg-secondary")}
          >
            {t(`filters.${f}`)}
          </Link>
        ))}
      </nav>

      {students.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          message={query ? t("noMatch") : t(`empty.${filter}`)}
          action={
            !query && filter === "all" && tenant.name === DEMO_TENANT ? (
              <ActionForm action={loadDemoDataAction} submitLabel={t("loadDemo")} variant="outline" />
            ) : undefined
          }
        />
      ) : (
        <ListSheet aria-live="polite">
          {students.map((s) => (
            <ListRow
              key={s.id}
              href={`/students/${s.id}`}
              title={
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words">{s.student_name}</span>
                  <span className="shrink-0 text-right">
                    {s.balance > 0 ? (
                      <span className={cn("num text-sm font-semibold", s.overdue > 0 ? "text-owed" : "text-foreground")}>
                        {t(s.overdue > 0 ? "overdue" : "owes", { amount: formatBirr(s.overdue > 0 ? s.overdue : s.balance, locale) })}
                      </span>
                    ) : (
                      <span className="text-sm text-money-in">{t("paidUp")}</span>
                    )}
                  </span>
                </span>
              }
              sub={
                <>
                  <RoadLine done={s.lessons_attended} total={s.lessons_total} label={t("lessonsDone", { done: s.lessons_attended, total: s.lessons_total })} />
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{s.status === "completed" ? t("completed") : s.course_name}</span>
                    <span className="num shrink-0" aria-hidden>
                      {s.lessons_attended}/{s.lessons_total}
                    </span>
                  </span>
                  {s.next_lesson_at || s.next_exam_on ? (
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                      {s.next_lesson_at ? (
                        <span className="num inline-flex items-center gap-1">
                          <CalendarClock aria-hidden className="size-4" />
                          {t("nextLesson", { date: formatEthiopianDate(addisDay(s.next_lesson_at), locale, { withEra: false }), time: addisTime(s.next_lesson_at) })}
                        </span>
                      ) : null}
                      {s.next_exam_on ? (
                        <span className="inline-flex items-center gap-1 font-medium text-exam">
                          <GraduationCap aria-hidden className="size-4" />
                          {t("nextExam", { date: formatEthiopianDate(s.next_exam_on, locale, { withEra: false }) })}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </>
              }
            />
          ))}
        </ListSheet>
      )}

      <div className="sticky bottom-20 md:bottom-4">
        <Link href="/students/new" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full shadow-md")}>
          <Plus aria-hidden />
          {t("register")}
        </Link>
      </div>
    </div>
  );
}
