-- Billing is a platform concern.  Schools get a read-only view of their own
-- subscription and payment history; only the Super Admin can change billing.

ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS school_subscriptions_school_dates_idx
  ON public.school_subscriptions(school_id, starts_at DESC, ends_at DESC);

CREATE INDEX IF NOT EXISTS school_payments_school_date_idx
  ON public.school_payments(school_id, payment_date DESC, created_at DESC);

DROP TRIGGER IF EXISTS school_subscriptions_touch ON public.school_subscriptions;
CREATE TRIGGER school_subscriptions_touch
  BEFORE UPDATE ON public.school_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_view_subscription()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('school_admin', 'head_teacher', 'dos')
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_subscription() TO authenticated;

-- RLS below still restricts these mutations to the Super Admin.  The grants
-- are needed by the authenticated server function that changes payment state.
GRANT INSERT, UPDATE, DELETE ON public.school_subscriptions, public.school_payments TO authenticated;

DROP POLICY IF EXISTS school_subscriptions_read ON public.school_subscriptions;
CREATE POLICY school_subscriptions_read ON public.school_subscriptions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.can_view_subscription()
      AND school_id = public.current_school_id()
    )
  );

DROP POLICY IF EXISTS school_payments_read ON public.school_payments;
CREATE POLICY school_payments_read ON public.school_payments
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.can_view_subscription()
      AND school_id = public.current_school_id()
    )
  );

GRANT INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
DROP POLICY IF EXISTS subscription_plans_manage ON public.subscription_plans;
CREATE POLICY subscription_plans_manage ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS subscription_plans_read ON public.subscription_plans;
CREATE POLICY subscription_plans_read ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR is_active = true
    OR EXISTS (
      SELECT 1
      FROM public.school_subscriptions ss
      WHERE ss.plan_id = subscription_plans.id
        AND ss.school_id = public.current_school_id()
        AND public.can_view_subscription()
    )
  );

-- Replacing a subscription is one transaction.  This prevents a failed
-- insert from leaving a school with its previous subscription already closed.
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
          WHERE school_id = p_school_id
            AND plan_id = p_plan_id
            AND status IN ('trial', 'active', 'past_due')
        )
      )
  ) THEN
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
    p_school_id, p_plan_id, p_status, p_starts_at, p_ends_at,
    NULLIF(trim(p_notes), ''),
    CASE WHEN p_status IN ('active', 'trial') THEN p_auto_renew ELSE false END,
    auth.uid(),
    CASE WHEN p_status = 'cancelled' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'cancelled' THEN auth.uid() ELSE NULL END
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_school_subscription(
  uuid, uuid, text, date, date, text, boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_school_payment(
  p_school_id uuid,
  p_subscription_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_date date,
  p_method text,
  p_reference text DEFAULT NULL,
  p_status text DEFAULT 'confirmed',
  p_notes text DEFAULT NULL
)
RETURNS public.school_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result public.school_payments;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the Super Admin can record payments';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF p_method NOT IN ('cash', 'bank', 'mobile_money', 'card', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_status NOT IN ('pending', 'confirmed', 'failed', 'refunded') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'School not found';
  END IF;
  IF p_subscription_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.school_subscriptions
    WHERE id = p_subscription_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Payment subscription does not belong to this school';
  END IF;

  INSERT INTO public.school_payments (
    school_id, subscription_id, amount, currency, payment_date,
    method, reference, status, notes, recorded_by
  )
  VALUES (
    p_school_id, p_subscription_id, p_amount, upper(trim(coalesce(p_currency, 'UGX'))),
    p_payment_date, p_method, NULLIF(trim(p_reference), ''), p_status,
    NULLIF(trim(p_notes), ''), auth.uid()
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_school_payment(
  uuid, uuid, numeric, text, date, text, text, text, text
) TO authenticated;

-- Keep the legacy school field useful for older platform screens while the
-- normalized subscription tables remain the source of truth.
UPDATE public.schools s
SET subscription_plan = p.name
FROM public.school_subscriptions ss
JOIN public.subscription_plans p ON p.id = ss.plan_id
WHERE ss.school_id = s.id
  AND ss.status IN ('trial', 'active', 'past_due');
