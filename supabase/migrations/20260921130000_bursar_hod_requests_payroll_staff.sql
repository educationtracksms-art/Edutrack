-- Bursar Phase 2b: HOD-to-Finance request workflow and independent payroll staff register.
-- finance_requests: HODs submit funding/expense requests; Bursar reviews and decides.
-- payroll_staff: school staff registered for payroll by the Bursar, independent of admin users.

CREATE TABLE IF NOT EXISTS public.finance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  hod_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  attachment_path text,
  date_needed date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing')),
  finance_remarks text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  staff_category text NOT NULL CHECK (staff_category IN ('teacher', 'non_teaching', 'cleaner', 'cook', 'porter', 'other')),
  employee_number text NOT NULL,
  national_id text,
  tax_pin text,
  bank_name text,
  account_name text,
  account_number text,
  basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  allowances numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  employment_type text NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'contract', 'casual')),
  date_of_employment date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, employee_number)
);

ALTER TABLE public.finance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_staff ENABLE ROW LEVEL SECURITY;

-- HOD: read/write own requests only.
CREATE POLICY finance_requests_hod_sel ON public.finance_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'hod'
      AND p.id = auth.uid()
      AND finance_requests.hod_id = p.id
  ));

CREATE POLICY finance_requests_hod_ins ON public.finance_requests
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'hod'
      AND p.id = auth.uid()
  ));

CREATE POLICY finance_requests_hod_upd ON public.finance_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'hod'
      AND p.id = auth.uid()
      AND finance_requests.hod_id = p.id
  ));

-- Bursar: full read/write on all finance_requests for their school.
CREATE POLICY finance_requests_bursar_all ON public.finance_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'bursar'
        AND p.id = auth.uid()
        AND p.school_id = finance_requests.school_id
    )
  );

ALTER TABLE public.payroll_staff ENABLE ROW LEVEL SECURITY;

-- Bursar: full CRUD on payroll_staff for their school.
CREATE POLICY payroll_staff_bursar_all ON public.payroll_staff
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'bursar'
        AND p.id = auth.uid()
        AND p.school_id = payroll_staff.school_id
    )
  );

-- Non-bursar staff: read-only visibility (e.g. payroll statements pull names).
CREATE POLICY payroll_staff_any_read ON public.payroll_staff
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE p.id = auth.uid()
      AND p.school_id = payroll_staff.school_id
  ));

SELECT public.finance_apply_tenant_rls(ARRAY['finance_requests', 'payroll_staff']);

SELECT public.finance_attach_audit_triggers(ARRAY['finance_requests', 'payroll_staff']);
