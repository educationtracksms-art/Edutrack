ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS duration_days integer;

UPDATE public.subscription_plans
SET duration_days = CASE billing_cycle
  WHEN 'monthly' THEN 30
  WHEN 'termly' THEN 90
  WHEN 'annual' THEN 365
  ELSE 30
END
WHERE duration_days IS NULL;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_duration_days_check;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_duration_days_check
  CHECK (duration_days IS NULL OR duration_days > 0);

CREATE OR REPLACE FUNCTION public.set_subscription_end_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_duration integer;
BEGIN
  IF NEW.starts_at IS NULL THEN
    NEW.starts_at := CURRENT_DATE;
  END IF;

  SELECT duration_days INTO plan_duration
  FROM public.subscription_plans
  WHERE id = NEW.plan_id;

  IF NEW.ends_at IS NULL AND plan_duration IS NOT NULL THEN
    NEW.ends_at := NEW.starts_at + plan_duration;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_subscriptions_set_end_date
  ON public.school_subscriptions;

CREATE TRIGGER school_subscriptions_set_end_date
BEFORE INSERT OR UPDATE OF plan_id, starts_at, ends_at
ON public.school_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_subscription_end_date();

UPDATE public.school_subscriptions ss
SET ends_at = ss.starts_at + p.duration_days
FROM public.subscription_plans p
WHERE p.id = ss.plan_id
  AND ss.ends_at IS NULL
  AND p.duration_days IS NOT NULL;
