-- The approved marks screen filters by school and status, while the pending
-- queue reads all statuses for a school. Both screens page through records in
-- creation order, so index both query shapes to avoid sorting the full tables.
CREATE INDEX IF NOT EXISTS assessments_school_status_created_idx
  ON public.assessments (school_id, status, created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS a_level_assessments_school_status_created_idx
  ON public.a_level_assessments (school_id, status, created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS formative_marks_school_status_created_idx
  ON public.formative_marks (school_id, status, created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS assessments_school_created_idx
  ON public.assessments (school_id, created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS a_level_assessments_school_created_idx
  ON public.a_level_assessments (school_id, created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS formative_marks_school_created_idx
  ON public.formative_marks (school_id, created_at DESC, id ASC);
