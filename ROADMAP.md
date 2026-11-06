# ROADMAP: Galmee Driving School

## M0: Foundation (shared pattern for all Galmee products)

- [ ] Next.js App Router + TS + Tailwind + shadcn/ui scaffold; `npm run build` passes
- [ ] PWA manifest, icons, offline shell; installs from Android Chrome
- [ ] Supabase client (`@supabase/ssr`) with `.env.example` values; middleware session refresh
- [ ] Auth: sign up, log in, log out; after first signup call `create_tenant` (vertical `driving`)
- [ ] next-intl with `am`, `om`, `en`; language switcher; Ethiopic-friendly font (Noto Sans Ethiopic)
- [ ] Ethiopian calendar date display helper + tests
- [ ] App shell: bottom navigation on mobile, sidebar on desktop, tenant name and logo
- [ ] Staff management (owner only): invite staff, set role
- [ ] Generated Supabase TypeScript types committed

## M1: Core screens

- [ ] Customers: list, search by name/phone, detail with balance
- [ ] Items and stock (if this product uses stock): list, add, receive stock
- [ ] Payments and credit: record payment, credit statement
- [ ] Reports: today / this week / this Ethiopian month; export CSV
- [ ] Offline queue for the main money action with sync status indicator

## M2: Galmee Driving School features

- [ ] Student registration with documents
- [ ] Course packages
- [ ] Lesson schedule per instructor and vehicle
- [ ] Attendance
- [ ] Installment payments
- [ ] Exam date tracking
- [ ] Migration: dr_courses
- [ ] Migration: dr_enrollments
- [ ] Migration: dr_instructors
- [ ] Migration: dr_lessons
- [ ] Migration: dr_installments
- [ ] Migration: dr_exams
- [ ] Remaining balance per student
- [ ] Lessons use core `bookings` so an instructor or vehicle cannot be double-booked

## M3: Notifications

- [ ] SMS lesson reminder
- [ ] SMS installment due
- [ ] Exam date reminder
- [ ] Edge Function reads `notifications` queue and sends (needs AfroMessage/Telegram keys: ask in NEEDS_APPROVAL.md)

## M4: Demo ready

- [ ] Demo tenant "Galmee Driving School Demo" with data: 3 course packages, 5 instructors, 4 vehicles, 60 students
- [ ] Demo login documented in NEEDS_APPROVAL.md for Alpha (password set by Alpha, never committed)
- [ ] 5-minute demo path works on a phone in airplane mode for the main action
- [ ] Amharic and Afaan Oromo text reviewed list in NEEDS_APPROVAL.md for Alpha (native speaker)

## M5: Client ready

- [ ] Receipt printing (58/80 mm thermal) and Telegram receipt
- [ ] Data import from Excel/CSV
- [ ] Export all tenant data to Excel
- [ ] Error monitoring hook (Sentry, DSN via env)
- [ ] README: setup, env vars, deploy steps

## Q: Quality and security baseline (do these inside M0 and M1, not after)

- [ ] `docs/DESIGN.md` written per `docs/FRONTEND.md` and the `frontend-design` skill (palette, type with Ethiopic support, layout wireframes, reviewed against generic defaults)
- [ ] Tailwind theme tokens and `next/font` fonts from DESIGN.md
- [ ] `server-only` Data Access Layer in `src/server/dal/`; every Server Action validates with zod and re-checks auth + role
- [ ] Security headers and CSP with nonce (SECURITY.md section 5)
- [ ] Cross-tenant RLS test extended to this product's tables and passing
- [ ] Playwright screenshot script for 360 px and 1280 px (`webapp-testing` skill)
- [ ] `npm audit` clean, Dependabot active
- [ ] Self-audit (SECURITY.md section 9) recorded in DAILY_LOG.md
