CREATE TABLE IF NOT EXISTS public.identifier_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  identifier numeric NOT NULL,
  min_score numeric NOT NULL,
  max_score numeric NOT NULL,
  descriptor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.identifier_scales TO authenticated;
GRANT ALL ON public.identifier_scales TO service_role;
ALTER TABLE public.identifier_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_identifier_scales" ON public.identifier_scales
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_write_identifier_scales" ON public.identifier_scales
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_update_identifier_scales" ON public.identifier_scales
  FOR UPDATE TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id())
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_delete_identifier_scales" ON public.identifier_scales
  FOR DELETE TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

INSERT INTO public.identifier_scales (school_id, identifier, min_score, max_score, descriptor)
VALUES
('11111111-1111-1111-1111-111111111111',3,2.5,3.0,'Outstanding'),
('11111111-1111-1111-1111-111111111111',2,1.5,2.49,'Moderate'),
('11111111-1111-1111-1111-111111111111',1,0.9,1.49,'Basic')
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'grading_scales'
  ) THEN
    INSERT INTO public.grading_scales (school_id, grade, min_score, max_score, descriptor)
    VALUES
    ('11111111-1111-1111-1111-111111111111','A',80,100,'Achieved MOST or ALL competencies exceedingly well.'),
    ('11111111-1111-1111-1111-111111111111','B',70,79,'Very Good performance'),
    ('11111111-1111-1111-1111-111111111111','C',60,69,'Achieved a good number of competencies.'),
    ('11111111-1111-1111-1111-111111111111','D',50,59,'Basic competency achieved.'),
    ('11111111-1111-1111-1111-111111111111','E',0,49,'Archieved a minimum level of competency achieved');
  END IF;
END $$;
