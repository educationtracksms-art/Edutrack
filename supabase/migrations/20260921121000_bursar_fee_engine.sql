-- =============================================================================
-- Bursar module — Phase 2: fee engine, billing and student receivables
-- =============================================================================
-- Fee categories and structures are fully configurable (nothing is hard-coded),
-- and every charge, discount, waiver, scholarship, invoice and payment lives in
-- an auditable sub-ledger. The general ledger entries are created by the
-- posting functions in the next migration so that there is one financial source
-- of truth.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fee categories (unlimited, school defined)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  gl_account_code text,
  is_recurring boolean NOT NULL DEFAULT false,
  is_optional boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

-- ---------------------------------------------------------------------------
-- 2. Fee structures and lines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  education_level text,
  student_category text NOT NULL DEFAULT 'all',
  boarding_status text NOT NULL DEFAULT 'both',
  currency text NOT NULL DEFAULT 'UGX',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  installments_allowed integer NOT NULL DEFAULT 1,
  is_optional boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name, academic_year_id, term_id, class_id, stream_id),
  CONSTRAINT fee_structures_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT fee_structures_boarding_check
    CHECK (boarding_status IN ('day', 'boarding', 'both')),
  CONSTRAINT fee_structures_installments_check CHECK (installments_allowed >= 1)
);

CREATE TABLE IF NOT EXISTS public.fee_structure_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  structure_id uuid NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  fee_category_id uuid NOT NULL REFERENCES public.fee_categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  is_optional boolean NOT NULL DEFAULT false,
  is_mandatory boolean NOT NULL DEFAULT true,
  pro_rate_allowed boolean NOT NULL DEFAULT false,
  tax_rate numeric(6,2) NOT NULL DEFAULT 0,
  gl_account_code text,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_structure_lines_amount_check CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_school_year
  ON public.fee_structures (school_id, academic_year_id, term_id, status);
CREATE INDEX IF NOT EXISTS idx_fee_structure_lines_structure
  ON public.fee_structure_lines (school_id, structure_id);

-- ---------------------------------------------------------------------------
-- 3. Fee assignments: extend the existing per-learner fee record
-- ---------------------------------------------------------------------------
-- student_fee_assignments remains the per-learner charge record created by the
-- school's fees workflow. The bursar adds the accounting detail: category,
-- structure line and gross/discount/waiver/net columns so that no screen has to
-- recompute a balance.
ALTER TABLE public.student_fee_assignments
  ADD COLUMN IF NOT EXISTS fee_category_id uuid REFERENCES public.fee_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_structure_id uuid REFERENCES public.fee_structures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_structure_line_id uuid REFERENCES public.fee_structure_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waived_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scholarship_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.student_fee_assignments
   SET gross_amount = amount_due, net_amount = amount_due
 WHERE gross_amount = 0 AND amount_due > 0;

-- ---------------------------------------------------------------------------
-- 4. Discounts, waivers, scholarships and sponsorships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  fee_category_id uuid REFERENCES public.fee_categories(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.student_invoices(id) ON DELETE SET NULL,
  adjustment_type text NOT NULL,
  award_type text NOT NULL DEFAULT 'discount',
  name text NOT NULL,
  reason text,
  calculation text NOT NULL DEFAULT 'fixed',
  rate numeric(6,2),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  applied_amount numeric(14,2) NOT NULL DEFAULT 0,
  sponsor_name text,
  donor_id uuid,
  gl_account_code text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status text NOT NULL DEFAULT 'pending_approval',
  policy_reference text,
  approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  journal_entry_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_adjustments_type_check
    CHECK (adjustment_type IN ('discount', 'waiver', 'scholarship', 'sponsorship', 'bursary')),
  CONSTRAINT fee_adjustments_award_check
    CHECK (award_type IN ('discount', 'waiver', 'scholarship', 'bursary', 'sponsorship', 'staff_child', 'financial_aid')),
  CONSTRAINT fee_adjustments_calculation_check
    CHECK (calculation IN ('fixed', 'percentage', 'full')),
  CONSTRAINT fee_adjustments_status_check
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'expired')),
  CONSTRAINT fee_adjustments_amount_check CHECK (amount >= 0 AND applied_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fee_adjustments_student
  ON public.fee_adjustments (school_id, student_id, status);

-- ---------------------------------------------------------------------------
-- 5. Payment plans and installments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  plan_number text NOT NULL,
  plan_name text NOT NULL DEFAULT 'Fee payment plan',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  frequency text NOT NULL DEFAULT 'monthly',
  installment_count integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  agreement_signed_by text,
  agreement_signed_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, plan_number),
  CONSTRAINT payment_plans_frequency_check
    CHECK (frequency IN ('weekly', 'monthly', 'termly', 'custom')),
  CONSTRAINT payment_plans_status_check
    CHECK (status IN ('draft', 'active', 'completed', 'breached', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.payment_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reminder_sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, installment_number),
  CONSTRAINT payment_plan_installments_status_check
    CHECK (status IN ('pending', 'part_paid', 'paid', 'missed', 'waived'))
);

-- ---------------------------------------------------------------------------
-- 6. Invoice enhancements (student_invoices is the billing document)
-- ---------------------------------------------------------------------------
ALTER TABLE public.student_invoices
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'fee_invoice',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waiver_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scholarship_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_balance numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_invoice_id uuid REFERENCES public.student_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid,
  ADD COLUMN IF NOT EXISTS printed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL;

ALTER TABLE public.student_invoice_items
  ADD COLUMN IF NOT EXISTS fee_category_id uuid REFERENCES public.fee_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_fee_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waiver_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scholarship_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gl_account_code text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

UPDATE public.student_invoice_items
   SET gross_amount = line_total, net_amount = line_total
 WHERE gross_amount = 0 AND line_total > 0;

CREATE INDEX IF NOT EXISTS idx_student_invoices_status_due
  ON public.student_invoices (school_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_student_invoices_term
  ON public.student_invoices (school_id, academic_year_id, term_id, class_id);

-- ---------------------------------------------------------------------------
-- 7. Payment capture detail (all supported Uganda payment methods)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payer_phone text,
  ADD COLUMN IF NOT EXISTS payer_relationship text,
  ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collection_point text,
  ADD COLUMN IF NOT EXISTS value_date date,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS cheque_number text,
  ADD COLUMN IF NOT EXISTS cheque_date date,
  ADD COLUMN IF NOT EXISTS cheque_drawer_bank text,
  ADD COLUMN IF NOT EXISTS cheque_status text,
  ADD COLUMN IF NOT EXISTS card_reference text,
  ADD COLUMN IF NOT EXISTS card_provider text,
  ADD COLUMN IF NOT EXISTS card_settlement_status text,
  ADD COLUMN IF NOT EXISTS mobile_money_provider text,
  ADD COLUMN IF NOT EXISTS mobile_money_transaction_id text,
  ADD COLUMN IF NOT EXISTS mobile_money_settlement_status text,
  ADD COLUMN IF NOT EXISTS bank_reference text,
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid,
  ADD COLUMN IF NOT EXISTS allocated_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unallocated_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_plan_installment_id uuid REFERENCES public.payment_plan_installments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.student_invoices(id) ON DELETE SET NULL,
  installment_id uuid REFERENCES public.payment_plan_installments(id) ON DELETE SET NULL,
  fee_category_id uuid REFERENCES public.fee_categories(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  allocation_type text NOT NULL DEFAULT 'invoice',
  is_reversed boolean NOT NULL DEFAULT false,
  reversed_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_amount_check CHECK (amount <> 0),
  CONSTRAINT payment_allocations_type_check
    CHECK (allocation_type IN ('invoice', 'advance', 'installment', 'fee_category', 'refund_recovery'))
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment
  ON public.payment_allocations (school_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice
  ON public.payment_allocations (school_id, invoice_id);

-- ---------------------------------------------------------------------------
-- 8. Receipts (reprint is audited; it never creates a second payment)
-- ---------------------------------------------------------------------------
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS printed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS qr_payload text,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.receipts r
   SET student_id = p.student_id,
       amount = p.amount,
       payment_method = p.payment_method,
       reference_number = p.reference_number,
       receipt_date = p.payment_date,
       issued_by = p.created_by,
       verification_code = upper(substr(md5(r.id::text || r.receipt_number), 1, 10))
  FROM public.payments p
 WHERE r.payment_id = p.id
   AND r.student_id IS NULL;

-- ---------------------------------------------------------------------------
-- 9. Refunds (request → review → approval → payment → entry → audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  refund_number text NOT NULL,
  refund_type text NOT NULL DEFAULT 'overpayment',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  reason text NOT NULL,
  refund_method text NOT NULL DEFAULT 'bank_transfer',
  bank_account_id uuid,
  mobile_money_provider text,
  mobile_money_number text,
  payee_name text,
  status text NOT NULL DEFAULT 'requested',
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at timestamptz,
  payment_reference text,
  journal_entry_id uuid,
  approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, refund_number),
  CONSTRAINT refunds_type_check
    CHECK (refund_type IN ('overpayment', 'duplicate_payment', 'withdrawal', 'adjustment', 'credit_balance')),
  CONSTRAINT refunds_status_check
    CHECK (status IN ('requested', 'under_review', 'approved', 'rejected', 'paid', 'cancelled')),
  CONSTRAINT refunds_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_refunds_school_status ON public.refunds (school_id, status);

-- ---------------------------------------------------------------------------
-- 10. Credit and debit notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.student_invoices(id) ON DELETE SET NULL,
  credit_note_number text NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'issued',
  journal_entry_id uuid,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, credit_note_number),
  CONSTRAINT credit_notes_amount_check CHECK (amount > 0),
  CONSTRAINT credit_notes_status_check CHECK (status IN ('draft', 'issued', 'applied', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.student_invoices(id) ON DELETE SET NULL,
  debit_note_number text NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'issued',
  journal_entry_id uuid,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, debit_note_number),
  CONSTRAINT debit_notes_amount_check CHECK (amount > 0),
  CONSTRAINT debit_notes_status_check CHECK (status IN ('draft', 'issued', 'applied', 'cancelled'))
);

-- ---------------------------------------------------------------------------
-- 11. Accounts receivable: collection cases, actions and promises to pay
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collection_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  case_number text NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  balance_amount numeric(14,2) NOT NULL DEFAULT 0,
  age_bucket text NOT NULL DEFAULT 'current',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_action_at timestamptz,
  next_action_at date,
  escalation_level integer NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  resolution_note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, case_number),
  CONSTRAINT collection_cases_status_check
    CHECK (status IN ('open', 'in_progress', 'promised', 'escalated', 'resolved', 'written_off')),
  CONSTRAINT collection_cases_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'critical'))
);

CREATE TABLE IF NOT EXISTS public.collection_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.collection_cases(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  channel text NOT NULL DEFAULT 'phone_call',
  notes text,
  outcome text,
  amount_promised numeric(14,2) DEFAULT 0,
  promised_date date,
  follow_up_date date,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collection_actions_channel_check
    CHECK (channel IN ('phone_call', 'sms', 'email', 'letter', 'in_person', 'statement', 'portal', 'other'))
);

CREATE TABLE IF NOT EXISTS public.payment_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.collection_cases(id) ON DELETE SET NULL,
  promised_amount numeric(14,2) NOT NULL DEFAULT 0,
  promised_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  kept_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_promises_status_check
    CHECK (status IN ('pending', 'kept', 'part_kept', 'broken', 'cancelled'))
);

-- ---------------------------------------------------------------------------
-- 12. Communication history (reminders, statements, receipts, notices)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  recipient_type text NOT NULL DEFAULT 'parent',
  recipient_name text,
  recipient_address text,
  channel text NOT NULL DEFAULT 'notification',
  message_type text NOT NULL,
  subject text,
  body text,
  entity_type text,
  entity_id uuid,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_reason text,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_communications_channel_check
    CHECK (channel IN ('notification', 'email', 'sms', 'print', 'portal')),
  CONSTRAINT finance_communications_status_check
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'cancelled'))
);

-- ---------------------------------------------------------------------------
-- 13. Sub-ledger views: learner account balances and receivables aging
-- ---------------------------------------------------------------------------
-- These views are the only place learner balances are derived, so no screen can
-- invent its own arithmetic. They read the real invoice, adjustment, payment
-- and refund records.
CREATE OR REPLACE VIEW public.v_student_finance_accounts
WITH (security_invoker = true) AS
SELECT
  s.school_id,
  s.id AS student_id,
  s.full_name,
  s.student_number,
  s.class_id,
  s.stream_id,
  c.name AS class_name,
  st.name AS stream_name,
  s.status AS student_status,
  s.parent_name,
  s.guardian_name,
  coalesce(billed.total, 0)::numeric(14,2) AS total_billed,
  coalesce(billed.adjustments, 0)::numeric(14,2) AS total_adjustments,
  coalesce(collected.total, 0)::numeric(14,2) AS total_paid,
  coalesce(refunded.total, 0)::numeric(14,2) AS total_refunded,
  coalesce(advance.total, 0)::numeric(14,2) AS advance_credit,
  (coalesce(billed.total, 0) - coalesce(billed.adjustments, 0)
    - coalesce(collected.total, 0) + coalesce(refunded.total, 0))::numeric(14,2) AS balance_due,
  coalesce(open_items.open_count, 0) AS open_invoice_count,
  open_items.oldest_due_date,
  s.fees_balance AS legacy_balance
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.streams st ON st.id = s.stream_id
LEFT JOIN LATERAL (
  SELECT sum(i.total_amount) AS total,
         sum(i.discount_amount + i.waiver_amount + i.scholarship_amount) AS adjustments
    FROM public.student_invoices i
   WHERE i.student_id = s.id
     AND i.status NOT IN ('voided', 'cancelled', 'draft')
) billed ON true
LEFT JOIN LATERAL (
  SELECT sum(p.amount) AS total
    FROM public.payments p
   WHERE p.student_id = s.id AND p.status = 'posted'
) collected ON true
LEFT JOIN LATERAL (
  SELECT sum(rf.amount) AS total
    FROM public.refunds rf
   WHERE rf.student_id = s.id AND rf.status = 'paid'
) refunded ON true
LEFT JOIN LATERAL (
  SELECT sum(pa.amount) AS total
    FROM public.payment_allocations pa
    JOIN public.payments p2 ON p2.id = pa.payment_id
   WHERE p2.student_id = s.id AND p2.status = 'posted' AND pa.allocation_type = 'advance'
) advance ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS open_count, min(i.due_date) AS oldest_due_date
    FROM public.student_invoices i
   WHERE i.student_id = s.id AND i.balance_due > 0
     AND i.status NOT IN ('voided', 'cancelled', 'draft')
) open_items ON true
WHERE s.deleted_at IS NULL;

/** Open receivable items with their aging bucket, used by AR and collections. */
CREATE OR REPLACE VIEW public.v_ar_open_items
WITH (security_invoker = true) AS
SELECT
  i.school_id,
  i.id AS invoice_id,
  i.invoice_number,
  i.student_id,
  s.full_name,
  s.student_number,
  i.class_id,
  i.stream_id,
  i.academic_year_id,
  i.term_id,
  i.invoice_date,
  coalesce(i.due_date, i.invoice_date) AS due_date,
  i.total_amount,
  i.amount_paid,
  i.balance_due,
  CASE
    WHEN coalesce(i.due_date, i.invoice_date) >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - coalesce(i.due_date, i.invoice_date) <= 30 THEN '1-30'
    WHEN CURRENT_DATE - coalesce(i.due_date, i.invoice_date) <= 60 THEN '31-60'
    WHEN CURRENT_DATE - coalesce(i.due_date, i.invoice_date) <= 90 THEN '61-90'
    ELSE '90+'
  END AS age_bucket,
  (CURRENT_DATE - coalesce(i.due_date, i.invoice_date)) AS days_overdue,
  i.status
FROM public.student_invoices i
JOIN public.students s ON s.id = i.student_id
WHERE i.balance_due > 0
  AND i.status NOT IN ('voided', 'cancelled', 'draft');

/** Aging summary per school/term for the dashboard and arrears reports. */
CREATE OR REPLACE VIEW public.v_ar_aging_summary
WITH (security_invoker = true) AS
SELECT
  school_id,
  academic_year_id,
  term_id,
  class_id,
  stream_id,
  age_bucket,
  count(*) AS invoice_count,
  sum(balance_due)::numeric(14,2) AS balance
FROM public.v_ar_open_items
GROUP BY school_id, academic_year_id, term_id, class_id, stream_id, age_bucket;




-- ---------------------------------------------------------------------------
-- 14. Billing, collection and revenue analysis for the dashboards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_fee_collection_daily
WITH (security_invoker = true) AS
SELECT
  p.school_id,
  p.payment_date,
  coalesce(pm.category, p.payment_method) AS payment_category,
  coalesce(pm.name, p.payment_method) AS payment_method_name,
  count(*) AS payment_count,
  sum(p.amount)::numeric(14,2) AS amount
FROM public.payments p
LEFT JOIN public.finance_payment_methods pm ON pm.id = p.payment_method_id
WHERE p.status = 'posted'
GROUP BY p.school_id, p.payment_date, coalesce(pm.category, p.payment_method),
         coalesce(pm.name, p.payment_method);

CREATE OR REPLACE VIEW public.v_billing_vs_collection
WITH (security_invoker = true) AS
WITH billing AS (
  SELECT school_id, date_trunc('month', invoice_date)::date AS period,
         sum(total_amount) AS billed,
         sum(discount_amount + waiver_amount + scholarship_amount) AS adjustments
    FROM public.student_invoices
   WHERE status NOT IN ('voided', 'cancelled', 'draft')
   GROUP BY school_id, date_trunc('month', invoice_date)::date
), collections AS (
  SELECT school_id, date_trunc('month', payment_date)::date AS period, sum(amount) AS collected
    FROM public.payments
   WHERE status = 'posted'
   GROUP BY school_id, date_trunc('month', payment_date)::date
)
SELECT
  coalesce(b.school_id, c.school_id) AS school_id,
  coalesce(b.period, c.period) AS period,
  coalesce(b.billed, 0)::numeric(14,2) AS billed,
  coalesce(b.adjustments, 0)::numeric(14,2) AS adjustments,
  coalesce(c.collected, 0)::numeric(14,2) AS collected,
  (coalesce(b.billed, 0) - coalesce(b.adjustments, 0) - coalesce(c.collected, 0))::numeric(14,2)
    AS outstanding
FROM billing b
FULL OUTER JOIN collections c ON c.school_id = b.school_id AND c.period = b.period;

CREATE OR REPLACE VIEW public.v_revenue_by_fee_category
WITH (security_invoker = true) AS
SELECT
  i.school_id,
  i.academic_year_id,
  i.term_id,
  it.fee_category_id,
  coalesce(fc.name, it.fee_type) AS fee_category,
  count(DISTINCT i.id) AS invoice_count,
  sum(it.net_amount)::numeric(14,2) AS billed_net,
  sum(it.discount_amount + it.waiver_amount + it.scholarship_amount)::numeric(14,2) AS adjustments
FROM public.student_invoice_items it
JOIN public.student_invoices i ON i.id = it.invoice_id
LEFT JOIN public.fee_categories fc ON fc.id = it.fee_category_id
WHERE i.status NOT IN ('voided', 'cancelled', 'draft')
GROUP BY i.school_id, i.academic_year_id, i.term_id, it.fee_category_id,
         coalesce(fc.name, it.fee_type);

-- ---------------------------------------------------------------------------
-- 15. Tenant RLS and audit triggers for the student finance tables
-- ---------------------------------------------------------------------------
SELECT public.finance_apply_tenant_rls(ARRAY[
  'fee_categories', 'fee_structures', 'fee_structure_lines', 'fee_adjustments',
  'payment_plans', 'payment_plan_installments', 'payment_allocations', 'refunds',
  'credit_notes', 'debit_notes', 'collection_cases', 'collection_actions',
  'payment_promises', 'finance_communications'
]);

SELECT public.finance_attach_audit_triggers(ARRAY[
  'fee_categories', 'fee_structures', 'fee_structure_lines', 'student_fee_assignments',
  'fee_adjustments', 'student_invoices', 'student_invoice_items', 'payments',
  'payment_allocations', 'receipts', 'refunds', 'credit_notes', 'debit_notes',
  'payment_plans', 'payment_plan_installments', 'collection_cases', 'payment_promises'
]);


