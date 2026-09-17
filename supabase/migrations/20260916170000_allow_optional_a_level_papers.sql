-- A-Level subjects may be assessed at subject level when no papers are
-- configured. If a subject has configured papers, the selected paper remains
-- required so marks cannot be mixed between subject-level and paper-level rows.
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
    WHERE school_id = NEW.school_id
      AND subject_id = NEW.subject_id
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

CREATE OR REPLACE FUNCTION public.validate_teacher_allocation_paper()
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
    RAISE EXCEPTION 'Allocation subject does not belong to the selected school';
  END IF;

  IF COALESCE(subject_level, 'ordinary') <> 'advanced' THEN
    IF NEW.paper_id IS NOT NULL THEN
      RAISE EXCEPTION 'O-Level subjects cannot be allocated to papers';
    END IF;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subject_papers
    WHERE school_id = NEW.school_id
      AND subject_id = NEW.subject_id
  )
  INTO has_subject_papers;

  IF NEW.paper_id IS NULL THEN
    IF has_subject_papers THEN
      RAISE EXCEPTION 'Select an A-Level paper for this teacher allocation';
    END IF;
    RETURN NEW;
  END IF;

  SELECT school_id, subject_id
    INTO paper_school_id, paper_subject_id
  FROM public.subject_papers
  WHERE id = NEW.paper_id;

  IF paper_school_id IS NULL OR paper_school_id <> NEW.school_id
     OR paper_subject_id <> NEW.subject_id THEN
    RAISE EXCEPTION 'Allocation paper does not belong to the selected subject and school';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_teacher_allocation_paper_trigger ON public.teacher_allocations;
CREATE TRIGGER validate_teacher_allocation_paper_trigger
BEFORE INSERT OR UPDATE OF school_id, subject_id, paper_id ON public.teacher_allocations
FOR EACH ROW EXECUTE FUNCTION public.validate_teacher_allocation_paper();
