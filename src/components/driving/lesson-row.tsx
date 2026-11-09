import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Car, UserRound } from "lucide-react";
import { markLessonAction } from "@/actions/driving";
import { ActionForm } from "@/components/driving/action-form";
import type { Locale } from "@/i18n/config";
import { addisDay, addisTime } from "@/lib/addis-time";
import { formatEthiopianDate } from "@/lib/ethiopian-date";
import type { LessonRow as Lesson } from "@/server/dal/driving";

function Mark({ lesson, enrollment, status, label, variant }: { lesson: string; enrollment: string; status: string; label: string; variant: "secondary" | "outline" }) {
  return (
    <ActionForm action={markLessonAction} submitLabel={label} size="sm" variant={variant} className="contents">
      <input type="hidden" name="lesson" value={lesson} />
      <input type="hidden" name="enrollment" value={enrollment} />
      <input type="hidden" name="status" value={status} />
    </ActionForm>
  );
}

export async function LessonRow({ lesson, showStudent, showDate, now }: { lesson: Lesson; showStudent?: boolean; showDate?: boolean; now: number }) {
  const [t, locale] = await Promise.all([getTranslations("lessons"), getLocale() as Promise<Locale>]);
  const open = lesson.status === "scheduled";
  const started = new Date(lesson.starts_at).getTime() <= now;
  return (
    <li className="grid gap-2 border-b py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="num font-semibold">{addisTime(lesson.starts_at)}</span>
          {showDate ? <span className="ml-2 text-sm text-muted-foreground">{formatEthiopianDate(addisDay(lesson.starts_at), locale, { withEra: false })}</span> : null}
          {showStudent ? (
            <Link href={`/students/${lesson.enrollment_id}`} className="ml-2 font-medium underline-offset-4 hover:underline">
              {lesson.student_name}
            </Link>
          ) : null}
        </div>
        <span className={lesson.status === "missed" ? "shrink-0 text-sm font-medium text-destructive" : "shrink-0 text-sm text-muted-foreground"}>{t(`status.${lesson.status}`)}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound aria-hidden className="size-4" />
          {lesson.instructor_name}
        </span>
        {lesson.vehicle_plate ? (
          <span className="num inline-flex items-center gap-1">
            <Car aria-hidden className="size-4" />
            {lesson.vehicle_plate}
          </span>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-wrap gap-2">
          {started ? (
            <>
              <Mark lesson={lesson.id} enrollment={lesson.enrollment_id} status="attended" label={t("attended")} variant="secondary" />
              <Mark lesson={lesson.id} enrollment={lesson.enrollment_id} status="missed" label={t("missed")} variant="outline" />
            </>
          ) : null}
          <Mark lesson={lesson.id} enrollment={lesson.enrollment_id} status="cancelled" label={t("cancel")} variant="outline" />
        </div>
      ) : null}
    </li>
  );
}
