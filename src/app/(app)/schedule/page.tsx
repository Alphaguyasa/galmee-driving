import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SelectField } from "@/components/driving/fields";
import { LessonRow } from "@/components/driving/lesson-row";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { addDays, addisDay } from "@/lib/addis-time";
import { formatEthiopianDate } from "@/lib/ethiopian-date";
import { cn } from "@/lib/utils";
import { listInstructors, listLessonsForDay, listVehicles } from "@/server/dal/driving";
import { day as dayParam, uuidParam } from "@/server/validation";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ day?: string; instructor?: string; vehicle?: string }> }) {
  const sp = await searchParams;
  const today = addisDay();
  const day = dayParam.safeParse(sp.day).success ? sp.day! : today;
  const instructor = uuidParam.safeParse(sp.instructor).success ? sp.instructor : undefined;
  const vehicle = uuidParam.safeParse(sp.vehicle).success ? sp.vehicle : undefined;
  const [t, locale, lessons, instructors, vehicles] = await Promise.all([
    getTranslations("schedule"),
    getLocale() as Promise<Locale>,
    listLessonsForDay(day, instructor, vehicle),
    listInstructors(),
    listVehicles(),
  ]);
  // eslint-disable-next-line react-hooks/purity -- a server component renders once per request; attendance buttons depend on the current time
  const now = Date.now();

  const link = (d: string) => {
    const params = new URLSearchParams({ day: d });
    if (instructor) params.set("instructor", instructor);
    if (vehicle) params.set("vehicle", vehicle);
    return `/schedule?${params}`;
  };

  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-[1.5625rem] leading-tight font-bold">{t("title")}</h1>
      <div className="flex items-center justify-between gap-2">
        <Link href={link(addDays(day, -1))} aria-label={t("previous")} className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
          <ChevronLeft aria-hidden />
        </Link>
        <div className="text-center">
          <p className="num font-semibold">{formatEthiopianDate(day, locale)}</p>
          {day !== today ? (
            <Link href={link(today)} className="text-sm underline underline-offset-4">
              {t("today")}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">{t("today")}</p>
          )}
        </div>
        <Link href={link(addDays(day, 1))} aria-label={t("next")} className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
          <ChevronRight aria-hidden />
        </Link>
      </div>

      <form action="/schedule" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="day" value={day} />
        <SelectField name="instructor" label={t("instructor")} defaultValue={instructor ?? ""} options={[{ value: "", label: t("all") }, ...instructors.map((i) => ({ value: i.id, label: i.name }))]} />
        <SelectField name="vehicle" label={t("vehicle")} defaultValue={vehicle ?? ""} options={[{ value: "", label: t("all") }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]} />
        <Button type="submit" variant="outline">
          {t("apply")}
        </Button>
      </form>

      {lessons.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul>
          {lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} showStudent now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
