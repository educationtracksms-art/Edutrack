-- Keeps the term total of school days attended separately from the present/absent counts.
-- It is initially populated from the existing summary values and remains editable.
ALTER TABLE public.attendance_summaries
  ADD COLUMN IF NOT EXISTS total_days int NOT NULL DEFAULT 0;

UPDATE public.attendance_summaries
SET total_days = days_present + days_absent
WHERE total_days = 0 AND (days_present + days_absent) > 0;
