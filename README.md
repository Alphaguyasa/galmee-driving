# Galmee Driving School

See every student's lessons, payments and exam date on one screen. Part of the Galmee family of business systems for Ethiopian small businesses; Amharic, Afaan Oromo and English, Ethiopian calendar, installable on Android.

## Features

- Student registration with paper checklist and installment plan
- Student board: lesson progress, balance, next lesson and exam at a glance
- Lesson schedule per instructor and vehicle, with double-booking protection
- Attendance, installment payments, exam dates and results
- Course packages, instructors and vehicles

## Setup

```sh
cp .env.example .env.local
npm ci
npm run dev
```

`.env.example` holds the public Supabase URL and publishable key. Server secrets live only in Supabase Edge Function secrets.

## Checks

```sh
npm run lint
npm test
npm run build
```

Database migrations are in `supabase/migrations`; the cross-tenant test is `supabase/tests/dr_rls_test.sql`.

## Deploy

Vercel, connected to this repository; set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
