-- A-Level assessment is always per paper. O-Level assessment stays at the
-- subject level and must not carry a paper id.
CREATE OR REPLACE FUNCTION public.validate_assessment_paper()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  subject_level text;
  subject_school_id uuid;
  paper_school_id uuid;
  paper_subject_id uuid;
BEGIN
  SELECT education_level, school_id
    INTO subject_level, subject_school_id
  FROM public.subjects
  WHERE id = NEW.subject_id;

  IF subject_school_id IS NULL OR subject_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'Assessment subject does not belong to the selected school';
  END IF;

  IF NEW.paper_id IS NULL THEN
    IF COALESCE(subject_level, 'ordinary') = 'advanced' THEN
      RAISE EXCEPTION 'Configure and select an A-Level paper for this assessment';
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

CREATE OR REPLACE FUNCTION public.validate_formative_mark_paper()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  subject_level text;
  subject_school_id uuid;
  paper_school_id uuid;
  paper_subject_id uuid;
BEGIN
  SELECT education_level, school_id
    INTO subject_level, subject_school_id
  FROM public.subjects
  WHERE id = NEW.subject_id;

  IF subject_school_id IS NULL OR subject_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'Formative-mark subject does not belong to the selected school';
  END IF;

  IF NEW.paper_id IS NULL THEN
    IF COALESCE(subject_level, 'ordinary') = 'advanced' THEN
      RAISE EXCEPTION 'Configure and select an A-Level paper for this formative mark';
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
