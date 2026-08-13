alter table public.classes
  add column if not exists education_level text not null default 'ordinary';

alter table public.classes
  drop constraint if exists classes_education_level_check;

alter table public.classes
  add constraint classes_education_level_check
  check (education_level in ('ordinary', 'advanced'));

alter table public.grading_scales
  add column if not exists education_level text not null default 'ordinary',
  add column if not exists points numeric;

alter table public.grading_scales
  drop constraint if exists grading_scales_education_level_check;

alter table public.grading_scales
  add constraint grading_scales_education_level_check
  check (education_level in ('ordinary', 'advanced'));
