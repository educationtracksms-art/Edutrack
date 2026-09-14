-- Keep the academic structure aligned with the school's departments.
-- Teachers already belong to a department through profiles.department_id.
-- Subjects now belong to one department as well, and allocations may only
-- connect teachers and subjects from the same department.

-- The Users & Roles screen stores the current HOD directly on the department
-- in addition to the historical department_heads records.
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS hod_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS department_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subjects_department_id_fkey'
      AND conrelid = 'public.subjects'::regclass
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_department_id_fkey
      FOREIGN KEY (department_id)
      REFERENCES public.departments(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Preserve existing subjects when departments have not yet been configured.
-- The generated department is only used for subjects that do not already have
-- an explicit department.
INSERT INTO public.departments (school_id, name, description)
SELECT DISTINCT
  school_id,
  'General',
  'Default department for subjects awaiting departmental setup'
FROM (
  SELECT s.school_id
  FROM public.subjects s
  WHERE s.department_id IS NULL

  UNION

  SELECT p.school_id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id IS NOT NULL
    AND p.department_id IS NULL
    AND ur.role IN ('class_teacher', 'subject_teacher', 'hod', 'dos')
) AS schools_needing_default_department
ON CONFLICT (school_id, name) DO NOTHING;

UPDATE public.subjects s
SET department_id = d.id
FROM public.departments d
WHERE s.department_id IS NULL
  AND d.school_id = s.school_id
  AND d.name = 'General';

-- Existing teachers need a department before their current allocations can be
-- edited or scheduled under the new validation rules.
UPDATE public.profiles p
SET department_id = d.id
FROM public.departments d
WHERE p.department_id IS NULL
  AND d.school_id = p.school_id
  AND d.name = 'General'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('class_teacher', 'subject_teacher', 'hod', 'dos')
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subjects WHERE department_id IS NULL) THEN
    RAISE EXCEPTION 'Every subject must belong to a department before this migration can finish';
  END IF;
END $$;

ALTER TABLE public.subjects
  ALTER COLUMN department_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS subjects_department_idx
  ON public.subjects (school_id, department_id, position);

CREATE OR REPLACE FUNCTION public.validate_profile_department_relationship()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  department_school_id uuid;
BEGIN
  IF NEW.department_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.id
        AND ur.role IN ('class_teacher', 'subject_teacher', 'hod', 'dos')
    ) THEN
      RAISE EXCEPTION 'A teaching role requires a department';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.teacher_allocations ta
      WHERE ta.teacher_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'A teacher with subject allocations must belong to a department';
    END IF;
    RETURN NEW;
  END IF;

  SELECT school_id
  INTO department_school_id
  FROM public.departments
  WHERE id = NEW.department_id;

  IF department_school_id IS NULL
     OR NEW.school_id IS NULL
     OR department_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'The teacher department must belong to the same school';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.teacher_allocations ta
    JOIN public.subjects s ON s.id = ta.subject_id
    WHERE ta.teacher_id = NEW.id
      AND s.department_id IS DISTINCT FROM NEW.department_id
  ) THEN
    RAISE EXCEPTION 'The teacher department cannot change while allocations use another department';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_department_relationship ON public.profiles;
CREATE TRIGGER validate_profile_department_relationship
BEFORE INSERT OR UPDATE OF school_id, department_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_department_relationship();

CREATE OR REPLACE FUNCTION public.validate_subject_department_relationship()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  department_school_id uuid;
BEGIN
  SELECT school_id
  INTO department_school_id
  FROM public.departments
  WHERE id = NEW.department_id;

  IF department_school_id IS NULL OR department_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'The subject department must belong to the same school';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.teacher_allocations ta
    JOIN public.profiles p ON p.id = ta.teacher_id
    WHERE ta.subject_id = NEW.id
      AND p.department_id IS DISTINCT FROM NEW.department_id
  ) THEN
    RAISE EXCEPTION 'The subject department cannot change while allocations use another department';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_subject_department_relationship ON public.subjects;
CREATE TRIGGER validate_subject_department_relationship
BEFORE INSERT OR UPDATE OF school_id, department_id ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.validate_subject_department_relationship();

CREATE OR REPLACE FUNCTION public.validate_teacher_department_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  teacher_school_id uuid;
  teacher_department_id uuid;
  subject_school_id uuid;
  subject_department_id uuid;
BEGIN
  SELECT school_id, department_id
  INTO teacher_school_id, teacher_department_id
  FROM public.profiles
  WHERE id = NEW.teacher_id;

  SELECT school_id, department_id
  INTO subject_school_id, subject_department_id
  FROM public.subjects
  WHERE id = NEW.subject_id;

  IF teacher_school_id IS NULL OR teacher_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'The selected teacher does not belong to this school';
  END IF;
  IF subject_school_id IS NULL OR subject_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'The selected subject does not belong to this school';
  END IF;
  IF teacher_department_id IS NULL THEN
    RAISE EXCEPTION 'Assign the teacher to a department before creating an allocation';
  END IF;
  IF teacher_department_id <> subject_department_id THEN
    RAISE EXCEPTION 'The teacher and subject must belong to the same department';
  END IF;

  IF TG_TABLE_NAME = 'timetable_entries' AND NOT EXISTS (
    SELECT 1
    FROM public.teacher_allocations ta
    WHERE ta.school_id = NEW.school_id
      AND ta.teacher_id = NEW.teacher_id
      AND ta.subject_id = NEW.subject_id
      AND ta.class_id = NEW.class_id
      AND (ta.stream_id IS NULL OR ta.stream_id = NEW.stream_id)
  ) THEN
    RAISE EXCEPTION 'Allocate the teacher to this subject, class and stream before scheduling the lesson';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_teacher_department_allocation ON public.teacher_allocations;
CREATE TRIGGER validate_teacher_department_allocation
BEFORE INSERT OR UPDATE OF school_id, teacher_id, subject_id ON public.teacher_allocations
FOR EACH ROW
EXECUTE FUNCTION public.validate_teacher_department_allocation();

CREATE OR REPLACE FUNCTION public.validate_teacher_role_department()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('class_teacher', 'subject_teacher', 'hod', 'dos')
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = NEW.user_id
         AND p.school_id = NEW.school_id
         AND p.department_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'A teaching role requires a teacher department';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_teacher_role_department ON public.user_roles;
CREATE TRIGGER validate_teacher_role_department
BEFORE INSERT OR UPDATE OF user_id, role, school_id ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.validate_teacher_role_department();

-- Timetable entries also store a teacher/subject pair directly, so keep them
-- subject to the same departmental rule when they are created or edited.
DROP TRIGGER IF EXISTS validate_timetable_teacher_department ON public.timetable_entries;
CREATE TRIGGER validate_timetable_teacher_department
BEFORE INSERT OR UPDATE OF school_id, teacher_id, subject_id ON public.timetable_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_teacher_department_allocation();
