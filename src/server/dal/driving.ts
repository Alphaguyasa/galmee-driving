import "server-only";
import { createClient } from "@/lib/supabase/server";
import { drivingErrorKey } from "@/lib/driving-errors";
import { addDays, addisInstant, addisDay } from "@/lib/addis-time";
import type { Enums } from "@/lib/database.types";
import type { DocumentKind } from "@/server/validation";

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: { message: string; code?: string } | null): { ok: false; error: string } {
  if (error?.code === "42501") return { ok: false, error: "not_allowed" };
  return { ok: false, error: drivingErrorKey(error?.message) };
}

const BOARD_COLUMNS =
  "id, student_name, student_phone, course_name, status, start_on, fee, paid_total, balance, lessons_total, lessons_attended, lessons_booked, next_lesson_at, next_exam_on, next_exam_kind, next_due_on, overdue" as const;

export type StudentRow = {
  id: string;
  student_name: string;
  student_phone: string | null;
  course_name: string;
  status: string;
  start_on: string;
  fee: number;
  paid_total: number;
  balance: number;
  lessons_total: number;
  lessons_attended: number;
  lessons_booked: number;
  next_lesson_at: string | null;
  next_exam_on: string | null;
  next_exam_kind: string | null;
  next_due_on: string | null;
  overdue: number;
};

export type BoardFilter = "all" | "owes" | "exam";
const BOARD_LIMIT = 100;

/** Commas and parentheses would break a PostgREST `or` filter; wildcards would widen it. */
function safeTerm(q: string) {
  return q.replace(/[,()%_*\\]/g, " ").trim();
}

export async function listStudents(q: string, filter: BoardFilter): Promise<StudentRow[]> {
  const supabase = await createClient();
  let query = supabase.from("dr_student_board").select(BOARD_COLUMNS).neq("status", "withdrawn");
  const term = safeTerm(q);
  if (term) query = query.or(`student_name.ilike.%${term}%,student_phone.ilike.%${term}%`);
  if (filter === "owes") query = query.gt("balance", 0).order("overdue", { ascending: false }).order("balance", { ascending: false });
  else if (filter === "exam") query = query.not("next_exam_on", "is", null).order("next_exam_on");
  else query = query.order("status").order("student_name");
  const { data, error } = await query.limit(BOARD_LIMIT);
  if (error) throw error;
  return data as StudentRow[];
}

export type StudentCard = {
  student: StudentRow;
  nationalId: string | null;
  documents: DocumentKind[];
  lessons: LessonRow[];
  installments: { id: string; seq: number; dueOn: string; amount: number; paid: number }[];
  payments: { id: string; amount: number; method: Enums<"pay_method">; reference: string | null; createdAt: string }[];
  exams: { id: string; kind: string; examOn: string; place: string | null; result: string }[];
};

export type LessonRow = {
  id: string;
  enrollment_id: string;
  student_name: string;
  instructor_id: string;
  instructor_name: string;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
};

const LESSON_COLUMNS =
  "id, enrollment_id, student_name, instructor_id, instructor_name, vehicle_id, vehicle_plate, starts_at, ends_at, status" as const;

export async function getStudent(id: string): Promise<StudentCard | null> {
  const supabase = await createClient();
  const [board, enrollment, documents, lessons, installments, payments, exams] = await Promise.all([
    supabase.from("dr_student_board").select(BOARD_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("dr_enrollments").select("national_id").eq("id", id).maybeSingle(),
    supabase.from("dr_documents").select("kind").eq("enrollment_id", id),
    supabase.from("dr_lesson_board").select(LESSON_COLUMNS).eq("enrollment_id", id).order("starts_at", { ascending: false }).limit(200),
    supabase.from("dr_installments").select("id, seq, due_on, amount, paid").eq("enrollment_id", id).order("seq"),
    supabase.from("dr_payments").select("id, amount, method, reference, created_at").eq("enrollment_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("dr_exams").select("id, kind, exam_on, place, result").eq("enrollment_id", id).order("exam_on", { ascending: false }),
  ]);
  for (const r of [board, enrollment, documents, lessons, installments, payments, exams]) if (r.error) throw r.error;
  if (!board.data) return null;
  return {
    student: board.data as StudentRow,
    nationalId: enrollment.data?.national_id ?? null,
    documents: (documents.data ?? []).map((d) => d.kind as DocumentKind),
    lessons: (lessons.data ?? []) as LessonRow[],
    installments: (installments.data ?? []).map((i) => ({ id: i.id, seq: i.seq, dueOn: i.due_on, amount: i.amount, paid: i.paid })),
    payments: (payments.data ?? []).map((p) => ({
      id: p.id, amount: p.amount, method: p.method as Enums<"pay_method">, reference: p.reference, createdAt: p.created_at,
    })),
    exams: (exams.data ?? []).map((x) => ({ id: x.id, kind: x.kind, examOn: x.exam_on, place: x.place, result: x.result })),
  };
}

export async function listLessonsForDay(day: string, instructor?: string, vehicle?: string): Promise<LessonRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("dr_lesson_board")
    .select(LESSON_COLUMNS)
    .gte("starts_at", addisInstant(day, "00:00"))
    .lt("starts_at", addisInstant(addDays(day, 1), "00:00"))
    .neq("status", "cancelled")
    .order("starts_at")
    .limit(200);
  if (instructor) q = q.eq("instructor_id", instructor);
  if (vehicle) q = q.eq("vehicle_id", vehicle);
  const { data, error } = await q;
  if (error) throw error;
  return data as LessonRow[];
}

export type ExamRow = {
  id: string; kind: string; examOn: string; place: string | null; enrollmentId: string; studentName: string;
};

export async function listUpcomingExams(): Promise<ExamRow[]> {
  const supabase = await createClient();
  const { data: exams, error } = await supabase
    .from("dr_exams")
    .select("id, kind, exam_on, place, enrollment_id")
    .eq("result", "pending")
    .order("exam_on")
    .limit(200);
  if (error) throw error;
  if (exams.length === 0) return [];
  const ids = [...new Set(exams.map((x) => x.enrollment_id))];
  const { data: students, error: studentError } = await supabase.from("dr_student_board").select("id, student_name").in("id", ids);
  if (studentError) throw studentError;
  const names = new Map(students.map((s) => [s.id, s.student_name]));
  return exams.map((x) => ({
    id: x.id, kind: x.kind, examOn: x.exam_on, place: x.place, enrollmentId: x.enrollment_id, studentName: names.get(x.enrollment_id) ?? "",
  }));
}

export type CourseRow = { id: string; name: string; licence_class: string | null; lessons_total: number; lesson_minutes: number; fee: number; active: boolean };
export type InstructorRow = { id: string; name: string; phone: string | null; active: boolean };
export type VehicleRow = { id: string; plate: string; label: string | null; active: boolean };

export async function listCourses(): Promise<CourseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dr_courses").select("id, name, licence_class, lessons_total, lesson_minutes, fee, active").order("name");
  if (error) throw error;
  return data;
}

export async function listInstructors(): Promise<InstructorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dr_instructors").select("id, name, phone, active").order("name");
  if (error) throw error;
  return data;
}

export async function listVehicles(): Promise<VehicleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dr_vehicles").select("id, plate, label, active").order("plate");
  if (error) throw error;
  return data;
}

export async function enroll(input: {
  name: string; phone?: string; nationalId?: string; course: string; start: string; down: number;
  method: Enums<"pay_method">; installments: number; firstDue?: string; documents: DocumentKind[]; clientRef: string;
}): Promise<Result<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dr_enroll", {
    p_name: input.name, p_phone: input.phone ?? null, p_course: input.course, p_start: input.start,
    p_national_id: input.nationalId, p_documents: input.documents, p_down: input.down, p_method: input.method,
    p_installments: input.installments, p_first_due: input.firstDue, p_client_ref: input.clientRef,
  });
  return error ? fail(error) : { ok: true, data };
}

export async function pay(input: { enrollment: string; amount: number; method: Enums<"pay_method">; reference?: string; clientRef: string }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dr_pay", {
    p_enrollment: input.enrollment, p_amount: input.amount, p_method: input.method, p_reference: input.reference, p_client_ref: input.clientRef,
  });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function bookLesson(input: { enrollment: string; instructor: string; vehicle?: string; date: string; time: string; clientRef: string }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dr_book_lesson", {
    p_enrollment: input.enrollment, p_instructor: input.instructor, p_vehicle: input.vehicle ?? null,
    p_starts_at: addisInstant(input.date, input.time), p_client_ref: input.clientRef,
  });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function markLesson(lesson: string, status: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dr_mark_lesson", { p_lesson: lesson, p_status: status });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function addExam(input: { enrollment: string; kind: string; examOn: string; place?: string; clientRef: string }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dr_add_exam", {
    p_enrollment: input.enrollment, p_kind: input.kind, p_exam_on: input.examOn, p_place: input.place, p_client_ref: input.clientRef,
  });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function recordExamResult(exam: string, result: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dr_exam_result", { p_exam: exam, p_result: result });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function setDocument(enrollment: string, kind: DocumentKind, received: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = received
    ? await supabase.from("dr_documents").upsert({ enrollment_id: enrollment, kind }, { onConflict: "enrollment_id,kind", ignoreDuplicates: true })
    : await supabase.from("dr_documents").delete().eq("enrollment_id", enrollment).eq("kind", kind);
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function addCourse(input: { name: string; licenceClass?: string; lessonsTotal: number; lessonMinutes: number; fee: number }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("dr_courses").insert({
    name: input.name, licence_class: input.licenceClass ?? null, lessons_total: input.lessonsTotal, lesson_minutes: input.lessonMinutes, fee: input.fee,
  });
  if (error?.code === "23505") return { ok: false, error: "name_taken" };
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function addInstructor(name: string, phone?: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("dr_instructors").insert({ name, phone: phone ?? null });
  if (error?.code === "23505") return { ok: false, error: "name_taken" };
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function addVehicle(plate: string, label?: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("dr_vehicles").insert({ plate: plate.toUpperCase(), label: label ?? null });
  if (error?.code === "23505") return { ok: false, error: "plate_taken" };
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function setActive(table: "dr_courses" | "dr_instructors" | "dr_vehicles", id: string, active: boolean): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).update({ active }).eq("id", id).select("id");
  if (error) return fail(error);
  // RLS hides the row from staff: no error, nothing updated.
  return data.length === 0 ? { ok: false, error: "not_allowed" } : { ok: true, data: undefined };
}

export async function loadDemoData(): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dr_load_demo");
  return error ? fail(error) : { ok: true, data: undefined };
}

export function todayInAddis() {
  return addisDay();
}
