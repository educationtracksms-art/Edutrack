-- Store A-Level period results as independent paper scores. O-Level continues
-- to use formative and summative components.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS score numeric;

UPDATE public.assessments a
SET score = a.summative,
    formative = NULL,
    summative = NULL
FROM public.students st
JOIN public.classes c ON c.id = st.class_id
WHERE a.student_id = st.id
  AND c.education_level = 'advanced'
  AND a.score IS NULL;

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_required_values;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_required_values
  CHECK (
    student_id IS NOT NULL
    AND subject_id IS NOT NULL
    AND term_id IS NOT NULL
    AND teacher_initials IS NOT NULL
    AND btrim(teacher_initials) <> ''
    AND submitted_by IS NOT NULL
    AND exam_type IS NOT NULL
    AND (
      (
        score IS NOT NULL
        AND score BETWEEN 0 AND 100
        AND formative IS NULL
        AND summative IS NULL
      )
      OR (
        score IS NULL
        AND summative IS NOT NULL
        AND summative BETWEEN 0 AND 80
        AND (formative IS NULL OR formative BETWEEN 0 AND 20)
      )
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.validate_assessment_grade_scale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_education_level text := 'ordinary';
  v_assessment_score numeric;
  v_grade text;
  v_descriptor text;
BEGIN
  SELECT COALESCE(c.education_level, 'ordinary')
  INTO v_education_level
  FROM public.students st
  JOIN public.classes c ON c.id = st.class_id
  WHERE st.id = NEW.student_id
    AND st.school_id = NEW.school_id;

  IF NEW.is_missing THEN
    IF v_education_level = 'advanced' THEN
      NEW.score := 0;
      NEW.formative := NULL;
      NEW.summative := NULL;
    ELSE
      NEW.score := NULL;
      NEW.formative := 0;
      NEW.summative := 0;
    END IF;
    NEW.grade_descriptor := 'MISSING MARK';
    RETURN NEW;
  END IF;

  IF v_education_level = 'advanced' THEN
    -- Accept summative from older clients while they roll forward, then
    -- normalize the row to the A-Level score column.
    NEW.score := COALESCE(NEW.score, NEW.summative);
    IF NEW.score IS NULL OR NEW.score < 0 OR NEW.score > 100 THEN
      RAISE EXCEPTION 'A-Level paper scores must be between 0 and 100';
    END IF;
    NEW.formative := NULL;
    NEW.summative := NULL;
    v_assessment_score := NEW.score;
  ELSE
    IF NEW.score IS NOT NULL THEN
      RAISE EXCEPTION 'The standalone score field is only for A-Level results';
    END IF;
    IF NEW.formative IS NULL OR NEW.formative < 0 OR NEW.formative > 20 THEN
      RAISE EXCEPTION 'O-Level formative marks must be between 0 and 20';
    END IF;
    IF NEW.summative IS NULL OR NEW.summative < 0 OR NEW.summative > 80 THEN
      RAISE EXCEPTION 'O-Level summative marks must be between 0 and 80';
    END IF;
    v_assessment_score := NEW.formative + NEW.summative;
  END IF;

  SELECT btrim(gs.grade), btrim(gs.grade_descriptor)
  INTO v_grade, v_descriptor
  FROM public.grading_scales gs
  WHERE gs.school_id = NEW.school_id
    AND COALESCE(gs.education_level, 'ordinary') = v_education_level
    AND v_assessment_score BETWEEN gs.min_score AND gs.max_score
  ORDER BY gs.min_score DESC
  LIMIT 1;

  IF NOT FOUND OR v_grade IS NULL OR v_grade = '' OR
     (v_education_level <> 'advanced' AND (v_descriptor IS NULL OR v_descriptor = '')) THEN
    RAISE EXCEPTION 'No complete grading-scale row covers this assessment score';
  END IF;

  IF v_education_level = 'advanced' THEN
    NEW.grade_descriptor := '';
  ELSIF NEW.grade_descriptor IS NULL OR btrim(NEW.grade_descriptor) <> v_descriptor THEN
    RAISE EXCEPTION 'The grade descriptor must come from the selected grading scale';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_assessment_grade_scale ON public.assessments;
CREATE TRIGGER validate_assessment_grade_scale
BEFORE INSERT OR UPDATE OF school_id, student_id, formative, summative, score, grade_descriptor, is_missing
ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.validate_assessment_grade_scale();

-- Keep the grouped O-Level workflow intact and allow standalone A-Level scores
-- through the existing atomic batch-submission RPC.
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
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('subject_teacher', 'class_teacher', 'hod', 'dos', 'school_admin', 'head_teacher', 'deputy_head_teacher')
  ) THEN
    RAISE EXCEPTION 'Not allowed to submit assessments';
  END IF;

  SELECT count(*) INTO requested_count FROM jsonb_array_elements(p_entries);
  SELECT count(DISTINCT item->>'assessment_id') INTO distinct_count
  FROM jsonb_array_elements(p_entries) AS item;
  IF requested_count <> distinct_count THEN
    RAISE EXCEPTION 'Duplicate assessments were selected';
  END IF;

  SELECT count(*) INTO matched_count
  FROM public.assessments a
  JOIN jsonb_to_recordset(p_entries) AS e(assessment_id uuid)
    ON e.assessment_id = a.id
  WHERE a.school_id = v_school_id
    AND a.status IN ('draft', 'rejected')
    AND NOT a.locked;
  IF matched_count <> requested_count THEN
    RAISE EXCEPTION 'Only unlocked draft or rejected assessments can be submitted';
  END IF;

  UPDATE public.assessments a
  SET formative = e.formative,
      summative = e.summative,
      score = e.score,
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
    score numeric,
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
