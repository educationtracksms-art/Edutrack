-- Finance roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bursar';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'library';

-- Staff/role helpers
CREATE OR REPLACE FUNCTION public.can_manage_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','school_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_library()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','school_admin')
  );
$$;

-- Finance module toggle support
INSERT INTO public.feature_toggles (school_id, module, enabled)
SELECT id, 'finance', true
FROM public.schools
ON CONFLICT (school_id, module) DO NOTHING;

-- Financial years and periods
CREATE TABLE IF NOT EXISTS public.financial_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  financial_year_id uuid NOT NULL REFERENCES public.financial_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  account_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_system_account boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  financial_year_id uuid NOT NULL REFERENCES public.financial_years(id) ON DELETE CASCADE,
  department_name text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  budget_category text NOT NULL,
  period_name text,
  proposed_amount numeric(14,2) NOT NULL DEFAULT 0,
  approved_amount numeric(14,2) NOT NULL DEFAULT 0,
  revised_amount numeric(14,2) NOT NULL DEFAULT 0,
  actual_amount numeric(14,2) NOT NULL DEFAULT 0,
  committed_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS committed_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revised_amount numeric(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  transaction_number text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  source_module text NOT NULL,
  source_record_id uuid,
  transaction_type text NOT NULL,
  reference_number text,
  status text NOT NULL DEFAULT 'posted',
  narration text,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, transaction_number)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  entry_number text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  status text NOT NULL DEFAULT 'posted',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, entry_number)
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  narration text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid,
  receipt_number text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  issued_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  supplier_id uuid,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  payment_number text NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL,
  reference_number text,
  status text NOT NULL DEFAULT 'posted',
  narration text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, payment_number)
);

CREATE TABLE IF NOT EXISTS public.audit_logs_finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL DEFAULT 'finance',
  entity text,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.department_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_heads_teacher_unique UNIQUE (department_id, teacher_id, start_date),
  CONSTRAINT department_heads_date_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS department_heads_active_department_uniq
  ON public.department_heads (department_id)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS department_heads_active_teacher_uniq
  ON public.department_heads (teacher_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_assignments_role_check CHECK (role IN ('bursar', 'library')),
  CONSTRAINT staff_assignments_date_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_assignments_active_uniq
  ON public.staff_assignments (school_id, user_id, role, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  tax_number text,
  payment_details text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, supplier_name)
);

CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  request_number text NOT NULL,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  department_name text,
  item_description text NOT NULL,
  requested_amount numeric(14,2) NOT NULL DEFAULT 0,
  approved_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  approval_status text NOT NULL DEFAULT 'draft',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, request_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  purchase_request_id uuid REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  ordered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  department_name text,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  items_received numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'received',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.approved_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  department_name text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  approval_status text NOT NULL DEFAULT 'pending',
  approval_note text,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  payment_voucher_id uuid,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  approved_invoice_id uuid REFERENCES public.approved_invoices(id) ON DELETE SET NULL,
  voucher_number text NOT NULL,
  department_name text,
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  payee_name text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'bank',
  status text NOT NULL DEFAULT 'draft',
  prepared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_financial_years_school ON public.financial_years (school_id, is_current);
CREATE INDEX IF NOT EXISTS idx_financial_periods_year ON public.financial_periods (financial_year_id, school_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_school ON public.chart_of_accounts (school_id, category, account_type);
CREATE INDEX IF NOT EXISTS idx_budgets_school_year ON public.budgets (school_id, financial_year_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON public.budget_lines (budget_id, school_id);
CREATE INDEX IF NOT EXISTS idx_transactions_school_date ON public.transactions (school_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_school_date ON public.journal_entries (school_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_school_date ON public.payments (school_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_school_status ON public.receipts (school_id, status);
CREATE INDEX IF NOT EXISTS idx_suppliers_school ON public.suppliers (school_id, supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_school_status ON public.purchase_requests (school_id, status, approval_status);
CREATE INDEX IF NOT EXISTS idx_departments_school ON public.departments (school_id, name);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_school_status ON public.purchase_orders (school_id, status);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_school_date ON public.goods_receipts (school_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_approved_invoices_school_status ON public.approved_invoices (school_id, approval_status, status);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_school_status ON public.payment_vouchers (school_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_school ON public.staff_assignments (school_id, role, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_department ON public.staff_assignments (department_id, is_active);
CREATE INDEX IF NOT EXISTS idx_department_heads_school ON public.department_heads (school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_department_heads_department ON public.department_heads (department_id, is_active);

ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_school_read_financial_years" ON public.financial_years
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_financial_years" ON public.financial_years
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_financial_periods" ON public.financial_periods
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_financial_periods" ON public.financial_periods
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_chart_of_accounts" ON public.chart_of_accounts
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_chart_of_accounts" ON public.chart_of_accounts
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_budgets" ON public.budgets
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_budgets" ON public.budgets
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_budget_lines" ON public.budget_lines
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_budget_lines" ON public.budget_lines
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_transactions" ON public.transactions
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_transactions" ON public.transactions
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_journal_entries" ON public.journal_entries
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_journal_entries" ON public.journal_entries
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_journal_entry_lines" ON public.journal_entry_lines
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_journal_entry_lines" ON public.journal_entry_lines
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_payments" ON public.payments
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_receipts" ON public.receipts
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_receipts" ON public.receipts
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_purchase_requests" ON public.purchase_requests
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_purchase_requests" ON public.purchase_requests
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "school_read_departments" ON public.departments
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "school_write_departments" ON public.departments
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

CREATE POLICY "finance_school_read_purchase_orders" ON public.purchase_orders
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_goods_receipts" ON public.goods_receipts
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_goods_receipts" ON public.goods_receipts
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_approved_invoices" ON public.approved_invoices
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_approved_invoices" ON public.approved_invoices
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "finance_school_read_payment_vouchers" ON public.payment_vouchers
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "finance_school_write_payment_vouchers" ON public.payment_vouchers
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

CREATE POLICY "staff_assignments_read" ON public.staff_assignments
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "staff_assignments_write" ON public.staff_assignments
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

CREATE POLICY "department_heads_read" ON public.department_heads
  FOR SELECT TO authenticated USING (public.is_super_admin() OR school_id = public.current_school_id());
CREATE POLICY "department_heads_write" ON public.department_heads
  FOR ALL TO authenticated USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_school()));

INSERT INTO public.chart_of_accounts (school_id, code, name, category, account_type, is_system_account)
SELECT s.id, account.code, account.name, account.category, account.account_type, true
FROM public.schools s
CROSS JOIN (
  VALUES
    ('1000', 'Cash', 'Assets', 'asset'),
    ('1010', 'Bank', 'Assets', 'asset'),
    ('1100', 'Accounts Receivable', 'Assets', 'asset'),
    ('4000', 'Tuition Fees', 'Income', 'income'),
    ('4001', 'Other Income', 'Income', 'income'),
    ('5000', 'School Expenses', 'Expenses', 'expense')
) AS account(code, name, category, account_type)
ON CONFLICT (school_id, code) DO NOTHING;
