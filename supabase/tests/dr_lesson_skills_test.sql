-- dr_lesson_skills test. Run with Supabase `execute_sql`; it RAISES so everything rolls back.
do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  ta uuid; tb uuid; ca uuid; ia uuid; va uuid; ea uuid; l1 uuid; l2 uuid; l3 uuid;
  r text := ''; n int; s text[]; msg text;
  t0 timestamptz := date_trunc('hour', now()) + interval '2 days';
begin
  insert into auth.users(id, aud, role, email) values
    (ua,'authenticated','authenticated','dr-sk-a@test.invalid'),(ub,'authenticated','authenticated','dr-sk-b@test.invalid'),(uc,'authenticated','authenticated','dr-sk-c@test.invalid');
  insert into public.tenants(name, vertical) values ('SK A','driving') returning id into ta;
  insert into public.tenants(name, vertical) values ('SK B','driving') returning id into tb;
  insert into public.profiles(user_id, tenant_id, full_name, role) values (ua, ta, 'A owner','owner'), (ub, tb, 'B owner','owner'), (uc, ta, 'A instructor desk','staff');

  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  insert into public.dr_courses(name, lessons_total, fee, lesson_minutes) values ('A course', 3, 900, 60) returning id into ca;
  insert into public.dr_instructors(name) values ('A instr') returning id into ia;
  insert into public.dr_vehicles(plate) values ('A-1') returning id into va;
  ea := public.dr_enroll('Student A','0911000001',ca,current_date,null,null,900,'cash');
  l1 := public.dr_book_lesson(ea, ia, va, t0);
  l2 := public.dr_book_lesson(ea, ia, va, t0 + interval '2 hours');
  l3 := public.dr_book_lesson(ea, ia, va, t0 + interval '4 hours');
  -- Move the first two lessons into the past as attended (setup only, as the table owner).
  reset role;
  update public.dr_lessons set starts_at = now() - interval '3 days', status = 'attended' where id = l1;
  update public.dr_lessons set starts_at = now() - interval '2 days', status = 'attended' where id = l2;
  perform set_config('role','authenticated', true);

  -- Staff (the desk / instructor) ticks skills; duplicates collapse; the first lesson gains both.
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role','authenticated')::text, true);
  s := public.dr_set_lesson_skills(l1, array['mirrors','controls','mirrors']);
  r := r || 'lesson 1 gained=' || s::text || ' (expect {controls,mirrors}); ';
  s := public.dr_set_lesson_skills(l2, array['mirrors','parking']);
  r := r || 'lesson 2 gained=' || s::text || ' (expect {parking}); ';
  -- Saving again replaces the lesson's ticks.
  perform public.dr_set_lesson_skills(l1, array['controls']);
  select count(*) into n from public.dr_lesson_skills where lesson_id = l1; r := r || 'lesson 1 rows after edit=' || n || ' (expect 1); ';
  perform public.dr_set_lesson_skills(l1, array[]::text[]);
  select count(*) into n from public.dr_lesson_skills where lesson_id = l1; r := r || 'lesson 1 cleared=' || n || ' (expect 0); ';
  begin perform public.dr_set_lesson_skills(l3, array['mirrors']); msg := 'ran'; exception when others then msg := sqlerrm; end;
  r := r || 'scheduled lesson=' || msg || ' (expect lesson_not_attended); ';
  begin perform public.dr_set_lesson_skills(l2, array['flying']); msg := 'ran'; exception when others then msg := sqlerrm; end;
  r := r || 'unknown skill=' || msg || ' (expect bad_skill); ';
  begin insert into public.dr_lesson_skills(lesson_id, enrollment_id, skill) values (l2, ea, 'gears'); msg := 'ran';
  exception when others then msg := left(sqlerrm, 17); end;
  r := r || 'direct insert=' || msg || ' (expect permission denied); ';
  select count(*) into n from public.dr_lesson_skills; r := r || 'school sees=' || n || ' (expect 2); ';

  -- Another school sees nothing and cannot tick A's lessons.
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  select count(*) into n from public.dr_lesson_skills; r := r || 'B sees=' || n || ' (expect 0); ';
  begin perform public.dr_set_lesson_skills(l2, array['gears']); msg := 'ran'; exception when others then msg := sqlerrm; end;
  r := r || 'B ticks A lesson=' || msg || ' (expect lesson_not_found); ';

  perform set_config('role','anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin select count(*) into n from public.dr_lesson_skills; msg := n::text; exception when others then msg := left(sqlerrm, 17); end;
  r := r || 'anon read=' || msg || ' (expect permission denied); ';
  begin perform public.dr_set_lesson_skills(l2, array['gears']); msg := 'ran'; exception when others then msg := left(sqlerrm, 17); end;
  r := r || 'anon tick=' || msg || ' (expect permission denied); ';
  raise exception 'DR_LESSON_SKILLS_TEST_RESULTS: %', r;
end $$;
