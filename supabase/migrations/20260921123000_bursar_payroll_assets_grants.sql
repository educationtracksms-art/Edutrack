-- Bursar module Phase 2: payroll, assets, grants, aid and tax tables.

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period_name text NOT NULL,
  pay_date date NOT NULL DEFAULT CURRENT_DATE,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  role_title text,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  asset_code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  purchase_cost numeric(14,2) NOT NULL DEFAULT 0,
  book_value numeric(14,2) NOT NULL DEFAULT 0,
  accumulated_depreciation numeric(14,2) NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL DEFAULT 5,
  location text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, asset_code)
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, item_code)
);

CREATE TABLE IF NOT EXISTS public.donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grant_code text NOT NULL,
  title text NOT NULL,
  donor_name text,
  donor_id uuid REFERENCES public.donors(id) ON DELETE SET NULL,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  received_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, grant_code)
);

CREATE TABLE IF NOT EXISTS public.financial_aid_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  award_name text NOT NULL,
  sponsor_name text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  rate numeric(6,3) NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'payroll',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

INSERT INTO public.finance_payment_methods (school_id, code, name, category, is_system, is_active, sort_order, requires_reference, supports_settlement)
SELECT s.id, method.code, method.name, method.category, true, true, method.sort_order, method.requires_reference, method.supports_settlement
FROM public.schools s
CROSS JOIN (VALUES
  ('cash', 'Cash', 'cash', 10, false, false),
  ('bank_transfer', 'Bank Transfer', 'bank', 20, true, false),
  ('cheque', 'Cheque', 'cheque', 30, true, false),
  ('card', 'Card', 'card', 40, true, false),
  ('airtel_money', 'Airtel Money', 'mobile_money', 50, true, true),
  ('mtn_mobile_money', 'MTN Mobile Money', 'mobile_money', 60, true, true)
) AS method(code, name, category, sort_order, requires_reference, supports_settlement)
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO public.finance_settings (school_id, currency, currency_symbol)
SELECT id, 'UGX', 'UGX' FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

SELECT public.finance_apply_tenant_rls(ARRAY[
  'payroll_runs', 'payroll_items', 'fixed_assets', 'inventory_items',
  'donors', 'grants', 'financial_aid_awards', 'tax_rates'
]);

SELECT public.finance_attach_audit_triggers(ARRAY[
  'payroll_runs', 'payroll_items', 'fixed_assets', 'inventory_items',
  'donors', 'grants', 'financial_aid_awards', 'tax_rates'
]);
