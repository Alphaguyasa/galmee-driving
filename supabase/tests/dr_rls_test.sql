-- Cross-tenant RLS and workflow test for Galmee Driving School. Run with Supabase `execute_sql`.
-- Everything rolls back: the final RAISE carries the result line. Compare each value with its "expect".
do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  ta uuid; tb uuid; ca uuid; cb uuid; ia uuid; ib uuid; i2 uuid; va uuid; vb uuid; ea uuid; eb uuid; e2 uuid; la uuid; lf uuid; xa uuid; n int; r text := ''; ok boolean; err text; v numeric; s text;
  t0 timestamptz := date_trunc('hour', now()) + interval '2 days';
  ref uuid := '33333333-3333-3333-3333-333333333333';
begin
  insert into auth.users(id, aud, role, email) values
    (ua,'authenticated','authenticated','dr-a@test.invalid'),(ub,'authenticated','authenticated','dr-b@test.invalid'),(uc,'authenticated','authenticated','dr-c@test.invalid');
  insert into public.tenants(name, vertical) values ('DR A','driving') returning id into ta;
  insert into public.tenants(name, vertical) values ('DR B','driving') returning id into tb;
  insert into public.profiles(user_id, tenant_id, full_name, role) values (ua, ta, 'A owner','owner'), (ub, tb, 'B owner','owner'), (uc, ta, 'A desk','staff');

  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  insert into public.dr_courses(name, lessons_total, fee) values ('B course', 2, 1000) returning id into cb;
  insert into public.dr_instructors(name) values ('B instr') returning id into ib;
  insert into public.dr_vehicles(plate) values ('B-1') returning id into vb;
  eb := public.dr_enroll('Student B','0911000002',cb,current_date,null,null,1000,'cash');

  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role','authenticated')::text, true);
  begin insert into public.dr_courses(name, lessons_total, fee) values ('Staff course', 1, 10); ok := true; exception when others then ok := false; end;
  r := r || 'staff create course=' || ok || ' (expect false); ';

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  insert into public.dr_courses(name, lessons_total, fee, lesson_minutes) values ('A course', 2, 900.10, 60) returning id into ca;
  insert into public.dr_instructors(name) values ('A instr') returning id into ia;
  insert into public.dr_instructors(name) values ('A instr 2') returning id into i2;
  insert into public.dr_vehicles(plate) values ('A-1') returning id into va;

  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role','authenticated')::text, true);
  ea := public.dr_enroll('Student A','0911000001',ca,current_date,'ID1',array['photo','photo','medical'],100,'cash',3,current_date + 10,ref);
  r := r || 'enroll idempotent=' || (public.dr_enroll('Student A','0911000001',ca,current_date,'ID1',null,100,'cash',3,current_date + 10,ref) = ea) || ' (expect true); ';
  begin perform public.dr_enroll('Student A again','0911000001',ca,current_date,null,null,900.10); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'duplicate active=' || ok || ' err=' || err || ' (expect false, already_enrolled); ';
  select balance into v from public.dr_enrollments where id = ea; r := r || 'balance=' || v || ' (expect 800.10); ';
  select count(*), sum(amount) into n, v from public.dr_installments where enrollment_id = ea; r := r || 'installments=' || n || '/' || v || ' (expect 3/800.10); ';
  select count(*) into n from public.dr_documents where enrollment_id = ea; r := r || 'docs=' || n || ' (expect 2); ';
  select coalesce(sum(case type when 'debt' then amount else -amount end),0) into v from public.credit_ledger where ref_table='dr_enrollments' and ref_id=ea; r := r || 'ledger=' || v || ' (expect 800.10); ';
  begin perform public.dr_enroll('Short','0911000003',ca,current_date,null,null,100,'cash',0); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'no plan=' || ok || ' err=' || err || ' (expect false, bad_installments); ';

  perform public.dr_pay(ea, 300, 'telebirr', null, '44444444-4444-4444-4444-444444444444');
  perform public.dr_pay(ea, 300, 'telebirr', null, '44444444-4444-4444-4444-444444444444');
  select balance into v from public.dr_enrollments where id = ea; r := r || 'pay idempotent balance=' || v || ' (expect 500.10); ';
  select paid into v from public.dr_installments where enrollment_id = ea and seq = 1; r := r || 'inst1 paid=' || v || ' (expect 266.70, oldest first); ';
  select paid into v from public.dr_installments where enrollment_id = ea and seq = 2; r := r || 'inst2 paid=' || v || ' (expect 33.30); ';
  begin perform public.dr_pay(ea, 900); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'overpay=' || ok || ' err=' || err || ' (expect false, overpayment); ';

  e2 := public.dr_enroll('Student C','0911000004',ca,current_date,null,null,900.10);
  la := public.dr_book_lesson(ea, ia, va, t0);
  begin perform public.dr_book_lesson(e2, ia, null, t0 + interval '30 minutes'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'instructor double=' || ok || ' err=' || err || ' (expect false, instructor_busy); ';
  begin perform public.dr_book_lesson(e2, i2, va, t0 + interval '30 minutes'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'vehicle double=' || ok || ' err=' || err || ' (expect false, vehicle_busy); ';
  select count(*) into n from public.bookings where resource_id = i2; r := r || 'failed booking left no row=' || n || ' (expect 0); ';
  begin perform public.dr_book_lesson(ea, i2, null, t0 + interval '30 minutes'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'student double=' || ok || ' err=' || err || ' (expect false, student_busy); ';
  lf := public.dr_book_lesson(ea, ia, va, t0 + interval '2 hours');
  begin perform public.dr_book_lesson(ea, ia, va, t0 + interval '5 hours'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'lessons used up=' || ok || ' err=' || err || ' (expect false, no_lessons_left); ';
  begin perform public.dr_mark_lesson(la, 'attended'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'attend future=' || ok || ' err=' || err || ' (expect false, lesson_in_future); ';
  perform public.dr_mark_lesson(lf, 'cancelled');
  select status into s from public.bookings where id = (select instructor_booking_id from public.dr_lessons where id = lf); r := r || 'cancel frees booking=' || s || ' (expect cancelled); ';
  perform public.dr_book_lesson(e2, i2, va, t0 + interval '2 hours');
  begin perform public.dr_mark_lesson(lf, 'attended'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'attend cancelled=' || ok || ' err=' || err || ' (expect false, lesson_cancelled); ';

  xa := public.dr_add_exam(ea, 'practical', current_date + 20, 'Road office');
  begin perform public.dr_add_exam(ea, 'practical', current_date + 21); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'second pending exam=' || ok || ' err=' || err || ' (expect false, exam_pending); ';
  select next_exam_kind || '/' || lessons_booked || '/' || round(overdue) into s from public.dr_student_board where id = ea; r := r || 'board=' || s || ' (expect practical/1/0); ';
  perform public.dr_exam_result(xa, 'passed');
  select status into s from public.dr_enrollments where id = ea; r := r || 'passed practical=' || s || ' (expect completed); ';

  -- Writes that must go through RPCs.
  begin update public.dr_enrollments set paid_total = fee where id = ea; ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'direct money write=' || ok || ' (expect false); ';

  -- Other tenant sees nothing and can change nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  select count(*) into n from public.dr_student_board where tenant_id = ta; r := r || 'B reads A board=' || n || ' (expect 0); ';
  select count(*) into n from public.dr_courses where tenant_id = ta; r := r || 'B reads A courses=' || n || ' (expect 0); ';
  select count(*) into n from public.dr_lessons where tenant_id = ta; r := r || 'B reads A lessons=' || n || ' (expect 0); ';
  select count(*) into n from public.dr_payments where tenant_id = ta; r := r || 'B reads A payments=' || n || ' (expect 0); ';
  update public.dr_courses set fee = 1 where id = ca; get diagnostics n = row_count; r := r || 'B updates A course=' || n || ' (expect 0); ';
  begin perform public.dr_pay(ea, 1); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'B pays A=' || ok || ' err=' || err || ' (expect false, enrollment_not_found); ';
  begin perform public.dr_book_lesson(eb, ia, null, t0); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'B uses A instructor=' || ok || ' err=' || err || ' (expect false, instructor_not_found); ';
  begin perform public.dr_mark_lesson(la, 'cancelled'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'B marks A lesson=' || ok || ' err=' || err || ' (expect false, lesson_not_found); ';
  begin insert into public.dr_documents(enrollment_id, kind) values (ea, 'photo'); ok := true; exception when others then ok := false; end;
  r := r || 'B inserts doc on A=' || ok || ' (expect false); ';

  -- Anon.
  perform set_config('role','anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin select count(*) into n from public.dr_student_board; ok := true; exception when others then ok := false; end;
  r := r || 'anon board=' || ok || ' (expect false); ';
  begin perform public.dr_pay(ea, 1); ok := true; exception when others then ok := false; end;
  r := r || 'anon pay=' || ok || ' (expect false); ';

  raise exception 'RESULT: %', r;
end $$;
