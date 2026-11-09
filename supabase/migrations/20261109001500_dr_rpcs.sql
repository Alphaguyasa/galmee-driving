-- Galmee Driving School server logic. Writes run as private SECURITY DEFINER functions with explicit
-- tenant and role checks; each is exposed through a SECURITY INVOKER wrapper.

create function private.dr_require_tenant() returns uuid
language plpgsql stable set search_path = public, private as $$
declare v uuid := private.current_tenant();
begin
  if v is null then raise exception 'not_a_member' using errcode = '42501'; end if;
  return v;
end $$;
revoke all on function private.dr_require_tenant() from public, anon;
grant execute on function private.dr_require_tenant() to authenticated;

create function private.dr_lock_enrollment(p_enrollment uuid, p_tenant uuid) returns public.dr_enrollments
language plpgsql set search_path = public, private as $$
declare v dr_enrollments%rowtype;
begin
  select * into v from dr_enrollments where id = p_enrollment and tenant_id = p_tenant for update;
  if not found then raise exception 'enrollment_not_found'; end if;
  return v;
end $$;
revoke all on function private.dr_lock_enrollment(uuid, uuid) from public, anon, authenticated;

-- Records money against an enrollment (row already locked by the caller) and pays installments oldest first.
create function private.dr_apply_payment(
  p_tenant uuid, p_enrollment public.dr_enrollments, p_amount numeric, p_method pay_method, p_reference text, p_client_ref uuid
) returns uuid language plpgsql set search_path = public, private as $$
declare
  v_pay uuid;
  v_id uuid;
  v_left numeric := p_amount;
  v_take numeric;
  i record;
begin
  insert into payments(tenant_id, customer_id, amount, method, reference, ref_table, ref_id, user_id)
  values (p_tenant, p_enrollment.customer_id, p_amount, p_method, nullif(btrim(p_reference), ''), 'dr_enrollments', p_enrollment.id, auth.uid())
  returning id into v_pay;
  insert into credit_ledger(tenant_id, customer_id, type, amount, ref_table, ref_id, user_id)
  values (p_tenant, p_enrollment.customer_id, 'repayment', p_amount, 'dr_enrollments', p_enrollment.id, auth.uid());
  insert into dr_payments(tenant_id, enrollment_id, payment_id, amount, method, reference, client_ref)
  values (p_tenant, p_enrollment.id, v_pay, p_amount, p_method, nullif(btrim(p_reference), ''), p_client_ref) returning id into v_id;
  update dr_enrollments set paid_total = paid_total + p_amount where id = p_enrollment.id;
  for i in select id, amount - paid as open from dr_installments where enrollment_id = p_enrollment.id and paid < amount order by seq for update loop
    exit when v_left <= 0;
    v_take := least(v_left, i.open);
    update dr_installments set paid = paid + v_take where id = i.id;
    v_left := v_left - v_take;
  end loop;
  return v_id;
end $$;
revoke all on function private.dr_apply_payment(uuid, public.dr_enrollments, numeric, pay_method, text, uuid) from public, anon, authenticated;

-- Registers a student on a course: customer, fee as debt, document checklist, installment plan, down payment.
create function private.dr_enroll(
  p_name text, p_phone text, p_course uuid, p_start date, p_national_id text, p_documents text[],
  p_down numeric, p_method pay_method, p_installments int, p_first_due date, p_client_ref uuid
) returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_course dr_courses%rowtype;
  v_customer uuid;
  v_row dr_enrollments%rowtype;
  v_id uuid;
  v_down numeric := coalesce(p_down, 0);
  v_rest numeric;
  v_each numeric;
  v_count int := coalesce(p_installments, 0);
  n int;
begin
  if p_client_ref is not null then
    select id into v_id from dr_enrollments where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if coalesce(char_length(btrim(p_name)), 0) < 2 then raise exception 'name_required'; end if;
  if p_start is null then raise exception 'bad_date'; end if;
  select * into v_course from dr_courses where id = p_course and tenant_id = v_tenant and active;
  if not found then raise exception 'course_not_found'; end if;
  if v_down < 0 then raise exception 'bad_amount'; end if;
  if v_down > v_course.fee then raise exception 'overpayment'; end if;
  v_rest := v_course.fee - v_down;
  if v_rest > 0 and (v_count < 1 or v_count > 24 or p_first_due is null) then raise exception 'bad_installments'; end if;
  if p_documents is not null and not p_documents <@ array['id_card','photo','medical','education'] then raise exception 'bad_document'; end if;

  if p_phone is not null then
    perform pg_advisory_xact_lock(hashtext('dr_customer:' || v_tenant::text || p_phone));
    select id into v_customer from customers where tenant_id = v_tenant and phone = p_phone order by created_at limit 1;
  end if;
  if v_customer is null then
    insert into customers(tenant_id, name, phone) values (v_tenant, btrim(p_name), p_phone) returning id into v_customer;
  end if;
  if exists (select 1 from dr_enrollments where customer_id = v_customer and course_id = p_course and status = 'active') then
    raise exception 'already_enrolled';
  end if;

  insert into dr_enrollments(tenant_id, customer_id, course_id, national_id, start_on, fee, lessons_total, lesson_minutes, client_ref)
  values (v_tenant, v_customer, p_course, nullif(btrim(p_national_id), ''), p_start, v_course.fee, v_course.lessons_total, v_course.lesson_minutes, p_client_ref)
  returning * into v_row;

  if v_course.fee > 0 then
    insert into credit_ledger(tenant_id, customer_id, type, amount, due_date, ref_table, ref_id, user_id)
    values (v_tenant, v_customer, 'debt', v_course.fee, p_first_due, 'dr_enrollments', v_row.id, auth.uid());
  end if;

  if p_documents is not null then
    insert into dr_documents(tenant_id, enrollment_id, kind)
    select v_tenant, v_row.id, d from unnest(p_documents) d group by d;
  end if;

  if v_rest > 0 then
    v_each := trunc(v_rest / v_count, 2);
    for n in 1..v_count loop
      insert into dr_installments(tenant_id, enrollment_id, seq, due_on, amount)
      values (v_tenant, v_row.id, n, (p_first_due + make_interval(months => n - 1))::date,
              case when n = v_count then v_rest - v_each * (v_count - 1) else v_each end);
    end loop;
  end if;

  if v_down > 0 then
    perform private.dr_apply_payment(v_tenant, v_row, v_down, coalesce(p_method, 'cash'), 'registration', null);
  end if;
  return v_row.id;
end $$;

create function private.dr_pay(p_enrollment uuid, p_amount numeric, p_method pay_method, p_reference text, p_client_ref uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_row dr_enrollments%rowtype;
  v_id uuid;
begin
  if p_client_ref is not null then
    select id into v_id from dr_payments where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  v_row := private.dr_lock_enrollment(p_enrollment, v_tenant);
  -- A retry that waited on the row lock must still see the first attempt.
  if p_client_ref is not null then
    select id into v_id from dr_payments where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if p_amount > v_row.balance then raise exception 'overpayment'; end if;
  return private.dr_apply_payment(v_tenant, v_row, p_amount, p_method, p_reference, p_client_ref);
end $$;

-- Books a lesson. Instructor and vehicle each take a row in core bookings, whose exclusion constraint
-- is what actually stops a double booking.
create function private.dr_book_lesson(p_enrollment uuid, p_instructor uuid, p_vehicle uuid, p_starts_at timestamptz, p_client_ref uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_row dr_enrollments%rowtype;
  v_id uuid;
  v_end timestamptz;
  v_used int;
  v_ib uuid;
  v_vb uuid;
begin
  if p_client_ref is not null then
    select id into v_id from dr_lessons where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if p_starts_at is null then raise exception 'bad_date'; end if;
  v_row := private.dr_lock_enrollment(p_enrollment, v_tenant);
  if p_client_ref is not null then
    select id into v_id from dr_lessons where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if v_row.status <> 'active' then raise exception 'enrollment_not_active'; end if;
  if not exists (select 1 from dr_instructors where id = p_instructor and tenant_id = v_tenant and active) then raise exception 'instructor_not_found'; end if;
  if p_vehicle is not null and not exists (select 1 from dr_vehicles where id = p_vehicle and tenant_id = v_tenant and active) then raise exception 'vehicle_not_found'; end if;
  select count(*) into v_used from dr_lessons where enrollment_id = p_enrollment and status in ('scheduled','attended');
  if v_used >= v_row.lessons_total then raise exception 'no_lessons_left'; end if;
  v_end := p_starts_at + make_interval(mins => v_row.lesson_minutes);
  if exists (
    select 1 from dr_lessons where enrollment_id = p_enrollment and status = 'scheduled'
    and tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, v_end)
  ) then raise exception 'student_busy'; end if;

  begin
    insert into bookings(tenant_id, resource_type, resource_id, customer_id, starts_at, ends_at)
    values (v_tenant, 'dr_instructor', p_instructor, v_row.customer_id, p_starts_at, v_end) returning id into v_ib;
  exception when exclusion_violation then raise exception 'instructor_busy'; end;
  if p_vehicle is not null then
    begin
      insert into bookings(tenant_id, resource_type, resource_id, customer_id, starts_at, ends_at)
      values (v_tenant, 'dr_vehicle', p_vehicle, v_row.customer_id, p_starts_at, v_end) returning id into v_vb;
    exception when exclusion_violation then raise exception 'vehicle_busy'; end;
  end if;

  insert into dr_lessons(tenant_id, enrollment_id, instructor_id, vehicle_id, starts_at, ends_at, instructor_booking_id, vehicle_booking_id, client_ref)
  values (v_tenant, p_enrollment, p_instructor, p_vehicle, p_starts_at, v_end, v_ib, v_vb, p_client_ref)
  returning id into v_id;
  return v_id;
end $$;

-- Attendance. Corrections between attended and missed are for owner or manager; a cancelled lesson stays cancelled.
create function private.dr_mark_lesson(p_lesson uuid, p_status text)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_role user_role := private.current_app_role();
  v_lesson dr_lessons%rowtype;
  v_booking text;
begin
  if p_status not in ('attended','missed','cancelled') then raise exception 'bad_status'; end if;
  select * into v_lesson from dr_lessons where id = p_lesson and tenant_id = v_tenant for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if v_lesson.status = 'cancelled' then raise exception 'lesson_cancelled'; end if;
  if v_lesson.status = p_status then return; end if;
  if v_lesson.status <> 'scheduled' and v_role not in ('owner','manager') then raise exception 'not_allowed'; end if;
  if p_status in ('attended','missed') and v_lesson.starts_at > now() then raise exception 'lesson_in_future'; end if;
  v_booking := case p_status when 'attended' then 'done' when 'missed' then 'no_show' else 'cancelled' end;
  update dr_lessons set status = p_status, marked_at = now(), marked_by = auth.uid() where id = p_lesson;
  update bookings set status = v_booking where id in (v_lesson.instructor_booking_id, v_lesson.vehicle_booking_id);
end $$;

create function private.dr_add_exam(p_enrollment uuid, p_kind text, p_exam_on date, p_place text, p_client_ref uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_row dr_enrollments%rowtype;
  v_id uuid;
begin
  if p_client_ref is not null then
    select id into v_id from dr_exams where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if p_kind not in ('theory','practical') then raise exception 'bad_status'; end if;
  if p_exam_on is null then raise exception 'bad_date'; end if;
  v_row := private.dr_lock_enrollment(p_enrollment, v_tenant);
  if v_row.status <> 'active' then raise exception 'enrollment_not_active'; end if;
  if exists (select 1 from dr_exams where enrollment_id = p_enrollment and kind = p_kind and result = 'pending') then raise exception 'exam_pending'; end if;
  insert into dr_exams(tenant_id, enrollment_id, kind, exam_on, place, client_ref)
  values (v_tenant, p_enrollment, p_kind, p_exam_on, nullif(btrim(p_place), ''), p_client_ref) returning id into v_id;
  return v_id;
end $$;

-- A passed practical exam finishes the course.
create function private.dr_exam_result(p_exam uuid, p_result text)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_exam dr_exams%rowtype;
  v_row dr_enrollments%rowtype;
begin
  if p_result not in ('passed','failed') then raise exception 'bad_status'; end if;
  select * into v_exam from dr_exams where id = p_exam and tenant_id = v_tenant for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_exam.result <> 'pending' then raise exception 'exam_done'; end if;
  v_row := private.dr_lock_enrollment(v_exam.enrollment_id, v_tenant);
  update dr_exams set result = p_result where id = p_exam;
  if p_result = 'passed' and v_exam.kind = 'practical' and v_row.status = 'active' then
    update dr_enrollments set status = 'completed' where id = v_row.id;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'dr_enroll(text,text,uuid,date,text,text[],numeric,pay_method,int,date,uuid)',
    'dr_pay(uuid,numeric,pay_method,text,uuid)',
    'dr_book_lesson(uuid,uuid,uuid,timestamptz,uuid)',
    'dr_mark_lesson(uuid,text)',
    'dr_add_exam(uuid,text,date,text,uuid)',
    'dr_exam_result(uuid,text)'
  ] loop
    execute format('revoke all on function private.%s from public, anon', f);
    execute format('grant execute on function private.%s to authenticated', f);
  end loop;
end $$;

create function public.dr_enroll(
  p_name text, p_phone text, p_course uuid, p_start date, p_national_id text default null, p_documents text[] default null,
  p_down numeric default 0, p_method pay_method default 'cash', p_installments int default 0, p_first_due date default null, p_client_ref uuid default null
) returns uuid language sql security invoker set search_path = public, private as
$$ select private.dr_enroll(p_name, p_phone, p_course, p_start, p_national_id, p_documents, p_down, p_method, p_installments, p_first_due, p_client_ref) $$;
create function public.dr_pay(p_enrollment uuid, p_amount numeric, p_method pay_method default 'cash', p_reference text default null, p_client_ref uuid default null)
returns uuid language sql security invoker set search_path = public, private as $$ select private.dr_pay(p_enrollment, p_amount, p_method, p_reference, p_client_ref) $$;
create function public.dr_book_lesson(p_enrollment uuid, p_instructor uuid, p_vehicle uuid, p_starts_at timestamptz, p_client_ref uuid default null)
returns uuid language sql security invoker set search_path = public, private as $$ select private.dr_book_lesson(p_enrollment, p_instructor, p_vehicle, p_starts_at, p_client_ref) $$;
create function public.dr_mark_lesson(p_lesson uuid, p_status text)
returns void language sql security invoker set search_path = public, private as $$ select private.dr_mark_lesson(p_lesson, p_status) $$;
create function public.dr_add_exam(p_enrollment uuid, p_kind text, p_exam_on date, p_place text default null, p_client_ref uuid default null)
returns uuid language sql security invoker set search_path = public, private as $$ select private.dr_add_exam(p_enrollment, p_kind, p_exam_on, p_place, p_client_ref) $$;
create function public.dr_exam_result(p_exam uuid, p_result text)
returns void language sql security invoker set search_path = public, private as $$ select private.dr_exam_result(p_exam, p_result) $$;

revoke all on function public.dr_enroll(text,text,uuid,date,text,text[],numeric,pay_method,int,date,uuid),
  public.dr_pay(uuid,numeric,pay_method,text,uuid), public.dr_book_lesson(uuid,uuid,uuid,timestamptz,uuid),
  public.dr_mark_lesson(uuid,text), public.dr_add_exam(uuid,text,date,text,uuid), public.dr_exam_result(uuid,text) from public, anon;
grant execute on function public.dr_enroll(text,text,uuid,date,text,text[],numeric,pay_method,int,date,uuid),
  public.dr_pay(uuid,numeric,pay_method,text,uuid), public.dr_book_lesson(uuid,uuid,uuid,timestamptz,uuid),
  public.dr_mark_lesson(uuid,text), public.dr_add_exam(uuid,text,date,text,uuid), public.dr_exam_result(uuid,text) to authenticated;
