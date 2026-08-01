ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS grade_descriptor text;
