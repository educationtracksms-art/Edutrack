-- =============================================================================
-- Bursar module — Phase 3: double-entry general ledger and posting engine
-- =============================================================================
-- The general ledger is the financial source of truth. Every business
-- transaction (billing, collection, expense, payroll, depreciation, refund,
-- reconciliation adjustment) posts through finance_post_journal, which:
--   * validates that total debits equal total credits,
--   * validates the accounting period is open,
--   * writes an immutable journal entry plus balanced lines,
--   * links back to the source document for traceability,
--   * records the audit trail.
-- Posted entries can never be edited or deleted — only reversed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Journal workflow columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS source_module text,
  ADD COLUMN IF NOT EXISTS source_record_id uuid,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.financial_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.finance_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS total_debit numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversal_of_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_by_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_url text;

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS line_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.finance_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_status_check') THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_status_check
      CHECK (status IN ('draft', 'submitted', 'approved', 'posted', 'reversed', 'rejected'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_type_check') THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_type_check
      CHECK (entry_type IN ('system', 'manual', 'adjusting', 'accrual', 'reversal', 'opening', 'closing'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entry_lines_amount_check') THEN
    ALTER TABLE public.journal_entry_lines
      ADD CONSTRAINT journal_entry_lines_amount_check
      CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0) AND (debit > 0 OR credit > 0));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_school_status
  ON public.journal_entries (school_id, status, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source
  ON public.journal_entries (school_id, source_module, source_record_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account
  ON public.journal_entry_lines (school_id, account_id);

-- ---------------------------------------------------------------------------
-- 2. Ledger immutability
-- ---------------------------------------------------------------------------
-- A posted journal is final. Reversal is the only correction path, which keeps
-- the audit trail intact and preserves double-entry integrity.
CREATE OR REPLACE FUNCTION public.finance_protect_posted_journal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('finance.posting', true), 'off') = 'on' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION
        'Nothing ever silently deletes a posted journal entry. Use reversal instead (entry %).',
        OLD.entry_number
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('posted', 'reversed') THEN
    IF NEW.status = 'reversed'
       AND NEW.reversed_by_entry_id IS DISTINCT FROM OLD.reversed_by_entry_id THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION
      'Journal entry % is % and cannot be edited. Post a reversal instead.',
      OLD.entry_number, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_protect_posted_journal ON public.journal_entries;
CREATE TRIGGER finance_protect_posted_journal
BEFORE UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.finance_protect_posted_journal();

CREATE OR REPLACE FUNCTION public.finance_protect_journal_lines()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  IF coalesce(current_setting('finance.posting', true), 'off') = 'on' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  SELECT status INTO v_status FROM public.journal_entries
   WHERE id = coalesce(NEW.journal_entry_id, OLD.journal_entry_id);

  IF v_status IN ('posted', 'reversed', 'approved') THEN
    RAISE EXCEPTION
      'Journal lines of a % entry cannot be changed. Reverse the journal instead.', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS finance_protect_journal_lines ON public.journal_entry_lines;
CREATE TRIGGER finance_protect_journal_lines
BEFORE UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.finance_protect_journal_lines();

-- ---------------------------------------------------------------------------
-- 3. The posting engine
-- ---------------------------------------------------------------------------
/**
 * Post a balanced journal entry.
 *
 * p_lines is a JSON array of
 *   { "account_id": uuid, "debit": number, "credit": number,
 *     "narration": text, "cost_center_id": uuid, "fund_id": uuid,
 *     "branch_id": uuid, "student_id": uuid, "supplier_id": uuid }
 *
 * Returns the journal entry id. Raises a readable error when the entry is out
 * of balance, when an account belongs to another school or when the accounting
 * period is locked.
 */
CREATE OR REPLACE FUNCTION public.finance_post_journal(
  p_school_id uuid,
  p_entry_date date,
  p_narration text,
  p_lines jsonb,
  p_entry_type text DEFAULT 'system',
  p_source_module text DEFAULT NULL,
  p_source_record_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_fund_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_permission text DEFAULT 'journals.post',
  p_auto_post boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  v_total_debit numeric(14,2) := 0;
  v_total_credit numeric(14,2) := 0;
  v_line jsonb;
  v_index integer := 0;
  v_entry_id uuid;
  v_entry_number text;
  v_transaction_id uuid;
  v_status text;
  v_period_id uuid;
  v_settings public.finance_settings%ROWTYPE;
BEGIN
  PERFORM public.finance_require_permission(p_school_id, p_permission);

  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) < 2 THEN
    RAISE EXCEPTION 'A journal entry needs at least two lines (one debit and one credit)';
  END IF;

  SELECT * INTO v_settings FROM public.finance_settings WHERE school_id = p_school_id;

  -- Validate every line before writing anything.
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    IF coalesce((v_line ->> 'debit')::numeric, 0) > 0
       AND coalesce((v_line ->> 'credit')::numeric, 0) > 0 THEN
      RAISE EXCEPTION 'A journal line cannot carry both a debit and a credit';
    END IF;
    IF coalesce((v_line ->> 'debit')::numeric, 0) < 0
       OR coalesce((v_line ->> 'credit')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'Journal amounts cannot be negative';
    END IF;
    IF (v_line ->> 'account_id') IS NULL THEN
      RAISE EXCEPTION 'Every journal line must be mapped to a chart of accounts account';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts a
       WHERE a.id = (v_line ->> 'account_id')::uuid AND a.school_id = p_school_id
    ) THEN
      RAISE EXCEPTION 'Account % does not belong to this school', v_line ->> 'account_id';
    END IF;

    v_total_debit := v_total_debit + coalesce((v_line ->> 'debit')::numeric, 0);
    v_total_credit := v_total_credit + coalesce((v_line ->> 'credit')::numeric, 0);
  END LOOP;

  IF round(v_total_debit, 2) <> round(v_total_credit, 2) THEN
    RAISE EXCEPTION
      'Total debits (%) must equal total credits (%) — out of balance by %',
      to_char(v_total_debit, 'FM999,999,999,990.00'),
      to_char(v_total_credit, 'FM999,999,999,990.00'),
      to_char(v_total_debit - v_total_credit, 'FM999,999,999,990.00');
  END IF;

  PERFORM public.finance_assert_period_open(p_school_id, coalesce(p_entry_date, CURRENT_DATE));

  SELECT id INTO v_period_id FROM public.financial_periods
   WHERE school_id = p_school_id
     AND coalesce(p_entry_date, CURRENT_DATE) BETWEEN start_date AND end_date
   ORDER BY start_date DESC LIMIT 1;

  v_status := CASE
    WHEN NOT p_auto_post THEN 'draft'
    WHEN coalesce(v_settings.require_journal_approval, false) THEN 'submitted'
    ELSE 'posted'
  END;

  v_entry_number := public.next_finance_number(
    p_school_id, 'JOURNAL', coalesce(v_settings.journal_prefix, 'JV'), v_settings.number_pad_width
  );

  INSERT INTO public.transactions (
    school_id, transaction_number, transaction_date, source_module, source_record_id,
    transaction_type, reference_number, status, narration, total_amount, created_by
  ) VALUES (
    p_school_id, v_entry_number, coalesce(p_entry_date, CURRENT_DATE),
    coalesce(p_source_module, 'journal'), p_source_record_id, 'journal',
    p_reference, CASE WHEN v_status = 'posted' THEN 'posted' ELSE 'draft' END,
    p_narration, round(v_total_debit, 2), auth.uid()
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.journal_entries (
    school_id, transaction_id, entry_number, entry_date, description, status, created_by,
    entry_type, source_module, source_record_id, reference_number, period_id,
    fund_id, branch_id, cost_center_id, total_debit, total_credit,
    submitted_by, submitted_at, posted_by, posted_at
  ) VALUES (
    p_school_id, v_transaction_id, v_entry_number, coalesce(p_entry_date, CURRENT_DATE),
    p_narration, v_status, auth.uid(),
    coalesce(p_entry_type, 'system'), p_source_module, p_source_record_id, p_reference, v_period_id,
    p_fund_id, p_branch_id, p_cost_center_id, round(v_total_debit, 2), round(v_total_credit, 2),
    CASE WHEN v_status IN ('submitted', 'posted') THEN auth.uid() END,
    CASE WHEN v_status IN ('submitted', 'posted') THEN now() END,
    CASE WHEN v_status = 'posted' THEN auth.uid() END,
    CASE WHEN v_status = 'posted' THEN now() END
  ) RETURNING id INTO v_entry_id;

  IF v_status = 'posted' THEN
    PERFORM set_config('finance.posting', 'on', true);
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_index := v_index + 1;
    INSERT INTO public.journal_entry_lines (
      school_id, journal_entry_id, account_id, debit, credit, narration, line_number,
      fund_id, branch_id, cost_center_id, reference, student_id, supplier_id
    ) VALUES (
      p_school_id, v_entry_id, (v_line ->> 'account_id')::uuid,
      coalesce((v_line ->> 'debit')::numeric, 0), coalesce((v_line ->> 'credit')::numeric, 0),
      v_line ->> 'narration', v_index,
      coalesce((v_line ->> 'fund_id')::uuid, p_fund_id),
      coalesce((v_line ->> 'branch_id')::uuid, p_branch_id),
      coalesce((v_line ->> 'cost_center_id')::uuid, p_cost_center_id),
      coalesce(v_line ->> 'reference', p_reference),
      (v_line ->> 'student_id')::uuid,
      (v_line ->> 'supplier_id')::uuid
    );
  END LOOP;

  IF v_status = 'posted' THEN
    PERFORM set_config('finance.posting', 'off', true);
  END IF;

  IF v_status = 'submitted' THEN
    PERFORM public.finance_request_approval(
      p_school_id, 'journal_entry', v_entry_id, v_entry_number, round(v_total_debit, 2),
      'Journal ' || v_entry_number || ' requires approval before posting',
      jsonb_build_object('narration', p_narration, 'entry_date', p_entry_date)
    );
  END IF;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_post_journal(uuid, date, text, jsonb, text, text, uuid, text, uuid, uuid, uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_post_journal(uuid, date, text, jsonb, text, text, uuid, text, uuid, uuid, uuid, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Journal workflow: approve, post, reverse
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_approve_journal(p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.journal_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.journal_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal entry not found'; END IF;

  PERFORM public.finance_require_permission(v_entry.school_id, 'journals.approve');

  IF v_entry.status NOT IN ('submitted', 'draft') THEN
    RAISE EXCEPTION 'Only a draft or submitted journal can be approved (this one is %)', v_entry.status;
  END IF;

  UPDATE public.journal_entries
     SET status = 'approved', approved_by = auth.uid(), approved_at = now()
   WHERE id = p_entry_id;

  UPDATE public.approval_requests
     SET status = 'approved', decided_at = now(), decided_by = auth.uid(),
         approvals_recorded = required_approvals
   WHERE entity_type = 'journal_entry' AND entity_id = p_entry_id AND status = 'pending';

  RETURN jsonb_build_object('journal_entry_id', p_entry_id, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_post_journal_entry(p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.journal_entries%ROWTYPE;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_settings public.finance_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.journal_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal entry not found'; END IF;

  PERFORM public.finance_require_permission(v_entry.school_id, 'journals.post');

  IF v_entry.status = 'posted' THEN
    RAISE EXCEPTION 'Journal entry % is already posted', v_entry.entry_number;
  END IF;
  IF v_entry.status = 'reversed' THEN
    RAISE EXCEPTION 'Journal entry % has been reversed and cannot be posted again', v_entry.entry_number;
  END IF;

  SELECT * INTO v_settings FROM public.finance_settings WHERE school_id = v_entry.school_id;

  IF v_entry.status = 'submitted'
     AND coalesce(v_settings.require_journal_approval, false)
     AND v_entry.approved_at IS NULL
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION
      'Journal % must be approved before it can be posted (approval is enabled for this school)',
      v_entry.entry_number;
  END IF;

  SELECT coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    INTO v_debit, v_credit
    FROM public.journal_entry_lines WHERE journal_entry_id = p_entry_id;

  IF round(v_debit, 2) <> round(v_credit, 2) OR v_debit = 0 THEN
    RAISE EXCEPTION
      'Journal % is out of balance (debits %, credits %) and cannot be posted',
      v_entry.entry_number, v_debit, v_credit;
  END IF;

  PERFORM public.finance_assert_period_open(v_entry.school_id, v_entry.entry_date);

  PERFORM set_config('finance.posting', 'on', true);

  UPDATE public.journal_entries
     SET status = 'posted',
         total_debit = round(v_debit, 2),
         total_credit = round(v_credit, 2),
         posted_by = auth.uid(),
         posted_at = now()
   WHERE id = p_entry_id;

  UPDATE public.transactions
     SET status = 'posted', total_amount = round(v_debit, 2)
   WHERE id = v_entry.transaction_id;

  PERFORM set_config('finance.posting', 'off', true);

  RETURN jsonb_build_object(
    'journal_entry_id', p_entry_id,
    'entry_number', v_entry.entry_number,
    'status', 'posted',
    'total_debit', v_debit,
    'total_credit', v_credit
  );
END;
$$;

/**
 * Reverse a posted journal. The original entry is preserved and marked
 * reversed; a mirrored contra entry carries the correcting postings.
 */
CREATE OR REPLACE FUNCTION public.finance_reverse_journal(p_entry_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.journal_entries%ROWTYPE;
  v_locked boolean := false;
  v_reversal_id uuid;
  v_reversal_number text;
  v_settings public.finance_settings%ROWTYPE;
  v_period_id uuid;
  v_line_count integer;
BEGIN
  SELECT * INTO v_entry FROM public.journal_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal entry not found'; END IF;

  PERFORM public.finance_require_permission(v_entry.school_id, 'journals.reverse');

  IF v_entry.status <> 'posted' THEN
    RAISE EXCEPTION 'Only a posted journal can be reversed (entry % is %)',
      v_entry.entry_number, v_entry.status;
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to reverse a journal entry';
  END IF;

  SELECT count(*) INTO v_line_count
    FROM public.journal_entry_lines WHERE journal_entry_id = p_entry_id;
  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Journal % has no lines to reverse', v_entry.entry_number;
  END IF;

  SELECT * INTO v_settings FROM public.finance_settings WHERE school_id = v_entry.school_id;

  v_reversal_number := public.next_finance_number(
    v_entry.school_id, 'JOURNAL', coalesce(v_settings.journal_prefix, 'JV'),
    v_settings.number_pad_width
  );

  SELECT id INTO v_period_id FROM public.financial_periods
   WHERE school_id = v_entry.school_id AND CURRENT_DATE BETWEEN start_date AND end_date
   ORDER BY start_date DESC LIMIT 1;

  PERFORM set_config('finance.posting', 'on', true);
  v_locked := true;

  INSERT INTO public.journal_entries (
    school_id, entry_number, entry_date, description, status, created_by, entry_type,
    source_module, source_record_id, reference_number, period_id, fund_id, branch_id,
    cost_center_id, total_debit, total_credit, reversal_of_entry_id, reversal_reason,
    posted_by, posted_at
  ) VALUES (
    v_entry.school_id, v_reversal_number, CURRENT_DATE,
    'Reversal of ' || v_entry.entry_number || ' — ' || p_reason,
    'posted', auth.uid(), 'reversal',
    v_entry.source_module, v_entry.source_record_id, v_entry.reference_number, v_period_id,
    v_entry.fund_id, v_entry.branch_id, v_entry.cost_center_id,
    v_entry.total_credit, v_entry.total_debit, v_entry.id, p_reason,
    auth.uid(), now()
  ) RETURNING id INTO v_reversal_id;

  INSERT INTO public.journal_entry_lines (
    school_id, journal_entry_id, account_id, debit, credit, narration, line_number,
    fund_id, branch_id, cost_center_id, reference, student_id, supplier_id
  )
  SELECT v_entry.school_id, v_reversal_id, l.account_id, l.credit, l.debit,
         'Reversal of ' || v_entry.entry_number, l.line_number,
         l.fund_id, l.branch_id, l.cost_center_id, v_reversal_number, l.student_id, l.supplier_id
    FROM public.journal_entry_lines l
   WHERE l.journal_entry_id = p_entry_id;

  UPDATE public.journal_entries
     SET status = 'reversed', reversed_by_entry_id = v_reversal_id
   WHERE id = p_entry_id;

  IF v_locked THEN
    PERFORM set_config('finance.posting', 'off', true);
  END IF;

  RETURN jsonb_build_object(
    'reversed_entry_id', p_entry_id,
    'reversal_entry_id', v_reversal_id,
    'reversal_number', v_reversal_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_approve_journal(uuid) FROM public;
REVOKE ALL ON FUNCTION public.finance_post_journal_entry(uuid) FROM public;
REVOKE ALL ON FUNCTION public.finance_reverse_journal(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_approve_journal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_post_journal_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reverse_journal(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. General ledger views and financial statement functions
-- ---------------------------------------------------------------------------
/** Every posted ledger line, with account, dimensions and source document. */
CREATE OR REPLACE VIEW public.v_gl_entries
WITH (security_invoker = true) AS
SELECT
  j.school_id,
  l.id AS line_id,
  j.id AS journal_entry_id,
  j.entry_number,
  j.entry_date,
  j.status AS entry_status,
  j.entry_type,
  j.source_module,
  j.source_record_id,
  j.reference_number,
  j.description AS narration,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.account_type,
  a.category AS account_category,
  l.debit,
  l.credit,
  (l.debit - l.credit) AS signed_amount,
  l.narration AS line_narration,
  l.student_id,
  s.full_name AS student_name,
  l.supplier_id,
  sup.supplier_name,
  l.cost_center_id,
  cc.name AS cost_center_name,
  l.fund_id,
  f.name AS fund_name,
  l.branch_id,
  b.name AS branch_name,
  j.posted_at,
  j.created_by
FROM public.journal_entry_lines l
JOIN public.journal_entries j ON j.id = l.journal_entry_id
JOIN public.chart_of_accounts a ON a.id = l.account_id
LEFT JOIN public.students s ON s.id = l.student_id
LEFT JOIN public.suppliers sup ON sup.id = l.supplier_id
LEFT JOIN public.finance_cost_centers cc ON cc.id = l.cost_center_id
LEFT JOIN public.finance_funds f ON f.id = l.fund_id
LEFT JOIN public.finance_branches b ON b.id = l.branch_id
WHERE j.status IN ('posted', 'reversed');

/** Trial balance straight from the ledger. Debits and credits always agree. */
CREATE OR REPLACE FUNCTION public.finance_trial_balance(
  p_school_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS TABLE (
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  opening_balance numeric,
  total_debit numeric,
  total_credit numeric,
  closing_balance numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ledger AS (
    SELECT account_id, account_type, debit, credit, entry_date
      FROM public.v_gl_entries
     WHERE school_id = p_school_id
  )
  SELECT
    a.id,
    a.code,
    a.name,
    a.account_type,
    coalesce(sum(CASE WHEN p_from IS NOT NULL AND l.entry_date < p_from
                      THEN l.debit - l.credit END), 0)::numeric(14,2) AS opening_balance,
    coalesce(sum(CASE WHEN (p_from IS NULL OR l.entry_date >= p_from)
                        AND (p_to IS NULL OR l.entry_date <= p_to)
                      THEN l.debit END), 0)::numeric(14,2) AS total_debit,
    coalesce(sum(CASE WHEN (p_from IS NULL OR l.entry_date >= p_from)
                        AND (p_to IS NULL OR l.entry_date <= p_to)
                      THEN l.credit END), 0)::numeric(14,2) AS total_credit,
    coalesce(sum(CASE WHEN p_to IS NULL OR l.entry_date <= p_to
                      THEN l.debit - l.credit END), 0)::numeric(14,2) AS closing_balance
  FROM public.chart_of_accounts a
  LEFT JOIN ledger l ON l.account_id = a.id
  WHERE a.school_id = p_school_id
  GROUP BY a.id, a.code, a.name, a.account_type
  ORDER BY a.code;
$$;

/** Income and expenditure statement (school P&L) from posted journals. */
CREATE OR REPLACE FUNCTION public.finance_income_expenditure(
  p_school_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE (
  section text,
  account_id uuid,
  account_code text,
  account_name text,
  amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE a.account_type WHEN 'income' THEN 'income' ELSE 'expenditure' END,
    a.id,
    a.code,
    a.name,
    (sum(l.credit) - sum(l.debit))::numeric(14,2) AS amount
  FROM public.v_gl_entries l
  JOIN public.chart_of_accounts a ON a.id = l.account_id
  WHERE l.school_id = p_school_id
    AND l.entry_date BETWEEN p_from AND p_to
    AND a.account_type IN ('income', 'expense')
  GROUP BY a.id, a.code, a.name, a.account_type
  HAVING sum(l.credit) - sum(l.debit) <> 0
  ORDER BY 1, 4;
$$;

/** Statement of financial position (balance sheet) as at a date. */
CREATE OR REPLACE FUNCTION public.finance_balance_sheet(p_school_id uuid, p_as_of date)
RETURNS TABLE (
  section text,
  account_id uuid,
  account_code text,
  account_name text,
  amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE a.account_type
      WHEN 'asset' THEN 'assets'
      WHEN 'liability' THEN 'liabilities'
      ELSE 'fund_balance'
    END,
    a.id,
    a.code,
    a.name,
    CASE WHEN a.account_type IN ('asset', 'expense')
         THEN (sum(l.debit) - sum(l.credit))
         ELSE (sum(l.credit) - sum(l.debit)) END::numeric(14,2) AS amount
  FROM public.v_gl_entries l
  JOIN public.chart_of_accounts a ON a.id = l.account_id
  WHERE l.school_id = p_school_id
    AND l.entry_date <= p_as_of
    AND a.account_type IN ('asset', 'liability', 'equity')
  GROUP BY a.id, a.code, a.name, a.account_type
  HAVING sum(l.debit) <> sum(l.credit)
  ORDER BY 1, 4;
$$;

REVOKE ALL ON FUNCTION public.finance_trial_balance(uuid, date, date) FROM public;
REVOKE ALL ON FUNCTION public.finance_income_expenditure(uuid, date, date) FROM public;
REVOKE ALL ON FUNCTION public.finance_balance_sheet(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_trial_balance(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_income_expenditure(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_balance_sheet(uuid, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cash, bank, petty cash and mobile money accounts
-- ---------------------------------------------------------------------------
-- Banks and mobile money providers are configuration, not code, so any Ugandan
-- bank or provider can be added by the school without an application change.
CREATE TABLE IF NOT EXISTS public.finance_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.finance_branches(id) ON DELETE SET NULL,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  bank_branch text,
  account_number text NOT NULL,
  swift_code text,
  currency text NOT NULL DEFAULT 'UGX',
  gl_account_code text NOT NULL DEFAULT '1010',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  opening_balance_date date,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  remarks text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, bank_name, account_number)
);

CREATE TABLE IF NOT EXISTS public.finance_cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.finance_branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  collection_point text,
  cashier_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gl_account_code text NOT NULL DEFAULT '1000',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  float_limit numeric(14,2),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.finance_petty_cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  custodian_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gl_account_code text NOT NULL DEFAULT '1001',
  float_amount numeric(14,2) NOT NULL DEFAULT 0,
  replenish_threshold numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.finance_mobile_money_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  provider_code text NOT NULL,
  account_name text NOT NULL,
  merchant_number text NOT NULL,
  gl_account_code text NOT NULL DEFAULT '1020',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  settlement_account_code text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  remarks text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, provider_code, merchant_number)
);

ALTER TABLE public.finance_payment_methods
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mobile_money_account_id uuid REFERENCES public.finance_mobile_money_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_account_id uuid REFERENCES public.finance_cash_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_account_id uuid REFERENCES public.finance_cash_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mobile_money_account_id uuid REFERENCES public.finance_mobile_money_accounts(id) ON DELETE SET NULL;

-- Bank, cash, petty cash and mobile money transaction ledgers
CREATE TABLE IF NOT EXISTS public.finance_bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  value_date date,
  direction text NOT NULL DEFAULT 'inflow',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reference text,
  description text,
  source_module text,
  source_record_id uuid,
  statement_reference text,
  status text NOT NULL DEFAULT 'unreconciled',
  reconciliation_id uuid,
  journal_entry_id uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_bank_transactions_direction_check CHECK (direction IN ('inflow', 'outflow')),
  CONSTRAINT finance_bank_transactions_status_check
    CHECK (status IN ('unreconciled', 'matched', 'cleared', 'voided'))
);

CREATE TABLE IF NOT EXISTS public.finance_cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  cash_account_id uuid NOT NULL REFERENCES public.finance_cash_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  direction text NOT NULL DEFAULT 'inflow',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reference text,
  description text,
  source_module text,
  source_record_id uuid,
  status text NOT NULL DEFAULT 'posted',
  journal_entry_id uuid,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_cash_transactions_direction_check CHECK (direction IN ('inflow', 'outflow'))
);

CREATE TABLE IF NOT EXISTS public.finance_petty_cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  petty_cash_account_id uuid NOT NULL REFERENCES public.finance_petty_cash_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL DEFAULT 'expense',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payee text,
  description text,
  receipt_reference text,
  expense_id uuid,
  status text NOT NULL DEFAULT 'posted',
  journal_entry_id uuid,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_petty_cash_transactions_type_check
    CHECK (transaction_type IN ('float', 'expense', 'replenishment', 'reimbursement', 'adjustment'))
);

CREATE TABLE IF NOT EXISTS public.finance_mobile_money_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  mobile_money_account_id uuid NOT NULL REFERENCES public.finance_mobile_money_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  direction text NOT NULL DEFAULT 'inflow',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  transaction_reference text NOT NULL,
  payer_name text,
  payer_phone text,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  description text,
  source_module text,
  source_record_id uuid,
  settlement_status text NOT NULL DEFAULT 'pending',
  reconciliation_status text NOT NULL DEFAULT 'unreconciled',
  journal_entry_id uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_mobile_money_direction_check CHECK (direction IN ('inflow', 'outflow')),
  CONSTRAINT finance_mobile_money_settlement_check
    CHECK (settlement_status IN ('pending', 'settled', 'failed', 'reversed')),
  CONSTRAINT finance_mobile_money_reconciliation_check
    CHECK (reconciliation_status IN ('unreconciled', 'matched', 'exception', 'ignored'))
);

-- ---------------------------------------------------------------------------
-- 7. Bank reconciliation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE,
  reconciliation_number text NOT NULL,
  statement_date date NOT NULL,
  period_start date,
  period_end date,
  statement_opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  statement_closing_balance numeric(14,2) NOT NULL DEFAULT 0,
  book_balance numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_deposits numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_withdrawals numeric(14,2) NOT NULL DEFAULT 0,
  adjustments numeric(14,2) NOT NULL DEFAULT 0,
  difference numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  prepared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  remarks text,
  journal_entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, reconciliation_number),
  CONSTRAINT finance_bank_reconciliations_status_check
    CHECK (status IN ('draft', 'in_progress', 'completed', 'voided'))
);

CREATE TABLE IF NOT EXISTS public.finance_bank_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  reconciliation_id uuid NOT NULL REFERENCES public.finance_bank_reconciliations(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'system',
  bank_transaction_id uuid REFERENCES public.finance_bank_transactions(id) ON DELETE SET NULL,
  statement_reference text,
  statement_date date,
  statement_amount numeric(14,2),
  system_amount numeric(14,2),
  match_status text NOT NULL DEFAULT 'unmatched',
  variance numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  matched_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_bank_reconciliation_items_type_check
    CHECK (item_type IN ('system', 'statement', 'bank_charge', 'interest', 'adjustment', 'outstanding')),
  CONSTRAINT finance_bank_reconciliation_items_match_check
    CHECK (match_status IN ('unmatched', 'matched', 'partially_matched', 'exception', 'ignored'))
);

CREATE INDEX IF NOT EXISTS idx_finance_bank_transactions_account
  ON public.finance_bank_transactions (school_id, bank_account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_mobile_money_account
  ON public.finance_mobile_money_transactions (school_id, mobile_money_account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_cash_transactions_account
  ON public.finance_cash_transactions (school_id, cash_account_id, transaction_date DESC);

-- ---------------------------------------------------------------------------
-- 8. Billing: issue a fee invoice with real accounting entries
-- ---------------------------------------------------------------------------
/**
 * Issue a fee invoice.
 *
 * p_items is a JSON array of
 *   { "fee_category_id": uuid, "description": text, "quantity": number,
 *     "unit_amount": number, "gross_amount": number, "discount_amount": number,
 *     "waiver_amount": number, "scholarship_amount": number, "tax_amount": number,
 *     "gl_account_code": text, "assignment_id": uuid }
 *
 * Postings: Dr Accounts Receivable (net), Dr Discounts/Waivers (adjustments),
 *           Cr fee income accounts per fee category.
 */
CREATE OR REPLACE FUNCTION public.finance_issue_invoice(
  p_school_id uuid,
  p_student_id uuid,
  p_items jsonb,
  p_invoice_date date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL,
  p_academic_year_id uuid DEFAULT NULL,
  p_term_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_auto_post boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_settings public.finance_settings%ROWTYPE;
  v_item jsonb;
  v_gross numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_waiver numeric(14,2) := 0;
  v_scholarship numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_gross_total numeric(14,2) := 0;
  v_discount_total numeric(14,2) := 0;
  v_waiver_total numeric(14,2) := 0;
  v_scholarship_total numeric(14,2) := 0;
  v_tax_total numeric(14,2) := 0;
  v_adjustment_total numeric(14,2) := 0;
  v_invoice_id uuid;
  v_invoice_number text;
  v_lines jsonb := '[]'::jsonb;
  v_income jsonb := '{}'::jsonb;
  v_ar_account uuid;
  v_discount_account uuid;
  v_journal_id uuid;
  v_previous_balance numeric(14,2) := 0;
  v_sort integer := 0;
  v_account_code text;
  v_account_id uuid;
  v_net_line numeric(14,2);
BEGIN
  PERFORM public.finance_require_permission(p_school_id, 'invoices.issue');

  SELECT * INTO v_student FROM public.students
   WHERE id = p_student_id AND school_id = p_school_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learner not found in your school';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one fee line to the invoice';
  END IF;

  SELECT * INTO v_settings FROM public.finance_settings WHERE school_id = p_school_id;

  v_ar_account := public.finance_account_id(p_school_id, v_settings.receivable_account_code);
  IF v_ar_account IS NULL THEN
    RAISE EXCEPTION 'The accounts receivable control account (%) is missing from the chart of accounts',
      v_settings.receivable_account_code;
  END IF;
  v_discount_account := public.finance_account_id(p_school_id, v_settings.discount_account_code);

  -- Step 1: create the invoice header with its own unique number.
  v_invoice_number := public.next_finance_number(
    p_school_id, 'INVOICE', coalesce(v_settings.invoice_prefix, 'INV'), v_settings.number_pad_width
  );

  SELECT coalesce(sum(balance_due), 0) INTO v_previous_balance
    FROM public.student_invoices
   WHERE school_id = p_school_id AND student_id = p_student_id
     AND balance_due > 0 AND status NOT IN ('voided', 'cancelled', 'draft');

  INSERT INTO public.student_invoices (
    school_id, student_id, financial_year_id, academic_year_id, term_id, class_id, stream_id,
    invoice_number, invoice_date, due_date, status, total_amount, amount_paid, balance_due,
    currency, source, notes, previous_balance, created_by, issued_at, issued_by
  ) VALUES (
    p_school_id, p_student_id,
    (SELECT fy.id FROM public.financial_years fy
      WHERE fy.school_id = p_school_id AND fy.is_current LIMIT 1),
    p_academic_year_id, p_term_id, v_student.class_id, v_student.stream_id,
    v_invoice_number, coalesce(p_invoice_date, CURRENT_DATE),
    coalesce(p_due_date,
             coalesce(p_invoice_date, CURRENT_DATE) + coalesce(v_settings.default_fee_due_days, 30)),
    CASE WHEN p_auto_post THEN 'issued' ELSE 'draft' END,
    0, 0, 0, coalesce(v_settings.currency, 'UGX'), coalesce(p_source, 'manual'), p_notes,
    v_previous_balance, auth.uid(),
    CASE WHEN p_auto_post THEN now() END,
    CASE WHEN p_auto_post THEN auth.uid() END
  )
  RETURNING id INTO v_invoice_id;

  -- Step 2: create the invoice lines and aggregate the income postings.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_account_code := coalesce(
      nullif(v_item ->> 'gl_account_code', ''),
      (SELECT fc.gl_account_code FROM public.fee_categories fc
        WHERE fc.id = nullif(v_item ->> 'fee_category_id', '')::uuid),
      v_settings.fee_income_account_code
    );
    v_account_id := coalesce(
      public.finance_account_id(p_school_id, v_account_code),
      public.finance_account_id(p_school_id, v_settings.fee_income_account_code)
    );
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'No income account is configured for fee line "%"',
        coalesce(v_item ->> 'description', 'fee');
    END IF;

    v_gross := round(coalesce(nullif(v_item ->> 'gross_amount', '')::numeric,
                    coalesce(nullif(v_item ->> 'unit_amount', '')::numeric, 0)
                      * coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1)), 2);
    IF v_gross < 0 THEN
      RAISE EXCEPTION 'Fee line amounts cannot be negative';
    END IF;

    v_discount := round(coalesce(nullif(v_item ->> 'discount_amount', '')::numeric, 0), 2);
    v_waiver := round(coalesce(nullif(v_item ->> 'waiver_amount', '')::numeric, 0), 2);
    v_scholarship := round(coalesce(nullif(v_item ->> 'scholarship_amount', '')::numeric, 0), 2);
    v_tax := round(coalesce(nullif(v_item ->> 'tax_amount', '')::numeric, 0), 2);
    v_net_line := round(v_gross - v_discount - v_waiver - v_scholarship + v_tax, 2);

    IF v_net_line < 0 THEN
      RAISE EXCEPTION 'Discounts and waivers on "%" exceed the fee amount',
        coalesce(v_item ->> 'description', 'fee line');
    END IF;

    v_sort := v_sort + 1;
    INSERT INTO public.student_invoice_items (
      school_id, invoice_id, fee_type, description, quantity, unit_amount, line_total,
      fee_category_id, assignment_id, gross_amount, discount_amount, waiver_amount,
      scholarship_amount, tax_amount, net_amount, gl_account_code, sort_order
    ) VALUES (
      p_school_id, v_invoice_id, coalesce(v_item ->> 'description', 'Fee'),
      v_item ->> 'description',
      coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1),
      coalesce(nullif(v_item ->> 'unit_amount', '')::numeric, v_gross), v_gross,
      nullif(v_item ->> 'fee_category_id', '')::uuid,
      nullif(v_item ->> 'assignment_id', '')::uuid,
      v_gross, v_discount, v_waiver, v_scholarship, v_tax,
      v_net_line, v_account_code, v_sort
    );

    v_total := round(v_total + v_net_line, 2);
    v_gross_total := round(v_gross_total + v_gross, 2);
    v_discount_total := round(v_discount_total + v_discount, 2);
    v_waiver_total := round(v_waiver_total + v_waiver, 2);
    v_scholarship_total := round(v_scholarship_total + v_scholarship, 2);
    v_tax_total := round(v_tax_total + v_tax, 2);
    v_income := jsonb_set(
      v_income,
      ARRAY[v_account_id::text],
      to_jsonb(coalesce((v_income ->> v_account_id::text)::numeric, 0) + v_gross + v_tax),
      true
    );
  END LOOP;

  v_adjustment_total := round(
    v_discount_total + v_waiver_total + v_scholarship_total, 2
  );

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Invoice total must be greater than zero';
  END IF;

  IF v_adjustment_total > 0 AND v_discount_account IS NULL THEN
    RAISE EXCEPTION
      'The discount and waiver account (%) is missing from the chart of accounts',
      v_settings.discount_account_code;
  END IF;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_ar_account,
      'debit', v_total,
      'credit', 0,
      'narration', 'Student receivable',
      'student_id', p_student_id
    )
  );

  IF v_adjustment_total > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_discount_account,
        'debit', v_adjustment_total,
        'credit', 0,
        'narration', 'Invoice discounts, waivers and scholarships',
        'student_id', p_student_id
      )
    );
  END IF;

  FOR v_account_code, v_net_line IN
    SELECT key, value::numeric FROM jsonb_each_text(v_income)
  LOOP
    IF v_net_line > 0 THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'account_id', v_account_code::uuid,
          'debit', 0,
          'credit', v_net_line,
          'narration', 'Fee income',
          'student_id', p_student_id
        )
      );
    END IF;
  END LOOP;

  v_journal_id := public.finance_post_journal(
    p_school_id,
    coalesce(p_invoice_date, CURRENT_DATE),
    'Invoice ' || v_invoice_number,
    v_lines,
    'system',
    'billing',
    v_invoice_id,
    v_invoice_number,
    NULL,
    NULL,
    NULL,
    'invoices.issue',
    p_auto_post
  );

  UPDATE public.student_invoices
     SET status = CASE WHEN p_auto_post THEN 'issued' ELSE 'draft' END,
         gross_amount = v_gross_total,
         discount_amount = v_discount_total,
         waiver_amount = v_waiver_total,
         scholarship_amount = v_scholarship_total,
         tax_amount = v_tax_total,
         total_amount = v_total,
         balance_due = v_total,
         journal_entry_id = v_journal_id,
         issued_at = CASE WHEN p_auto_post THEN now() ELSE NULL END,
         issued_by = CASE WHEN p_auto_post THEN auth.uid() ELSE NULL END
   WHERE id = v_invoice_id;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'journal_entry_id', v_journal_id,
    'total_amount', v_total,
    'balance_due', v_total,
    'status', CASE WHEN p_auto_post THEN 'issued' ELSE 'draft' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_issue_invoice(
  uuid, uuid, jsonb, date, date, uuid, uuid, text, text, boolean
) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_issue_invoice(
  uuid, uuid, jsonb, date, date, uuid, uuid, text, text, boolean
) TO authenticated;











