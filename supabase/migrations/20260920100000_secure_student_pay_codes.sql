-- A SchPay code identifies one learner within one school. It is assigned by
-- the bursar after admission, so learner registration never needs to invent a
-- payment code.
UPDATE public.students
SET schpay_code = NULLIF(upper(btrim(schpay_code)), '')
WHERE schpay_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_school_schpay_code_key
  ON public.students (school_id, lower(btrim(schpay_code)))
  WHERE schpay_code IS NOT NULL
    AND btrim(schpay_code) <> ''
    AND deleted_at IS NULL;

-- Bursars need to find learners in order to assign their payment codes.
CREATE OR REPLACE FUNCTION public.can_view_all_students()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'school_admin', 'head_teacher', 'deputy_head_teacher', 'dos',
        'class_teacher', 'bursar'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_student_schpay_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.schpay_code := NULLIF(upper(btrim(NEW.schpay_code)), '');

  IF (TG_OP = 'INSERT' AND NEW.schpay_code IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.schpay_code IS DISTINCT FROM OLD.schpay_code) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND school_id = NEW.school_id
        AND role = 'bursar'
    ) THEN
      RAISE EXCEPTION 'Only the school bursar can assign or change a learner payment code';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_student_schpay_code ON public.students;
CREATE TRIGGER validate_student_schpay_code
BEFORE INSERT OR UPDATE OF schpay_code ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.validate_student_schpay_code();
