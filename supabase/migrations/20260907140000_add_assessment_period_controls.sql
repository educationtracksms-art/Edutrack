CREATE TABLE IF NOT EXISTS public.assessment_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  exam_type text NOT NULL CHECK (exam_type IN ('beginning_of_term','mid_term','end_of_term')),
  is_active boolean NOT NULL DEFAULT false, is_locked boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, term_id, exam_type)
);
ALTER TABLE public.assessment_periods ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_periods TO authenticated;
GRANT ALL ON public.assessment_periods TO service_role;
CREATE POLICY assessment_periods_tenant ON public.assessment_periods FOR ALL TO authenticated USING (school_id = public.current_school_id()) WITH CHECK (school_id = public.current_school_id());
INSERT INTO public.assessment_periods (school_id, term_id, exam_type, is_active)
SELECT t.school_id, t.id, p.exam_type, p.exam_type = 'end_of_term'
FROM public.terms t CROSS JOIN (VALUES ('beginning_of_term'), ('mid_term'), ('end_of_term')) p(exam_type)
ON CONFLICT (school_id, term_id, exam_type) DO NOTHING;
