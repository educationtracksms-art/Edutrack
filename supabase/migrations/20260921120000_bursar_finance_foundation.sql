-- =============================================================================
-- Bursar & Financial Management Module — Phase 1: foundation
-- =============================================================================
-- Adds the accounting foundation the rest of the Bursar module builds on:
--   * financial settings (UGX default currency, approval thresholds, numbering)
--   * concurrency-safe document numbering
--   * granular finance permissions underneath the bursar role
--   * cost centres, funds and branches for optional multi-entity reporting
--   * approval rules / requests / actions (approval centre)
--   * document attachments and audit triggers for financial tables
--
-- This migration is additive: it never recreates students, parents, classes,
-- streams, academic years or terms. Those remain owned by the school system.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Financial settings (one row per school)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'UGX',
  currency_symbol text NOT NULL DEFAULT 'UGX',
  invoice_prefix text NOT NULL DEFAULT 'INV',
  receipt_prefix text NOT NULL DEFAULT 'RCT',
  payment_prefix text NOT NULL DEFAULT 'PAY',
  journal_prefix text NOT NULL DEFAULT 'JV',
  credit_note_prefix text NOT NULL DEFAULT 'CN',
  debit_note_prefix text NOT NULL DEFAULT 'DN',
  number_pad_width integer NOT NULL DEFAULT 6,
  reset_numbering_yearly boolean NOT NULL DEFAULT true,
  default_fee_due_days integer NOT NULL DEFAULT 30,
  late_payment_grace_days integer NOT NULL DEFAULT 7,
  reminder_days_before_due integer NOT NULL DEFAULT 3,
  allow_advance_payments boolean NOT NULL DEFAULT true,
  auto_allocate_payments boolean NOT NULL DEFAULT true,
  fiscal_year_start_month integer NOT NULL DEFAULT 1,
  require_journal_approval boolean NOT NULL DEFAULT false,
  require_refund_approval boolean NOT NULL DEFAULT true,
  require_expense_approval boolean NOT NULL DEFAULT true,
  require_adjustment_approval boolean NOT NULL DEFAULT true,
  allow_over_budget boolean NOT NULL DEFAULT false,
  approval_threshold_amount numeric(14,2) NOT NULL DEFAULT 500000,
  petty_cash_float_limit numeric(14,2) NOT NULL DEFAULT 200000,
  receivable_account_code text NOT NULL DEFAULT '1100',
  cash_account_code text NOT NULL DEFAULT '1000',
  bank_account_code text NOT NULL DEFAULT '1010',
  mobile_money_account_code text NOT NULL DEFAULT '1020',
  payable_account_code text NOT NULL DEFAULT '2000',
  payroll_payable_account_code text NOT NULL DEFAULT '2100',
  statutory_payable_account_code text NOT NULL DEFAULT '2200',
  discount_account_code text NOT NULL DEFAULT '4050',
  fee_income_account_code text NOT NULL DEFAULT '4000',
  other_income_account_code text NOT NULL DEFAULT '4001',
  expense_account_code text NOT NULL DEFAULT '5000',
  bank_charges_account_code text NOT NULL DEFAULT '5090',
  depreciation_account_code text NOT NULL DEFAULT '5080',
  accumulated_depreciation_account_code text NOT NULL DEFAULT '1050',
  asset_account_code text NOT NULL DEFAULT '1060',
  grant_income_account_code text NOT NULL DEFAULT '4100',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id),
  CONSTRAINT finance_settings_year_month_check CHECK (fiscal_year_start_month BETWEEN 1 AND 12)
);

-- ---------------------------------------------------------------------------
-- 2. Concurrency-safe document numbering
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_number_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  prefix text NOT NULL,
  pad_width integer NOT NULL DEFAULT 6,
  reset_yearly boolean NOT NULL DEFAULT true,
  current_value bigint NOT NULL DEFAULT 0,
  last_reset_year integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, document_type)
);

CREATE OR REPLACE FUNCTION public.next_finance_number(
  p_school_id uuid,
  p_document_type text,
  p_prefix text DEFAULT NULL,
  p_pad_width integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_pad integer;
  v_reset boolean;
  v_seq bigint;
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_base text := upper(coalesce(nullif(btrim(p_document_type), ''), 'DOC'));
BEGIN
  INSERT INTO public.finance_number_sequences (school_id, document_type, prefix, pad_width, reset_yearly)
  VALUES (
    p_school_id,
    v_base,
    coalesce(nullif(btrim(coalesce(p_prefix, '')), ''), left(v_base, 3)),
    greatest(coalesce(p_pad_width, 6), 3),
    true
  )
  ON CONFLICT (school_id, document_type) DO NOTHING;

  -- UPDATE ... RETURNING is atomic: two cashiers collecting at the same moment
  -- can never be given the same document number.
  UPDATE public.finance_number_sequences
     SET current_value = CASE
           WHEN reset_yearly AND (last_reset_year IS DISTINCT FROM v_year) THEN 1
           ELSE current_value + 1
         END,
         last_reset_year = v_year,
         updated_at = now()
   WHERE school_id = p_school_id
     AND document_type = v_base
  RETURNING prefix, pad_width, reset_yearly, current_value
       INTO v_prefix, v_pad, v_reset, v_seq;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Unable to allocate a % number for this school', v_base;
  END IF;

  IF v_reset THEN
    RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, v_pad, '0');
  END IF;

  RETURN v_prefix || '-' || lpad(v_seq::text, v_pad, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_finance_number(uuid, text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.next_finance_number(uuid, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Granular financial permissions
-- ---------------------------------------------------------------------------
-- The bursar role holds the full operational catalogue by default. A school can
-- revoke individual keys (for example journals.approve) so that only the head
-- teacher may approve, without any code change.
CREATE TABLE IF NOT EXISTS public.finance_permission_catalog (
  permission_key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  description text,
  is_sensitive boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.finance_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role text NOT NULL,
  permission_key text NOT NULL REFERENCES public.finance_permission_catalog(permission_key) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  limit_amount numeric(14,2),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, role, permission_key)
);

CREATE TABLE IF NOT EXISTS public.finance_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.finance_permission_catalog(permission_key) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, permission_key)
);

INSERT INTO public.finance_permission_catalog (permission_key, label, category, is_sensitive) VALUES
  ('finance.view', 'View finance workspace', 'General', false),
  ('finance.settings.manage', 'Manage financial settings', 'General', true),
  ('finance.accounts.manage', 'Manage chart of accounts', 'Accounting', true),
  ('finance.periods.close', 'Close accounting periods', 'Accounting', true),
  ('finance.periods.reopen', 'Reopen closed periods', 'Accounting', true),
  ('journals.create', 'Create journal entries', 'Accounting', false),
  ('journals.approve', 'Approve journal entries', 'Accounting', true),
  ('journals.post', 'Post journal entries', 'Accounting', true),
  ('journals.reverse', 'Reverse posted journals', 'Accounting', true),
  ('fees.manage', 'Manage fee categories and structures', 'Student finance', false),
  ('fees.assign', 'Assign fees to learners', 'Student finance', false),
  ('invoices.issue', 'Issue fee invoices', 'Student finance', false),
  ('invoices.void', 'Void invoices', 'Student finance', true),
  ('payments.record', 'Record payments', 'Student finance', false),
  ('payments.reverse', 'Reverse payments', 'Student finance', true),
  ('receipts.reprint', 'Reprint receipts', 'Student finance', false),
  ('adjustments.create', 'Create discounts and waivers', 'Student finance', false),
  ('adjustments.approve', 'Approve discounts, waivers and scholarships', 'Student finance', true),
  ('refunds.request', 'Request refunds', 'Student finance', false),
  ('refunds.approve', 'Approve refunds', 'Student finance', true),
  ('refunds.pay', 'Pay refunds', 'Student finance', true),
  ('plans.manage', 'Manage payment plans', 'Collections', false),
  ('collections.manage', 'Manage collection cases', 'Collections', false),
  ('communications.send', 'Send finance communication', 'Collections', false),
  ('banking.manage', 'Manage bank, cash and mobile money accounts', 'Banking', true),
  ('reconciliation.perform', 'Perform reconciliations', 'Banking', false),
  ('reconciliation.complete', 'Complete reconciliations', 'Banking', true),
  ('pettycash.manage', 'Manage petty cash', 'Banking', false),
  ('suppliers.manage', 'Manage suppliers', 'Payables', false),
  ('expenses.create', 'Record expenses', 'Payables', false),
  ('expenses.approve', 'Approve expenses and bills', 'Payables', true),
  ('ap.pay', 'Pay suppliers', 'Payables', true),
  ('procurement.request', 'Raise purchase requests', 'Procurement', false),
  ('procurement.approve', 'Approve purchase requests and orders', 'Procurement', true),
  ('procurement.receive', 'Record goods received', 'Procurement', false),
  ('procurement.match', 'Perform three-way matching', 'Procurement', false),
  ('budget.create', 'Create budgets', 'Budget', false),
  ('budget.approve', 'Approve budgets', 'Budget', true),
  ('budget.transfer', 'Transfer between budget lines', 'Budget', true),
  ('payroll.manage', 'Manage payroll and statutory configuration', 'Payroll', true),
  ('payroll.approve', 'Approve payroll runs', 'Payroll', true),
  ('payroll.pay', 'Pay payroll', 'Payroll', true),
  ('assets.manage', 'Manage the fixed asset register', 'Assets', false),
  ('assets.depreciate', 'Run depreciation', 'Assets', true),
  ('assets.dispose', 'Dispose of assets', 'Assets', true),
  ('inventory.manage', 'Manage inventory valuation', 'Assets', false),
  ('grants.manage', 'Manage donors and grants', 'Grants', false),
  ('aid.review', 'Review financial aid applications', 'Financial aid', false),
  ('aid.approve', 'Approve financial aid awards', 'Financial aid', true),
  ('tax.manage', 'Manage tax configuration', 'Tax', true),
  ('reports.view', 'View financial reports', 'Reports', false),
  ('reports.export', 'Export financial data', 'Reports', false),
  ('audit.view', 'View the finance audit trail', 'Audit', false),
  ('approvals.act', 'Act on approval requests', 'Approvals', true),
  ('portal.support', 'View the learner/parent finance portal', 'Student finance', false)
ON CONFLICT (permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Permission resolution helpers (server-side authorization boundary)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_permission_keys()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(permission_key ORDER BY permission_key), ARRAY[]::text[])
  FROM public.finance_permission_catalog;
$$;

/** Resolve the role of the signed-in user inside a school. */
CREATE OR REPLACE FUNCTION public.finance_current_roles(p_school_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT role::text), ARRAY[]::text[])
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND (school_id = p_school_id OR school_id IS NULL);
$$;

/**
 * Sensitive finance actions must always be authorised in the database, never
 * only in the UI. Returns true when the signed-in user holds the permission for
 * the school, honouring role defaults and user-level overrides.
 */
CREATE OR REPLACE FUNCTION public.finance_has_permission(p_school_id uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin()
    OR public.can_manage_finance()
      AND (
        -- explicit user override wins
        (SELECT fup.granted FROM public.finance_user_permissions fup
          WHERE fup.school_id = p_school_id AND fup.user_id = auth.uid()
            AND fup.permission_key = p_permission)
        IS TRUE
        OR coalesce(
          (SELECT frp.granted FROM public.finance_role_permissions frp
            WHERE frp.school_id = p_school_id
              AND frp.permission_key = p_permission
              AND frp.role = ANY (public.finance_current_roles(p_school_id))
            ORDER BY frp.granted DESC
            LIMIT 1),
          -- default: the bursar catalogue applies until a school says otherwise
          p_permission = ANY (
            SELECT unnest(public.finance_permission_keys())
          ) AND 'bursar' = ANY (public.finance_current_roles(p_school_id))
        )
      );
$$;

/** Every permission key the signed-in user effectively holds for a school. */
CREATE OR REPLACE FUNCTION public.finance_my_permissions(p_school_id uuid)
RETURNS TABLE (permission_key text, granted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.permission_key, public.finance_has_permission(p_school_id, c.permission_key)
  FROM public.finance_permission_catalog c
  ORDER BY c.category, c.permission_key;
$$;

/** Finance records are readable by leadership and finance staff only. */
CREATE OR REPLACE FUNCTION public.finance_can_read(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('school_admin', 'head_teacher', 'deputy_head_teacher', 'bursar')
        AND p.school_id = p_school_id
    );
$$;

/**
 * Guard used at the top of every financial write function. Raises a
 * human-readable error instead of silently failing.
 */
CREATE OR REPLACE FUNCTION public.finance_require_permission(p_school_id uuid, p_permission text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'This action must be performed inside a school';
  END IF;

  IF NOT public.finance_has_permission(p_school_id, p_permission) THEN
    RAISE EXCEPTION 'Your role does not allow this financial action (%)', p_permission
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_require_permission(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_require_permission(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_my_permissions(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_my_permissions(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reporting dimensions: cost centres, funds, branches (all optional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS public.finance_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  fund_type text NOT NULL DEFAULT 'unrestricted',
  donor_id uuid,
  restriction_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code),
  CONSTRAINT finance_funds_type_check CHECK (fund_type IN ('unrestricted', 'restricted', 'endowment'))
);

CREATE TABLE IF NOT EXISTS public.finance_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

-- ---------------------------------------------------------------------------
-- 6. Chart of accounts extension
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code),
  CONSTRAINT account_categories_type_check
    CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense'))
);

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.account_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS normal_balance text NOT NULL DEFAULT 'debit',
  ADD COLUMN IF NOT EXISTS is_control_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bank_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.finance_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chart_of_accounts_type_check'
  ) THEN
    ALTER TABLE public.chart_of_accounts
      ADD CONSTRAINT chart_of_accounts_type_check
      CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense'));
  END IF;
END $$;

-- Reserve the control accounts the accounting engine posts to. They cannot be
-- deleted or re-purposed once transactions exist, which protects the ledger.
UPDATE public.chart_of_accounts
   SET is_control_account = true
 WHERE code IN ('1100', '1000', '1010', '2000');

CREATE OR REPLACE FUNCTION public.finance_account_id(p_school_id uuid, p_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.chart_of_accounts
  WHERE school_id = p_school_id AND code = p_code
  LIMIT 1;
$$;

/** Resolve an account code from the school's financial settings. */
CREATE OR REPLACE FUNCTION public.finance_setting_account(p_school_id uuid, p_setting text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
BEGIN
  EXECUTE format(
    'SELECT %I FROM public.finance_settings WHERE school_id = $1', p_setting
  ) INTO v_code USING p_school_id;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Financial setting % is not configured for this school', p_setting;
  END IF;

  RETURN public.finance_account_id(p_school_id, v_code);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Configurable payment methods (Uganda-first, provider agnostic)
-- ---------------------------------------------------------------------------
-- Codes are data, not enum values, so a school can add another provider later
-- without touching the accounting engine. Cash, bank transfer, cheque, card,
-- Airtel Money and MTN Mobile Money ship as defaults.
CREATE TABLE IF NOT EXISTS public.finance_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  provider_name text,
  gl_account_code text,
  is_mobile_money boolean NOT NULL DEFAULT false,
  requires_reference boolean NOT NULL DEFAULT false,
  requires_bank_account boolean NOT NULL DEFAULT false,
  requires_instrument_number boolean NOT NULL DEFAULT false,
  supports_settlement boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code),
  CONSTRAINT finance_payment_methods_category_check
    CHECK (category IN ('cash', 'bank', 'cheque', 'card', 'mobile_money', 'other'))
);

-- ---------------------------------------------------------------------------
-- 8. Accounting period control
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_period_status(p_school_id uuid, p_date date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT fp.status
       FROM public.financial_periods fp
      WHERE fp.school_id = p_school_id
        AND p_date BETWEEN fp.start_date AND fp.end_date
      ORDER BY fp.start_date DESC
      LIMIT 1),
    'open'
  );
$$;

/**
 * Transactions may only be posted into an open accounting period, unless the
 * user holds a permission that explicitly allows posting into locked periods.
 */
CREATE OR REPLACE FUNCTION public.finance_assert_period_open(p_school_id uuid, p_date date)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text := public.finance_period_status(p_school_id, p_date);
BEGIN
  IF v_status = 'open' THEN
    RETURN;
  END IF;

  IF public.is_super_admin()
     OR (public.finance_has_permission(p_school_id, 'finance.periods.reopen')
         AND coalesce((SELECT post_to_locked_period_by_permission
                         FROM public.finance_settings
                        WHERE school_id = p_school_id), false)) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION
    'The accounting period covering % is %. Reopen it with authorisation before posting.',
    p_date, v_status
    USING ERRCODE = 'object_not_in_prerequisite_state';
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Approval centre (discounts, refunds, journals, expenses, assets, payroll)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  label text,
  threshold_amount numeric(14,2) NOT NULL DEFAULT 0,
  approver_permission text NOT NULL DEFAULT 'approvals.act',
  required_approvals integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, entity_type)
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  reference text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  required_approvals integer NOT NULL DEFAULT 1,
  approvals_recorded integer NOT NULL DEFAULT 0,
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision_note text,
  CONSTRAINT approval_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_actions_action_check
    CHECK (action IN ('approve', 'reject', 'cancel', 'comment'))
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_school_status
  ON public.approval_requests (school_id, status, requested_at DESC);

/** Create an approval request and return its id (null when auto-approved). */
CREATE OR REPLACE FUNCTION public.finance_request_approval(
  p_school_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_reference text,
  p_amount numeric,
  p_summary text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rule public.approval_rules%ROWTYPE;
  v_needed boolean := true;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_rule FROM public.approval_rules
   WHERE school_id = p_school_id AND entity_type = p_entity_type AND is_active
   LIMIT 1;

  IF FOUND THEN
    v_needed := p_amount >= coalesce(v_rule.threshold_amount, 0);
  END IF;

  IF NOT v_needed THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.approval_requests (
    school_id, entity_type, entity_id, reference, amount, summary, payload,
    status, requested_by, required_approvals
  ) VALUES (
    p_school_id, p_entity_type, p_entity_id, p_reference, coalesce(p_amount, 0),
    p_summary, coalesce(p_payload, '{}'::jsonb), 'pending', auth.uid(),
    coalesce(v_rule.required_approvals, 1)
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

INSERT INTO public.finance_permission_catalog (permission_key, label, category, is_sensitive)
SELECT 'payroll.view', 'View payroll', 'Payroll', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_permission_catalog WHERE permission_key = 'payroll.view'
);

/** Record an approval decision and update the parent request. */
CREATE OR REPLACE FUNCTION public.finance_decide_approval(
  p_request_id uuid,
  p_action text,
  p_comment text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.approval_requests%ROWTYPE;
  v_name text;
  v_approvals integer;
  v_status text;
BEGIN
  SELECT * INTO v_request FROM public.approval_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found';
  END IF;

  PERFORM public.finance_require_permission(v_request.school_id, 'approvals.act');

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This approval request has already been %', v_request.status;
  END IF;

  IF p_action NOT IN ('approve', 'reject', 'cancel', 'comment') THEN
    RAISE EXCEPTION 'Unsupported approval action: %', p_action;
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.approval_actions (school_id, request_id, action, actor_id, actor_name, comment)
  VALUES (v_request.school_id, p_request_id, p_action, auth.uid(), v_name, p_comment);

  v_approvals := v_request.approvals_recorded + CASE WHEN p_action = 'approve' THEN 1 ELSE 0 END;

  v_status := CASE
    WHEN p_action = 'reject' THEN 'rejected'
    WHEN p_action = 'cancel' THEN 'cancelled'
    WHEN p_action = 'approve' AND v_approvals >= v_request.required_approvals THEN 'approved'
    ELSE 'pending'
  END;

  UPDATE public.approval_requests
     SET approvals_recorded = v_approvals,
         status = v_status,
         decided_at = CASE WHEN v_status = 'pending' THEN decided_at ELSE now() END,
         decided_by = CASE WHEN v_status = 'pending' THEN decided_by ELSE auth.uid() END,
         decision_note = coalesce(p_comment, decision_note)
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'status', v_status,
    'entity_type', v_request.entity_type,
    'entity_id', v_request.entity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_decide_approval(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_decide_approval(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Document management for financial evidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'supporting_document',
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  notes text,
  is_verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_attachments_entity
  ON public.finance_attachments (school_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 11. Audit trail for every financial table
-- ---------------------------------------------------------------------------
-- Financial records are never silently deleted. This generic trigger records
-- who changed what, with the full before/after payload, on every financial
-- table. Void / reverse / cancel are the supported alternatives to deletion.
CREATE OR REPLACE FUNCTION public.finance_audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school uuid;
  v_old jsonb;
  v_new jsonb;
  v_name text;
  v_roles text;
BEGIN
  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_school := coalesce((v_new ->> 'school_id')::uuid, (v_old ->> 'school_id')::uuid);

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();
  SELECT string_agg(DISTINCT role::text, ',') INTO v_roles
    FROM public.user_roles WHERE user_id = auth.uid();

  INSERT INTO public.audit_logs (
    school_id, user_id, user_name, user_role, action, entity, details
  ) VALUES (
    v_school, auth.uid(), v_name, v_roles,
    'FINANCE_' || TG_OP, TG_TABLE_NAME,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'before', v_old,
      'after', v_new,
      'recorded_at', now()
    )
  );

  RETURN coalesce(NEW, OLD);
END;
$$;

/** Attach the audit trigger to every existing financial table. */
CREATE OR REPLACE FUNCTION public.finance_attach_audit_triggers(p_tables text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t text;
  v_count integer := 0;
BEGIN
  FOREACH t IN ARRAY p_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS finance_audit_%1$s ON public.%1$s', t);
      EXECUTE format(
        'CREATE TRIGGER finance_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.finance_audit_row()', t
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

/** Enable school-scoped RLS (read: finance roles, write: finance managers). */
CREATE OR REPLACE FUNCTION public.finance_apply_tenant_rls(p_tables text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t text;
  v_count integer := 0;
BEGIN
  FOREACH t IN ARRAY p_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      EXECUTE format('DROP POLICY IF EXISTS finance_read_%1$s ON public.%1$s', t);
      EXECUTE format(
        'CREATE POLICY finance_read_%1$s ON public.%1$s FOR SELECT TO authenticated
           USING (public.finance_can_read(school_id))', t
      );

      EXECUTE format('DROP POLICY IF EXISTS finance_write_%1$s ON public.%1$s', t);
      EXECUTE format(
        'CREATE POLICY finance_write_%1$s ON public.%1$s FOR ALL TO authenticated
           USING (school_id = public.current_school_id() AND public.can_manage_finance())
           WITH CHECK (school_id = public.current_school_id() AND public.can_manage_finance())', t
      );

      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

SELECT public.finance_apply_tenant_rls(ARRAY[
  'finance_settings', 'finance_number_sequences', 'finance_role_permissions',
  'finance_user_permissions', 'finance_cost_centers', 'finance_funds',
  'finance_branches', 'account_categories', 'finance_payment_methods',
  'approval_rules', 'approval_requests', 'approval_actions', 'finance_attachments'
]);

ALTER TABLE public.finance_permission_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_read_finance_permission_catalog ON public.finance_permission_catalog;
CREATE POLICY finance_read_finance_permission_catalog ON public.finance_permission_catalog
  FOR SELECT TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS finance_role_permissions_uniq
  ON public.finance_role_permissions (school_id, role, permission_key);
CREATE UNIQUE INDEX IF NOT EXISTS finance_user_permissions_uniq
  ON public.finance_user_permissions (school_id, user_id, permission_key);








