-- Term-based fee assignments let the bursar set fees for a class or a single
-- learner while keeping an auditable record behind the report-card balance.
CREATE TABLE IF NOT EXISTS public.student_fee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  fee_name text NOT NULL DEFAULT 'Tuition',
  amount_due numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  balance_due numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  set_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, academic_year_id, term_id, fee_name),
  CONSTRAINT student_fee_assignments_amounts_check CHECK (
    amount_due >= 0 AND amount_paid >= 0 AND balance_due >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_school_term
  ON public.student_fee_assignments (school_id, academic_year_id, term_id, status);
CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_school_class
  ON public.student_fee_assignments (school_id, class_id, stream_id);

ALTER TABLE public.student_fee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_school_read_student_fee_assignments
  ON public.student_fee_assignments;
CREATE POLICY finance_school_read_student_fee_assignments
  ON public.student_fee_assignments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = public.current_school_id());

DROP POLICY IF EXISTS finance_school_write_student_fee_assignments
  ON public.student_fee_assignments;
CREATE POLICY finance_school_write_student_fee_assignments
  ON public.student_fee_assignments
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (school_id = public.current_school_id() AND public.can_manage_finance())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (school_id = public.current_school_id() AND public.can_manage_finance())
  );
