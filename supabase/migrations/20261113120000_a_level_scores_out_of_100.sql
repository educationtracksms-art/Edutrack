ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_required_values;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_required_values
  CHECK (
    student_id IS NOT NULL
    AND subject_id IS NOT NULL
    AND term_id IS NOT NULL
    AND summative IS NOT NULL
    AND (formative IS NULL OR formative BETWEEN 0 AND 20)
    AND summative BETWEEN 0 AND 100
    AND teacher_initials IS NOT NULL
    AND btrim(teacher_initials) <> ''
    AND submitted_by IS NOT NULL
    AND exam_type IS NOT NULL
  ) NOT VALID;

ALTER TABLE public.grading_scales
  DROP CONSTRAINT IF EXISTS grading_scales_complete_values;
ALTER TABLE public.grading_scales
  ADD CONSTRAINT grading_scales_complete_values
  CHECK (
    btrim(grade) <> ''
    AND min_score <= max_score
    AND (
      COALESCE(education_level, 'ordinary') <> 'advanced'
      OR (min_score >= 0 AND max_score <= 100)
    )
    AND (
      COALESCE(education_level, 'ordinary') = 'advanced'
      OR btrim(grade_descriptor) <> ''
    )
  ) NOT VALID;

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_grade_descriptor_required;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_grade_descriptor_required
  CHECK (grade_descriptor IS NOT NULL) NOT VALID;

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
    NEW.formative := CASE WHEN v_education_level = 'advanced' THEN NULL ELSE 0 END;
    NEW.summative := 0;
    NEW.grade_descriptor := 'MISSING MARK';
    RETURN NEW;
  END IF;

  IF v_education_level = 'advanced' THEN
    IF NEW.summative < 0 OR NEW.summative > 100 THEN
      RAISE EXCEPTION 'A-level paper scores must be between 0 and 100';
    END IF;
    NEW.formative := NULL;
    v_assessment_score := NEW.summative;
  ELSE
    IF NEW.formative IS NULL OR NEW.formative < 0 OR NEW.formative > 20 THEN
      RAISE EXCEPTION 'O-level formative marks must be between 0 and 20';
    END IF;
    IF NEW.summative < 0 OR NEW.summative > 80 THEN
      RAISE EXCEPTION 'O-level summative marks must be between 0 and 80';
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