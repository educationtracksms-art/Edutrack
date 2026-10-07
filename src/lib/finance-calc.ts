/**
 * Pure, dependency-free financial calculations shared by the Bursar server
 * functions, the finance workspace UI and the automated tests.
 *
 * Nothing in this file touches the network, the DOM or Supabase so it can be
 * executed by `node --test` as well as bundled for the browser. Keep every
 * function deterministic: the same inputs must always produce the same output.
 *
 * Currency defaults to the Uganda Shilling (UGX) but every formatter accepts an
 * explicit currency so a school can switch currencies through configuration.
 */

export const DEFAULT_CURRENCY = "UGX";

/** Number of minor units per major unit. UGX has no cents in practice. */
export const CURRENCY_DECIMALS: Record<string, number> = {
  UGX: 0,
  KES: 2,
  TZS: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

export function currencyDecimals(currency = DEFAULT_CURRENCY): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}

/**
 * Round a monetary amount to the precision of its currency. Financial values
 * must never carry floating point noise into the ledger.
 */
export function roundMoney(amount: number, currency = DEFAULT_CURRENCY): number {
  const decimals = currencyDecimals(currency);
  const factor = 10 ** decimals;
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

/** Adds monetary values without floating point drift. */
export function sumMoney(
  values: Array<number | null | undefined>,
  currency = DEFAULT_CURRENCY,
): number {
  return values.reduce<number>(
    (total, value) => roundMoney(total + Number(value ?? 0), currency),
    0,
  );
}

/** `UGX 1,500,000` — thousands separators plus currency code, never hard-coded per screen. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = DEFAULT_CURRENCY,
  options: { showCode?: boolean; signed?: boolean } = {},
): string {
  const decimals = currencyDecimals(currency);
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
  const showCode = options.showCode ?? true;
  const sign = options.signed && safe > 0 ? "+" : "";
  return showCode ? `${currency.toUpperCase()} ${sign}${formatted}` : `${sign}${formatted}`;
}

/**
 * Render an amount the accounting way: debits positive, credits in brackets.
 * Used by ledgers, trial balances and statements.
 */
export function formatDebitCredit(
  amount: number,
  side: "debit" | "credit",
  currency = DEFAULT_CURRENCY,
): string {
  const decimals = currencyDecimals(currency);
  const formatted = new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));
  return side === "credit" ? `(${formatted})` : formatted;
}

/** Parse bursar input such as "1,500,000", "UGX 250000" or "1 500 000" into a number. */
export function parseMoneyInput(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/[^\d.\-]/g, "")
    .trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `42%` with one optional decimal place, used by collection rate KPIs. */
export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(decimals).replace(/\.0+$/, "")}%`;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : 0;
}

/** Collection rate = collected / billed, expressed as a percentage (0 when nothing billed). */
export function collectionRate(billed: number, collected: number): number {
  return roundMoney(safeDivide(collected, billed) * 100, "KES");
}

/* -------------------------------------------------------------------------- */
/* Accounts receivable aging                                                   */
/* -------------------------------------------------------------------------- */

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

/** Whole days between two dates (ISO date strings or Date objects), never negative. */
export function daysBetween(from: Date | string, to: Date | string): number {
  const start = from instanceof Date ? from : new Date(`${from}T00:00:00Z`);
  const end = to instanceof Date ? to : new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return diff < 0 ? 0 : diff;
}

/** Classify an outstanding balance into the standard school aging buckets. */
export function agingBucket(
  dueDate: Date | string | null | undefined,
  asOf: Date | string = new Date(),
): AgingBucket {
  if (!dueDate) return "current";
  const overdueDays = daysBetween(dueDate, asOf);
  if (overdueDays <= 0) return "current";
  if (overdueDays <= 30) return "1-30";
  if (overdueDays <= 60) return "31-60";
  if (overdueDays <= 90) return "61-90";
  return "90+";
}

export type AgingRow = { dueDate?: string | null; balance: number };

/** Aggregate receivables into the five aging buckets. */
export function buildAgingSummary(
  rows: AgingRow[],
  asOf: Date | string = new Date(),
  currency = DEFAULT_CURRENCY,
): Array<{ bucket: AgingBucket; label: string; amount: number; count: number }> {
  const totals = new Map<AgingBucket, { amount: number; count: number }>();
  for (const bucket of AGING_BUCKETS) totals.set(bucket, { amount: 0, count: 0 });
  for (const row of rows) {
    const balance = Number(row.balance ?? 0);
    if (balance <= 0) continue;
    const bucket = agingBucket(row.dueDate, asOf);
    const current = totals.get(bucket)!;
    current.amount = roundMoney(current.amount + balance, currency);
    current.count += 1;
  }
  return AGING_BUCKETS.map((bucket) => ({
    bucket,
    label: AGING_BUCKET_LABELS[bucket],
    amount: totals.get(bucket)!.amount,
    count: totals.get(bucket)!.count,
  }));
}

/* -------------------------------------------------------------------------- */
/* Payment allocation engine                                                   */
/* -------------------------------------------------------------------------- */

export type AllocatableInvoice = {
  id: string;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  balanceDue: number;
};

export type PaymentAllocation = {
  invoiceId: string;
  invoiceNumber?: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
};

export type AllocationResult = {
  allocations: PaymentAllocation[];
  allocatedTotal: number;
  unallocated: number;
};

/**
 * Apply an amount to the oldest outstanding invoices first (FIFO by due date,
 * then invoice date), which is the collection policy Ugandan schools follow.
 * The remainder becomes an unallocated advance held on the learner account.
 */
export function allocatePayment(
  amount: number,
  invoices: AllocatableInvoice[],
  currency = DEFAULT_CURRENCY,
): AllocationResult {
  let remaining = roundMoney(Math.max(0, amount), currency);
  const allocations: PaymentAllocation[] = [];

  const ordered = [...invoices]
    .filter((invoice) => Number(invoice.balanceDue ?? 0) > 0)
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return String(a.id).localeCompare(String(b.id));
    });

  for (const invoice of ordered) {
    if (remaining <= 0) break;
    const balanceBefore = roundMoney(Number(invoice.balanceDue ?? 0), currency);
    const applied = roundMoney(Math.min(remaining, balanceBefore), currency);
    if (applied <= 0) continue;
    allocations.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber ?? null,
      amount: applied,
      balanceBefore,
      balanceAfter: roundMoney(balanceBefore - applied, currency),
    });
    remaining = roundMoney(remaining - applied, currency);
  }

  return {
    allocations,
    allocatedTotal: sumMoney(
      allocations.map((row) => row.amount),
      currency,
    ),
    unallocated: remaining,
  };
}

/* -------------------------------------------------------------------------- */
/* Payment plans                                                               */
/* -------------------------------------------------------------------------- */

export type InstallmentScheduleRow = {
  installmentNumber: number;
  dueDate: string;
  amount: number;
};

/** Add months to an ISO date while keeping the day-of-month stable. */
export function addMonths(date: Date | string, months: number): string {
  const base = date instanceof Date ? new Date(date.getTime()) : new Date(`${date}T00:00:00Z`);
  const day = base.getUTCDate();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Build an installment schedule. Any rounding remainder is added to the final
 * installment so the schedule always sums exactly to the total.
 */
export function buildInstallmentSchedule(
  total: number,
  count: number,
  firstDueDate: Date | string,
  frequency: "weekly" | "monthly" | "termly" = "monthly",
  currency = DEFAULT_CURRENCY,
): InstallmentScheduleRow[] {
  const installments = Math.max(1, Math.floor(count));
  const rounded = roundMoney(total, currency);
  const perInstallment = roundMoney(rounded / installments, currency);
  const rows: InstallmentScheduleRow[] = [];

  for (let index = 0; index < installments; index += 1) {
    const isLast = index === installments - 1;
    const amount = isLast
      ? roundMoney(
          rounded -
            sumMoney(
              rows.map((row) => row.amount),
              currency,
            ),
          currency,
        )
      : perInstallment;
    const startIso = firstDueDate instanceof Date
      ? firstDueDate.toISOString().slice(0, 10)
      : firstDueDate;
    const dueDate =
      frequency === "weekly"
        ? new Date(
            new Date(`${startIso}T00:00:00Z`).getTime() + index * 7 * 86_400_000,
          )
            .toISOString()
            .slice(0, 10)
        : frequency === "termly"
          ? addMonths(startIso, index * 4)
          : addMonths(startIso, index);
    rows.push({ installmentNumber: index + 1, dueDate, amount });
  }

  return rows;
}

/** Outstanding value of a payment plan and the installments already missed. */
export function summarisePaymentPlan(
  installments: Array<{ amount: number; amountPaid: number; dueDate: string; status?: string }>,
  asOf: Date | string = new Date(),
  currency = DEFAULT_CURRENCY,
): {
  scheduled: number;
  paid: number;
  outstanding: number;
  missed: number;
  nextDueDate: string | null;
} {
  const scheduled = sumMoney(
    installments.map((row) => Number(row.amount ?? 0)),
    currency,
  );
  const paid = sumMoney(
    installments.map((row) => Number(row.amountPaid ?? 0)),
    currency,
  );
  const outstanding = roundMoney(scheduled - paid, currency);
  const missed = installments.filter(
    (row) =>
      Number(row.amountPaid ?? 0) < Number(row.amount ?? 0) &&
      daysBetween(row.dueDate, asOf) > 0 &&
      row.status !== "paid",
  ).length;
  const pending = installments
    .filter((row) => Number(row.amountPaid ?? 0) < Number(row.amount ?? 0))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return { scheduled, paid, outstanding, missed, nextDueDate: pending[0]?.dueDate ?? null };
}

/* -------------------------------------------------------------------------- */
/* Discounts, waivers and scholarships                                         */
/* -------------------------------------------------------------------------- */

export type FeeLine = {
  feeCategoryId?: string | null;
  description: string;
  amount: number;
  isOptional?: boolean;
};

export type AdjustmentInput = {
  type: "percentage" | "fixed" | "waiver" | "scholarship" | "sponsorship";
  value: number;
  /** Limit a percentage adjustment to one fee category. */
  feeCategoryId?: string | null;
};

export type ChargeResult = {
  lines: Array<FeeLine & { gross: number; adjustment: number; net: number }>;
  grossTotal: number;
  adjustmentTotal: number;
  netTotal: number;
};

/**
 * Apply percentage/fixed/waiver adjustments across a set of fee lines.
 * Adjustments can never exceed the gross charge and never produce a negative fee.
 */
export function applyAdjustments(
  lines: FeeLine[],
  adjustments: AdjustmentInput[],
  currency = DEFAULT_CURRENCY,
): ChargeResult {
  const result = lines.map((line) => {
    const gross = roundMoney(Math.max(0, Number(line.amount ?? 0)), currency);
    let adjustment = 0;

    for (const rule of adjustments) {
      if (rule.feeCategoryId && rule.feeCategoryId !== line.feeCategoryId) continue;
      if (rule.type === "percentage") {
        adjustment += roundMoney((gross * Number(rule.value ?? 0)) / 100, currency);
      } else if (rule.type === "fixed") {
        adjustment += roundMoney(Number(rule.value ?? 0), currency);
      } else if (rule.type === "waiver") {
        adjustment = gross;
      } else if (rule.type === "scholarship" || rule.type === "sponsorship") {
        adjustment += roundMoney(Number(rule.value ?? 0), currency);
      }
    }

    adjustment = roundMoney(Math.min(Math.max(0, adjustment), gross), currency);
    return { ...line, gross, adjustment, net: roundMoney(gross - adjustment, currency) };
  });

  return {
    lines: result,
    grossTotal: sumMoney(
      result.map((line) => line.gross),
      currency,
    ),
    adjustmentTotal: sumMoney(
      result.map((line) => line.adjustment),
      currency,
    ),
    netTotal: sumMoney(
      result.map((line) => line.net),
      currency,
    ),
  };
}

/** Pro-rate a termly fee over the school days a learner actually attended. */
export function proRateAmount(
  amount: number,
  daysAttended: number,
  totalSchoolDays: number,
  currency = DEFAULT_CURRENCY,
): number {
  if (totalSchoolDays <= 0) return roundMoney(amount, currency);
  const ratio = Math.min(1, Math.max(0, daysAttended / totalSchoolDays));
  return roundMoney(amount * ratio, currency);
}

/* -------------------------------------------------------------------------- */
/* Payments: duplicate detection and reversal guards                           */
/* -------------------------------------------------------------------------- */

export type ExistingPayment = {
  id: string;
  referenceNumber?: string | null;
  amount: number;
  paymentDate: string;
  status?: string | null;
};

/** Normalise a bank/mobile money reference for comparison. */
export function normaliseReference(reference: string | null | undefined): string {
  return String(reference ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Find payments that look like duplicates of the one being captured: same
 * amount *and* same normalised reference (a classic double-capture of a bank
 * transfer or mobile money receipt).
 */
export function findDuplicatePayments(
  candidate: { referenceNumber?: string | null; amount: number },
  existing: ExistingPayment[],
): ExistingPayment[] {
  const reference = normaliseReference(candidate.referenceNumber);
  if (!reference) return [];
  return existing.filter(
    (payment) =>
      normaliseReference(payment.referenceNumber) === reference &&
      Number(payment.amount ?? 0) === Number(candidate.amount ?? 0) &&
      payment.status !== "reversed",
  );
}

/** Refundable amount = posted receipts less refunds already paid against them. */
export function refundableAmount(
  paid: number,
  alreadyRefunded: number,
  currency = DEFAULT_CURRENCY,
): number {
  return roundMoney(Math.max(0, Number(paid ?? 0) - Number(alreadyRefunded ?? 0)), currency);
}

export function validateRefundRequest(
  amount: number,
  paid: number,
  alreadyRefunded: number,
  currency = DEFAULT_CURRENCY,
): { ok: boolean; message?: string; refundable: number } {
  const refundable = refundableAmount(paid, alreadyRefunded, currency);
  const requested = roundMoney(Number(amount ?? 0), currency);
  if (requested <= 0) {
    return { ok: false, message: "Refund amount must be greater than zero", refundable };
  }
  if (requested > refundable) {
    return {
      ok: false,
      message: `Refund cannot exceed the refundable balance of ${formatMoney(refundable, currency)}`,
      refundable,
    };
  }
  return { ok: true, refundable };
}

/* -------------------------------------------------------------------------- */
/* Double-entry journal validation                                             */
/* -------------------------------------------------------------------------- */

export type JournalLineInput = {
  accountId: string;
  accountCode?: string | null;
  debit: number;
  credit: number;
  narration?: string | null;
  costCenterId?: string | null;
  fundId?: string | null;
  branchId?: string | null;
};

export type JournalValidation = {
  ok: boolean;
  message?: string;
  totalDebit: number;
  totalCredit: number;
  difference: number;
};

export function validateJournalLines(
  lines: JournalLineInput[],
  currency = DEFAULT_CURRENCY,
): JournalValidation {
  const usable = lines.filter(
    (line) => Number(line.debit ?? 0) !== 0 || Number(line.credit ?? 0) !== 0,
  );
  const empty: JournalValidation = {
    ok: false,
    totalDebit: 0,
    totalCredit: 0,
    difference: 0,
  };

  if (usable.length < 2) {
    return { ...empty, message: "A journal entry needs at least two lines (one debit and one credit)" };
  }

  for (const line of usable) {
    if (!line.accountId) {
      return { ...empty, message: "Every journal line must be mapped to a chart of accounts account" };
    }
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (debit < 0 || credit < 0) {
      return { ...empty, message: "Journal amounts cannot be negative" };
    }
    if (debit > 0 && credit > 0) {
      return { ...empty, message: "A journal line cannot carry both a debit and a credit" };
    }
  }

  const totalDebit = sumMoney(
    usable.map((line) => line.debit),
    currency,
  );
  const totalCredit = sumMoney(
    usable.map((line) => line.credit),
    currency,
  );
  const difference = roundMoney(totalDebit - totalCredit, currency);

  if (difference !== 0) {
    return {
      ok: false,
      message: `Total debits (${formatMoney(totalDebit, currency)}) must equal total credits (${formatMoney(totalCredit, currency)})`,
      totalDebit,
      totalCredit,
      difference,
    };
  }

  return { ok: true, totalDebit, totalCredit, difference: 0 };
}

/** Build the mirror-image lines used when reversing a posted journal. */
export function buildReversalLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({
    ...line,
    debit: Number(line.credit ?? 0),
    credit: Number(line.debit ?? 0),
  }));
}

/** A posted journal is immutable: only reversal creates a correcting entry. */
export function canEditJournal(status: string | null | undefined): boolean {
  return status === "draft" || status === "submitted" || status === "rejected";
}

/** Trial balance must always balance; this guards report integrity checks. */
export function trialBalanceDifference(
  rows: Array<{ debit: number; credit: number }>,
  currency = DEFAULT_CURRENCY,
): number {
  const debit = sumMoney(
    rows.map((row) => row.debit),
    currency,
  );
  const credit = sumMoney(
    rows.map((row) => row.credit),
    currency,
  );
  return roundMoney(debit - credit, currency);
}

/* -------------------------------------------------------------------------- */
/* Fixed assets and depreciation                                               */
/* -------------------------------------------------------------------------- */

export type DepreciationMethod = "straight_line" | "reducing_balance" | "none";

export type DepreciationResult = {
  annualAmount: number;
  monthlyAmount: number;
  netBookValue: number;
  accumulated: number;
  fullyDepreciated: boolean;
};

/**
 * Compute depreciation for one asset. All rates and lives come from
 * configuration (asset category / asset record), never hard-coded here.
 */
export function computeDepreciation(params: {
  cost: number;
  residualValue?: number;
  usefulLifeYears: number;
  method: DepreciationMethod;
  /** Rate in percent, used by the reducing-balance method. */
  ratePercent?: number | null;
  monthsElapsed: number;
  accumulatedToDate?: number;
  currency?: string;
}): DepreciationResult {
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const cost = roundMoney(Math.max(0, params.cost), currency);
  const residual = roundMoney(Math.max(0, params.residualValue ?? 0), currency);
  const depreciableBase = Math.max(0, cost - residual);
  const monthsElapsed = Math.max(0, params.monthsElapsed);
  const accumulatedToDate = roundMoney(Math.max(0, params.accumulatedToDate ?? 0), currency);

  if (params.method === "none" || depreciableBase === 0) {
    const accumulated = Math.min(accumulatedToDate, depreciableBase);
    return {
      annualAmount: 0,
      monthlyAmount: 0,
      netBookValue: roundMoney(cost - accumulated, currency),
      accumulated,
      fullyDepreciated: accumulated >= depreciableBase,
    };
  }

  if (params.method === "reducing_balance") {
    const rate = Number(params.ratePercent ?? 0) / 100;
    let bookValue = cost;
    let accumulated = 0;
    const monthly: number[] = [];
    const months = Math.min(monthsElapsed, Math.max(1, params.usefulLifeYears) * 12);
    for (let month = 0; month < months; month += 1) {
      const charge = roundMoney((bookValue * rate) / 12, currency);
      const remaining = Math.max(0, depreciableBase - accumulated);
      const applied = roundMoney(Math.min(charge, remaining), currency);
      accumulated = roundMoney(accumulated + applied, currency);
      bookValue = roundMoney(bookValue - applied, currency);
      monthly.push(applied);
    }
    const lastMonth = monthly[monthly.length - 1] ?? 0;
    return {
      annualAmount: roundMoney(lastMonth * 12, currency),
      monthlyAmount: lastMonth,
      netBookValue: roundMoney(cost - accumulated, currency),
      accumulated,
      fullyDepreciated: accumulated >= depreciableBase,
    };
  }

  const life = Math.max(1, params.usefulLifeYears);
  const annualAmount = roundMoney(depreciableBase / life, currency);
  const monthlyAmount = roundMoney(depreciableBase / (life * 12), currency);
  const months = Math.min(monthsElapsed, life * 12);
  const accumulated = roundMoney(Math.min(depreciableBase, monthlyAmount * months), currency);
  return {
    annualAmount,
    monthlyAmount,
    netBookValue: roundMoney(cost - accumulated, currency),
    accumulated,
    fullyDepreciated: accumulated >= depreciableBase,
  };
}

/* -------------------------------------------------------------------------- */
/* Budget monitoring                                                           */
/* -------------------------------------------------------------------------- */

export type BudgetLineComparison = {
  budget: number;
  actual: number;
  committed?: number;
};

export function summariseBudget(
  lines: BudgetLineComparison[],
  currency = DEFAULT_CURRENCY,
): {
  budget: number;
  actual: number;
  committed: number;
  available: number;
  variance: number;
  utilisation: number;
  overBudget: boolean;
} {
  const budget = sumMoney(
    lines.map((line) => Number(line.budget ?? 0)),
    currency,
  );
  const actual = sumMoney(
    lines.map((line) => Number(line.actual ?? 0)),
    currency,
  );
  const committed = sumMoney(
    lines.map((line) => Number(line.committed ?? 0)),
    currency,
  );
  const available = roundMoney(budget - actual - committed, currency);
  return {
    budget,
    actual,
    committed,
    available,
    variance: roundMoney(budget - actual, currency),
    utilisation: roundMoney(safeDivide(actual + committed, budget) * 100, "KES"),
    overBudget: actual + committed > budget,
  };
}

/* -------------------------------------------------------------------------- */
/* Payroll (fully data-driven statutory configuration)                         */
/* -------------------------------------------------------------------------- */

export type TaxBand = {
  /** Lower bound of monthly chargeable income (inclusive). */
  from: number;
  /** Upper bound of monthly chargeable income (exclusive); null = no limit. */
  to?: number | null;
  /** Rate in percent applied to the band. */
  ratePercent: number;
  /** Fixed amount added for the band (graduated scale support). */
  fixedAmount?: number;
};

/**
 * Progressive PAYE-style calculation driven entirely by configured bands.
 * No rate is hard-coded: schools configure bands with effective dates and the
 * engine applies whatever bands are in force for the payroll period.
 */
export function calculateBandedTax(
  chargeableIncome: number,
  bands: TaxBand[],
  currency = DEFAULT_CURRENCY,
): number {
  const income = Math.max(0, Number(chargeableIncome ?? 0));
  if (!bands.length || income <= 0) return 0;

  let tax = 0;
  const ordered = [...bands].sort((a, b) => a.from - b.from);

  for (const band of ordered) {
    const lower = Number(band.from ?? 0);
    if (income <= lower) continue;
    const upper = band.to ?? Number.POSITIVE_INFINITY;
    const taxableInBand = Math.min(income, upper) - lower;
    if (taxableInBand <= 0) continue;
    tax += roundMoney(Number(band.fixedAmount ?? 0), currency);
    tax += roundMoney((taxableInBand * Number(band.ratePercent ?? 0)) / 100, currency);
  }

  return roundMoney(tax, currency);
}

export type PayrollInput = {
  basicPay: number;
  allowances: Array<{ name: string; amount: number; taxable?: boolean }>;
  /** Percentage-based statutory deductions (e.g. an employee pension rate). */
  percentageDeductions: Array<{
    name: string;
    ratePercent: number;
    appliesTo?: "basic" | "gross";
  }>;
  /** Progressive tax bands in force for the payroll period. */
  taxBands?: TaxBand[];
  /** Fixed deductions such as loans, advances or welfare contributions. */
  fixedDeductions: Array<{ name: string; amount: number }>;
};

export type PayrollResult = {
  grossPay: number;
  taxableAllowances: number;
  chargeableIncome: number;
  statutoryDeductions: Array<{ name: string; amount: number }>;
  otherDeductions: Array<{ name: string; amount: number }>;
  totalDeductions: number;
  netPay: number;
};

/**
 * Compute a payslip. Every rate, band and deduction comes from configuration
 * supplied by the caller so a change in statutory rules never requires a code
 * change.
 */
export function calculatePayroll(input: PayrollInput, currency = DEFAULT_CURRENCY): PayrollResult {
  const basicPay = roundMoney(Math.max(0, Number(input.basicPay ?? 0)), currency);
  const allowanceRows = input.allowances.map((allowance) => ({
    name: allowance.name,
    amount: roundMoney(Math.max(0, Number(allowance.amount ?? 0)), currency),
    taxable: allowance.taxable ?? true,
  }));
  const grossPay = roundMoney(
    basicPay +
      sumMoney(
        allowanceRows.map((row) => row.amount),
        currency,
      ),
    currency,
  );
  const taxableAllowances = sumMoney(
    allowanceRows.filter((row) => row.taxable).map((row) => row.amount),
    currency,
  );
  const chargeableIncome = roundMoney(basicPay + taxableAllowances, currency);

  const statutoryDeductions: Array<{ name: string; amount: number }> = [];
  for (const deduction of input.percentageDeductions) {
    const base = deduction.appliesTo === "gross" ? grossPay : basicPay;
    statutoryDeductions.push({
      name: deduction.name,
      amount: roundMoney((base * Number(deduction.ratePercent ?? 0)) / 100, currency),
    });
  }

  const tax = input.taxBands?.length
    ? calculateBandedTax(chargeableIncome, input.taxBands, currency)
    : 0;
  if (tax > 0) statutoryDeductions.push({ name: "Pay as you earn", amount: tax });

  const otherDeductions = input.fixedDeductions.map((deduction) => ({
    name: deduction.name,
    amount: roundMoney(Math.max(0, Number(deduction.amount ?? 0)), currency),
  }));

  const totalDeductions = sumMoney(
    [...statutoryDeductions, ...otherDeductions].map((row) => row.amount),
    currency,
  );

  return {
    grossPay,
    taxableAllowances,
    chargeableIncome,
    statutoryDeductions,
    otherDeductions,
    totalDeductions,
    netPay: roundMoney(Math.max(0, grossPay - totalDeductions), currency),
  };
}

/* -------------------------------------------------------------------------- */
/* Bank / mobile money reconciliation                                          */
/* -------------------------------------------------------------------------- */

export type ReconciliationCandidate = {
  systemId: string;
  reference?: string | null;
  amount: number;
  valueDate: string;
};

export type StatementLine = {
  statementId: string;
  reference?: string | null;
  amount: number;
  valueDate: string;
};

/**
 * Suggest matches between bank statement lines and system transactions.
 * Exact reference match scores highest, then amount plus date proximity.
 * These are suggestions only — the bursar always confirms the match.
 */
export function suggestReconciliationMatches(
  statementLines: StatementLine[],
  systemTransactions: ReconciliationCandidate[],
): Array<{ statementId: string; systemId: string; confidence: number; reason: string }> {
  const suggestions: Array<{
    statementId: string;
    systemId: string;
    confidence: number;
    reason: string;
  }> = [];
  const used = new Set<string>();

  for (const line of statementLines) {
    const reference = normaliseReference(line.reference);
    let best: { systemId: string; confidence: number; reason: string } | null = null;

    for (const candidate of systemTransactions) {
      if (used.has(candidate.systemId)) continue;
      if (Number(candidate.amount ?? 0) !== Number(line.amount ?? 0)) continue;
      const dayGap = Math.abs(
        (new Date(`${normaliseDate(line.valueDate)}T00:00:00Z`).getTime() -
          new Date(`${normaliseDate(candidate.valueDate)}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      const sameReference =
        reference.length > 0 && reference === normaliseReference(candidate.reference);
      let confidence = 0.5;
      let reason = "Amount and date";
      if (sameReference) {
        confidence = 1;
        reason = "Reference and amount match";
      } else if (dayGap === 0) {
        confidence = 0.85;
        reason = "Amount and same value date";
      } else if (dayGap <= 3) {
        confidence = 0.7;
        reason = `Amount match within ${dayGap} day(s)`;
      }
      if (!best || confidence > best.confidence) {
        best = { systemId: candidate.systemId, confidence, reason };
      }
    }

    if (best) {
      used.add(best.systemId);
      suggestions.push({ statementId: line.statementId, ...best });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

function normaliseDate(value: string): string {
  return String(value).slice(0, 10);
}

/**
 * Difference between the bank statement and the school's books. A
 * reconciliation can only be completed when the difference is zero or fully
 * explained by recorded adjustments such as outstanding cheques.
 */
export function reconciliationDifference(params: {
  statementClosingBalance: number;
  bookBalance: number;
  outstandingDeposits?: number;
  outstandingWithdrawals?: number;
  adjustments?: number;
  currency?: string;
}): { difference: number; explained: number; unexplained: number } {
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const adjustments = roundMoney(params.adjustments ?? 0, currency);
  const explained = roundMoney(
    Number(params.outstandingDeposits ?? 0) -
      Number(params.outstandingWithdrawals ?? 0) +
      adjustments,
    currency,
  );
  const difference = roundMoney(
    Number(params.statementClosingBalance ?? 0) - Number(params.bookBalance ?? 0),
    currency,
  );
  return { difference, explained, unexplained: roundMoney(difference - explained, currency) };
}

/* -------------------------------------------------------------------------- */
/* Cash flow forecasting                                                       */
/* -------------------------------------------------------------------------- */

export type ForecastInputs = {
  /** Average collections per period from historical actuals. */
  averageCollections: number;
  /** Outstanding fees expected to be collected in the period. */
  expectedArrearsCollection: number;
  /** Recurring operating expenses per period. */
  recurringExpenses: number;
  /** Payroll obligation for the period. */
  payroll: number;
  openingCash: number;
  currency?: string;
};

/**
 * Project cash for the next `periods` periods. Projections are clearly
 * separated from actual figures by the caller; this function only does maths.
 */
export function forecastCashFlow(
  inputs: ForecastInputs,
  periods = 3,
): Array<{ period: number; inflow: number; outflow: number; net: number; closing: number }> {
  const currency = inputs.currency ?? DEFAULT_CURRENCY;
  const horizon = Math.max(1, Math.floor(periods));
  let closing = roundMoney(inputs.openingCash ?? 0, currency);
  const rows: Array<{ period: number; inflow: number; outflow: number; net: number; closing: number }> = [];

  for (let period = 1; period <= horizon; period += 1) {
    const inflow = roundMoney(
      Number(inputs.averageCollections ?? 0) + Number(inputs.expectedArrearsCollection ?? 0),
      currency,
    );
    const outflow = roundMoney(
      Number(inputs.recurringExpenses ?? 0) + Number(inputs.payroll ?? 0),
      currency,
    );
    const net = roundMoney(inflow - outflow, currency);
    closing = roundMoney(closing + net, currency);
    rows.push({ period, inflow, outflow, net, closing });
  }

  return rows;
}







