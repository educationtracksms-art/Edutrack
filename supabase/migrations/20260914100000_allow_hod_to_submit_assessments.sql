-- Head of Department is a teaching role and may submit assessments for their
-- own allocations, just like class and subject teachers.
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
