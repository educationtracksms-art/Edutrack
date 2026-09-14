-- School leadership roles can also teach. When they are assigned a
-- department, they may be allocated subjects and are subject to the same
-- allocation checks as other teaching roles.
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
        AND ur.role IN (
          'head_teacher', 'deputy_head_teacher', 'dos', 'hod',
          'class_teacher', 'subject_teacher'
        )
    ) THEN
      RAISE EXCEPTION 'A teaching role requires a department';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.teacher_allocations ta WHERE ta.teacher_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'A teacher with subject allocations must belong to a department';
    END IF;
    RETURN NEW;
  END IF;

  SELECT school_id INTO department_school_id
  FROM public.departments WHERE id = NEW.department_id;

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

CREATE OR REPLACE FUNCTION public.validate_teacher_role_department()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN (
    'head_teacher', 'deputy_head_teacher', 'dos', 'hod',
    'class_teacher', 'subject_teacher'
  ) AND NOT EXISTS (
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

-- Existing triggers call the replaced functions, so no trigger recreation is
-- needed here.
