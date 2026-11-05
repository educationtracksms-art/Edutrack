-- School staff need to read subscription dates to determine dashboard access.
-- Keep this status-only function separate from payment-history permissions.
CREATE OR REPLACE FUNCTION public.get_current_school_subscription_status()
RETURNS TABLE (
  status text,
  starts_at date,
  ends_at date,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ss.status, ss.starts_at, ss.ends_at, ss.created_at
  FROM public.school_subscriptions ss
  WHERE ss.school_id = public.current_school_id()
    AND ss.status IN ('trial', 'active', 'past_due', 'pending', 'confirmed')
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'school_admin',
          'head_teacher',
          'deputy_head_teacher',
          'dos',
          'hod',
          'class_teacher',
          'subject_teacher',
          'librarian',
          'bursar',
          'library'
        )
    )
  ORDER BY ss.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_current_school_subscription_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_school_subscription_status() TO authenticated;
-- School staff need to read subscription dates to determine dashboard access.
-- Keep this status-only function separate from payment-history permissions.
CREATE OR REPLACE FUNCTION public.get_current_school_subscription_status()
RETURNS TABLE (
  status text,
  starts_at date,
  ends_at date,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ss.status, ss.starts_at, ss.ends_at, ss.created_at
  FROM public.school_subscriptions ss
  WHERE ss.school_id = public.current_school_id()
    AND ss.status IN ('trial', 'active', 'past_due', 'pending', 'confirmed')
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN (
          'school_admin',
          'head_teacher',
          'deputy_head_teacher',
          'dos',
          'hod',
          'class_teacher',
          'subject_teacher',
          'librarian',
          'bursar',
          'library'
        )
    )
  ORDER BY ss.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_current_school_subscription_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_school_subscription_status() TO authenticated;
