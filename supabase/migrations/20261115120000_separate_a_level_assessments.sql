-- A-Level period marks have one score and do not use O-Level components.
CREATE TABLE IF NOT EXISTS public.a_level_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  paper_id uuid REFERENCES public.subject_papers(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  exam_type text NOT NULL DEFAULT 'end_of_term'
    CHECK (exam_type IN ('beginning_of_term', 'mid_term', 'end_of_term')),
  score numeric NOT NULL CHECK (score BETWEEN 0 AND 100),
  is_missing boolean NOT NULL DEFAULT false,
  grade_descriptor text NOT NULL DEFAULT '',
  teacher_initials text,
  status public.assessment_status NOT NULL DEFAULT 'draft',
  locked boolean NOT NULL DEFAULT false,
  rejection_reason text,
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS a_level_assessments_student_period_paper_uniq
  ON public.a_level_assessments (
    student_id,
    subject_id,
    term_id,
    exam_type,
    COALESCE(paper_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
CREATE INDEX IF NOT EXISTS a_level_assessments_school_idx
  ON public.a_level_assessments (school_id, term_id, subject_id);
CREATE INDEX IF NOT EXISTS a_level_assessments_student_term_idx
  ON public.a_level_assessments (student_id, term_id);

-- Move the A-Level rows already created by the previous score-column workflow.
INSERT INTO public.a_level_assessments (
  id, school_id, student_id, subject_id, paper_id, term_id, exam_type, score,
  is_missing, grade_descriptor, teacher_initials, status, locked,
  rejection_reason, submitted_by, submitted_at, approved_by, approved_at,
  created_at, updated_at
)
SELECT
  a.id, a.school_id, a.student_id, a.subject_id, a.paper_id, a.term_id,
  a.exam_type, COALESCE(a.score, a.summative, 0), a.is_missing,
  COALESCE(a.grade_descriptor, ''), a.teacher_initials, a.status, a.locked,
  a.rejection_reason, a.submitted_by, a.submitted_at, a.approved_by,
  a.approved_at, a.created_at, a.updated_at
FROM public.assessments a
JOIN public.students st ON st.id = a.student_id
JOIN public.classes c ON c.id = st.class_id
WHERE c.education_level = 'advanced'
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.assessments a
USING public.students st, public.classes c
WHERE a.student_id = st.id
  AND st.class_id = c.id
  AND c.education_level = 'advanced';

DELETE FROM public.formative_marks fm
USING public.students st, public.classes c
WHERE fm.student_id = st.id
  AND st.class_id = c.id
  AND c.education_level = 'advanced';

-- The legacy table now accepts only O-Level component marks.
ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_required_values;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_required_values
  CHECK (
    student_id IS NOT NULL
    AND subject_id IS NOT NULL
    AND term_id IS NOT NULL
    AND score IS NULL
    AND formative IS NOT NULL
    AND formative BETWEEN 0 AND 20
    AND summative IS NOT NULL
    AND summative BETWEEN 0 AND 80
    AND teacher_initials IS NOT NULL
    AND btrim(teacher_initials) <> ''
    AND submitted_by IS NOT NULL
    AND exam_type IS NOT NULL
  ) NOT VALID;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.a_level_assessments TO authenticated;
GRANT ALL ON public.a_level_assessments TO service_role;
ALTER TABLE public.a_level_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_read_a_level_assessments ON public.a_level_assessments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY tenant_insert_a_level_assessments ON public.a_level_assessments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY tenant_update_a_level_assessments ON public.a_level_assessments
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id())
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY tenant_delete_a_level_assessments ON public.a_level_assessments
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());

CREATE POLICY a_level_assessments_access_scope_select
ON public.a_level_assessments AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.can_view_assessment(school_id, student_id, subject_id, paper_id));

CREATE POLICY a_level_assessments_access_scope_insert
ON public.a_level_assessments AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
  AND submitted_by = auth.uid()
  AND status IN ('draft', 'submitted')
  AND NOT locked
  AND approved_by IS NULL
  AND approved_at IS NULL
);

CREATE POLICY a_level_assessments_access_scope_update
ON public.a_level_assessments AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR (
      public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
      AND status IN ('draft', 'rejected')
      AND NOT locked
    )
  )
)
WITH CHECK (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR (
      public.can_enter_assessment(school_id, student_id, subject_id, paper_id)
      AND status IN ('draft', 'rejected', 'submitted')
      AND NOT locked
    )
  )
);

CREATE POLICY a_level_assessments_access_scope_delete
ON public.a_level_assessments AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.can_manage_assessment(school_id)
    OR (
      public.can_view_assessment(school_id, student_id, subject_id, paper_id)
      AND status IN ('draft', 'rejected')
      AND NOT locked
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.school_id = public.current_school_id()
          AND ur.role IN ('class_teacher', 'subject_teacher', 'dos', 'head_teacher', 'deputy_head_teacher')
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.validate_a_level_assessment_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_student_school_id uuid;
  v_student_class_id uuid;
  v_student_stream_id uuid;
  v_class_level text;
  v_subject_school_id uuid;
  v_subject_level text;
  v_term_school_id uuid;
  v_submitter_school_id uuid;
  v_grade text;
  v_points numeric;
BEGIN
  IF NEW.teacher_initials IS NULL OR btrim(NEW.teacher_initials) = '' THEN
    RAISE EXCEPTION 'Teacher initials are required before saving marks';
  END IF;

  SELECT school_id, class_id, stream_id
  INTO v_student_school_id, v_student_class_id, v_student_stream_id
  FROM public.students WHERE id = NEW.student_id;
  IF v_student_school_id IS NULL OR v_student_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'The selected learner does not belong to this school';
  END IF;
  PERFORM public.validate_class_stream_relation(NEW.school_id, v_student_class_id, v_student_stream_id);
  SELECT COALESCE(education_level, 'ordinary') INTO v_class_level
  FROM public.classes WHERE id = v_student_class_id AND school_id = NEW.school_id;
  IF v_class_level IS DISTINCT FROM 'advanced' THEN
    RAISE EXCEPTION 'A-Level marks must be entered for an A-Level learner';
  END IF;

  SELECT school_id, COALESCE(education_level, 'ordinary')
  INTO v_subject_school_id, v_subject_level
  FROM public.subjects WHERE id = NEW.subject_id;
  IF v_subject_school_id IS DISTINCT FROM NEW.school_id OR v_subject_level IS DISTINCT FROM 'advanced' THEN
    RAISE EXCEPTION 'Choose an A-Level subject from this school';
  END IF;

  SELECT school_id INTO v_term_school_id FROM public.terms WHERE id = NEW.term_id;
  IF v_term_school_id IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION 'The selected term does not belong to this school';
  END IF;
  SELECT school_id INTO v_submitter_school_id FROM public.profiles WHERE id = NEW.submitted_by;
  IF v_submitter_school_id IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION 'A teacher or authorised staff member from this school is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = NEW.submitted_by
      AND ur.role IN ('subject_teacher', 'class_teacher', 'dos')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.teacher_allocations ta
    WHERE ta.school_id = NEW.school_id
      AND ta.teacher_id = NEW.submitted_by
      AND ta.subject_id = NEW.subject_id
      AND ta.paper_id IS NOT DISTINCT FROM NEW.paper_id
      AND (ta.class_id IS NULL OR ta.class_id = v_student_class_id)
      AND (ta.stream_id IS NULL OR ta.stream_id = v_student_stream_id)
  ) THEN
    RAISE EXCEPTION 'Allocate the teacher to this learner class, stream and subject first';
  END IF;

  IF NEW.is_missing THEN
    NEW.score := 0;
    NEW.grade_descriptor := 'MISSING MARK';
    RETURN NEW;
  END IF;

  IF NEW.score IS NULL OR NEW.score < 0 OR NEW.score > 100 THEN
    RAISE EXCEPTION 'A-Level scores must be between 0 and 100';
  END IF;
  SELECT btrim(gs.grade), gs.points INTO v_grade, v_points
  FROM public.grading_scales gs
  WHERE gs.school_id = NEW.school_id
    AND COALESCE(gs.education_level, 'ordinary') = 'advanced'
    AND NEW.score BETWEEN gs.min_score AND gs.max_score
  ORDER BY gs.min_score DESC
  LIMIT 1;
  IF NOT FOUND OR v_grade IS NULL OR v_grade = '' OR v_points IS NULL THEN
    RAISE EXCEPTION 'No complete A-Level grading-scale row covers this score';
  END IF;
  NEW.grade_descriptor := '';
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_a_level_assessment_relationships
BEFORE INSERT OR UPDATE ON public.a_level_assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_a_level_assessment_relationships();

CREATE OR REPLACE FUNCTION public.reject_a_level_formative_marks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.students st
    JOIN public.classes c ON c.id = st.class_id
    WHERE st.id = NEW.student_id
      AND st.school_id = NEW.school_id
      AND c.education_level = 'advanced'
  ) THEN
    RAISE EXCEPTION 'A-Level learners do not have formative marks';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_a_level_formative_marks ON public.formative_marks;
CREATE TRIGGER reject_a_level_formative_marks
BEFORE INSERT OR UPDATE OF school_id, student_id ON public.formative_marks
FOR EACH ROW EXECUTE FUNCTION public.reject_a_level_formative_marks();

DROP TRIGGER IF EXISTS validate_a_level_assessment_paper ON public.a_level_assessments;
CREATE TRIGGER validate_a_level_assessment_paper
BEFORE INSERT OR UPDATE OF subject_id, school_id, paper_id ON public.a_level_assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_assessment_paper();

DROP TRIGGER IF EXISTS validate_a_level_assessment_period ON public.a_level_assessments;
CREATE TRIGGER validate_a_level_assessment_period
BEFORE INSERT OR UPDATE ON public.a_level_assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_assessment_period();

DROP TRIGGER IF EXISTS a_level_assessments_touch_updated_at ON public.a_level_assessments;
CREATE TRIGGER a_level_assessments_touch_updated_at
BEFORE UPDATE ON public.a_level_assessments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.submit_a_level_assessment_batch(p_entries jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid := public.current_school_id();
  v_requested_count integer;
  v_distinct_count integer;
  v_matched_count integer;
  v_updated_count integer;
BEGIN
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Your account is not linked to a school';
  END IF;
  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'No A-Level assessments were selected';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('subject_teacher', 'class_teacher', 'hod', 'dos', 'school_admin', 'head_teacher', 'deputy_head_teacher', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to submit assessments';
  END IF;

  SELECT count(*) INTO v_requested_count FROM jsonb_array_elements(p_entries);
  SELECT count(DISTINCT item->>'assessment_id') INTO v_distinct_count
  FROM jsonb_array_elements(p_entries) AS item;
  IF v_requested_count <> v_distinct_count THEN
    RAISE EXCEPTION 'Duplicate assessments were selected';
  END IF;

  SELECT count(*) INTO v_matched_count
  FROM public.a_level_assessments a
  JOIN jsonb_to_recordset(p_entries) AS e(assessment_id uuid) ON e.assessment_id = a.id
  WHERE a.school_id = v_school_id AND a.status IN ('draft', 'rejected') AND NOT a.locked;
  IF v_matched_count <> v_requested_count THEN
    RAISE EXCEPTION 'Only unlocked draft or rejected A-Level assessments can be submitted';
  END IF;

  UPDATE public.a_level_assessments a
  SET score = e.score,
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
    score numeric,
    is_missing boolean,
    teacher_initials text,
    grade_descriptor text
  )
  WHERE a.id = e.assessment_id
    AND a.school_id = v_school_id
    AND a.status IN ('draft', 'rejected')
    AND NOT a.locked;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_requested_count THEN
    RAISE EXCEPTION 'The selected A-Level assessments could not be submitted';
  END IF;
  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_a_level_assessment_batch(jsonb) TO authenticated;
