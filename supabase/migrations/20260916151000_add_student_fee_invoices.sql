-- Learner fee invoices support the bursar's collections workflow.
CREATE TABLE IF NOT EXISTS public.student_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  financial_year_id uuid REFERENCES public.financial_years(id) ON DELETE SET NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'issued',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  balance_due numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_number),
  CONSTRAINT student_invoices_amounts_check CHECK (
    total_amount >= 0 AND amount_paid >= 0 AND balance_due >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.student_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.student_invoices(id) ON DELETE CASCADE,
  fee_type text NOT NULL,
  description text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_invoice_items_amounts_check CHECK (
    quantity >= 0 AND unit_amount >= 0 AND line_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_student_invoices_school_date
  ON public.student_invoices (school_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_invoices_school_student
  ON public.student_invoices (school_id, student_id, status);
CREATE INDEX IF NOT EXISTS idx_student_invoice_items_invoice
  ON public.student_invoice_items (school_id, invoice_id);

ALTER TABLE public.student_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_school_read_student_invoices ON public.student_invoices;
CREATE POLICY finance_school_read_student_invoices ON public.student_invoices
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());

DROP POLICY IF EXISTS finance_school_write_student_invoices ON public.student_invoices;
CREATE POLICY finance_school_write_student_invoices ON public.student_invoices
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));

DROP POLICY IF EXISTS finance_school_read_student_invoice_items ON public.student_invoice_items;
CREATE POLICY finance_school_read_student_invoice_items ON public.student_invoice_items
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());

DROP POLICY IF EXISTS finance_school_write_student_invoice_items ON public.student_invoice_items;
CREATE POLICY finance_school_write_student_invoice_items ON public.student_invoice_items
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()))
  WITH CHECK (public.is_super_admin() OR (school_id = public.current_school_id() AND public.can_manage_finance()));
