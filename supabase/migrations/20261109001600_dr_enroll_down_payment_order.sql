-- The installment plan is already net of the down payment, so the down payment must be recorded
-- before the plan exists; otherwise it is counted against the first installment as well.
create or replace function private.dr_enroll(
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

  if v_down > 0 then
    perform private.dr_apply_payment(v_tenant, v_row, v_down, coalesce(p_method, 'cash'), 'registration', null);
  end if;

  if v_rest > 0 then
    v_each := trunc(v_rest / v_count, 2);
    for n in 1..v_count loop
      insert into dr_installments(tenant_id, enrollment_id, seq, due_on, amount)
      values (v_tenant, v_row.id, n, (p_first_due + make_interval(months => n - 1))::date,
              case when n = v_count then v_rest - v_each * (v_count - 1) else v_each end);
    end loop;
  end if;
  return v_row.id;
end $$;
