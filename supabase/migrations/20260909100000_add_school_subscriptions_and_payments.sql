-- Platform billing is owned by the Super Admin. Schools can see their
-- subscription status through normal tenant reads, but cannot change billing.
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','termly','annual')),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial','active','past_due','expired','cancelled')),
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_subscription_per_school
  ON public.school_subscriptions(school_id) WHERE status IN ('trial','active','past_due');

CREATE TABLE IF NOT EXISTS public.school_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.school_subscriptions(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'UGX',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','bank','mobile_money','card','other')),
  reference text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','failed','refunded')),
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.subscription_plans (name, price, billing_cycle, description)
VALUES ('Standard', 0, 'monthly', 'Standard school subscription')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.school_subscriptions, public.school_payments TO authenticated;
GRANT ALL ON public.subscription_plans, public.school_subscriptions, public.school_payments TO service_role;

CREATE POLICY subscription_plans_read ON public.subscription_plans FOR SELECT TO authenticated
  USING (public.is_super_admin() OR is_active = true);
CREATE POLICY school_subscriptions_read ON public.school_subscriptions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY school_subscriptions_manage ON public.school_subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY school_payments_read ON public.school_payments FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY school_payments_manage ON public.school_payments FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
