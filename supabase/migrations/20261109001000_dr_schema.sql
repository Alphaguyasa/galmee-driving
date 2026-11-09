-- Galmee Driving School schema: courses, instructors, vehicles, enrollments, lessons,
-- installments, payments, exams, document checklist.
-- Enrollments, lessons, installments, payments and exams are written only through RPCs (see dr_rpcs migration).

create table public.dr_courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  licence_class text check (char_length(licence_class) <= 40),
  lessons_total int not null check (lessons_total between 1 and 500),
  lesson_minutes int not null default 60 check (lesson_minutes between 15 and 240),
  fee numeric(12,2) not null check (fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create table public.dr_instructors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  phone text check (char_length(phone) <= 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create table public.dr_vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  plate text not null check (char_length(btrim(plate)) between 2 and 20),
  label text check (char_length(label) <= 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, plate),
  unique (tenant_id, id)
);

create table public.dr_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  course_id uuid not null,
  national_id text check (char_length(national_id) <= 40),
  start_on date not null,
  fee numeric(12,2) not null check (fee >= 0),
  lessons_total int not null check (lessons_total > 0),
  lesson_minutes int not null check (lesson_minutes > 0),
  paid_total numeric(12,2) not null default 0 check (paid_total >= 0),
  balance numeric(12,2) generated always as (fee - paid_total) stored,
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  client_ref uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (paid_total <= fee),
  unique (tenant_id, client_ref),
  unique (tenant_id, id),
  foreign key (tenant_id, course_id) references public.dr_courses(tenant_id, id)
);
create index dr_enrollments_customer_idx on public.dr_enrollments (customer_id);
create index dr_enrollments_course_idx on public.dr_enrollments (tenant_id, course_id);
create unique index dr_enrollments_one_active on public.dr_enrollments (customer_id, course_id) where status = 'active';

create table public.dr_lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  enrollment_id uuid not null,
  instructor_id uuid not null,
  vehicle_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','attended','missed','cancelled')),
  instructor_booking_id uuid references public.bookings(id),
  vehicle_booking_id uuid references public.bookings(id),
  client_ref uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  marked_at timestamptz,
  marked_by uuid,
  check (ends_at > starts_at),
  unique (tenant_id, client_ref),
  unique (tenant_id, id),
  foreign key (tenant_id, enrollment_id) references public.dr_enrollments(tenant_id, id),
  foreign key (tenant_id, instructor_id) references public.dr_instructors(tenant_id, id),
  foreign key (tenant_id, vehicle_id) references public.dr_vehicles(tenant_id, id)
);
create index dr_lessons_enrollment_idx on public.dr_lessons (enrollment_id, starts_at);
create index dr_lessons_day_idx on public.dr_lessons (tenant_id, starts_at);
create index dr_lessons_instructor_idx on public.dr_lessons (tenant_id, instructor_id);
create index dr_lessons_vehicle_idx on public.dr_lessons (tenant_id, vehicle_id);
create index dr_lessons_instructor_booking_idx on public.dr_lessons (instructor_booking_id);
create index dr_lessons_vehicle_booking_idx on public.dr_lessons (vehicle_booking_id);

create table public.dr_installments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  enrollment_id uuid not null,
  seq int not null check (seq > 0),
  due_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid numeric(12,2) not null default 0 check (paid >= 0),
  check (paid <= amount),
  unique (enrollment_id, seq),
  foreign key (tenant_id, enrollment_id) references public.dr_enrollments(tenant_id, id)
);
create index dr_installments_tenant_enrollment_idx on public.dr_installments (tenant_id, enrollment_id);
create index dr_installments_due_idx on public.dr_installments (tenant_id, due_on) where paid < amount;

create table public.dr_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  enrollment_id uuid not null,
  payment_id uuid not null references public.payments(id),
  amount numeric(12,2) not null check (amount > 0),
  method public.pay_method not null,
  reference text check (char_length(reference) <= 80),
  client_ref uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (tenant_id, client_ref),
  foreign key (tenant_id, enrollment_id) references public.dr_enrollments(tenant_id, id)
);
create index dr_payments_enrollment_idx on public.dr_payments (tenant_id, enrollment_id, created_at desc);
create index dr_payments_payment_idx on public.dr_payments (payment_id);

create table public.dr_exams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  enrollment_id uuid not null,
  kind text not null check (kind in ('theory','practical')),
  exam_on date not null,
  place text check (char_length(place) <= 120),
  result text not null default 'pending' check (result in ('pending','passed','failed')),
  client_ref uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (tenant_id, client_ref),
  foreign key (tenant_id, enrollment_id) references public.dr_enrollments(tenant_id, id)
);
create index dr_exams_enrollment_idx on public.dr_exams (tenant_id, enrollment_id, exam_on);
create index dr_exams_upcoming_idx on public.dr_exams (tenant_id, exam_on) where result = 'pending';
create unique index dr_exams_one_pending on public.dr_exams (enrollment_id, kind) where result = 'pending';

-- Papers a student has handed in. A row means the paper is with the school.
create table public.dr_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  enrollment_id uuid not null,
  kind text not null check (kind in ('id_card','photo','medical','education')),
  received_at timestamptz not null default now(),
  received_by uuid default auth.uid(),
  unique (enrollment_id, kind),
  foreign key (tenant_id, enrollment_id) references public.dr_enrollments(tenant_id, id)
);
create index dr_documents_tenant_enrollment_idx on public.dr_documents (tenant_id, enrollment_id);

alter table public.dr_courses enable row level security;
alter table public.dr_instructors enable row level security;
alter table public.dr_vehicles enable row level security;
alter table public.dr_enrollments enable row level security;
alter table public.dr_lessons enable row level security;
alter table public.dr_installments enable row level security;
alter table public.dr_payments enable row level security;
alter table public.dr_exams enable row level security;
alter table public.dr_documents enable row level security;

revoke all on public.dr_courses, public.dr_instructors, public.dr_vehicles, public.dr_enrollments, public.dr_lessons,
  public.dr_installments, public.dr_payments, public.dr_exams, public.dr_documents from anon;
revoke insert, update, delete, truncate on public.dr_enrollments, public.dr_lessons, public.dr_installments, public.dr_payments, public.dr_exams from authenticated;
revoke update, truncate on public.dr_documents from authenticated;
revoke delete, truncate on public.dr_courses, public.dr_instructors, public.dr_vehicles from authenticated;

create policy dr_courses_sel on public.dr_courses for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_courses_ins on public.dr_courses for insert to authenticated
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));
create policy dr_courses_upd on public.dr_courses for update to authenticated
  using (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'))
  with check (tenant_id = (select private.current_tenant()));

create policy dr_instructors_sel on public.dr_instructors for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_instructors_ins on public.dr_instructors for insert to authenticated
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));
create policy dr_instructors_upd on public.dr_instructors for update to authenticated
  using (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'))
  with check (tenant_id = (select private.current_tenant()));

create policy dr_vehicles_sel on public.dr_vehicles for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_vehicles_ins on public.dr_vehicles for insert to authenticated
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));
create policy dr_vehicles_upd on public.dr_vehicles for update to authenticated
  using (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'))
  with check (tenant_id = (select private.current_tenant()));

create policy dr_enrollments_sel on public.dr_enrollments for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_lessons_sel on public.dr_lessons for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_installments_sel on public.dr_installments for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_payments_sel on public.dr_payments for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_exams_sel on public.dr_exams for select to authenticated using (tenant_id = (select private.current_tenant()));

create policy dr_documents_sel on public.dr_documents for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy dr_documents_ins on public.dr_documents for insert to authenticated with check (tenant_id = (select private.current_tenant()));
create policy dr_documents_del on public.dr_documents for delete to authenticated using (tenant_id = (select private.current_tenant()));

-- One line per student: the lessons, money and exam date on one screen.
create view public.dr_student_board with (security_invoker = true) as
select
  e.id, e.tenant_id, e.customer_id, c.name as student_name, c.phone as student_phone,
  co.name as course_name, e.status, e.start_on, e.fee, e.paid_total, e.balance, e.lessons_total,
  l.attended as lessons_attended, l.booked as lessons_booked, l.next_lesson_at,
  x.exam_on as next_exam_on, x.kind as next_exam_kind,
  i.next_due_on, coalesce(i.overdue, 0) as overdue
from public.dr_enrollments e
join public.customers c on c.id = e.customer_id
join public.dr_courses co on co.id = e.course_id
cross join lateral (
  select count(*) filter (where status = 'attended')::int as attended,
         count(*) filter (where status = 'scheduled')::int as booked,
         min(starts_at) filter (where status = 'scheduled' and starts_at >= now()) as next_lesson_at
  from public.dr_lessons where enrollment_id = e.id
) l
left join lateral (
  select exam_on, kind from public.dr_exams
  where enrollment_id = e.id and result = 'pending' order by exam_on limit 1
) x on true
left join lateral (
  select min(due_on) as next_due_on,
         sum(amount - paid) filter (where due_on < (now() at time zone 'Africa/Addis_Ababa')::date) as overdue
  from public.dr_installments where enrollment_id = e.id and paid < amount
) i on true;
revoke all on public.dr_student_board from anon;
grant select on public.dr_student_board to authenticated;
