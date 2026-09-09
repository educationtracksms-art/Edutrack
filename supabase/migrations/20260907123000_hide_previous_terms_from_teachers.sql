-- Teachers work only in the school's current term. Historical term data is
-- retained, but is not exposed to class/subject teachers through the API.
CREATE OR REPLACE FUNCTION public.can_view_term_as_teacher(_term_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('school_admin', 'head_teacher', 'deputy_head_teacher', 'dos')
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('class_teacher', 'subject_teacher')
      )
      AND EXISTS (
      SELECT 1
      FROM public.terms t
      WHERE t.id = _term_id
        AND t.school_id = public.current_school_id()
        AND t.is_current = true
      )
    );
$$;

-- The original tenant policies are intentionally replaced: RLS policies are
-- ORed together, so leaving the broad read policy in place would bypass this
-- restriction.
DROP POLICY IF EXISTS "tenant_read_terms" ON public.terms;
CREATE POLICY "tenant_read_terms" ON public.terms
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (school_id = public.current_school_id() AND public.can_view_term_as_teacher(id))
);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assessments', 'attendance_summaries', 'report_comments', 'co_curricular'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_read_%1$s" ON public.%1$I;', table_name);
    EXECUTE format($policy$
      CREATE POLICY "tenant_read_%1$s" ON public.%1$I
      FOR SELECT TO authenticated
      USING (
        public.is_super_admin()
        OR (
          school_id = public.current_school_id()
          AND public.can_view_term_as_teacher(term_id)
        )
      );
    $policy$, table_name);
  END LOOP;
END $$;
