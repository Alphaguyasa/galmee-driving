"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as driving from "@/server/dal/driving";
import { getSession, getUserId } from "@/server/dal/session";
import {
  addExamSchema,
  bookLessonSchema,
  courseSchema,
  documentSchema,
  enrollSchema,
  examResultSchema,
  formToObject,
  instructorSchema,
  markLessonSchema,
  paySchema,
  toggleSchema,
  vehicleSchema,
} from "@/server/validation";

/** `error` is a key in the `errors` message namespace. */
export type ActionState = { error?: string; done?: boolean } | undefined;

// Server Actions are public endpoints: every one checks the login and validates; RLS and the RPCs re-check tenant and role.
async function requireLogin() {
  if (!(await getUserId())) redirect("/login");
}

async function requireManager() {
  const { profile } = await getSession();
  return profile.role !== "staff";
}

function refreshStudent(id: string) {
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/exams");
  revalidatePath(`/students/${id}`);
}

export async function enrollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = enrollSchema.safeParse({
    ...formToObject(formData, ["name", "phone", "nationalId", "course", "start", "down", "method", "installments", "firstDue", "clientRef"]),
    documents: formData.getAll("documents"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.path[0] === "phone" ? "phone" : "form" };
  const result = await driving.enroll(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  redirect(`/students/${result.data}`);
}

export async function payAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = paySchema.safeParse(formToObject(formData, ["enrollment", "amount", "method", "reference", "clientRef"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.pay(parsed.data);
  if (!result.ok) return { error: result.error };
  refreshStudent(parsed.data.enrollment);
  return { done: true };
}

export async function bookLessonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = bookLessonSchema.safeParse(formToObject(formData, ["enrollment", "instructor", "vehicle", "date", "time", "clientRef"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.bookLesson(parsed.data);
  if (!result.ok) return { error: result.error };
  refreshStudent(parsed.data.enrollment);
  return { done: true };
}

export async function markLessonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = markLessonSchema.safeParse(formToObject(formData, ["lesson", "status"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.markLesson(parsed.data.lesson, parsed.data.status);
  if (!result.ok) return { error: result.error };
  const enrollment = formData.get("enrollment");
  if (typeof enrollment === "string") refreshStudent(enrollment);
  return { done: true };
}

export async function addExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = addExamSchema.safeParse(formToObject(formData, ["enrollment", "kind", "examOn", "place", "clientRef"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.addExam(parsed.data);
  if (!result.ok) return { error: result.error };
  refreshStudent(parsed.data.enrollment);
  return { done: true };
}

export async function examResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = examResultSchema.safeParse(formToObject(formData, ["exam", "result"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.recordExamResult(parsed.data.exam, parsed.data.result);
  if (!result.ok) return { error: result.error };
  const enrollment = formData.get("enrollment");
  if (typeof enrollment === "string") refreshStudent(enrollment);
  revalidatePath("/exams");
  return { done: true };
}

export async function documentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = documentSchema.safeParse(formToObject(formData, ["enrollment", "kind", "received"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.setDocument(parsed.data.enrollment, parsed.data.kind, parsed.data.received === "true");
  if (!result.ok) return { error: result.error };
  revalidatePath(`/students/${parsed.data.enrollment}`);
  return { done: true };
}

export async function addCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  if (!(await requireManager())) return { error: "not_allowed" };
  const parsed = courseSchema.safeParse(formToObject(formData, ["name", "licenceClass", "lessonsTotal", "lessonMinutes", "fee"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.addCourse(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings");
  return { done: true };
}

export async function addInstructorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  if (!(await requireManager())) return { error: "not_allowed" };
  const parsed = instructorSchema.safeParse(formToObject(formData, ["name", "phone"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.path[0] === "phone" ? "phone" : "form" };
  const result = await driving.addInstructor(parsed.data.name, parsed.data.phone);
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings");
  return { done: true };
}

export async function addVehicleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  if (!(await requireManager())) return { error: "not_allowed" };
  const parsed = vehicleSchema.safeParse(formToObject(formData, ["plate", "label"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.addVehicle(parsed.data.plate, parsed.data.label);
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings");
  return { done: true };
}

async function toggle(table: "dr_courses" | "dr_instructors" | "dr_vehicles", formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = toggleSchema.safeParse(formToObject(formData, ["id", "active"]));
  if (!parsed.success) return { error: "form" };
  const result = await driving.setActive(table, parsed.data.id, parsed.data.active === "true");
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings");
  return { done: true };
}

export async function toggleCourseAction(_prev: ActionState, formData: FormData) {
  return toggle("dr_courses", formData);
}
export async function toggleInstructorAction(_prev: ActionState, formData: FormData) {
  return toggle("dr_instructors", formData);
}
export async function toggleVehicleAction(_prev: ActionState, formData: FormData) {
  return toggle("dr_vehicles", formData);
}

export async function loadDemoDataAction(): Promise<ActionState> {
  await requireLogin();
  const result = await driving.loadDemoData();
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  revalidatePath("/settings");
  return { done: true };
}
