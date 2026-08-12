create table if not exists public.timetable_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  term_id uuid references public.terms(id) on delete set null,
  break_start time not null default '10:00',
  break_end time not null default '10:30',
  lunch_start time not null default '12:30',
  lunch_end time not null default '14:00',
  school_day_start time not null default '08:00',
  school_day_end time not null default '16:00',
  total_periods integer not null default 9,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, term_id)
);

alter table public.timetable_settings enable row level security;

drop policy if exists "timetable_settings_select" on public.timetable_settings;
create policy "timetable_settings_select"
on public.timetable_settings
for select
using (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

drop policy if exists "timetable_settings_insert" on public.timetable_settings;
create policy "timetable_settings_insert"
on public.timetable_settings
for insert
with check (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

drop policy if exists "timetable_settings_update" on public.timetable_settings;
create policy "timetable_settings_update"
on public.timetable_settings
for update
using (
  school_id = public.current_school_id()
  or public.is_super_admin()
)
with check (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

drop policy if exists "timetable_settings_delete" on public.timetable_settings;
create policy "timetable_settings_delete"
on public.timetable_settings
for delete
using (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

create index if not exists timetable_settings_school_idx
  on public.timetable_settings (school_id);

create index if not exists timetable_settings_term_idx
  on public.timetable_settings (term_id);

create or replace function public.touch_timetable_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists timetable_settings_updated_at_trg on public.timetable_settings;
create trigger timetable_settings_updated_at_trg
before update on public.timetable_settings
for each row execute function public.touch_timetable_settings_updated_at();

insert into public.timetable_settings (
  school_id,
  academic_year_id,
  term_id
)
select
  t.school_id,
  t.academic_year_id,
  t.id
from public.terms t
where not exists (
  select 1
  from public.timetable_settings s
  where s.school_id = t.school_id
    and s.term_id = t.id
);
