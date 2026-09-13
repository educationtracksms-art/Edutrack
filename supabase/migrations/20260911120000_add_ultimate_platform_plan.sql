-- Ultimate is a platform-only, lifetime plan. It can be assigned to a school
-- by the Super Admin, but its plan record is never exposed to school users.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS is_platform_only boolean NOT NULL DEFAULT false;

INSERT INTO public.subscription_plans (
  name,
  price,
  billing_cycle,
  description,
  display_order,
  is_active,
  is_platform_only
)
VALUES (
  'Ultimate',
  0,
  'annual',
  'Lifetime platform plan with no subscription end date. Super Admin assignment only.',
  0,
  true,
  true
)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  billing_cycle = EXCLUDED.billing_cycle,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  is_platform_only = EXCLUDED.is_platform_only;

-- Enforce the lifetime rule at the database boundary as well as in the UI.
CREATE OR REPLACE FUNCTION public.replace_school_subscription(
  p_school_id uuid,
  p_plan_id uuid,
  p_status text,
  p_starts_at date,
  p_ends_at date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_auto_renew boolean DEFAULT false
)
RETURNS public.school_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result public.school_subscriptions;
  platform_only boolean;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the Super Admin can manage subscriptions';
  END IF;
  IF p_status NOT IN ('trial', 'active', 'past_due', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid subscription status';
  END IF;
  IF p_ends_at IS NOT NULL AND p_ends_at < p_starts_at THEN
    RAISE EXCEPTION 'Subscription end date must be on or after the start date';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  SELECT is_platform_only INTO platform_only
  FROM public.subscription_plans
  WHERE id = p_plan_id
    AND (
      is_active = true
      OR EXISTS (
        SELECT 1
        FROM public.school_subscriptions
        WHERE school_id = p_school_id
          AND plan_id = p_plan_id
          AND status IN ('trial', 'active', 'past_due')
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active subscription plan';
  END IF;

  UPDATE public.school_subscriptions
  SET status = 'expired', updated_at = now()
  WHERE school_id = p_school_id
    AND status IN ('trial', 'active', 'past_due');

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, starts_at, ends_at, notes,
    auto_renew, created_by, cancelled_at, cancelled_by
  )
  VALUES (
    p_school_id, p_plan_id, p_status, p_starts_at,
    CASE WHEN platform_only THEN NULL ELSE p_ends_at END,
    NULLIF(trim(p_notes), ''),
    CASE WHEN platform_only OR p_status NOT IN ('active', 'trial') THEN false ELSE p_auto_renew END,
    auth.uid(),
    CASE WHEN p_status = 'cancelled' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'cancelled' THEN auth.uid() ELSE NULL END
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- School users can see normal active plans, but never the Ultimate plan.
DROP POLICY IF EXISTS subscription_plans_read ON public.subscription_plans;
CREATE POLICY subscription_plans_read ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (is_active = true AND is_platform_only = false)
  );

-- Keep the legacy school field useful for platform reports.
UPDATE public.schools s
SET subscription_plan = p.name
FROM public.school_subscriptions ss
JOIN public.subscription_plans p ON p.id = ss.plan_id
WHERE ss.school_id = s.id
  AND ss.status IN ('trial', 'active', 'past_due');
