-- Subscription Management System — Part 2: allow pending/confirmed via self-serve RPC.
-- The tracked RPC change_own_school_subscription() (20260911130000) only allows
-- trial/active/past_due/expired/cancelled, so subscribing with status 'pending'
-- would always fail with 'Invalid subscription status'. Extend it without
-- rewriting the published migration.

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
  IF p_status NOT IN ('trial', 'active', 'past_due', 'expired', 'cancelled', 'pending', 'confirmed') THEN
    RAISE EXCEPTION 'Invalid subscription status';
  END IF;
  IF p_ends_at IS NOT NULL AND p_ends_at < p_starts_at THEN
    RAISE EXCEPTION 'Subscription end date must be on or after the start date';
  END IF;

  SELECT p.is_platform_only INTO current_platform_only
  FROM public.school_subscriptions ss
  JOIN public.subscription_plans p ON p.id = ss.plan_id
  WHERE ss.school_id = school_id_value
    AND ss.status IN ('trial', 'active', 'past_due', 'pending', 'confirmed')
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

  -- Single open subscription per school: subscribing while one exists is blocked
  -- in the app layer, but guard here too so concurrent requests cannot double-book.
  IF EXISTS (
    SELECT 1 FROM public.school_subscriptions
    WHERE school_id = school_id_value
      AND status IN ('trial', 'active', 'past_due', 'pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'This school already has an active subscription. Please cancel it before subscribing to a new plan.';
  END IF;

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

-- Status transitions are enforced in the server functions (not via table
-- trigger, which would also fire for Super Admin writes):
--   createSchoolSubscription (school_admin → pending only),
--   confirmPayment (super_admin pending → active only).
