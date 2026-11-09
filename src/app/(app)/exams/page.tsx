import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { addisDay } from "@/lib/addis-time";
import { daysBetween, formatEthiopianDate } from "@/lib/ethiopian-date";
import { listUpcomingExams } from "@/server/dal/driving";

export default async function ExamsPage() {
  const [t, locale, exams] = await Promise.all([getTranslations("exams"), getLocale() as Promise<Locale>, listUpcomingExams()]);
  const today = addisDay();
  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {exams.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul>
          {exams.map((x) => {
            const days = daysBetween(x.examOn, today);
            return (
              <li key={x.id}>
                <Link href={`/students/${x.enrollmentId}`} className="grid gap-1 border-b py-3 hover:bg-accent/40">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold">{x.studentName}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{t(`kinds.${x.kind}`)}</span>
                  </span>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="font-medium text-exam">{formatEthiopianDate(x.examOn, locale, { withEra: false })}</span>
                    <span className={days < 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {days < 0 ? t("needsResult") : t("inDays", { days })}
                    </span>
                  </span>
                  {x.place ? <span className="text-sm text-muted-foreground">{x.place}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
