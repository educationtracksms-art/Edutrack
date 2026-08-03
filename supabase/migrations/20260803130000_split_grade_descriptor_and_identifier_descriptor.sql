ALTER TABLE public.grading_scales
  RENAME COLUMN descriptor TO grade_descriptor;

CREATE TABLE IF NOT EXISTS public.grading_identifier_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  identifier numeric NOT NULL,
  min_score numeric NOT NULL,
  max_score numeric NOT NULL,
  descriptor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grading_identifier_scales TO authenticated;
GRANT ALL ON public.grading_identifier_scales TO service_role;
ALTER TABLE public.grading_identifier_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_grading_identifier_scales" ON public.grading_identifier_scales
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_write_grading_identifier_scales" ON public.grading_identifier_scales
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_update_grading_identifier_scales" ON public.grading_identifier_scales
  FOR UPDATE TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id())
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_delete_grading_identifier_scales" ON public.grading_identifier_scales
  FOR DELETE TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

INSERT INTO public.grading_identifier_scales (school_id, identifier, min_score, max_score, descriptor)
VALUES
('11111111-1111-1111-1111-111111111111',3,2.5,3.0,'Outstanding'),
('11111111-1111-1111-1111-111111111111',2,1.5,2.49,'Moderate'),
('11111111-1111-1111-1111-111111111111',1,0.9,1.49,'Basic')
ON CONFLICT DO NOTHING;
