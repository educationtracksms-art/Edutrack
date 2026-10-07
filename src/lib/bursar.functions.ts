import { createServerFn } from "@tanstack/react-start";
import { requireRateLimitedSupabaseAuth as requireSupabaseAuth } from "@/integrations/supabase/rate-limited-auth-middleware";

/**
 * Allow-list for finance server functions. Deny by default: only the Bursar may
 * read or mutate finance data. Keep in step with FINANCE_VIEW_ROLES in
 * `@/lib/bursar`, FINANCE_ROUTE_ROLES in `@/lib/route-guards`, and the SQL
 * helpers `public.can_manage_finance()` / `public.finance_can_read()`.
 */
const FINANCE_MANAGERS = ["bursar"];

async function rolesOf(dbClient: any, accountId: string): Promise<string[]> {
  const { data } = await dbClient.from("user_roles").select("role").eq("user_id", accountId);
  return (data ?? []).map((row: any) => row.role);
}

async function schoolOf(dbClient: any, id: string): Promise<string | null> {
  const { data } = await dbClient.from("profiles").select("school_id").eq("id", id).maybeSingle();
  return data?.school_id ?? null;
}

async function requireFinanceRole(context: { supabase: any; userId: string }): Promise<string> {
  const roles = await rolesOf(context.supabase as any, context.userId as string);
  if (!roles.some((role) => FINANCE_MANAGERS.includes(role))) {
    throw new Error("Not allowed to manage school finances");
  }
  const schoolId = await schoolOf(context.supabase as any, context.userId as string);
  if (!schoolId) throw new Error("Your account is not linked to a school");
  return schoolId;
}

async function requirePermission(context: { supabase: any; userId: string }, schoolId: string, permission: string) {
  const roles = await rolesOf(context.supabase as any, context.userId as string);
  if (!roles.some((role) => FINANCE_MANAGERS.includes(role))) {
    throw new Error(`Your role does not allow this financial action (${permission})`);
  }
  const { error } = await (context.supabase as any).rpc("finance_require_permission", {
    p_school_id: schoolId,
    p_permission: permission,
  });
  if (error) throw new Error(error.message);
}

async function logAudit(auditClient: any, actorId: string, schoolId: string | null, action: string, entity: string, details?: Record<string, unknown>) {
  const { data: profile } = await auditClient.from("profiles").select("full_name").eq("id", actorId).maybeSingle();
  await auditClient.from("audit_logs").insert({
    school_id: schoolId,
    user_id: actorId,
    user_name: profile?.full_name ?? null,
    action,
    entity,
    details: details ?? {},
  });
}

function positiveAmount(value: unknown, label: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${label} must be greater than zero`);
  return amount;
}

function nextDocNumber(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

function dbTable(supabase: any, table: string): any {
  return (supabase as any).from(table as never);
}

export const recordBursarPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      studentId: string;
      amount: number;
      paymentMethod: string;
      paymentDate?: string | null;
      referenceNumber?: string | null;
      narration?: string | null;
      paymentNumber?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "payments.record");
    const amount = positiveAmount(data.amount, "Payment amount");
    const paymentNumber = data.paymentNumber?.trim() || nextDocNumber("PAY");
    const today = new Date().toISOString().slice(0, 10);
    const { data: student } = await supabase
      .from("students")
      .select("id, school_id, fees_balance")
      .eq("id", data.studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        school_id: schoolId,
        student_id: data.studentId,
        payment_number: paymentNumber,
        payment_date: data.paymentDate ?? today,
        amount,
        payment_method: data.paymentMethod,
        reference_number: data.referenceNumber ?? null,
        narration: data.narration ?? null,
        status: "completed",
        created_by: userId,
      })
      .select("id")
      .single();
    if (paymentError) throw new Error(paymentError.message);
    const receiptNumber = paymentNumber.replace(/^PAY/i, "RCT");
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        school_id: schoolId,
        student_id: data.studentId,
        payment_id: payment.id,
        receipt_number: receiptNumber,
        status: "issued",
      })
      .select("id")
      .single();
    if (receiptError) throw new Error(receiptError.message);
    await supabase
      .from("students")
      .update({ fees_balance: Math.max(0, Number(student.fees_balance ?? 0) - amount) })
      .eq("id", data.studentId);
    await logAudit(supabase, userId, schoolId, "BURSAR_PAYMENT_RECORDED", "payments", {
      payment_id: payment.id,
      receipt_id: receipt.id,
      student_id: data.studentId,
      amount,
      payment_method: data.paymentMethod,
    });
    return { paymentId: payment.id, receiptId: receipt.id };
  });

export const issueBursarInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      studentId: string;
      amount: number;
      termId?: string | null;
      financialYearId?: string | null;
      dueDate?: string | null;
      feeType?: string | null;
      description?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "invoices.issue");
    const amount = positiveAmount(data.amount, "Invoice amount");
    const invoiceNumber = nextDocNumber("INV");
    const { data: student } = await supabase
      .from("students")
      .select("id, school_id, fees_balance")
      .eq("id", data.studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");
    const { data: invoice, error } = await supabase
      .from("student_invoices")
      .insert({
        school_id: schoolId,
        student_id: data.studentId,
        financial_year_id: data.financialYearId ?? null,
        term_id: data.termId ?? null,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: data.dueDate ?? null,
        status: "issued",
        total_amount: amount,
        amount_paid: 0,
        balance_due: amount,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("student_invoice_items").insert({
      school_id: schoolId,
      invoice_id: invoice.id,
      fee_type: data.feeType?.trim() || "Tuition",
      description: data.description?.trim() || "Student fee invoice",
      quantity: 1,
      unit_amount: amount,
      line_total: amount,
    });
    await supabase
      .from("students")
      .update({ fees_balance: Number(student.fees_balance ?? 0) + amount })
      .eq("id", data.studentId);
    await logAudit(supabase, userId, schoolId, "BURSAR_INVOICE_ISSUED", "student_invoices", {
      invoice_id: invoice.id,
      student_id: data.studentId,
      amount,
    });
    return { invoiceId: invoice.id };
  });

export const manageFeeSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      action: "category" | "structure" | "adjustment";
      name: string;
      code?: string | null;
      amount?: number | null;
      currency?: string | null;
      description?: string | null;
      adjustmentType?: string | null;
      studentId?: string | null;
      reason?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "fees.manage");
    if (!data.name.trim()) throw new Error("Enter a name first");
    if (data.action === "category") {
      const code = (data.code?.trim() || data.name.trim().toUpperCase().slice(0, 12)).replace(/\s+/g, "_");
      const { error } = await supabase.from("fee_categories").insert({
        school_id: schoolId,
        code,
        name: data.name.trim(),
        description: data.description?.trim() || null,
      });
      if (error) throw new Error(error.message);
    } else if (data.action === "structure") {
      const amount = positiveAmount(data.amount, "Fee amount");
      const { error } = await supabase.from("fee_structures").insert({
        school_id: schoolId,
        name: data.name.trim(),
        amount,
        currency: data.currency || "UGX",
        status: "active",
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    } else {
      if (!data.studentId) throw new Error("Select a student for the adjustment");
      const amount = positiveAmount(data.amount, "Adjustment amount");
      const { error } = await supabase.from("fee_adjustments").insert({
        school_id: schoolId,
        student_id: data.studentId,
        adjustment_type: data.adjustmentType || "discount",
        name: data.name.trim(),
        reason: data.reason?.trim() || null,
        amount,
        applied_amount: amount,
        status: "approved",
        requested_by: userId,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
    await logAudit(supabase, userId, schoolId, "BURSAR_FEE_SETUP", "fee_structures", {
      action: data.action,
      name: data.name,
    });
    return { ok: true };
  });

export const recordReceivableAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      studentId: string;
      actionType: string;
      channel?: string | null;
      notes?: string | null;
      amountPromised?: number | null;
      promisedDate?: string | null;
      followUpDate?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "collections.manage");
    if (!data.actionType.trim()) throw new Error("Select a follow-up action");
    const { data: student } = await supabase
      .from("students")
      .select("id, school_id")
      .eq("id", data.studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");
    const { data: existingCase } = await supabase
      .from("collection_cases")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_id", data.studentId)
      .eq("status", "open")
      .maybeSingle();
    let caseId = existingCase?.id ?? null;
    if (!caseId) {
      const { data: created, error } = await supabase
        .from("collection_cases")
        .insert({
          school_id: schoolId,
          student_id: data.studentId,
          case_number: nextDocNumber("COL"),
          status: "open",
          priority: "medium",
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      caseId = created.id;
    }
    const { error: actionError } = await supabase.from("collection_actions").insert({
      school_id: schoolId,
      case_id: caseId,
      student_id: data.studentId,
      action_type: data.actionType,
      channel: data.channel ?? null,
      notes: data.notes?.trim() || null,
      amount_promised: data.amountPromised ?? null,
      promised_date: data.promisedDate ?? null,
      follow_up_date: data.followUpDate ?? null,
      performed_by: userId,
    });
    if (actionError) throw new Error(actionError.message);
    return { caseId };
  });

export const recordBursarCollectionFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentId: string; actionType: string; note?: string | null; nextActionDate?: string | null }) => data)
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "collections.manage");
    if (!data.studentId) throw new Error("Select a learner first");
    if (!data.actionType.trim()) throw new Error("Select a follow-up action");
    const { error } = await supabase.from("collection_actions").insert({
      school_id: schoolId,
      student_id: data.studentId,
      action_type: data.actionType.trim(),
      note: data.note ?? null,
      next_action_date: data.nextActionDate ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, schoolId, "BURSAR_COLLECTION_FOLLOW_UP", "collection_actions", {
      student_id: data.studentId,
      action_type: data.actionType,
    });
    return { ok: true };
  });

export const recordBursarExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      payeeName: string;
      amount: number;
      paymentMethod: string;
      narration?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "expenses.create");
    if (!data.payeeName.trim()) throw new Error("Enter the payee first");
    const amount = positiveAmount(data.amount, "Expense amount");
    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert({
        school_id: schoolId,
        transaction_number: nextDocNumber("EXP"),
        transaction_date: new Date().toISOString().slice(0, 10),
        source_module: "expenses",
        transaction_type: "expense",
        narration: data.narration?.trim() || `Payment to ${data.payeeName.trim()}`,
        total_amount: amount,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { transactionId: transaction.id };
  });

export const recordBankingMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      accountKind: "bank" | "cash" | "mobile_money" | "petty_cash";
      accountId: string;
      direction: "in" | "out";
      amount: number;
      reference?: string | null;
      description?: string | null;
      transactionDate?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "banking.manage");
    const amount = positiveAmount(data.amount, "Transaction amount");
    const transactionDate = data.transactionDate ?? new Date().toISOString().slice(0, 10);
    if (data.accountKind === "bank") {
      const { error } = await supabase.from("finance_bank_transactions").insert({
        school_id: schoolId,
        bank_account_id: data.accountId,
        transaction_date: transactionDate,
        direction: data.direction,
        amount,
        reference: data.reference?.trim() || null,
        description: data.description?.trim() || null,
        source_module: "manual",
        status: "posted",
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    } else if (data.accountKind === "cash") {
      const { error } = await supabase.from("finance_cash_transactions").insert({
        school_id: schoolId,
        cash_account_id: data.accountId,
        transaction_date: transactionDate,
        direction: data.direction,
        amount,
        reference: data.reference?.trim() || null,
        description: data.description?.trim() || null,
        source_module: "manual",
        status: "posted",
        recorded_by: userId,
      });
      if (error) throw new Error(error.message);
    } else if (data.accountKind === "mobile_money") {
      const { error } = await supabase.from("finance_mobile_money_transactions").insert({
        school_id: schoolId,
        mobile_money_account_id: data.accountId,
        transaction_date: transactionDate,
        direction: data.direction,
        amount,
        transaction_reference: data.reference?.trim() || nextDocNumber("MM"),
        description: data.description?.trim() || null,
        source_module: "manual",
        settlement_status: "pending",
        reconciliation_status: "unmatched",
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("finance_petty_cash_transactions").insert({
        school_id: schoolId,
        petty_cash_account_id: data.accountId,
        transaction_date: transactionDate,
        transaction_type: data.direction === "in" ? "replenishment" : "expense",
        amount,
        description: data.description?.trim() || null,
        receipt_reference: data.reference?.trim() || null,
        status: "posted",
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
export const createBursarJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      description: string;
      entryDate?: string | null;
      lines: Array<{ accountId: string; debit?: number; credit?: number; narration?: string | null }>;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "journals.create");
    if (!data.description.trim()) throw new Error("Enter a journal description");
    if (!data.lines || data.lines.length < 2) throw new Error("A journal needs at least two lines");
    const debit = data.lines.reduce((sum: number, line: any) => sum + Number(line.debit ?? 0), 0);
    const credit = data.lines.reduce((sum: number, line: any) => sum + Number(line.credit ?? 0), 0);
    if (Math.abs(debit - credit) > 0.01 || debit <= 0) {
      throw new Error("Debits must equal credits and be greater than zero");
    }
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        school_id: schoolId,
        transaction_number: nextDocNumber("JV"),
        transaction_date: data.entryDate ?? new Date().toISOString().slice(0, 10),
        source_module: "journals",
        transaction_type: "journal",
        narration: data.description.trim(),
        total_amount: debit,
        created_by: userId,
      })
      .select("id")
      .single();
    if (transactionError) throw new Error(transactionError.message);
    const { data: journal, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        school_id: schoolId,
        transaction_id: transaction.id,
        entry_number: nextDocNumber("JV"),
        entry_date: data.entryDate ?? new Date().toISOString().slice(0, 10),
        description: data.description.trim(),
        status: "posted",
        created_by: userId,
      })
      .select("id")
      .single();
    if (journalError) throw new Error(journalError.message);
    const { error: lineError } = await supabase.from("journal_entry_lines").insert(
      data.lines.map((line: any) => ({
        school_id: schoolId,
        journal_entry_id: journal.id,
        account_id: line.accountId,
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        narration: line.narration ?? null,
      })),
    );
    if (lineError) throw new Error(lineError.message);
    return { journalId: journal.id };
  });

export const createBursarBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { title: string; financialYearId?: string | null; departmentName?: string | null; proposedAmount: number }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "budget.create");
    if (!data.title.trim()) throw new Error("Enter a budget title");
    const amount = positiveAmount(data.proposedAmount, "Budget amount");
    const { data: budget, error } = await supabase
      .from("budgets")
      .insert({
        school_id: schoolId,
        financial_year_id: data.financialYearId ?? null,
        department_name: data.departmentName?.trim() || null,
        title: data.title.trim(),
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: lineError } = await supabase.from("budget_lines").insert({
      school_id: schoolId,
      budget_id: budget.id,
      budget_category: data.departmentName?.trim() || "General",
      proposed_amount: amount,
      approved_amount: 0,
      revised_amount: amount,
      actual_amount: 0,
      committed_amount: 0,
    });
    if (lineError) throw new Error(lineError.message);
    return { budgetId: budget.id };
  });

export const createBursarPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { periodName: string; payDate?: string | null; grossAmount: number; deductions?: number | null; notes?: string | null }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "payroll.manage");
    if (!data.periodName.trim()) throw new Error("Enter a payroll period");
    const gross = positiveAmount(data.grossAmount, "Gross payroll");
    const deductions = Number(data.deductions ?? 0);
    const net = gross - (Number.isFinite(deductions) ? deductions : 0);
    if (net <= 0) throw new Error("Net pay must be greater than zero");
    const { data: run, error } = await supabase
      .from("payroll_runs")
      .insert({
        school_id: schoolId,
        period_name: data.periodName.trim(),
        pay_date: data.payDate ?? new Date().toISOString().slice(0, 10),
        gross_amount: gross,
        deductions: Number.isFinite(deductions) ? deductions : 0,
        net_amount: net,
        status: "draft",
        notes: data.notes?.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { payrollRunId: run.id };
  });

export const updateBursarPayrollStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { payrollRunId: string; status: string }) => data)
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    const permission = data.status === "paid" ? "payroll.pay" : "payroll.approve";
    await requirePermission(context, schoolId, permission);
    const { error } = await supabase
      .from("payroll_runs")
      .update({ status: data.status, approved_by: userId, approved_at: new Date().toISOString() })
      .eq("id", data.payrollRunId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createBursarAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { name: string; category?: string | null; purchaseDate?: string | null; purchaseCost: number; usefulLifeYears?: number | null; location?: string | null }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "assets.manage");
    if (!data.name.trim()) throw new Error("Enter the asset name");
    const cost = positiveAmount(data.purchaseCost, "Purchase cost");
    const { data: asset, error } = await supabase
      .from("fixed_assets")
      .insert({
        school_id: schoolId,
        asset_code: nextDocNumber("FA"),
        name: data.name.trim(),
        category: data.category?.trim() || "General",
        purchase_date: data.purchaseDate ?? new Date().toISOString().slice(0, 10),
        purchase_cost: cost,
        book_value: cost,
        useful_life_years: data.usefulLifeYears ?? 5,
        location: data.location?.trim() || null,
        status: "active",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { assetId: asset.id };
  });

export const createBursarGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { kind: "grant" | "aid"; title: string; amount: number; donor?: string | null; studentId?: string | null; status?: string | null; notes?: string | null }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, data.kind === "grant" ? "grants.manage" : "aid.review");
    if (!data.title.trim()) throw new Error("Enter a title");
    const amount = positiveAmount(data.amount, "Amount");
    if (data.kind === "grant") {
      const { data: grant, error } = await supabase
        .from("grants")
        .insert({
          school_id: schoolId,
          grant_code: nextDocNumber("GRT"),
          title: data.title.trim(),
          donor_name: data.donor?.trim() || null,
          total_amount: amount,
          received_amount: 0,
          status: data.status || "active",
          notes: data.notes?.trim() || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { grantId: grant.id };
    }
    if (!data.studentId) throw new Error("Select a student for financial aid");
    const { data: award, error } = await supabase
      .from("financial_aid_awards")
      .insert({
        school_id: schoolId,
        student_id: data.studentId,
        award_name: data.title.trim(),
        sponsor_name: data.donor?.trim() || null,
        amount,
        status: data.status || "pending",
        notes: data.notes?.trim() || null,
        reviewed_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { awardId: award.id };
  });

export const decideBursarApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { requestId: string; action: "approve" | "reject" | "cancel" | "comment"; comment?: string | null }) => data)
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "approvals.act");
    const { data: result, error } = await (supabase as any).rpc("finance_decide_approval", {
      p_request_id: data.requestId,
      p_action: data.action,
      p_comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, schoolId, "BURSAR_APPROVAL_DECIDED", "approval_requests", {
      request_id: data.requestId,
      action: data.action,
    });
    return result;
  });

export const saveBursarSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      currency?: string | null;
      invoicePrefix?: string | null;
      receiptPrefix?: string | null;
      paymentPrefix?: string | null;
      defaultFeeDueDays?: number | null;
      approvalThresholdAmount?: number | null;
      pettyCashFloatLimit?: number | null;
      requireRefundApproval?: boolean | null;
      requireExpenseApproval?: boolean | null;
      requireAdjustmentApproval?: boolean | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "finance.settings.manage");
    const payload: Record<string, unknown> = { school_id: schoolId, updated_at: new Date().toISOString() };
    if (data.currency) payload.currency = data.currency.toUpperCase();
    if (data.invoicePrefix) payload.invoice_prefix = data.invoicePrefix.trim();
    if (data.receiptPrefix) payload.receipt_prefix = data.receiptPrefix.trim();
    if (data.paymentPrefix) payload.payment_prefix = data.paymentPrefix.trim();
    if (data.defaultFeeDueDays !== undefined && data.defaultFeeDueDays !== null) payload.default_fee_due_days = Math.max(0, Number(data.defaultFeeDueDays));
    if (data.approvalThresholdAmount !== undefined && data.approvalThresholdAmount !== null) payload.approval_threshold_amount = Math.max(0, Number(data.approvalThresholdAmount));
    if (data.pettyCashFloatLimit !== undefined && data.pettyCashFloatLimit !== null) payload.petty_cash_float_limit = Math.max(0, Number(data.pettyCashFloatLimit));
    if (data.requireRefundApproval !== undefined && data.requireRefundApproval !== null) payload.require_refund_approval = !!data.requireRefundApproval;
    if (data.requireExpenseApproval !== undefined && data.requireExpenseApproval !== null) payload.require_expense_approval = !!data.requireExpenseApproval;
    if (data.requireAdjustmentApproval !== undefined && data.requireAdjustmentApproval !== null) payload.require_adjustment_approval = !!data.requireAdjustmentApproval;
    const { error } = await supabase.from("finance_settings").upsert(payload, { onConflict: "school_id" });
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, schoolId, "BURSAR_SETTINGS_SAVED", "finance_settings", payload);
    return { ok: true };
  });

//
// Finance request workflow (HOD submits → Bursar decides)
//

export const createFinanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      schoolId: string;
      subject: string;
      description: string;
      amount: number;
      priority: "low" | "medium" | "high";
      dateNeeded?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const roles = await rolesOf(supabase, userId);
    if (!roles.includes("hod")) throw new Error("Only heads of department can submit finance requests");
    const { data: profile } = await supabase.from("profiles").select("id, school_id").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    if (profile.school_id !== data.schoolId) throw new Error("School mismatch");
    const amount = positiveAmount(data.amount, "Amount");
    const { error } = await supabase.from("finance_requests").insert({
      school_id: data.schoolId,
      hod_id: profile.id,
      subject: data.subject.trim(),
      description: data.description.trim(),
      amount,
      priority: data.priority,
      date_needed: data.dateNeeded || null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, data.schoolId, "FINANCE_REQUEST_CREATED", "finance_requests", {
      request_id: data.subject,
      amount,
      priority: data.priority,
    });
    return { ok: true };
  });

export const listFinanceRequestsForSchool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    const { data, error } = await supabase
      .from("finance_requests")
      .select(
        "id, school_id, hod_id, subject, description, amount, priority, attachment_path, date_needed, status, finance_remarks, reviewed_by, reviewed_at, created_at, updated_at, profiles!hod_id (id, full_name, initials)",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const decideFinanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      requestId: string;
      schoolId: string;
      action: "approve" | "reject" | "processing";
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "finance.requests.decide");
    if (!["approve", "reject", "processing"].includes(data.action)) throw new Error("Invalid action");
    const { data: existing, error: findError } = await supabase
      .from("finance_requests")
      .select("id, status")
      .eq("id", data.requestId)
      .eq("school_id", data.schoolId)
      .single();
    if (findError) throw new Error("Request not found");
    const allowedTransitions: Record<string, string[]> = {
      pending: ["approve", "reject", "processing"],
      processing: ["approve", "reject"],
    };
    if (!allowedTransitions[existing?.status]?.includes(data.action)) {
      throw new Error(`Cannot ${data.action} a request with status "${existing?.status}"`);
    }
    const targetStatus = data.action === "processing" ? "processing" : data.action;
    const { error } = await supabase.from("finance_requests").update({
      status: targetStatus,
      finance_remarks: data.remarks?.trim() || null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", data.requestId);
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, data.schoolId, "FINANCE_REQUEST_DECIDED", "finance_requests", {
      request_id: data.requestId,
      action: data.action,
      new_status: targetStatus,
      remarks: data.remarks ?? null,
    });
    return { ok: true };
  });

export const listPayrollStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    const { data, error } = await supabase
      .from("payroll_staff")
      .select("*")
      .eq("school_id", schoolId)
      .order("full_name")
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPayrollStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      schoolId: string;
      id?: string | null;
      fullName: string;
      staffCategory: "teacher" | "non_teaching" | "cleaner" | "cook" | "porter" | "other";
      employeeNumber: string;
      nationalId?: string | null;
      taxPin?: string | null;
      bankName?: string | null;
      accountName?: string | null;
      accountNumber?: string | null;
      basicSalary: number;
      allowances: number;
      deductions: number;
      employmentType: "permanent" | "contract" | "casual";
      dateOfEmployment?: string | null;
      status: "active" | "inactive";
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "payroll.staff.manage");
    const payload: Record<string, unknown> = {
      school_id: data.schoolId,
      full_name: data.fullName.trim(),
      staff_category: data.staffCategory,
      employee_number: data.employeeNumber.trim().toUpperCase(),
      national_id: data.nationalId?.trim() || null,
      tax_pin: data.taxPin?.trim() || null,
      bank_name: data.bankName?.trim() || null,
      account_name: data.accountName?.trim() || null,
      account_number: data.accountNumber?.trim() || null,
      basic_salary: positiveAmount(data.basicSalary, "Basic salary"),
      allowances: Math.max(0, Number(data.allowances || 0)),
      deductions: Math.max(0, Number(data.deductions || 0)),
      employment_type: data.employmentType,
      date_of_employment: data.dateOfEmployment || new Date().toISOString().slice(0, 10),
      status: data.status,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      payload.id = data.id;
      const { error } = await supabase.from("payroll_staff").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(supabase, userId, schoolId, "PAYROLL_STAFF_UPDATED", "payroll_staff", { staff_id: data.id, employee_number: payload.employee_number });
      return { ok: true, updated: true };
    }
    const { error } = await supabase.from("payroll_staff").insert(payload);
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, schoolId, "PAYROLL_STAFF_CREATED", "payroll_staff", { employee_number: payload.employee_number });
    return { ok: true, updated: false };
  });

export const deletePayrollStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; schoolId: string }) => data)
  .handler(async ({ data, context }: any) => {
    const supabase: any = (context as any).supabase;
    const userId: string = (context as any).userId;
    const schoolId = await requireFinanceRole(context);
    await requirePermission(context, schoolId, "payroll.staff.manage");
    const { error } = await supabase.from("payroll_staff").delete().eq("id", data.id).eq("school_id", data.schoolId);
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, schoolId, "PAYROLL_STAFF_DELETED", "payroll_staff", { staff_id: data.id });
    return { ok: true };
  });
