alter table public.teacher_allocations
  add column if not exists weekly_periods integer not null default 1;

alter table public.teacher_allocations
  add constraint teacher_allocations_weekly_periods_check
  check (weekly_periods > 0 and weekly_periods <= 60);
