import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Circle } from "lucide-react";
import { addExamAction, bookLessonAction, documentAction, examResultAction, payAction } from "@/actions/driving";
import { ActionForm } from "@/components/driving/action-form";
import { ClientRef } from "@/components/driving/client-ref";
import { DateField, SelectField } from "@/components/driving/fields";
import { LessonRow } from "@/components/driving/lesson-row";
import { RoadLine } from "@/components/driving/road-line";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { addDays, addisDay } from "@/lib/addis-time";
import { formatEthiopianDate } from "@/lib/ethiopian-date";
import { formatBirr } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getStudent, listInstructors, listVehicles } from "@/server/dal/driving";
import { DOCUMENT_KINDS, EXAM_KINDS, PAY_METHODS, uuidParam } from "@/server/validation";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidParam.safeParse(id).success) notFound();
  const [t, tDocs, tMethods, tExams, locale, card, instructors, vehicles] = await Promise.all([
    getTranslations("student"),
    getTranslations("documents"),
    getTranslations("methods"),
    getTranslations("exams"),
    getLocale() as Promise<Locale>,
    getStudent(id),
    listInstructors(),
    listVehicles(),
  ]);
  if (!card) notFound();
  const { student: s, lessons, installments, payments, exams, documents } = card;
  const today = addisDay();
  const money = (n: number) => formatBirr(n, locale);
  const date = (d: string) => formatEthiopianDate(d, locale, { withEra: false });
  const active = s.status === "active";
  // eslint-disable-next-line react-hooks/purity -- a server component renders once per request; attendance buttons depend on the current time
  const now = Date.now();

  return (
    <div className="grid max-w-2xl gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-bold">{s.student_name}</h1>
        <p className="text-muted-foreground">
          {[s.course_name, s.student_phone, card.nationalId].filter(Boolean).join(" · ")}
        </p>
        <RoadLine done={s.lessons_attended} total={s.lessons_total} label={t("lessonsDone", { done: s.lessons_attended, total: s.lessons_total })} />
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("lessons")}</dt>
            <dd className="num text-lg font-semibold">
              {s.lessons_attended}/{s.lessons_total}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("paid")}</dt>
            <dd className="num text-lg font-semibold">{money(s.paid_total)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("balance")}</dt>
            <dd className={cn("num text-lg font-semibold", s.balance > 0 && "text-destructive")}>{money(s.balance)}</dd>
          </div>
        </dl>
        {s.status === "completed" ? <p className="font-medium">{t("completed")}</p> : null}
      </header>

      <Section title={t("money")}>
        {installments.length > 0 ? (
          <ul>
            {installments.map((i) => {
              const open = i.amount - i.paid;
              const late = open > 0 && i.dueOn < today;
              return (
                <li key={i.id} className="flex items-baseline justify-between gap-3 border-b py-2 text-sm">
                  <span>{t("installment", { n: i.seq, date: date(i.dueOn) })}</span>
                  <span className={cn("num shrink-0", late && "font-semibold text-destructive")}>
                    {open <= 0 ? t("installmentPaid") : t(late ? "installmentLate" : "installmentOpen", { amount: money(open) })}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {s.balance > 0 ? (
          <ActionForm action={payAction} submitLabel={t("recordPayment")} doneLabel={t("paymentRecorded")} className="grid gap-3 rounded-md border bg-card p-3">
            <ClientRef />
            <input type="hidden" name="enrollment" value={s.id} />
            <div className="grid gap-2">
              <Label htmlFor="amount">{t("amount")}</Label>
              <Input id="amount" name="amount" inputMode="decimal" required autoComplete="off" />
            </div>
            <SelectField name="method" label={t("method")} defaultValue="cash" options={PAY_METHODS.map((m) => ({ value: m, label: tMethods(m) }))} />
            <div className="grid gap-2">
              <Label htmlFor="reference">{t("reference")}</Label>
              <Input id="reference" name="reference" maxLength={80} autoComplete="off" />
            </div>
          </ActionForm>
        ) : null}
        {payments.length > 0 ? (
          <ul>
            {payments.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 border-b py-2 text-sm">
                <span className="text-muted-foreground">
                  {date(addisDay(p.createdAt))} · {tMethods(p.method)}
                </span>
                <span className="num font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
        )}
      </Section>

      <Section title={t("lessons")}>
        {active ? (
          instructors.some((i) => i.active) ? (
            <ActionForm action={bookLessonAction} submitLabel={t("bookLesson")} doneLabel={t("lessonBooked")} className="grid gap-3 rounded-md border bg-card p-3">
              <ClientRef />
              <input type="hidden" name="enrollment" value={s.id} />
              <DateField name="date" label={t("date")} defaultValue={addDays(today, 1)} />
              <div className="grid gap-2">
                <Label htmlFor="time">{t("time")}</Label>
                <Input id="time" name="time" type="time" defaultValue="08:00" required />
              </div>
              <SelectField name="instructor" label={t("instructor")} options={instructors.filter((i) => i.active).map((i) => ({ value: i.id, label: i.name }))} />
              <SelectField
                name="vehicle"
                label={t("vehicle")}
                options={[{ value: "", label: t("noVehicle") }, ...vehicles.filter((v) => v.active).map((v) => ({ value: v.id, label: [v.plate, v.label].filter(Boolean).join(" ") }))]}
              />
            </ActionForm>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noInstructors")}</p>
          )
        ) : null}
        {lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLessons")}</p>
        ) : (
          <ul>
            {lessons.map((l) => (
              <LessonRow key={l.id} lesson={l} showDate now={now} />
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("exams")}>
        {exams.length === 0 ? <p className="text-sm text-muted-foreground">{t("noExams")}</p> : null}
        <ul>
          {exams.map((x) => (
            <li key={x.id} className="grid gap-2 border-b py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {tExams(`kinds.${x.kind}`)}: <span className="text-exam">{date(x.examOn)}</span>
                </span>
                <span className="shrink-0 text-sm">{tExams(`results.${x.result}`)}</span>
              </div>
              {x.place ? <p className="text-sm text-muted-foreground">{x.place}</p> : null}
              {x.result === "pending" ? (
                <div className="flex gap-2">
                  {(["passed", "failed"] as const).map((result) => (
                    <ActionForm key={result} action={examResultAction} submitLabel={tExams(`mark.${result}`)} size="sm" variant="outline" className="contents">
                      <input type="hidden" name="exam" value={x.id} />
                      <input type="hidden" name="enrollment" value={s.id} />
                      <input type="hidden" name="result" value={result} />
                    </ActionForm>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {active ? (
          <ActionForm action={addExamAction} submitLabel={t("addExam")} doneLabel={t("examAdded")} className="grid gap-3 rounded-md border bg-card p-3">
            <ClientRef />
            <input type="hidden" name="enrollment" value={s.id} />
            <SelectField name="kind" label={t("examKind")} options={EXAM_KINDS.map((k) => ({ value: k, label: tExams(`kinds.${k}`) }))} />
            <DateField name="examOn" label={t("examDate")} defaultValue={addDays(today, 14)} />
            <div className="grid gap-2">
              <Label htmlFor="place">{t("examPlace")}</Label>
              <Input id="place" name="place" maxLength={120} autoComplete="off" />
            </div>
          </ActionForm>
        ) : null}
      </Section>

      <Section title={t("documents")}>
        <ul>
          {DOCUMENT_KINDS.map((kind) => {
            const has = documents.includes(kind);
            return (
              <li key={kind} className="flex items-center justify-between gap-3 border-b py-2">
                <span className="inline-flex items-center gap-2">
                  {has ? <CheckCircle2 aria-hidden className="size-5" /> : <Circle aria-hidden className="size-5 text-muted-foreground" />}
                  {tDocs(kind)}
                  <span className="sr-only">{has ? t("docReceived") : t("docMissing")}</span>
                </span>
                <ActionForm action={documentAction} submitLabel={has ? t("docRemove") : t("docMark")} size="sm" variant="outline" className="contents">
                  <input type="hidden" name="enrollment" value={s.id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="received" value={has ? "false" : "true"} />
                </ActionForm>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
