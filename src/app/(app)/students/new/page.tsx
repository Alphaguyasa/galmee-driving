import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { enrollAction } from "@/actions/driving";
import { ActionForm } from "@/components/driving/action-form";
import { ClientRef } from "@/components/driving/client-ref";
import { DateField, SelectField } from "@/components/driving/fields";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { addDays, addisDay } from "@/lib/addis-time";
import { formatBirr } from "@/lib/money";
import { listCourses } from "@/server/dal/driving";
import { DOCUMENT_KINDS, PAY_METHODS } from "@/server/validation";

export default async function NewStudentPage() {
  const [t, tDocs, tMethods, locale, courses] = await Promise.all([
    getTranslations("newStudent"),
    getTranslations("documents"),
    getTranslations("methods"),
    getLocale() as Promise<Locale>,
    listCourses(),
  ]);
  const active = courses.filter((c) => c.active);
  const today = addisDay();

  if (active.length === 0) {
    return (
      <div className="grid gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("noCourses")}</p>
        <Link href="/settings" className={buttonVariants({ size: "lg" })}>
          {t("addCourse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <ActionForm action={enrollAction} submitLabel={t("submit")} className="grid gap-4">
        <ClientRef />
        <div className="grid gap-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" required minLength={2} maxLength={120} autoComplete="off" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nationalId">{t("nationalId")}</Label>
          <Input id="nationalId" name="nationalId" maxLength={40} autoComplete="off" />
        </div>
        <SelectField
          name="course"
          label={t("course")}
          options={active.map((c) => ({ value: c.id, label: t("courseOption", { name: c.name, lessons: c.lessons_total, fee: formatBirr(c.fee, locale) }) }))}
        />
        <DateField name="start" label={t("start")} defaultValue={today} />

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t("documents")}</legend>
          {DOCUMENT_KINDS.map((kind) => (
            <label key={kind} className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="documents" value={kind} className="size-5 accent-[var(--asphalt)]" />
              {tDocs(kind)}
            </label>
          ))}
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor="down">{t("down")}</Label>
          <Input id="down" name="down" inputMode="decimal" autoComplete="off" placeholder="0" />
        </div>
        <SelectField name="method" label={t("method")} defaultValue="cash" options={PAY_METHODS.map((m) => ({ value: m, label: tMethods(m) }))} />
        <div className="grid gap-2">
          <Label htmlFor="installments">{t("installments")}</Label>
          <Input id="installments" name="installments" type="number" inputMode="numeric" min={0} max={24} defaultValue={3} />
          <p className="text-sm text-muted-foreground">{t("installmentsHint")}</p>
        </div>
        <DateField name="firstDue" label={t("firstDue")} defaultValue={addDays(today, 30)} />
      </ActionForm>
    </div>
  );
}
