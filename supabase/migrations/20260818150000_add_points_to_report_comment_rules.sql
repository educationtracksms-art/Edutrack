CREATE TABLE IF NOT EXISTS public.report_comment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  comment_role text NOT NULL,
  descriptor text NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, comment_role, descriptor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_comment_rules TO authenticated;
GRANT ALL ON public.report_comment_rules TO service_role;
ALTER TABLE public.report_comment_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_comment_rules'
      AND policyname = 'tenant_read_report_comment_rules'
  ) THEN
    CREATE POLICY "tenant_read_report_comment_rules" ON public.report_comment_rules FOR SELECT TO authenticated
      USING (public.is_super_admin() OR school_id = public.current_school_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_comment_rules'
      AND policyname = 'tenant_write_report_comment_rules'
  ) THEN
    CREATE POLICY "tenant_write_report_comment_rules" ON public.report_comment_rules FOR INSERT TO authenticated
      WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_comment_rules'
      AND policyname = 'tenant_update_report_comment_rules'
  ) THEN
    CREATE POLICY "tenant_update_report_comment_rules" ON public.report_comment_rules FOR UPDATE TO authenticated
      USING (public.is_super_admin() OR school_id = public.current_school_id())
      WITH CHECK (public.is_super_admin() OR school_id = public.current_school_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_comment_rules'
      AND policyname = 'tenant_delete_report_comment_rules'
  ) THEN
    CREATE POLICY "tenant_delete_report_comment_rules" ON public.report_comment_rules FOR DELETE TO authenticated
      USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));
  END IF;
END $$;

ALTER TABLE public.report_comment_rules
  ADD COLUMN IF NOT EXISTS points integer;

CREATE UNIQUE INDEX IF NOT EXISTS report_comment_rules_school_role_points_idx
  ON public.report_comment_rules (school_id, comment_role, points)
  WHERE points IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS report_comment_rules_school_role_descriptor_idx
  ON public.report_comment_rules (school_id, comment_role, descriptor)
  WHERE descriptor IS NOT NULL;
