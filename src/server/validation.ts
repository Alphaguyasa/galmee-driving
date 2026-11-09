import { z } from "zod";

export const MIN_PASSWORD = 10;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().max(128),
});

export const signupSchema = credentialsSchema.extend({
  password: z.string().min(MIN_PASSWORD).max(128),
});

// Ethiopian mobile/landline: 09xxxxxxxx, 07xxxxxxxx or +2519xxxxxxxx; spaces and dashes allowed.
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+251|0)[1-9]\d{8}$/));

export const onboardingSchema = z.object({
  schoolName: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
});

export function formToObject(formData: FormData, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k) ?? ""]));
}

const uuid = z.string().uuid();
const money = z.coerce.number().positive().max(100_000_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined);
const optionalUuid = z.union([z.literal(""), uuid]).transform((v) => v || undefined);
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDay = z.union([z.literal(""), day]).transform((v) => v || undefined);
const optionalPhone = z.union([z.literal(""), phoneSchema]).transform((v) => v || undefined);

export const uuidParam = uuid;
export const searchParam = z.string().trim().max(60);

export const PAY_METHODS = ["cash", "telebirr", "cbe_birr", "bank", "other"] as const;
export const DOCUMENT_KINDS = ["id_card", "photo", "medical", "education"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const LESSON_MARKS = ["attended", "missed", "cancelled"] as const;
export const EXAM_KINDS = ["theory", "practical"] as const;

export const enrollSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optionalPhone,
  nationalId: optionalText(40),
  course: uuid,
  start: day,
  down: z.union([z.literal(""), z.coerce.number().min(0).max(100_000_000)]).transform((v) => (v === "" ? 0 : v)),
  method: z.enum(PAY_METHODS),
  installments: z.coerce.number().int().min(0).max(24),
  firstDue: optionalDay,
  documents: z.array(z.enum(DOCUMENT_KINDS)).max(4),
  clientRef: uuid,
});

export const paySchema = z.object({
  enrollment: uuid,
  amount: money,
  method: z.enum(PAY_METHODS),
  reference: optionalText(80),
  clientRef: uuid,
});

export const bookLessonSchema = z.object({
  enrollment: uuid,
  instructor: uuid,
  vehicle: optionalUuid,
  date: day,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  clientRef: uuid,
});

export const markLessonSchema = z.object({ lesson: uuid, status: z.enum(LESSON_MARKS) });

export const addExamSchema = z.object({
  enrollment: uuid,
  kind: z.enum(EXAM_KINDS),
  examOn: day,
  place: optionalText(120),
  clientRef: uuid,
});

export const examResultSchema = z.object({ exam: uuid, result: z.enum(["passed", "failed"]) });

export const documentSchema = z.object({
  enrollment: uuid,
  kind: z.enum(DOCUMENT_KINDS),
  received: z.enum(["true", "false"]),
});

export const courseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  licenceClass: optionalText(40),
  lessonsTotal: z.coerce.number().int().min(1).max(500),
  lessonMinutes: z.coerce.number().int().min(15).max(240),
  fee: z.coerce.number().min(0).max(100_000_000),
});

export const instructorSchema = z.object({ name: z.string().trim().min(2).max(120), phone: optionalPhone });
export const vehicleSchema = z.object({ plate: z.string().trim().min(2).max(20), label: optionalText(60) });
export const toggleSchema = z.object({ id: uuid, active: z.enum(["true", "false"]) });
