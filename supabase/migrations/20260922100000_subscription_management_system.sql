-- Subscription Management System — Part 1: Schema extensions
-- Adds flexible duration fields, pending/confirmed statuses, payment references,
-- and the subscription_expiry_notifications tracking table.

-- 1. Add flexible duration columns to subscription_plans.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS duration_value integer NOT NULL DEFAULT 1 CHECK (duration_value > 0),
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'months'
    CHECK (duration_unit IN ('days','weeks','months','years'));

-- Backfill: map existing billing_cycle to duration_value + duration_unit.
UPDATE public.subscription_plans
SET
  duration_value = CASE
    WHEN billing_cycle = 'monthly'  THEN 1
    WHEN billing_cycle = 'termly'   THEN 3
    WHEN billing_cycle = 'annual'   THEN 1
    ELSE 1
  END,
  duration_unit = CASE
    WHEN billing_cycle = 'monthly'  THEN 'months'
    WHEN billing_cycle = 'termly'   THEN 'months'
    WHEN billing_cycle = 'annual'   THEN 'years'
    ELSE 'months'
  END
WHERE duration_value = 1 AND duration_unit = 'months';

-- Helper: convert duration_value + duration_unit to days.
CREATE OR REPLACE FUNCTION public.duration_to_days(p_value integer, p_unit text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_unit
    WHEN 'days'   THEN p_value
    WHEN 'weeks'  THEN p_value * 7
    WHEN 'months' THEN p_value * 30
    WHEN 'years'  THEN p_value * 365
    ELSE p_value * 30
  END;
$$;

-- Auto-sync duration_days whenever duration_value/unit change.
CREATE OR REPLACE FUNCTION public.sync_plan_duration_days()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.duration_value IS NOT NULL AND NEW.duration_unit IS NOT NULL THEN
    NEW.duration_days := public.duration_to_days(NEW.duration_value, NEW.duration_unit);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plans_sync_duration_days
  ON public.subscription_plans;

CREATE TRIGGER subscription_plans_sync_duration_days
  BEFORE INSERT OR UPDATE OF duration_value, duration_unit, duration_days
  ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_plan_duration_days();

-- Backfill duration_days for any rows where it is stale.
UPDATE public.subscription_plans
SET duration_days = public.duration_to_days(duration_value, duration_unit)
WHERE duration_days IS NULL OR duration_days != public.duration_to_days(duration_value, duration_unit);

-- 2. Add payment_reference and payment confirmation tracking to school_subscriptions.
ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

-- 3. Add 'pending' and 'confirmed' statuses to the subscription status check.
ALTER TABLE public.school_subscriptions
  DROP CONSTRAINT IF EXISTS school_subscriptions_status_check;

ALTER TABLE public.school_subscriptions
  ADD CONSTRAINT school_subscriptions_status_check
  CHECK (status IN ('trial','active','past_due','expired','cancelled','pending','confirmed'));

-- 5. Subscription expiry notification tracking table.
--    Prevents duplicate notifications for the same milestone/channel/day.
--    Also extends notifications with the 'type' column used by the notifier
--    and app code (base table only has title/body).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general';

CREATE TABLE IF NOT EXISTS public.subscription_expiry_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.school_subscriptions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  days_before integer NOT NULL CHECK (days_before IN (30,14,7,3,1,0)),
  scheduled_for date NOT NULL,
  sent_at timestamptz,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','sms')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, days_before, channel, scheduled_for)
);

ALTER TABLE public.subscription_expiry_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.subscription_expiry_notifications TO authenticated;
GRANT ALL ON public.subscription_expiry_notifications TO service_role;

CREATE POLICY subscription_expiry_notifications_read
  ON public.subscription_expiry_notifications FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());

CREATE POLICY subscription_expiry_notifications_manage
  ON public.subscription_expiry_notifications FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 6. Notify the school admin via in-app notification + email queue.
CREATE OR REPLACE FUNCTION public.notify_school_admin_expiry(
  p_school_id uuid,
  p_school_name text,
  p_end_date date,
  p_days_before integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid;
  admin_name text;
  subject text;
  body text;
BEGIN
  SELECT ur.user_id, p.full_name
    INTO admin_user_id, admin_name
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.school_id = p_school_id
      AND ur.role = 'school_admin'
      AND p.is_active = true
    LIMIT 1;

  IF admin_user_id IS NULL THEN
    RETURN;
  END IF;

  subject := format('Subscription expiry reminder — %s', p_school_name);
  body := format(
    'Your %s subscription will expire on %s. Please renew to avoid service interruption.',
    p_school_name,
    p_end_date
  );

  -- In-app notification (notifications has no dedupe constraint, so guard manually).
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.school_id = p_school_id
      AND n.user_id = admin_user_id
      AND n.title = subject
      AND n.body = body
      AND n.type = 'subscription_expiry'
      AND n.created_at::date = CURRENT_DATE
  ) THEN
    INSERT INTO public.notifications (school_id, user_id, title, body, type)
    VALUES (p_school_id, admin_user_id, subject, body, 'subscription_expiry');
  END IF;

  -- Email notification: notifications has no delivery columns, so queue a second
  -- in-app row tagged for email delivery instead of referencing missing columns.
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.school_id = p_school_id
      AND n.user_id = admin_user_id
      AND n.title = subject
      AND n.body = body || ' [email queue]'
      AND n.type = 'subscription_expiry'
      AND n.created_at::date = CURRENT_DATE
  ) THEN
    INSERT INTO public.notifications (school_id, user_id, title, body, type)
    VALUES (p_school_id, admin_user_id, subject, body || ' [email queue]', 'subscription_expiry');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_school_admin_expiry(uuid, text, date, integer) TO authenticated;

-- 7. Planner: inserts notification tracking rows for subscriptions reaching a milestone.
CREATE OR REPLACE FUNCTION public.plan_expiry_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := CURRENT_DATE;
BEGIN
  INSERT INTO public.subscription_expiry_notifications
    (subscription_id, school_id, days_before, scheduled_for)
  SELECT
    ss.id,
    ss.school_id,
    d.days_before,
    (ss.ends_at - d.days_before)::date
  FROM public.school_subscriptions ss
  CROSS JOIN (VALUES (30),(14),(7),(3),(1),(0)) AS d(days_before)
  WHERE ss.status IN ('active','pending','confirmed')
    AND ss.ends_at IS NOT NULL
    AND (ss.ends_at - d.days_before)::date <= today
    AND NOT EXISTS (
      SELECT 1 FROM public.subscription_expiry_notifications sen
      WHERE sen.subscription_id = ss.id
        AND sen.days_before = d.days_before
        AND sen.channel = 'in_app'
        AND sen.scheduled_for = (ss.ends_at - d.days_before)::date
    )
  ON CONFLICT (subscription_id, days_before, channel, scheduled_for) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_expiry_notifications() TO service_role;

-- 8. Delivery: sends pending in_app notifications and marks them as sent.
CREATE OR REPLACE FUNCTION public.deliver_pending_expiry_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expiry_row record;
BEGIN
  FOR expiry_row IN
    SELECT sen.subscription_id, sen.school_id, sen.days_before, sen.scheduled_for
    FROM public.subscription_expiry_notifications sen
    WHERE sen.channel = 'in_app'
      AND sen.sent_at IS NULL
      AND sen.scheduled_for <= CURRENT_DATE
  LOOP
    PERFORM public.notify_school_admin_expiry(
      expiry_row.school_id,
      (SELECT s.name FROM public.schools s WHERE s.id = expiry_row.school_id),
      (SELECT ss.ends_at FROM public.school_subscriptions ss WHERE ss.id = expiry_row.subscription_id),
      expiry_row.days_before
    );
    UPDATE public.subscription_expiry_notifications
    SET sent_at = now()
    WHERE id = expiry_row.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deliver_pending_expiry_notifications() TO service_role;

-- 9. Auto-update expired subscriptions nightly (status = active/past_due → expired).
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.school_subscriptions
  SET status = 'expired',
      updated_at = now()
  WHERE status IN ('active','past_due')
    AND ends_at IS NOT NULL
    AND ends_at < CURRENT_DATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_overdue_subscriptions() TO service_role;

-- 10. Combined nightly maintenance job: expire overdue subscriptions, plan the
--     notification milestones (30/14/7/3/1/0 days, per §3 schedule), then
--     deliver due in-app rows.
CREATE OR REPLACE FUNCTION public.run_subscription_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.expire_overdue_subscriptions();
  PERFORM public.plan_expiry_notifications();
  PERFORM public.deliver_pending_expiry_notifications();
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_subscription_maintenance() TO service_role;

-- 11. Nightly schedule via pg_cron when the extension is installed.
--     Falls back gracefully (NOTICE only) on hosts without pg_cron, so the
--     migration never fails on Supabase projects without the cron schema.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    PERFORM cron.schedule(
      'subscription-nightly-maintenance',
      '30 0 * * *',
      'SELECT public.run_subscription_maintenance();'
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed: skipping subscription-nightly-maintenance schedule';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_function THEN
    RAISE NOTICE 'cron.schedule unavailable: skipping subscription-nightly-maintenance schedule';
END;
$$;

-- 4. Rebuild the partial unique index: ONE open subscription per school.
DROP INDEX IF EXISTS one_open_subscription_per_school;

CREATE UNIQUE INDEX one_open_subscription_per_school
  ON public.school_subscriptions(school_id)
  WHERE status IN ('trial','active','past_due','pending','confirmed');
