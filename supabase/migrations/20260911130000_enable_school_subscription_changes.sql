-- Allow school billing roles to change their own non-Ultimate subscription.
-- Ultimate remains permanently controlled by the Super Admin.
CREATE OR REPLACE FUNCTION public.change_own_school_subscription(
  p_plan_id uuid,
  p_status text,
  p_starts_at date,
  p_ends_at date DEFAULT NULL,
  p_auto_renew boolean DEFAULT false
)
RETURNS public.school_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result public.school_subscriptions;
  school_id_value uuid := public.current_school_id();
  current_platform_only boolean;
BEGIN
  IF school_id_value IS NULL THEN
    RAISE EXCEPTION 'Your account is not linked to a school';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('school_admin', 'head_teacher', 'dos')
  ) THEN
    RAISE EXCEPTION 'Only school administrators, head teachers and DOS users can change subscriptions';
  END IF;
  IF p_status NOT IN ('trial', 'active', 'past_due', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid subscription status';
  END IF;
  IF p_ends_at IS NOT NULL AND p_ends_at < p_starts_at THEN
    RAISE EXCEPTION 'Subscription end date must be on or after the start date';
  END IF;

  SELECT p.is_platform_only INTO current_platform_only
  FROM public.school_subscriptions ss
  JOIN public.subscription_plans p ON p.id = ss.plan_id
  WHERE ss.school_id = school_id_value
    AND ss.status IN ('trial', 'active', 'past_due')
  ORDER BY ss.created_at DESC LIMIT 1;
  IF COALESCE(current_platform_only, false) THEN
    RAISE EXCEPTION 'Ultimate subscriptions can only be changed by the Super Admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans
    WHERE id = p_plan_id AND is_active = true AND is_platform_only = false
  ) THEN
    RAISE EXCEPTION 'Choose an available subscription plan';
  END IF;

  UPDATE public.school_subscriptions
  SET status = 'expired', updated_at = now()
  WHERE school_id = school_id_value
    AND status IN ('trial', 'active', 'past_due');

  INSERT INTO public.school_subscriptions
    (school_id, plan_id, status, starts_at, ends_at, auto_renew, created_by)
  VALUES
    (school_id_value, p_plan_id, p_status, p_starts_at, p_ends_at,
     CASE WHEN p_status IN ('active', 'trial') THEN p_auto_renew ELSE false END,
     auth.uid())
  RETURNING * INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_own_school_subscription(uuid, text, date, date, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.current_school_has_ultimate_subscription()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_subscriptions ss
    JOIN public.subscription_plans p ON p.id = ss.plan_id
    WHERE ss.school_id = public.current_school_id()
      AND ss.status IN ('trial', 'active', 'past_due')
      AND p.is_platform_only = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.current_school_has_ultimate_subscription() TO authenticated;
