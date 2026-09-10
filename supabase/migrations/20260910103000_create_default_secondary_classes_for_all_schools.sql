-- Create the standard Ugandan secondary-school classes for every school.
-- S.1-S.4 use O-Level grading; S.5-S.6 use A-Level grading.

create or replace function public.create_default_secondary_classes(p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.classes (school_id, name, level, education_level)
  select p_school_id, v.name, v.level, v.education_level
  from (values
    ('S.1', 1, 'ordinary'),
    ('S.2', 2, 'ordinary'),
    ('S.3', 3, 'ordinary'),
    ('S.4', 4, 'ordinary'),
    ('S.5', 5, 'advanced'),
    ('S.6', 6, 'advanced')
  ) as v(name, level, education_level)
  where not exists (
    select 1
    from public.classes c
    where c.school_id = p_school_id
      and upper(regexp_replace(trim(c.name), '\\s+', '', 'g')) = upper(replace(v.name, '.', ''))
  );
end;
$$;

revoke all on function public.create_default_secondary_classes(uuid) from public;

-- Backfill every school already in the database.
do $$
declare
  school_record record;
begin
  for school_record in select id from public.schools loop
    perform public.create_default_secondary_classes(school_record.id);
  end loop;
end;
$$;

-- Automatically seed the same classes whenever a new school is created.
create or replace function public.handle_new_school_default_classes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_default_secondary_classes(new.id);
  return new;
end;
$$;

drop trigger if exists schools_create_default_classes on public.schools;
create trigger schools_create_default_classes
after insert on public.schools
for each row execute function public.handle_new_school_default_classes();
