-- Keep school self-service cancellation within the tenant boundary while
-- allowing the pending cancellation offered by the school billing screen.
CREATE OR REPLACE FUNCTION public.cancel_own_pending_school_subscription(
  p_subscription_id uuid
)
RETURNS public.school_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.school_subscriptions;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'school_admin'
      AND school_id = public.current_school_id()
  ) THEN
    RAISE EXCEPTION 'Only the School Admin can cancel a pending subscription';
  END IF;

  UPDATE public.school_subscriptions
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_at = now()
  WHERE id = p_subscription_id
    AND school_id = public.current_school_id()
    AND status = 'pending'
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending subscription not found for your school';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_own_pending_school_subscription(uuid) TO authenticated;

-- Super Admin replacement must close every state covered by the one-open
-- subscription index, including pending requests and legacy confirmed rows.
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.school_subscriptions;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans
    WHERE id = p_plan_id
      AND (
        is_active = true
        OR EXISTS (
          SELECT 1 FROM public.school_subscriptions
          WHERE school_id = p_school_id AND plan_id = p_plan_id
            AND status IN ('trial', 'active', 'past_due', 'pending', 'confirmed')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Choose an active subscription plan';
  END IF;

  UPDATE public.school_subscriptions
  SET status = 'expired', updated_at = now()
  WHERE school_id = p_school_id
    AND status IN ('trial', 'active', 'past_due', 'pending', 'confirmed');

  INSERT INTO public.school_subscriptions (
    school_id, plan_id, status, starts_at, ends_at, notes,
    auto_renew, created_by, cancelled_at, cancelled_by
  ) VALUES (
    p_school_id, p_plan_id, p_status, p_starts_at, p_ends_at,
    NULLIF(trim(p_notes), ''),
    CASE WHEN p_status IN ('active', 'trial') THEN p_auto_renew ELSE false END,
    auth.uid(),
    CASE WHEN p_status = 'cancelled' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'cancelled' THEN auth.uid() ELSE NULL END
  ) RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_school_subscription(
  uuid, uuid, text, date, date, text, boolean
) TO authenticated;

-- Activation and its payment ledger entry must succeed or fail together.
CREATE OR REPLACE FUNCTION public.confirm_school_subscription_payment(
  p_subscription_id uuid,
  p_payment_method text,
  p_confirmed_amount numeric DEFAULT NULL,
  p_payment_reference text DEFAULT NULL
)
RETURNS public.school_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub public.school_subscriptions;
  plan public.subscription_plans;
  payment_ref text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the Super Admin can confirm payments';
  END IF;
  IF p_payment_method NOT IN ('mtn', 'airtel', 'bank', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT * INTO sub FROM public.school_subscriptions
  WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  IF sub.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending subscriptions can be confirmed';
  END IF;

  SELECT * INTO plan FROM public.subscription_plans WHERE id = sub.plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF p_confirmed_amount IS NOT NULL AND p_confirmed_amount <> plan.price THEN
    RAISE EXCEPTION 'Confirmed amount must match the plan price';
  END IF;

  payment_ref := COALESCE(sub.payment_reference, p_payment_reference, 'EDU-' || upper(substr(replace(sub.school_id::text, '-', ''), 1, 6))
    || '-' || upper(substr(replace(sub.id::text, '-', ''), 1, 6)));

  UPDATE public.school_subscriptions
  SET status = 'active', payment_reference = payment_ref,
      payment_confirmed_by = auth.uid(), payment_confirmed_at = now(), updated_at = now()
  WHERE id = sub.id
  RETURNING * INTO sub;

  INSERT INTO public.school_payments (
    school_id, subscription_id, amount, currency, payment_date, method,
    reference, status, notes, recorded_by
  ) VALUES (
    sub.school_id, sub.id, plan.price, 'UGX', CURRENT_DATE,
    CASE WHEN p_payment_method IN ('mtn', 'airtel') THEN 'mobile_money' ELSE p_payment_method END,
    payment_ref, 'confirmed', 'Confirmed by Super Admin via ' || p_payment_method, auth.uid()
  );

  RETURN sub;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_school_subscription_payment(uuid, text, numeric, text) TO authenticated;
