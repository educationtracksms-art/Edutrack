-- formative_marks is the single source of formative scores. Assessment rows
-- represent only one summative period (BOT, MOT, or EOT), so they must never
-- persist a second copy of the formative value.
CREATE OR REPLACE FUNCTION public.keep_assessment_formative_separate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.formative := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_keep_assessment_formative_separate ON public.assessments;
CREATE TRIGGER a_keep_assessment_formative_separate
BEFORE INSERT OR UPDATE OF formative ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.keep_assessment_formative_separate();
