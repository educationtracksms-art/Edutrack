-- A-Level subsidiary subjects use a binary points rule rather than the
-- ordinary A-Level grading-scale points: 50+ earns 1 point, otherwise 0.
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_subsidiary boolean NOT NULL DEFAULT false;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_subsidiary_level_check;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_subsidiary_level_check
  CHECK (NOT is_subsidiary OR education_level = 'advanced');
