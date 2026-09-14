-- Keep the assessment workflow usable for every school and every newly-created
-- term.  Older rows are intentionally preserved; these defaults only fill
-- missing setup records.

-- Every term needs assessment-period rows because report generation only uses
-- approved marks from active periods.
INSERT INTO public.assessment_periods (school_id, term_id, exam_type, is_active, is_locked)
SELECT t.school_id, t.id, p.exam_type, p.exam_type = 'end_of_term', false
FROM public.terms t
CROSS JOIN (
  VALUES ('beginning_of_term'), ('mid_term'), ('end_of_term')
) AS p(exam_type)
ON CONFLICT (school_id, term_id, exam_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_term_assessment_periods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assessment_periods (school_id, term_id, exam_type, is_active, is_locked)
  VALUES
    (NEW.school_id, NEW.id, 'beginning_of_term', false, false),
    (NEW.school_id, NEW.id, 'mid_term', false, false),
    (NEW.school_id, NEW.id, 'end_of_term', true, false)
  ON CONFLICT (school_id, term_id, exam_type) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS terms_seed_assessment_periods ON public.terms;
CREATE TRIGGER terms_seed_assessment_periods
AFTER INSERT ON public.terms
FOR EACH ROW
EXECUTE FUNCTION public.seed_term_assessment_periods();

-- New schools must have a grading scale before staff can enter meaningful
-- results.  Do not duplicate a school's existing customized scale.
INSERT INTO public.grading_scales
  (school_id, grade, min_score, max_score, grade_descriptor, education_level, points)
SELECT s.id, g.grade, g.min_score, g.max_score, g.grade_descriptor, 'ordinary', NULL
FROM public.schools s
CROSS JOIN (
  VALUES
    ('A', 80::numeric, 100::numeric, 'Achieved MOST or ALL competencies exceedingly well.'),
    ('B', 70::numeric, 79.99::numeric, 'Very good performance.'),
    ('C', 60::numeric, 69.99::numeric, 'Achieved a good number of competencies.'),
    ('D', 50::numeric, 59.99::numeric, 'Basic competency achieved.'),
    ('E', 0::numeric, 49.99::numeric, 'Achieved a minimum level of competency.')
) AS g(grade, min_score, max_score, grade_descriptor)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.grading_scales existing
  WHERE existing.school_id = s.id
    AND COALESCE(existing.education_level, 'ordinary') = 'ordinary'
);

CREATE OR REPLACE FUNCTION public.seed_school_grading_scales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.grading_scales
    (school_id, grade, min_score, max_score, grade_descriptor, education_level, points)
  VALUES
    (NEW.id, 'A', 80, 100, 'Achieved MOST or ALL competencies exceedingly well.', 'ordinary', NULL),
    (NEW.id, 'B', 70, 79.99, 'Very good performance.', 'ordinary', NULL),
    (NEW.id, 'C', 60, 69.99, 'Achieved a good number of competencies.', 'ordinary', NULL),
    (NEW.id, 'D', 50, 59.99, 'Basic competency achieved.', 'ordinary', NULL),
    (NEW.id, 'E', 0, 49.99, 'Achieved a minimum level of competency.', 'ordinary', NULL)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_seed_grading_scales ON public.schools;
CREATE TRIGGER schools_seed_grading_scales
AFTER INSERT ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.seed_school_grading_scales();

-- Keep stored descriptors canonical for existing marks.  The displayed grade
-- itself is always resolved from the same scale row at read time.
ALTER TABLE public.assessments DISABLE TRIGGER validate_academic_relationships;
UPDATE public.assessments a
SET grade_descriptor = gs.grade_descriptor
FROM public.students st
JOIN public.classes c ON c.id = st.class_id
JOIN public.grading_scales gs
  ON gs.school_id = a.school_id
 AND COALESCE(gs.education_level, 'ordinary') = COALESCE(c.education_level, 'ordinary')
 AND (a.formative + a.summative) BETWEEN gs.min_score AND gs.max_score
WHERE st.id = a.student_id
  AND st.school_id = a.school_id;
ALTER TABLE public.assessments ENABLE TRIGGER validate_academic_relationships;

ALTER TABLE public.grading_scales
  DROP CONSTRAINT IF EXISTS grading_scales_complete_values;
ALTER TABLE public.grading_scales
  ADD CONSTRAINT grading_scales_complete_values
  CHECK (
    btrim(grade) <> ''
    AND btrim(grade_descriptor) <> ''
    AND min_score <= max_score
  ) NOT VALID;

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_grade_descriptor_required;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_grade_descriptor_required
  CHECK (grade_descriptor IS NOT NULL AND btrim(grade_descriptor) <> '') NOT VALID;

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
BEFORE INSERT OR UPDATE OF school_id, student_id, formative, summative, grade_descriptor
ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.validate_assessment_grade_scale();

-- A draft or submitted mark is only valid while its period is open.  Approval
-- and rejection remain possible after entry is locked, so DOS can finish the
-- workflow without reopening data entry.
CREATE OR REPLACE FUNCTION public.validate_assessment_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  period_active boolean;
  period_locked boolean;
BEGIN
  IF NEW.status IN ('draft', 'submitted') THEN
    SELECT is_active, is_locked
    INTO period_active, period_locked
    FROM public.assessment_periods
    WHERE school_id = NEW.school_id
      AND term_id = NEW.term_id
      AND exam_type = NEW.exam_type;

    IF NOT FOUND OR NOT period_active OR period_locked THEN
      RAISE EXCEPTION 'This assessment period is not open for entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_assessment_period ON public.assessments;
CREATE TRIGGER validate_assessment_period
BEFORE INSERT OR UPDATE ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.validate_assessment_period();

-- Allow a teacher to remove only their own draft/rejected entry.  The old
-- policy required school-management privileges even though the entry screen
-- exposes this action to teachers.
DROP POLICY IF EXISTS "tenant_delete_assessments" ON public.assessments;
CREATE POLICY "tenant_delete_assessments" ON public.assessments
FOR DELETE TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.can_manage_school()
    OR (status IN ('draft', 'rejected') AND submitted_by = auth.uid() AND NOT locked)
  )
);

-- Submit a batch in one transaction.  The server validates the teacher's
-- allocation and score values first; this function makes the final write
-- atomic so a failed row cannot leave half a class submitted.
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
        'subject_teacher', 'class_teacher', 'dos',
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
