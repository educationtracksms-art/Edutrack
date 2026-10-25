-- Subscription and billing notifications are visible to school leadership.
-- Classify existing Super Admin billing messages before tightening reads.
UPDATE public.notifications
SET type = 'subscription'
WHERE type IS DISTINCT FROM 'subscription'
  AND (
    title IN (
      'Subscription updated',
      'Subscription activated',
      'Subscription cancelled',
      'Payment recorded',
      'Payment status updated'
    )
    OR title LIKE 'Subscription expiry reminder%'
  );

-- The original tenant policy allowed every school user to read every
-- notification in that school. Keep that behavior for ordinary notices while
-- restricting subscription notices to accounts with the School Admin role.
DROP POLICY IF EXISTS tenant_read_notifications ON public.notifications;

CREATE POLICY tenant_read_notifications
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      school_id = public.current_school_id()
      AND (
        COALESCE(type, 'general') NOT IN ('subscription', 'subscription_expiry')
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.school_id = public.notifications.school_id
            AND ur.role IN ('school_admin', 'dos', 'head_teacher', 'deputy_head_teacher')
        )
      )
    )
  );

-- Expiry reminders were previously sent only to the School Admin. Send the
-- same deduplicated reminder to the academic leadership roles as well.
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
  subject text;
  body text;
BEGIN
  subject := format('Subscription expiry reminder — %s', p_school_name);
  body := format(
    'Your %s subscription will expire on %s. Please renew to avoid service interruption.',
    p_school_name,
    p_end_date
  );

  FOR admin_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.school_id = p_school_id
      AND ur.role IN ('school_admin', 'dos', 'head_teacher', 'deputy_head_teacher')
      AND p.is_active = true
  LOOP
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
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_school_admin_expiry(uuid, text, date, integer) TO authenticated;
