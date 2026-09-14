-- Ensure every school tenant always has an active subscription plan.
-- The lowest-priced active non-platform plan is used as the default.

DO $$
DECLARE
  default_plan_id uuid;
BEGIN
  SELECT id INTO default_plan_id
  FROM public.subscription_plans
  WHERE is_active = true AND is_platform_only = false
  ORDER BY price ASC, created_at ASC
  LIMIT 1;

  IF default_plan_id IS NULL THEN
    RAISE EXCEPTION 'No active non-platform subscription plan exists';
  END IF;

  INSERT INTO public.school_subscriptions
    (school_id, plan_id, status, starts_at, auto_renew)
  SELECT s.id, default_plan_id, 'active', CURRENT_DATE, false
  FROM public.schools s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.school_subscriptions ss
    WHERE ss.school_id = s.id
      AND ss.status IN ('trial', 'active', 'past_due')
  );
END $$;

CREATE OR REPLACE FUNCTION public.assign_default_school_subscription()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_plan_id uuid;
BEGIN
  SELECT id INTO default_plan_id
  FROM public.subscription_plans
  WHERE is_active = true AND is_platform_only = false
  ORDER BY price ASC, created_at ASC
  LIMIT 1;

  IF default_plan_id IS NULL THEN
    RAISE EXCEPTION 'No active non-platform subscription plan exists';
  END IF;

  INSERT INTO public.school_subscriptions
    (school_id, plan_id, status, starts_at, auto_renew)
  VALUES
    (NEW.id, default_plan_id, 'active', CURRENT_DATE, false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_default_subscription ON public.schools;
CREATE TRIGGER schools_default_subscription
AFTER INSERT ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_school_subscription();
