# ROADMAP: Galmee Driving School

## M0: Foundation (shared pattern for all Galmee products)

- [x] Next.js App Router + TS + Tailwind + shadcn/ui scaffold; `npm run build` passes
- [x] PWA manifest, icons, offline shell; installs from Android Chrome
- [x] Supabase client (`@supabase/ssr`) with `.env.example` values; middleware session refresh
- [x] Auth: sign up, log in, log out; after first signup call `create_tenant` (vertical `driving`)
- [x] next-intl with `am`, `om`, `en`; language switcher; Ethiopic-friendly font (Noto Sans Ethiopic)
- [x] Ethiopian calendar date display helper + tests
- [x] App shell: bottom navigation on mobile, sidebar on desktop, tenant name and logo
- [ ] Staff management (owner only): invite staff, set role
- [ ] Generated Supabase TypeScript types committed

## M1: Core screens

- [x] Customers: list, search by name/phone, detail with balance
- [x] Items and stock: not used by this product (a driving school sells courses, not stock)
- [x] Payments and credit: record payment, credit statement
- [ ] Reports: today / this week / this Ethiopian month; export CSV
- [ ] Offline queue for the main money action with sync status indicator

## M2: Galmee Driving School features

- [x] Student registration with document checklist
- [ ] Upload scanned student documents (Supabase Storage): one bucket and a list per student, nothing more (built in M-next)
- [x] Course packages
- [x] Lesson schedule per instructor and vehicle
- [x] Attendance
- [x] Installment payments
- [x] Exam date tracking
- [x] Migration: dr_courses
- [x] Migration: dr_enrollments
- [x] Migration: dr_instructors
- [x] Migration: dr_lessons
- [x] Migration: dr_installments
- [x] Migration: dr_exams
- [x] Remaining balance per student
- [x] Lessons use core `bookings` so an instructor or vehicle cannot be double-booked

## M-next: Tier 1 close-out

- [ ] Installment receipt layout + print/reprint
- [ ] Storage bucket + upload on student card (`dr_documents`)
- [ ] Fix the `dr_documents` delete policy while touching it

## M-after: Tier 2 and 3

- [ ] SMS templates: lesson reminder, installment due, exam date, into the notifications queue
- [ ] Collections + outstanding report by Ethiopian month, CSV
- [ ] Offline queue for `dr_pay`
- [ ] Owner Telegram: today's collections + students with lessons done but balance unpaid
- [ ] Instructor accounts + lesson-count report
- [ ] Pass-rate report per instructor

Out of scope: vehicle maintenance tracking (that belongs to a garage system). Demo data is complete; it is not extended further.

## M3: Notifications

- [ ] SMS lesson reminder
- [ ] SMS installment due
- [ ] Exam date reminder
- [ ] Edge Function reads `notifications` queue and sends (needs AfroMessage/Telegram keys: ask in the decision log)

## M4: Demo ready

- [ ] Demo tenant "Galmee Driving School Demo" with data: 3 course packages, 5 instructors, 4 vehicles, 60 students
- [ ] Demo login documented in the decision log for Alpha (password set by Alpha, never committed)
- [ ] 5-minute demo path works on a phone in airplane mode for the main action
- [ ] Amharic and Afaan Oromo text reviewed list in the decision log for Alpha (native speaker)

## M5: Client ready

- [ ] Receipt printing (58/80 mm thermal) and Telegram receipt
- [ ] Data import from Excel/CSV
- [ ] Export all tenant data to Excel
- [ ] Error monitoring hook (Sentry, DSN via env)
- [x] README: setup, env vars, deploy steps

## Q: Quality and security baseline (do these inside M0 and M1, not after)

- [x] `docs/DESIGN.md` written per the frontend guidelines (palette, type with Ethiopic support, layout wireframes, reviewed against generic defaults)
- [x] Tailwind theme tokens and `next/font` fonts from DESIGN.md
- [x] `server-only` Data Access Layer in `src/server/dal/`; every Server Action validates with zod and re-checks auth + role
- [x] Security headers and CSP with nonce (the security guidelines section 5)
- [x] Cross-tenant RLS test extended to this product's tables and passing
- [x] Playwright screenshot script for 360 px and 1280 px
- [x] `npm audit` clean, Dependabot active
- [ ] Self-audit (the security guidelines section 9) recorded in the dev log
