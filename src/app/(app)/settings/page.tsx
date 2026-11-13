import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { addCourseAction, addInstructorAction, addVehicleAction, toggleCourseAction, toggleInstructorAction, toggleVehicleAction, type ActionState } from "@/actions/driving";
import { ActionForm } from "@/components/driving/action-form";
import { BirrInput } from "@/components/galmee/birr-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { formatBirr } from "@/lib/money";
import { listCourses, listInstructors, listVehicles } from "@/server/dal/driving";
import { getSession } from "@/server/dal/session";

function Field({ name, label, type, inputMode, required, defaultValue }: { name: string; label: string; type?: string; inputMode?: "decimal" | "numeric" | "tel"; required?: boolean; defaultValue?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} inputMode={inputMode} required={required} defaultValue={defaultValue} autoComplete="off" />
    </div>
  );
}

function Row({ id, active, title, detail, action, labels }: {
  id: string; active: boolean; title: string; detail?: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  labels: { on: string; off: string; inactive: string };
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b py-2">
      <span className="min-w-0">
        <span className="font-medium">{title}</span>
        {detail ? <span className="block text-sm text-muted-foreground">{detail}</span> : null}
        {!active ? <span className="block text-sm text-muted-foreground">{labels.inactive}</span> : null}
      </span>
      <ActionForm action={action} submitLabel={active ? labels.off : labels.on} size="sm" variant="outline" className="contents">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
      </ActionForm>
    </li>
  );
}

export default async function SettingsPage() {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");
  const [t, locale, courses, instructors, vehicles] = await Promise.all([getTranslations("settings"), getLocale() as Promise<Locale>, listCourses(), listInstructors(), listVehicles()]);
  const birr = (await getTranslations("common"))("birr");
  const labels = { on: t("activate"), off: t("deactivate"), inactive: t("inactive") };
  return (
    <div className="grid max-w-2xl gap-8">
      <h1 className="text-[1.5625rem] leading-tight font-bold">{t("title")}</h1>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("courses")}</h2>
        {courses.length === 0 ? <p className="text-muted-foreground">{t("noCourses")}</p> : null}
        <ul>
          {courses.map((c) => (
            <Row key={c.id} id={c.id} active={c.active} title={c.name} detail={t("courseDetail", { lessons: c.lessons_total, minutes: c.lesson_minutes, fee: formatBirr(c.fee, locale) })} action={toggleCourseAction} labels={labels} />
          ))}
        </ul>
        <ActionForm action={addCourseAction} submitLabel={t("addCourse")} doneLabel={t("added")} className="grid gap-3 rounded-md border bg-card p-3">
          <Field name="name" label={t("courseName")} required />
          <Field name="licenceClass" label={t("licenceClass")} />
          <Field name="lessonsTotal" label={t("lessonsTotal")} type="number" inputMode="numeric" required defaultValue="25" />
          <Field name="lessonMinutes" label={t("lessonMinutes")} type="number" inputMode="numeric" required defaultValue="60" />
          <div className="grid gap-2">
            <Label htmlFor="fee">{t("fee")}</Label>
            <BirrInput id="fee" name="fee" required unitLabel={birr} />
          </div>
        </ActionForm>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("instructors")}</h2>
        {instructors.length === 0 ? <p className="text-muted-foreground">{t("noInstructors")}</p> : null}
        <ul>
          {instructors.map((i) => (
            <Row key={i.id} id={i.id} active={i.active} title={i.name} detail={i.phone ?? undefined} action={toggleInstructorAction} labels={labels} />
          ))}
        </ul>
        <ActionForm action={addInstructorAction} submitLabel={t("addInstructor")} doneLabel={t("added")} className="grid gap-3 rounded-md border bg-card p-3">
          <Field name="name" label={t("instructorName")} required />
          <Field name="phone" label={t("phone")} type="tel" inputMode="tel" />
        </ActionForm>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("vehicles")}</h2>
        {vehicles.length === 0 ? <p className="text-muted-foreground">{t("noVehicles")}</p> : null}
        <ul>
          {vehicles.map((v) => (
            <Row key={v.id} id={v.id} active={v.active} title={v.plate} detail={v.label ?? undefined} action={toggleVehicleAction} labels={labels} />
          ))}
        </ul>
        <ActionForm action={addVehicleAction} submitLabel={t("addVehicle")} doneLabel={t("added")} className="grid gap-3 rounded-md border bg-card p-3">
          <Field name="plate" label={t("plate")} required />
          <Field name="label" label={t("vehicleLabel")} />
        </ActionForm>
      </section>
    </div>
  );
}
