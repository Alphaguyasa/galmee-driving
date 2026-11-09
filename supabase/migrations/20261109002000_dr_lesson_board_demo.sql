-- Flat lesson list for the schedule and the student card.
create view public.dr_lesson_board with (security_invoker = true) as
select l.id, l.tenant_id, l.enrollment_id, c.name as student_name, l.instructor_id, i.name as instructor_name,
       l.vehicle_id, v.plate as vehicle_plate, l.starts_at, l.ends_at, l.status
from public.dr_lessons l
join public.dr_enrollments e on e.id = l.enrollment_id
join public.customers c on c.id = e.customer_id
join public.dr_instructors i on i.id = l.instructor_id
left join public.dr_vehicles v on v.id = l.vehicle_id;
revoke all on public.dr_lesson_board from anon;
grant select on public.dr_lesson_board to authenticated;

-- Fills the demo school only: 3 courses, 5 instructors, 4 vehicles, 60 students with fictional names.
create function private.dr_load_demo() returns void
language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_name text;
  v_courses uuid[] := '{}';
  v_instr uuid[] := '{}';
  v_veh uuid[] := '{}';
  v_id uuid;
  v_fee numeric;
  v_total int;
  v_lessons int;
  v_down numeric;
  v_plan int;
  v_course int;
  v_today date := (now() at time zone 'Africa/Addis_Ababa')::date;
  v_first text[] := array['Hawi','Lensa','Bontu','Abdi','Gemechu','Tolera','Chaltu','Dawit','Selam','Yonas','Meron','Kedir','Hana','Biruk','Sifan'];
  v_father text[] := array['Tufa','Bekele','Ayana','Dinsa','Haile','Mengistu','Wako','Alemu'];
  v_method pay_method[] := array['cash','telebirr','cash','cbe_birr','bank']::pay_method[];
  c int := 0;
  f int := 0;
  g int;
  s int;
  n int;
  v_at timestamptz;
  v_l uuid;
begin
  select name into v_name from tenants where id = v_tenant;
  if v_name <> 'Galmee Driving School Demo' then raise exception 'not_demo_tenant'; end if;
  if private.current_app_role() <> 'owner' then raise exception 'not_allowed'; end if;
  if exists (select 1 from dr_courses where tenant_id = v_tenant) then raise exception 'already_loaded'; end if;

  with ins as (
    insert into dr_courses(tenant_id, name, licence_class, lessons_total, lesson_minutes, fee) values
      (v_tenant, 'Automobile', 'Automobile', 25, 60, 12500),
      (v_tenant, 'Public 1', 'Public 1', 30, 60, 16000),
      (v_tenant, 'Dry Cargo 1', 'Dry Cargo 1', 35, 60, 18500)
    returning id
  ) select array_agg(id) into v_courses from ins;
  with ins as (
    insert into dr_instructors(tenant_id, name, phone) values
      (v_tenant, 'Girma Tesfaye', '0911500001'), (v_tenant, 'Ayantu Bulti', '0911500002'),
      (v_tenant, 'Solomon Kebede', '0911500003'), (v_tenant, 'Obsa Guyo', '0911500004'),
      (v_tenant, 'Tigist Lemma', '0911500005')
    returning id
  ) select array_agg(id) into v_instr from ins;
  with ins as (
    insert into dr_vehicles(tenant_id, plate, label) values
      (v_tenant, '3-A 40217', 'Toyota Vitz'), (v_tenant, '3-A 51830', 'Suzuki Dzire'),
      (v_tenant, '3-A 62294', 'Toyota Corolla'), (v_tenant, '3-B 17065', 'Isuzu NPR')
    returning id
  ) select array_agg(id) into v_veh from ins;

  for s in 1..60 loop
    v_course := 1 + (s % 3);
    select fee, lessons_total into v_fee, v_total from dr_courses where id = v_courses[v_course];
    v_down := round(v_fee * ((s % 4) + 1) * 0.25, 2);
    v_plan := case when v_down >= v_fee then 0 else 3 end;
    v_id := private.dr_enroll(
      v_first[1 + (s % 15)] || ' ' || v_father[1 + (s % 8)] || case when s > 30 then ' ' || v_father[1 + (s % 7)] else '' end,
      '0916' || lpad(s::text, 6, '0'), v_courses[v_course], v_today - (20 + s), null,
      case when s % 3 = 0 then array['id_card','photo'] else array['id_card','photo','medical','education'] end,
      v_down, v_method[1 + (s % 5)], v_plan,
      case when v_plan > 0 then v_today - 25 + (s % 30) end, null);

    -- Attended lessons in the past: four cars per hour, eight hours a day, working back from yesterday.
    v_lessons := 2 + (s % 9);
    for n in 1..v_lessons loop
      g := c / 4;
      v_at := ((v_today - 1 - (g / 8))::timestamp + make_interval(hours => 8 + (g % 8))) at time zone 'Africa/Addis_Ababa';
      v_l := private.dr_book_lesson(v_id, v_instr[1 + ((g + c % 4) % 5)], v_veh[1 + (c % 4)], v_at, null);
      perform private.dr_mark_lesson(v_l, case when n % 9 = 0 then 'missed' else 'attended' end);
      c := c + 1;
    end loop;

    -- One upcoming lesson each.
    g := f / 4;
    v_at := ((v_today + 1 + (g / 8))::timestamp + make_interval(hours => 8 + (g % 8))) at time zone 'Africa/Addis_Ababa';
    perform private.dr_book_lesson(v_id, v_instr[1 + ((g + f % 4) % 5)], v_veh[1 + (f % 4)], v_at, null);
    f := f + 1;

    if s % 3 = 0 then
      perform private.dr_add_exam(v_id, 'theory', v_today + 3 + (s % 21), 'Shashamane transport office', null);
    end if;
    if s % 10 = 0 then
      perform private.dr_exam_result(private.dr_add_exam(v_id, 'practical', v_today - (s % 7) - 1, 'Shashamane transport office', null), 'passed');
    end if;
  end loop;
end $$;
revoke all on function private.dr_load_demo() from public, anon;
grant execute on function private.dr_load_demo() to authenticated;
create function public.dr_load_demo() returns void
language sql security invoker set search_path = public, private as $$ select private.dr_load_demo() $$;
revoke all on function public.dr_load_demo() from public, anon;
grant execute on function public.dr_load_demo() to authenticated;
