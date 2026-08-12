create table if not exists public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  term_id uuid references public.terms(id) on delete set null,
  period_order integer not null,
  label text not null,
  start_time time,
  end_time time,
  is_break boolean not null default false,
  is_lunch boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, term_id, period_order)
);

alter table public.timetable_periods enable row level security;

drop policy if exists "timetable_periods_select" on public.timetable_periods;
create policy "timetable_periods_select"
on public.timetable_periods
for select
using (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

drop policy if exists "timetable_periods_insert" on public.timetable_periods;
create policy "timetable_periods_insert"
on public.timetable_periods
for insert
with check (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

drop policy if exists "timetable_periods_update" on public.timetable_periods;
create policy "timetable_periods_update"
on public.timetable_periods
for update
using (
  school_id = public.current_school_id()
  or public.is_super_admin()
)
with check (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

drop policy if exists "timetable_periods_delete" on public.timetable_periods;
create policy "timetable_periods_delete"
on public.timetable_periods
for delete
using (
  school_id = public.current_school_id()
  or public.is_super_admin()
);

create index if not exists timetable_periods_school_idx
  on public.timetable_periods (school_id);

create index if not exists timetable_periods_term_idx
  on public.timetable_periods (term_id);

create or replace function public.touch_timetable_periods_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists timetable_periods_updated_at_trg on public.timetable_periods;
create trigger timetable_periods_updated_at_trg
before update on public.timetable_periods
for each row execute function public.touch_timetable_periods_updated_at();

insert into public.timetable_periods (
  school_id,
  academic_year_id,
  term_id,
  period_order,
  label,
  start_time,
  end_time,
  is_break,
  is_lunch
)
select
  t.school_id,
  t.academic_year_id,
  t.id,
  x.period_order,
  x.label,
  x.start_time,
  x.end_time,
  x.is_break,
  x.is_lunch
from public.terms t
cross join lateral (
  values
    (1, '8:00', time '08:00', time '08:40', false, false),
    (2, '8:40', time '08:40', time '09:20', false, false),
    (3, '9:20', time '09:20', time '10:00', false, false),
    (4, 'BREAK', null::time, null::time, true, false),
    (5, '10:30', time '10:30', time '11:10', false, false),
    (6, '11:10', time '11:10', time '11:50', false, false),
    (7, '11:50', time '11:50', time '12:30', false, false),
    (8, 'LUNCH', null::time, null::time, false, true),
    (9, '2:00', time '14:00', time '14:40', false, false),
    (10, '2:40', time '14:40', time '15:20', false, false),
    (11, '3:20', time '15:20', time '16:00', false, false)
) as x(period_order, label, start_time, end_time, is_break, is_lunch)
where not exists (
  select 1
  from public.timetable_periods p
  where p.school_id = t.school_id
    and p.term_id = t.id
    and p.period_order = x.period_order
);
