-- A-Level formative marks are entered and approved per paper, just like
-- summative assessment records. Deleting a paper cascades to both record
-- types; O-Level marks remain subject-level rows.
ALTER TABLE public.formative_marks
  ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.subject_papers(id) ON DELETE CASCADE;

ALTER TABLE public.formative_marks
  DROP CONSTRAINT IF EXISTS formative_marks_student_id_subject_id_term_id_key;

ALTER TABLE public.formative_marks
  DROP CONSTRAINT IF EXISTS formative_marks_student_subject_term_paper_uniq;

ALTER TABLE public.formative_marks
  ADD CONSTRAINT formative_marks_student_subject_term_paper_uniq
  UNIQUE NULLS NOT DISTINCT (student_id, subject_id, term_id, paper_id);

CREATE INDEX IF NOT EXISTS formative_marks_paper_lookup_idx
  ON public.formative_marks (school_id, student_id, subject_id, term_id, paper_id);

CREATE OR REPLACE FUNCTION public.validate_formative_mark_paper()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  subject_level text;
  subject_school_id uuid;
  paper_school_id uuid;
  paper_subject_id uuid;
  has_subject_papers boolean;
BEGIN
  SELECT education_level, school_id
    INTO subject_level, subject_school_id
  FROM public.subjects
  WHERE id = NEW.subject_id;

  IF subject_school_id IS NULL OR subject_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'Formative-mark subject does not belong to the selected school';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subject_papers
    WHERE school_id = NEW.school_id AND subject_id = NEW.subject_id
  )
  INTO has_subject_papers;

  IF NEW.paper_id IS NULL THEN
    IF COALESCE(subject_level, 'ordinary') = 'advanced' AND has_subject_papers THEN
      RAISE EXCEPTION 'Select an A-Level paper for this formative mark';
    END IF;
    RETURN NEW;
  END IF;

  SELECT school_id, subject_id
    INTO paper_school_id, paper_subject_id
  FROM public.subject_papers
  WHERE id = NEW.paper_id;

  IF paper_school_id IS NULL OR paper_school_id <> NEW.school_id
     OR paper_subject_id <> NEW.subject_id THEN
    RAISE EXCEPTION 'Formative-mark paper does not belong to the selected subject and school';
  END IF;

  IF COALESCE(subject_level, 'ordinary') <> 'advanced' THEN
    RAISE EXCEPTION 'Papers can only be used with A-Level subjects';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_formative_mark_paper_trigger ON public.formative_marks;
CREATE TRIGGER validate_formative_mark_paper_trigger
BEFORE INSERT OR UPDATE OF school_id, subject_id, paper_id ON public.formative_marks
FOR EACH ROW EXECUTE FUNCTION public.validate_formative_mark_paper();
