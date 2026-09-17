-- A missing mark is a real academic outcome, not a blank score. Store it
-- explicitly so it can be shown on report cards and counted as zero without
-- confusing it with a learner who genuinely scored zero.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS is_missing boolean NOT NULL DEFAULT false;

ALTER TABLE public.formative_marks
  ADD COLUMN IF NOT EXISTS is_missing boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assessments.is_missing IS
  'True when this assessment was deliberately recorded as a missing mark.';
COMMENT ON COLUMN public.formative_marks.is_missing IS
  'True when this formative mark was deliberately recorded as missing.';

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_missing_mark_values;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_missing_mark_values
  CHECK (
    NOT is_missing
    OR (formative = 0 AND summative = 0 AND grade_descriptor = 'MISSING MARK')
  ) NOT VALID;

ALTER TABLE public.formative_marks
  DROP CONSTRAINT IF EXISTS formative_marks_missing_mark_values;
ALTER TABLE public.formative_marks
  ADD CONSTRAINT formative_marks_missing_mark_values
  CHECK (NOT is_missing OR mark = 0) NOT VALID;

-- Missing assessments must not require a grading-scale descriptor. The trigger
-- also normalizes their stored values for writes made outside the web app.
CREATE OR REPLACE FUNCTION public.validate_assessment_grade_scale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_education_level text := 'ordinary';
  v_grade text;
  v_descriptor text;
BEGIN
  IF NEW.is_missing THEN
    NEW.formative := 0;
    NEW.summative := 0;
    NEW.grade_descriptor := 'MISSING MARK';
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.education_level, 'ordinary')
  INTO v_education_level
  FROM public.students st
  JOIN public.classes c ON c.id = st.class_id
  WHERE st.id = NEW.student_id
    AND st.school_id = NEW.school_id;

  SELECT btrim(gs.grade), btrim(gs.grade_descriptor)
  INTO v_grade, v_descriptor
  FROM public.grading_scales gs
  WHERE gs.school_id = NEW.school_id
    AND COALESCE(gs.education_level, 'ordinary') = v_education_level
    AND (NEW.formative + NEW.summative) BETWEEN gs.min_score AND gs.max_score
  ORDER BY gs.min_score DESC
  LIMIT 1;

  IF NOT FOUND OR v_grade IS NULL OR v_grade = '' OR v_descriptor IS NULL OR v_descriptor = '' THEN
    RAISE EXCEPTION 'No complete grading-scale row covers this assessment total';
  END IF;

  IF NEW.grade_descriptor IS NULL OR btrim(NEW.grade_descriptor) <> v_descriptor THEN
    RAISE EXCEPTION 'The grade descriptor must come from the selected grading scale';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_assessment_grade_scale ON public.assessments;
CREATE TRIGGER validate_assessment_grade_scale
BEFORE INSERT OR UPDATE OF school_id, student_id, formative, summative, grade_descriptor, is_missing
ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.validate_assessment_grade_scale();

-- Preserve the atomic batch-submission path and carry the missing-mark flag
-- through it. HOD remains included as an authorised teaching role.
CREATE OR REPLACE FUNCTION public.submit_assessment_batch(p_entries jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid := public.current_school_id();
  requested_count integer;
  distinct_count integer;
  matched_count integer;
  updated_count integer;
BEGIN
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Your account is not linked to a school';
  END IF;

  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'No assessments were selected';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'subject_teacher', 'class_teacher', 'hod', 'dos',
        'school_admin', 'head_teacher', 'deputy_head_teacher'
      )
  ) THEN
    RAISE EXCEPTION 'Not allowed to submit assessments';
  END IF;

  SELECT count(*) INTO requested_count
  FROM jsonb_array_elements(p_entries);

  SELECT count(DISTINCT item->>'assessment_id') INTO distinct_count
  FROM jsonb_array_elements(p_entries) AS item;

  IF requested_count <> distinct_count THEN
    RAISE EXCEPTION 'Duplicate assessments were selected';
  END IF;

  SELECT count(*) INTO matched_count
  FROM public.assessments a
  JOIN jsonb_to_recordset(p_entries) AS e(
    assessment_id uuid,
    formative numeric,
    summative numeric,
    is_missing boolean,
    teacher_initials text,
    grade_descriptor text
  ) ON e.assessment_id = a.id
  WHERE a.school_id = v_school_id
    AND a.status IN ('draft', 'rejected')
    AND NOT a.locked;

  IF matched_count <> requested_count THEN
    RAISE EXCEPTION 'Only unlocked draft or rejected assessments can be submitted';
  END IF;

  UPDATE public.assessments a
  SET formative = e.formative,
      summative = e.summative,
      is_missing = COALESCE(e.is_missing, false),
      teacher_initials = NULLIF(btrim(e.teacher_initials), ''),
      grade_descriptor = e.grade_descriptor,
      status = 'submitted',
      locked = false,
      rejection_reason = NULL,
      submitted_by = COALESCE(a.submitted_by, auth.uid()),
      submitted_at = now(),
      updated_at = now()
  FROM jsonb_to_recordset(p_entries) AS e(
    assessment_id uuid,
    formative numeric,
    summative numeric,
    is_missing boolean,
    teacher_initials text,
    grade_descriptor text
  )
  WHERE a.id = e.assessment_id
    AND a.school_id = v_school_id
    AND a.status IN ('draft', 'rejected')
    AND NOT a.locked;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> requested_count THEN
    RAISE EXCEPTION 'The selected assessments could not be submitted';
  END IF;

  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assessment_batch(jsonb) TO authenticated;
