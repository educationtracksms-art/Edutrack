-- Super Admin owns platform tenants and subscriptions. School-scoped records
-- belong to the school administrator and school leadership roles.

-- A platform account must not inherit a school scope, even if a stale or
-- accidental school_id exists on its profile.
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN NULL::uuid
    ELSE (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_school()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('school_admin', 'head_teacher', 'deputy_head_teacher', 'dos')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'school_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_library()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'school_admin'
  );
$$;

-- This helper is used by the term-dependent school activity policies. The
-- platform role must not bypass the school tenant boundary.
CREATE OR REPLACE FUNCTION public.can_view_term_as_teacher(_term_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('school_admin', 'head_teacher', 'deputy_head_teacher', 'dos')
  )
  OR (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('class_teacher', 'subject_teacher')
    )
    AND EXISTS (
      SELECT 1
      FROM public.terms t
      WHERE t.id = _term_id
        AND t.school_id = public.current_school_id()
        AND t.is_current = true
    )
  );
$$;

DROP POLICY IF EXISTS "tenant_read_terms" ON public.terms;
CREATE POLICY "tenant_read_terms" ON public.terms
FOR SELECT TO authenticated
USING (
  school_id = public.current_school_id()
  AND public.can_view_term_as_teacher(id)
);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assessments', 'attendance_summaries', 'report_comments', 'co_curricular'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_read_%1$s" ON public.%1$I;', table_name);
    EXECUTE format($policy$
      CREATE POLICY "tenant_read_%1$s" ON public.%1$I
      FOR SELECT TO authenticated
      USING (
        school_id = public.current_school_id()
        AND public.can_view_term_as_teacher(term_id)
      );
    $policy$, table_name);
  END LOOP;
END $$;

-- Module switches are school operations, not platform operations.
DROP POLICY IF EXISTS "tenant_read_feature_toggles" ON public.feature_toggles;
DROP POLICY IF EXISTS "tenant_write_feature_toggles" ON public.feature_toggles;
DROP POLICY IF EXISTS "tenant_update_feature_toggles" ON public.feature_toggles;
DROP POLICY IF EXISTS "tenant_delete_feature_toggles" ON public.feature_toggles;
CREATE POLICY "tenant_read_feature_toggles" ON public.feature_toggles
FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY "tenant_write_feature_toggles" ON public.feature_toggles
FOR INSERT TO authenticated
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY "tenant_update_feature_toggles" ON public.feature_toggles
FOR UPDATE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_school())
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY "tenant_delete_feature_toggles" ON public.feature_toggles
FOR DELETE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_school());

DROP POLICY IF EXISTS "tenant_read_report_comment_rules" ON public.report_comment_rules;
DROP POLICY IF EXISTS "tenant_write_report_comment_rules" ON public.report_comment_rules;
DROP POLICY IF EXISTS "tenant_update_report_comment_rules" ON public.report_comment_rules;
DROP POLICY IF EXISTS "tenant_delete_report_comment_rules" ON public.report_comment_rules;
CREATE POLICY "tenant_read_report_comment_rules" ON public.report_comment_rules
FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY "tenant_write_report_comment_rules" ON public.report_comment_rules
FOR INSERT TO authenticated
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY "tenant_update_report_comment_rules" ON public.report_comment_rules
FOR UPDATE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_school())
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());
CREATE POLICY "tenant_delete_report_comment_rules" ON public.report_comment_rules
FOR DELETE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_school());

-- These policies were introduced by later module migrations with a
-- platform-wide bypass. Recreate them with the school boundary intact.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'identifier_scales', 'grading_identifier_scales'
  ] LOOP
    -- These tables are introduced by optional grading migrations. Keep this
    -- hardening migration safe on databases where those migrations have not
    -- been applied yet.
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "tenant_read_%1$s" ON public.%1$I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_write_%1$s" ON public.%1$I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%1$s" ON public.%1$I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%1$s" ON public.%1$I;', table_name);
    EXECUTE format($policy$
      CREATE POLICY "tenant_read_%1$s" ON public.%1$I
      FOR SELECT TO authenticated USING (school_id = public.current_school_id());
    $policy$, table_name);
    EXECUTE format($policy$
      CREATE POLICY "tenant_write_%1$s" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (school_id = public.current_school_id() AND public.can_manage_academics());
    $policy$, table_name);
    EXECUTE format($policy$
      CREATE POLICY "tenant_update_%1$s" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (school_id = public.current_school_id() AND public.can_manage_academics())
      WITH CHECK (school_id = public.current_school_id() AND public.can_manage_academics());
    $policy$, table_name);
    EXECUTE format($policy$
      CREATE POLICY "tenant_delete_%1$s" ON public.%1$I
      FOR DELETE TO authenticated
      USING (school_id = public.current_school_id() AND public.can_manage_academics());
    $policy$, table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'financial_years', 'financial_periods', 'chart_of_accounts', 'budgets',
    'budget_lines', 'transactions', 'journal_entries', 'journal_entry_lines',
    'payments', 'receipts', 'suppliers', 'purchase_requests', 'purchase_orders',
    'goods_receipts', 'approved_invoices', 'payment_vouchers'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "finance_school_read_%1$s" ON public.%1$I;', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "finance_school_write_%1$s" ON public.%1$I;', table_name);
    EXECUTE format($policy$
      CREATE POLICY "finance_school_read_%1$s" ON public.%1$I
      FOR SELECT TO authenticated USING (school_id = public.current_school_id());
    $policy$, table_name);
    EXECUTE format($policy$
      CREATE POLICY "finance_school_write_%1$s" ON public.%1$I
      FOR ALL TO authenticated
      USING (school_id = public.current_school_id() AND public.can_manage_finance())
      WITH CHECK (school_id = public.current_school_id() AND public.can_manage_finance());
    $policy$, table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "school_read_departments" ON public.departments;
DROP POLICY IF EXISTS "school_write_departments" ON public.departments;
CREATE POLICY "school_read_departments" ON public.departments
FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY "school_write_departments" ON public.departments
FOR ALL TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_school())
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());

DROP POLICY IF EXISTS "staff_assignments_read" ON public.staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_write" ON public.staff_assignments;
CREATE POLICY "staff_assignments_read" ON public.staff_assignments
FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY "staff_assignments_write" ON public.staff_assignments
FOR ALL TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_school())
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());

DROP POLICY IF EXISTS "department_heads_read" ON public.department_heads;
DROP POLICY IF EXISTS "department_heads_write" ON public.department_heads;
CREATE POLICY "department_heads_read" ON public.department_heads
FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY "department_heads_write" ON public.department_heads
FOR ALL TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_school())
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_school());

DROP POLICY IF EXISTS "timetable_settings_select" ON public.timetable_settings;
DROP POLICY IF EXISTS "timetable_settings_insert" ON public.timetable_settings;
DROP POLICY IF EXISTS "timetable_settings_update" ON public.timetable_settings;
DROP POLICY IF EXISTS "timetable_settings_delete" ON public.timetable_settings;
CREATE POLICY "timetable_settings_select" ON public.timetable_settings
FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY "timetable_settings_insert" ON public.timetable_settings
FOR INSERT TO authenticated
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_academics());
CREATE POLICY "timetable_settings_update" ON public.timetable_settings
FOR UPDATE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_academics())
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_academics());
CREATE POLICY "timetable_settings_delete" ON public.timetable_settings
FOR DELETE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_academics());

DROP POLICY IF EXISTS "timetable_periods_select" ON public.timetable_periods;
DROP POLICY IF EXISTS "timetable_periods_insert" ON public.timetable_periods;
DROP POLICY IF EXISTS "timetable_periods_update" ON public.timetable_periods;
DROP POLICY IF EXISTS "timetable_periods_delete" ON public.timetable_periods;
CREATE POLICY "timetable_periods_select" ON public.timetable_periods
FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY "timetable_periods_insert" ON public.timetable_periods
FOR INSERT TO authenticated
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_academics());
CREATE POLICY "timetable_periods_update" ON public.timetable_periods
FOR UPDATE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_academics())
WITH CHECK (school_id = public.current_school_id() AND public.can_manage_academics());
CREATE POLICY "timetable_periods_delete" ON public.timetable_periods
FOR DELETE TO authenticated
USING (school_id = public.current_school_id() AND public.can_manage_academics());
