ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS report_next_term_begins_on date;
