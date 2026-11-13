import { getLocale, getTranslations } from "next-intl/server";
import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/galmee/empty-state";
import { ListRow, ListSheet } from "@/components/galmee/list-row";
import type { Locale } from "@/i18n/config";
import { addisDay } from "@/lib/addis-time";
import { daysBetween, formatEthiopianDate } from "@/lib/ethiopian-date";
import { listUpcomingExams } from "@/server/dal/driving";

export default async function ExamsPage() {
  const [t, locale, exams] = await Promise.all([getTranslations("exams"), getLocale() as Promise<Locale>, listUpcomingExams()]);
  const today = addisDay();
  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-[1.5625rem] leading-tight font-bold">{t("title")}</h1>
      {exams.length === 0 ? (
        <EmptyState icon={GraduationCap} message={t("empty")} />
      ) : (
        <ListSheet>
          {exams.map((x) => {
            const days = daysBetween(x.examOn, today);
            return (
              <ListRow
                key={x.id}
                href={`/students/${x.enrollmentId}`}
                title={x.studentName}
                right={
                  <>
                    <span className="text-sm text-muted-foreground">{t(`kinds.${x.kind}`)}</span>
                    <span className={days < 0 ? "text-sm font-medium text-owed" : "text-sm text-muted-foreground"}>
                      {days < 0 ? t("needsResult") : t("inDays", { days })}
                    </span>
                  </>
                }
                sub={
                  <>
                    <span className="num font-medium text-exam">{formatEthiopianDate(x.examOn, locale, { withEra: false })}</span>
                    {x.place ? <span>{x.place}</span> : null}
                  </>
                }
              />
            );
          })}
        </ListSheet>
      )}
    </div>
  );
}
