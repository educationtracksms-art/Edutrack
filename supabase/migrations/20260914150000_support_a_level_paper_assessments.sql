-- Allow the same A-Level subject and assessment period to be recorded once
-- per paper. O-Level and subject-level legacy rows continue to use a NULL
-- paper_id.
DROP INDEX IF EXISTS public.assessments_student_subject_term_exam_type_uniq;
DROP INDEX IF EXISTS public.assessments_student_subject_term_exam_type_paper_uniq;

CREATE UNIQUE INDEX assessments_student_subject_term_exam_type_paper_uniq
  ON public.assessments (
    student_id,
    subject_id,
    term_id,
    exam_type,
    COALESCE(paper_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE OR REPLACE FUNCTION public.validate_assessment_paper()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  subject_level text;
  paper_school_id uuid;
  paper_subject_id uuid;
BEGIN
  SELECT education_level INTO subject_level
  FROM public.subjects
  WHERE id = NEW.subject_id;

  IF NEW.paper_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT school_id, subject_id
    INTO paper_school_id, paper_subject_id
  FROM public.subject_papers
  WHERE id = NEW.paper_id;

  IF paper_school_id IS NULL OR paper_school_id <> NEW.school_id
     OR paper_subject_id <> NEW.subject_id THEN
    RAISE EXCEPTION 'Assessment paper does not belong to the selected subject and school';
  END IF;

  IF COALESCE(subject_level, 'ordinary') <> 'advanced' THEN
    RAISE EXCEPTION 'Papers can only be used with A-Level subjects';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_assessment_paper_trigger ON public.assessments;
CREATE TRIGGER validate_assessment_paper_trigger
BEFORE INSERT OR UPDATE OF subject_id, school_id, paper_id ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.validate_assessment_paper();
