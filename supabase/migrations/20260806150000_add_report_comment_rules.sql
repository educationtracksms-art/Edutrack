CREATE TABLE public.report_comment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  comment_role text NOT NULL,
  descriptor text NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),n
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, comment_role, descriptor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_comment_rules TO authenticated;
GRANT ALL ON public.report_comment_rules TO service_role;
ALTER TABLE public.report_comment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_report_comment_rules" ON public.report_comment_rules FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_write_report_comment_rules" ON public.report_comment_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_update_report_comment_rules" ON public.report_comment_rules FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id())
  WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "tenant_delete_report_comment_rules" ON public.report_comment_rules FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

INSERT INTO public.report_comment_rules (school_id, comment_role, descriptor, comment) VALUES
('11111111-1111-1111-1111-111111111111','class_teacher','Outstanding','Nice performance. Don't relax'),
('11111111-1111-1111-1111-111111111111','class_teacher','Modulate','Improve on weak Subjects'),
('11111111-1111-1111-1111-111111111111','class_teacher','Basic','More efforts needed'),
('11111111-1111-1111-1111-111111111111','head_teacher','Outstanding','Maintain this performance'),
('11111111-1111-1111-1111-111111111111','head_teacher','Modulate','Aim Higher for outstanding'),
('11111111-1111-1111-1111-111111111111','head_teacher','Basic','Try to consult in weak subjects.');
