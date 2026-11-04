-- Formative marks share the same review lifecycle as summative assessments.
-- The earlier tenant-only policies allowed any authenticated school member to
-- write marks and set them directly to approved.
-- Backfill legacy O-Level/former subject-level formative scores, including a
-- genuine score of zero. New workflow rows have formative=0 placeholders and
-- were introduced after this cutoff, so they must not be copied as scores.
WITH legacy_scores AS (
  SELECT DISTINCT ON (a.school_id, a.student_id, a.subject_id, a.term_id, a.paper_id)
    a.school_id,
    a.student_id,
    a.subject_id,
    a.paper_id,
    a.term_id,
    a.formative AS mark,
    a.is_missing,
    a.teacher_initials,
    a.submitted_by,
    a.submitted_at,
    a.approved_by,
    a.approved_at,
    a.created_at,
    a.updated_at
  FROM public.assessments a
  WHERE a.created_at < TIMESTAMPTZ '2026-09-14 12:00:00+00'
    AND a.formative BETWEEN 0 AND 20
    AND NOT EXISTS (
      SELECT 1
      FROM public.subject_papers sp
      WHERE sp.school_id = a.school_id
        AND sp.subject_id = a.subject_id
    )
  ORDER BY a.school_id, a.student_id, a.subject_id, a.term_id, a.paper_id,
    a.created_at DESC, a.id DESC
), legacy_states AS (
  SELECT
    a.school_id,
    a.student_id,
    a.subject_id,
    a.paper_id,
    a.term_id,
    bool_and(a.status = 'approved') AS all_approved,
    bool_or(a.status = 'rejected') AS has_rejected,
    bool_or(a.status IN ('submitted', 'approved')) AS has_submitted
  FROM public.assessments a
  WHERE a.created_at < TIMESTAMPTZ '2026-09-14 12:00:00+00'
  GROUP BY a.school_id, a.student_id, a.subject_id, a.paper_id, a.term_id
)
INSERT INTO public.formative_marks (
  school_id, student_id, subject_id, paper_id, term_id, mark, is_missing,
  teacher_initials, status, locked, submitted_by, submitted_at,
  approved_by, approved_at, created_at, updated_at
)
SELECT
  score.school_id,
  score.student_id,
  score.subject_id,
  score.paper_id,
  score.term_id,
  score.mark,
  COALESCE(score.is_missing, false),
  COALESCE(score.teacher_initials, ''),
  CASE
    WHEN state.all_approved THEN 'approved'::public.assessment_status
    WHEN state.has_rejected THEN 'rejected'::public.assessment_status
    WHEN state.has_submitted THEN 'submitted'::public.assessment_status
    ELSE 'draft'::public.assessment_status
  END,
  COALESCE(state.all_approved, false),
  score.submitted_by,
  score.submitted_at,
  CASE WHEN state.all_approved THEN score.approved_by ELSE NULL END,
  CASE WHEN state.all_approved THEN score.approved_at ELSE NULL END,
  score.created_at,
  score.updated_at
FROM legacy_scores score
JOIN legacy_states state USING (school_id, student_id, subject_id, paper_id, term_id)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS formative_marks_insert ON public.formative_marks;
DROP POLICY IF EXISTS formative_marks_update ON public.formative_marks;

CREATE POLICY formative_marks_insert ON public.formative_marks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.school_id = formative_marks.school_id
          AND ur.role IN (
            'subject_teacher', 'class_teacher', 'hod', 'dos', 'school_admin',
            'head_teacher', 'deputy_head_teacher'
          )
      )
    )
  );

CREATE POLICY formative_marks_update ON public.formative_marks
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.school_id = formative_marks.school_id
          AND ur.role IN (
            'subject_teacher', 'class_teacher', 'hod', 'dos', 'school_admin',
            'head_teacher', 'deputy_head_teacher'
          )
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.school_id = formative_marks.school_id
          AND ur.role IN (
            'subject_teacher', 'class_teacher', 'hod', 'dos', 'school_admin',
            'head_teacher', 'deputy_head_teacher'
          )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_formative_mark_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  can_manage boolean := false;
  can_teach boolean := false;
  has_allocation boolean := false;
  learner_class_id uuid;
  learner_stream_id uuid;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated user is required to change formative marks';
  END IF;

  SELECT
    bool_or(ur.role IN ('super_admin', 'school_admin', 'dos', 'head_teacher', 'deputy_head_teacher', 'hod')),
    bool_or(ur.role IN ('subject_teacher', 'class_teacher'))
  INTO can_manage, can_teach
  FROM public.user_roles ur
  WHERE ur.user_id = actor_id
    AND (ur.school_id = NEW.school_id OR ur.role = 'super_admin');

  can_manage := COALESCE(can_manage, false);
  can_teach := COALESCE(can_teach, false);
  IF NOT can_manage AND NOT can_teach THEN
    RAISE EXCEPTION 'Not allowed to manage formative marks';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students st
    JOIN public.subjects s ON s.id = NEW.subject_id AND s.school_id = st.school_id
    JOIN public.terms t ON t.id = NEW.term_id AND t.school_id = st.school_id
    WHERE st.id = NEW.student_id
      AND st.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Learner, subject, and term must belong to the selected school';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.school_id = NEW.school_id
     AND OLD.student_id = NEW.student_id
     AND OLD.subject_id = NEW.subject_id
     AND OLD.term_id = NEW.term_id
     AND OLD.paper_id IS NOT DISTINCT FROM NEW.paper_id THEN
    IF OLD.status IN ('submitted', 'approved')
       AND (OLD.mark, OLD.is_missing, OLD.teacher_initials)
           IS DISTINCT FROM (NEW.mark, NEW.is_missing, NEW.teacher_initials) THEN
      RAISE EXCEPTION 'Submitted formative marks must be returned for correction before editing';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Formative mark ownership cannot be changed';
  END IF;

  IF NOT can_manage THEN
    SELECT st.class_id, st.stream_id
    INTO learner_class_id, learner_stream_id
    FROM public.students st
    WHERE st.id = NEW.student_id
      AND st.school_id = NEW.school_id;

    SELECT EXISTS (
      SELECT 1
      FROM public.teacher_allocations ta
      WHERE ta.school_id = NEW.school_id
        AND ta.teacher_id = actor_id
        AND ta.subject_id = NEW.subject_id
        AND (ta.class_id IS NULL OR ta.class_id = learner_class_id)
        AND (ta.stream_id IS NULL OR ta.stream_id = learner_stream_id)
        AND (ta.paper_id IS NULL OR ta.paper_id IS NOT DISTINCT FROM NEW.paper_id)
    ) INTO has_allocation;
    IF NOT has_allocation THEN
      RAISE EXCEPTION 'This formative mark is outside your teaching allocation';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.locked OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'New formative marks must start as unlocked drafts';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'submitted' AND OLD.status IN ('draft', 'rejected') THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.assessment_periods ap
        WHERE ap.school_id = NEW.school_id
          AND ap.term_id = NEW.term_id
          AND ap.is_active
          AND NOT ap.is_locked
      ) THEN
        RAISE EXCEPTION 'No assessment period is open for formative submission';
      END IF;
    ELSIF NEW.status IN ('approved', 'rejected') AND OLD.status = 'submitted' THEN
      IF NOT can_manage THEN
        RAISE EXCEPTION 'Only academic leadership can review formative marks';
      END IF;
    ELSIF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
      IF NOT can_manage THEN
        RAISE EXCEPTION 'Only academic leadership can return approved formative marks';
      END IF;
    ELSIF NEW.status = 'draft' AND OLD.status IN ('rejected', 'submitted') THEN
      IF NOT can_manage AND OLD.status <> 'rejected' THEN
        RAISE EXCEPTION 'Only academic leadership can return submitted formative marks to draft';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid formative mark status transition';
    END IF;
  END IF;

  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NOT NEW.locked OR NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'Approved formative marks must be locked and record the approver';
  END IF;
  IF NEW.status <> 'approved' AND NEW.locked THEN
    RAISE EXCEPTION 'Only approved formative marks can be locked';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_formative_mark_workflow ON public.formative_marks;
CREATE TRIGGER enforce_formative_mark_workflow
BEFORE INSERT OR UPDATE ON public.formative_marks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_formative_mark_workflow();

-- Submit the term-level formative mark and all period marks as one transaction.
-- If either write fails, PostgreSQL rolls back both sides of the review group.
CREATE OR REPLACE FUNCTION public.submit_assessment_group(
  p_entries jsonb,
  p_formative_mark_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid := public.current_school_id();
  v_formative public.formative_marks%ROWTYPE;
  v_requested_count integer;
  v_updated_count integer;
BEGIN
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Your account is not linked to a school';
  END IF;
  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Assessment entries must be an array';
  END IF;
  IF jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'No assessments were selected';
  END IF;

  SELECT * INTO v_formative
  FROM public.formative_marks fm
  WHERE fm.id = p_formative_mark_id
    AND fm.school_id = v_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formative mark not found in your school';
  END IF;

  SELECT count(*) INTO v_requested_count
  FROM jsonb_to_recordset(p_entries) AS entry(assessment_id uuid);
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS entry(assessment_id uuid)
    LEFT JOIN public.assessments a ON a.id = entry.assessment_id
    WHERE a.id IS NULL
       OR a.school_id <> v_school_id
       OR a.student_id <> v_formative.student_id
       OR a.subject_id <> v_formative.subject_id
       OR a.term_id <> v_formative.term_id
       OR a.paper_id IS DISTINCT FROM v_formative.paper_id
  ) THEN
    RAISE EXCEPTION 'Formative and summative marks must belong to the same learner, subject, paper, and term';
  END IF;

  IF v_formative.status IN ('draft', 'rejected') THEN
    IF v_formative.locked THEN
      RAISE EXCEPTION 'Locked formative marks cannot be submitted';
    END IF;
    UPDATE public.formative_marks
    SET status = 'submitted',
        locked = false,
        submitted_by = COALESCE(submitted_by, auth.uid()),
        submitted_at = now(),
        approved_by = NULL,
        approved_at = NULL,
        updated_at = now()
    WHERE id = p_formative_mark_id
      AND school_id = v_school_id
      AND status = v_formative.status;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The formative mark changed before it was submitted';
    END IF;
  ELSIF v_formative.status NOT IN ('submitted', 'approved') THEN
    RAISE EXCEPTION 'Only draft, rejected, submitted, or approved formative marks can be submitted with this group';
  END IF;

  v_updated_count := public.submit_assessment_batch(p_entries);
  IF v_updated_count <> v_requested_count THEN
    RAISE EXCEPTION 'Not every assessment in the group was submitted';
  END IF;
  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assessment_group(jsonb, uuid) TO authenticated;

-- Submit many learner/subject/paper groups in one transaction. A bulk action
-- must pair each set of period marks with its formative record, and any failed
-- group rolls back the whole allocation submission.
CREATE OR REPLACE FUNCTION public.submit_assessment_groups(p_groups jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_group jsonb;
  v_total integer := 0;
  v_group_count integer;
  v_requested_count integer;
  v_distinct_count integer;
BEGIN
  IF jsonb_typeof(p_groups) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Assessment groups must be an array';
  END IF;
  IF jsonb_array_length(p_groups) = 0 THEN
    RAISE EXCEPTION 'No assessment groups were selected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_groups) AS group_item(value)
    WHERE CASE
            WHEN jsonb_typeof(value->'entries') IS DISTINCT FROM 'array' THEN true
            ELSE jsonb_array_length(value->'entries') = 0
          END
       OR NULLIF(value->>'formative_mark_id', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Every group must include a formative mark and summative assessments';
  END IF;

  SELECT count(*) INTO v_requested_count
  FROM jsonb_array_elements(p_groups) AS group_item(value)
  CROSS JOIN LATERAL jsonb_to_recordset(value->'entries') AS entry(assessment_id uuid);
  SELECT count(DISTINCT entry.assessment_id) INTO v_distinct_count
  FROM jsonb_array_elements(p_groups) AS group_item(value)
  CROSS JOIN LATERAL jsonb_to_recordset(value->'entries') AS entry(assessment_id uuid);
  IF v_requested_count <> v_distinct_count THEN
    RAISE EXCEPTION 'An assessment can only appear once in a grouped submission';
  END IF;

  SELECT count(*) INTO v_group_count FROM jsonb_array_elements(p_groups);
  FOR v_group IN SELECT value FROM jsonb_array_elements(p_groups) AS group_item(value)
  LOOP
    v_total := v_total + public.submit_assessment_group(
      v_group->'entries',
      (v_group->>'formative_mark_id')::uuid
    );
  END LOOP;

  IF v_total <> v_requested_count OR v_group_count = 0 THEN
    RAISE EXCEPTION 'Not every assessment group was submitted';
  END IF;
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assessment_groups(jsonb) TO authenticated;
