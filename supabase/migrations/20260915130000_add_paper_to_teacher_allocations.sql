-- A-Level teaching allocations are assigned to a specific subject paper.
-- O-Level allocations remain subject-level and keep paper_id NULL.
ALTER TABLE public.teacher_allocations
  ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.subject_papers(id) ON DELETE CASCADE;

ALTER TABLE public.teacher_allocation_history
  ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.subject_papers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS teacher_allocations_paper_idx
  ON public.teacher_allocations (school_id, subject_id, paper_id);

CREATE OR REPLACE FUNCTION public.validate_teacher_allocation_paper()
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
    RAISE EXCEPTION 'Allocation subject does not belong to the selected school';
  END IF;

  IF COALESCE(subject_level, 'ordinary') <> 'advanced' THEN
    IF NEW.paper_id IS NOT NULL THEN
      RAISE EXCEPTION 'O-Level subjects cannot be allocated to papers';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.paper_id IS NULL THEN
    RAISE EXCEPTION 'Select an A-Level paper for this teacher allocation';
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
