-- A learner can have one assessment per subject, term and assessment period.
-- Existing records keep their current end_of_term default.
ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_student_id_subject_id_term_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS assessments_student_subject_term_exam_type_uniq
  ON public.assessments (student_id, subject_id, term_id, exam_type);

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_exam_type_check;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_exam_type_check
  CHECK (exam_type IN ('beginning_of_term', 'mid_term', 'end_of_term'));
