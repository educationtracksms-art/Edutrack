ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS points numeric NOT NULL DEFAULT 1;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_points_range_check
  CHECK (points >= 1 AND points <= 5);
