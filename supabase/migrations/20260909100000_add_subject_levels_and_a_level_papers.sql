-- Keep O-Level and A-Level subjects explicit, and allow A-Level subjects to
-- have separately assessed papers (for example Physics Paper 1 and Paper 2).
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS education_level text NOT NULL DEFAULT 'ordinary';

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_education_level_check;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_education_level_check
  CHECK (education_level IN ('ordinary', 'advanced'));

CREATE TABLE IF NOT EXISTS public.subject_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  position integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, name)
);

ALTER TABLE public.subject_papers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_papers TO authenticated;
GRANT ALL ON public.subject_papers TO service_role;
DROP POLICY IF EXISTS subject_papers_tenant ON public.subject_papers;
CREATE POLICY subject_papers_tenant ON public.subject_papers FOR ALL TO authenticated
  USING (school_id = public.current_school_id())
  WITH CHECK (school_id = public.current_school_id());

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.subject_papers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS subject_papers_subject_position_idx
  ON public.subject_papers (subject_id, position);
CREATE INDEX IF NOT EXISTS assessments_paper_idx ON public.assessments (paper_id);

-- Existing records remain subject-level records. New A-Level paper records
-- use paper_id and are therefore stored independently.
