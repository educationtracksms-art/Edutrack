-- Bursars manage the financial records of their assigned school. Keep the
-- tenant boundary in the database as well as in the finance dashboard.
CREATE OR REPLACE FUNCTION public.can_manage_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('school_admin', 'bursar')
        AND p.school_id IS NOT NULL
        AND ur.school_id = p.school_id
    );
$$;
