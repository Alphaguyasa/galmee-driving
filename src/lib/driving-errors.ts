const KNOWN = [
  "name_required", "bad_date", "course_not_found", "bad_amount", "overpayment", "bad_installments", "bad_document",
  "already_enrolled", "enrollment_not_found", "enrollment_not_active", "instructor_not_found", "vehicle_not_found",
  "no_lessons_left", "student_busy", "instructor_busy", "vehicle_busy", "bad_status", "lesson_not_found",
  "lesson_cancelled", "lesson_in_future", "exam_pending", "exam_not_found", "exam_done", "not_allowed",
  "not_demo_tenant", "already_loaded",
] as const;

export type DrivingErrorKey = (typeof KNOWN)[number] | "generic" | "name_taken" | "plate_taken";

/** Turns a database error message into a translation key; anything unknown stays generic. */
export function drivingErrorKey(message: string | undefined): DrivingErrorKey {
  return KNOWN.find((code) => message?.includes(code)) ?? "generic";
}
