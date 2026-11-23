-- Skills a student showed in an attended lesson (mirrors, hill start, parking, ...).
-- Written only through dr_set_lesson_skills; everyone in the school can read them.
create table public.dr_lesson_skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  lesson_id uuid not null,
  enrollment_id uuid not null,
  skill text not null check (skill in ('controls','mirrors','steering','gears','reversing','hill_start','parking','traffic')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (lesson_id, skill),
  foreign key (tenant_id, lesson_id) references public.dr_lessons(tenant_id, id) on delete cascade,
  foreign key (tenant_id, enrollment_id) references public.dr_enrollments(tenant_id, id)
);
create index dr_lesson_skills_enrollment_idx on public.dr_lesson_skills (tenant_id, enrollment_id);
create index dr_lesson_skills_tenant_lesson_idx on public.dr_lesson_skills (tenant_id, lesson_id);

alter table public.dr_lesson_skills enable row level security;
create policy dr_lesson_skills_sel on public.dr_lesson_skills for select to authenticated
  using (tenant_id = (select private.current_tenant()));
revoke insert, update, delete, truncate on public.dr_lesson_skills from anon, authenticated;
revoke all on public.dr_lesson_skills from anon;

-- Replaces the skills ticked for one attended lesson. Returns the skills this lesson
-- added that no earlier lesson of the same student had (the "skills gained" line).
create function private.dr_set_lesson_skills(p_lesson uuid, p_skills text[])
returns text[] language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.dr_require_tenant();
  v_lesson dr_lessons%rowtype;
  v_skills text[] := coalesce(array(select distinct unnest(p_skills) order by 1), '{}');
  v_new text[];
begin
  if exists (select 1 from unnest(v_skills) s where s not in ('controls','mirrors','steering','gears','reversing','hill_start','parking','traffic')) then
    raise exception 'bad_skill';
  end if;
  select * into v_lesson from dr_lessons where id = p_lesson and tenant_id = v_tenant for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if v_lesson.status <> 'attended' then raise exception 'lesson_not_attended'; end if;

  delete from dr_lesson_skills where lesson_id = p_lesson and tenant_id = v_tenant and skill <> all (v_skills);
  insert into dr_lesson_skills (tenant_id, lesson_id, enrollment_id, skill)
    select v_tenant, p_lesson, v_lesson.enrollment_id, s from unnest(v_skills) s
    on conflict (lesson_id, skill) do nothing;

  select coalesce(array_agg(s order by s), '{}') into v_new from unnest(v_skills) s
  where not exists (
    select 1 from dr_lesson_skills k join dr_lessons l on l.id = k.lesson_id
    where k.tenant_id = v_tenant and k.enrollment_id = v_lesson.enrollment_id and k.skill = s
      and k.lesson_id <> p_lesson and l.status = 'attended' and l.starts_at < v_lesson.starts_at
  );
  return v_new;
end $$;

create function public.dr_set_lesson_skills(p_lesson uuid, p_skills text[])
returns text[] language sql security invoker set search_path = public, private as $$ select private.dr_set_lesson_skills(p_lesson, p_skills) $$;

revoke all on function private.dr_set_lesson_skills(uuid, text[]) from public, anon;
revoke all on function public.dr_set_lesson_skills(uuid, text[]) from public, anon;
grant execute on function private.dr_set_lesson_skills(uuid, text[]) to authenticated;
grant execute on function public.dr_set_lesson_skills(uuid, text[]) to authenticated;
