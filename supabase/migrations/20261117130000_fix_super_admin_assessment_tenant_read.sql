-- The assessment access-scope policy allows platform super admins, but the
-- tenant read policy must also allow them or PostgreSQL RLS still filters
-- every O-Level assessment row out.
DROP POLICY IF EXISTS "tenant_read_assessments" ON public.assessments;
CREATE POLICY "tenant_read_assessments" ON public.assessments
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.current_school_id()
    AND public.can_view_term_as_teacher(term_id)
  )
);
