-- Delete an entire learner/subject/term/paper assessment set together. This
-- keeps formative, BOT, MOT, and EOT marks in sync when a draft is removed.
DROP POLICY IF EXISTS formative_marks_delete ON public.formative_marks;
CREATE POLICY formative_marks_delete ON public.formative_marks
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_school_id()
      AND (
        public.can_manage_school()
        OR (status IN ('draft', 'rejected') AND submitted_by = auth.uid() AND NOT locked)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.delete_assessment_group(
  p_school_id uuid,
  p_student_id uuid,
  p_subject_id uuid,
  p_paper_id uuid,
  p_term_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  assessment_count integer;
  formative_count integer;
  deleted_assessment_count integer;
  deleted_formative_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_super_admin() AND p_school_id IS DISTINCT FROM public.current_school_id() THEN
    RAISE EXCEPTION 'Assessment records are outside your school';
  END IF;

  SELECT count(*)
  INTO assessment_count
  FROM public.assessments
  WHERE school_id = p_school_id
    AND student_id = p_student_id
    AND subject_id = p_subject_id
    AND term_id = p_term_id
    AND paper_id IS NOT DISTINCT FROM p_paper_id;

  IF assessment_count = 0 THEN
    RAISE EXCEPTION 'No assessment records were found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assessments
    WHERE school_id = p_school_id
      AND student_id = p_student_id
      AND subject_id = p_subject_id
      AND term_id = p_term_id
      AND paper_id IS NOT DISTINCT FROM p_paper_id
      AND (locked OR status NOT IN ('draft', 'rejected'))
  ) THEN
    RAISE EXCEPTION 'Only unlocked draft or rejected assessment records can be deleted';
  END IF;

  SELECT count(*)
  INTO formative_count
  FROM public.formative_marks
  WHERE school_id = p_school_id
    AND student_id = p_student_id
    AND subject_id = p_subject_id
    AND term_id = p_term_id
    AND paper_id IS NOT DISTINCT FROM p_paper_id;

  IF EXISTS (
    SELECT 1
    FROM public.formative_marks
    WHERE school_id = p_school_id
      AND student_id = p_student_id
      AND subject_id = p_subject_id
      AND term_id = p_term_id
      AND paper_id IS NOT DISTINCT FROM p_paper_id
      AND (locked OR status NOT IN ('draft', 'rejected'))
  ) THEN
    RAISE EXCEPTION 'Only unlocked draft or rejected formative marks can be deleted';
  END IF;

  DELETE FROM public.formative_marks
  WHERE school_id = p_school_id
    AND student_id = p_student_id
    AND subject_id = p_subject_id
    AND term_id = p_term_id
    AND paper_id IS NOT DISTINCT FROM p_paper_id;
  GET DIAGNOSTICS deleted_formative_count = ROW_COUNT;

  DELETE FROM public.assessments
  WHERE school_id = p_school_id
    AND student_id = p_student_id
    AND subject_id = p_subject_id
    AND term_id = p_term_id
    AND paper_id IS NOT DISTINCT FROM p_paper_id;
  GET DIAGNOSTICS deleted_assessment_count = ROW_COUNT;

  IF deleted_assessment_count <> assessment_count OR deleted_formative_count <> formative_count THEN
    RAISE EXCEPTION 'Not allowed to delete one or more assessment records';
  END IF;

  RETURN deleted_assessment_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_assessment_group(uuid, uuid, uuid, uuid, uuid)
  TO authenticated;
