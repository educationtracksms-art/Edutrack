-- A-Level subjects with configured papers must use one of those papers.
-- A-Level subjects without configured papers may keep subject-level rows.
CREATE OR REPLACE FUNCTION public.validate_assessment_paper()
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
    RAISE EXCEPTION 'Assessment subject does not belong to the selected school';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subject_papers
    WHERE school_id = NEW.school_id
      AND subject_id = NEW.subject_id
  )
  INTO has_subject_papers;

  IF NEW.paper_id IS NULL THEN
    IF COALESCE(subject_level, 'ordinary') = 'advanced' AND has_subject_papers THEN
      RAISE EXCEPTION 'Select an A-Level paper for this assessment';
    END IF;
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