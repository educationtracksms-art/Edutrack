ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS report_payment_reference_type text NOT NULL DEFAULT 'schpay_code',
  ADD COLUMN IF NOT EXISTS report_account_number text;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_report_payment_reference_type_check
  CHECK (report_payment_reference_type IN ('schpay_code', 'account_number'));
