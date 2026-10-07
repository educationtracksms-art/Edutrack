/**
 * Automated tests for the pure finance engine.
 *
 * These run with Node's built-in test runner so no extra dependency is needed:
 *   node --test src/lib/__tests__/finance-calc.test.ts
 *
 * They cover the fee engine, payment allocation, refunds, journal integrity,
 * payroll, assets and reconciliation because those calculations must be
 * provably correct before they are allowed to touch the ledger.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  agingBucket,
  allocatePayment,
  applyAdjustments,
  buildAgingSummary,
  buildInstallmentSchedule,
  buildReversalLines,
  calculateBandedTax,
  calculatePayroll,
  canEditJournal,
  collectionRate,
  computeDepreciation,
  daysBetween,
  findDuplicatePayments,
  forecastCashFlow,
  formatMoney,
  parseMoneyInput,
  proRateAmount,
  reconciliationDifference,
  refundableAmount,
  roundMoney,
  suggestReconciliationMatches,
  summariseBudget,
  summarisePaymentPlan,
  trialBalanceDifference,
  validateJournalLines,
  validateRefundRequest,
} from "../finance-calc.ts";

/* ----------------------------- money handling ----------------------------- */

test("money is rounded to the currency precision", () => {
  assert.equal(roundMoney(1500000.4, "UGX"), 1500000);
  assert.equal(roundMoney(10.345, "USD"), 10.35);
});

test("UGX amounts are formatted with thousands separators and code", () => {
  assert.equal(formatMoney(1500000, "UGX"), "UGX 1,500,000");
  assert.equal(formatMoney(0, "UGX"), "UGX 0");
});

test("bursar input formats are parsed", () => {
  assert.equal(parseMoneyInput("UGX 1,500,000"), 1500000);
  assert.equal(parseMoneyInput("1,250,000"), 1250000);
  assert.equal(parseMoneyInput(""), 0);
});

test("collection rate is a percentage of billed fees", () => {
  assert.equal(collectionRate(4000000, 3000000), 75);
  assert.equal(collectionRate(0, 500000), 0);
});

/* --------------------------------- aging --------------------------------- */

test("aging buckets follow school receivables policy", () => {
  assert.equal(agingBucket("2026-03-31", "2026-03-01"), "current");
  assert.equal(agingBucket("2026-02-25", "2026-03-01"), "1-30");
  assert.equal(agingBucket("2026-01-20", "2026-03-01"), "31-60");
  assert.equal(agingBucket("2025-12-25", "2026-03-01"), "61-90");
  assert.equal(agingBucket("2025-09-01", "2026-03-01"), "90+");
});

test("aging summary totals every outstanding balance exactly once", () => {
  const summary = buildAgingSummary(
    [
      { dueDate: "2026-03-15", balance: 500000 },
      { dueDate: "2026-02-20", balance: 250000 },
      { dueDate: "2025-10-01", balance: 100000 },
    ],
    "2026-03-01",
  );
  const total = summary.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(total, 850000);
  assert.equal(summary.find((row) => row.bucket === "current")?.amount, 500000);
});

/* --------------------------- payment allocation --------------------------- */

test("payments are allocated to the oldest invoices first", () => {
  const result = allocatePayment(700000, [
    { id: "b", dueDate: "2026-03-31", balanceDue: 400000 },
    { id: "a", dueDate: "2026-02-28", balanceDue: 500000 },
  ]);
  assert.equal(result.allocatedTotal, 700000);
  assert.equal(result.unallocated, 0);
  assert.equal(result.allocations[0].invoiceId, "a");
  assert.equal(result.allocations[0].amount, 500000);
  assert.equal(result.allocations[1].invoiceId, "b");
  assert.equal(result.allocations[1].amount, 200000);
  assert.equal(result.allocations[1].balanceAfter, 200000);
});

test("an overpayment is held as an unallocated advance", () => {
  const result = allocatePayment(1200000, [
    { id: "a", dueDate: "2026-02-28", balanceDue: 500000 },
  ]);
  assert.equal(result.allocatedTotal, 500000);
  assert.equal(result.unallocated, 700000);
});

test("zero or negative payments allocate nothing", () => {
  const result = allocatePayment(0, [{ id: "a", balanceDue: 500000 }]);
  assert.equal(result.allocations.length, 0);
  assert.equal(result.unallocated, 0);
});

/* -------------------------- fees and adjustments -------------------------- */

test("percentage adjustments reduce the charge but never below zero", () => {
  const charge = applyAdjustments(
    [
      { description: "Tuition", amount: 1000000, feeCategoryId: "tuition" },
      { description: "Boarding", amount: 800000, feeCategoryId: "boarding" },
    ],
    [{ type: "percentage", value: 50, feeCategoryId: "tuition" }],
  );
  assert.equal(charge.grossTotal, 1800000);
  assert.equal(charge.adjustmentTotal, 500000);
  assert.equal(charge.netTotal, 1300000);
});

test("a full waiver zeroes the fee", () => {
  const waived = applyAdjustments([{ description: "Tuition", amount: 1000000 }], [
    { type: "waiver", value: 0 },
  ]);
  assert.equal(waived.netTotal, 0);
  assert.equal(waived.lines[0].net, 0);
});

test("a discount larger than the fee is capped at the fee amount", () => {
  const charge = applyAdjustments([{ description: "Transport", amount: 100000 }], [
    { type: "fixed", value: 250000 },
  ]);
  assert.equal(charge.adjustmentTotal, 100000);
  assert.equal(charge.netTotal, 0);
});

test("pro-rated fees use the attendance ratio", () => {
  assert.equal(proRateAmount(900000, 30, 90), 300000);
  assert.equal(proRateAmount(900000, 30, 0), 900000);
});

/* ------------------------------- payment plans ---------------------------- */

test("installment schedules sum exactly to the plan total", () => {
  const schedule = buildInstallmentSchedule(1000000, 3, "2026-02-01");
  assert.equal(schedule.length, 3);
  const total = schedule.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(total, 1000000);
  assert.deepEqual(
    schedule.map((row) => row.dueDate),
    ["2026-02-01", "2026-03-01", "2026-04-01"],
  );
});

test("payment plan summary reports missed installments", () => {
  const summary = summarisePaymentPlan(
    [
      { amount: 300000, amountPaid: 300000, dueDate: "2026-01-15" },
      { amount: 300000, amountPaid: 0, dueDate: "2026-02-15" },
      { amount: 400000, amountPaid: 0, dueDate: "2026-04-15" },
    ],
    "2026-03-01",
  );
  assert.equal(summary.scheduled, 1000000);
  assert.equal(summary.paid, 300000);
  assert.equal(summary.outstanding, 700000);
  assert.equal(summary.missed, 1);
  assert.equal(summary.nextDueDate, "2026-02-15");
});

/* ------------------- duplicate payment and refund guards ------------------ */

test("duplicate bank and mobile money references are detected", () => {
  const duplicates = findDuplicatePayments({ referenceNumber: "MM2401-9981", amount: 150000 }, [
    {
      id: "p1",
      referenceNumber: "MM 2401 9981",
      amount: 150000,
      paymentDate: "2026-02-01",
      status: "posted",
    },
    { id: "p2", referenceNumber: "MM2401-9981", amount: 120000, paymentDate: "2026-02-02" },
  ]);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].id, "p1");
});

test("refunds cannot exceed the refundable balance", () => {
  assert.equal(refundableAmount(500000, 200000), 300000);
  assert.equal(validateRefundRequest(400000, 500000, 200000).ok, false);
  assert.equal(validateRefundRequest(300000, 500000, 200000).ok, true);
  assert.equal(validateRefundRequest(0, 500000, 0).ok, false);
});

/* -------------------------------- journals -------------------------------- */

test("journal entries must balance before posting", () => {
  const unbalanced = validateJournalLines([
    { accountId: "cash", debit: 100000, credit: 0 },
    { accountId: "income", debit: 0, credit: 90000 },
  ]);
  assert.equal(unbalanced.ok, false);
  assert.equal(unbalanced.difference, 10000);

  const balanced = validateJournalLines([
    { accountId: "ar", debit: 100000, credit: 0 },
    { accountId: "income", debit: 0, credit: 100000 },
  ]);
  assert.equal(balanced.ok, true);
  assert.equal(balanced.totalDebit, balanced.totalCredit);
});

test("a single journal line cannot mix debit and credit", () => {
  const invalid = validateJournalLines([
    { accountId: "cash", debit: 1000, credit: 1000 },
    { accountId: "income", debit: 0, credit: 1000 },
  ]);
  assert.equal(invalid.ok, false);
});

test("reversal entries mirror the original lines", () => {
  const reversal = buildReversalLines([
    { accountId: "ar", debit: 50000, credit: 0 },
    { accountId: "income", debit: 0, credit: 50000 },
  ]);
  assert.equal(reversal[0].credit, 50000);
  assert.equal(reversal[0].debit, 0);
  assert.equal(reversal[1].debit, 50000);
});

test("posted journals are immutable and trial balances must balance", () => {
  assert.equal(canEditJournal("draft"), true);
  assert.equal(canEditJournal("posted"), false);
  assert.equal(
    trialBalanceDifference([
      { debit: 500, credit: 0 },
      { debit: 0, credit: 500 },
    ]),
    0,
  );
  assert.equal(trialBalanceDifference([{ debit: 500, credit: 0 }]), 500);
});

test("daysBetween never returns negative values", () => {
  assert.equal(daysBetween("2026-03-05", "2026-03-01"), 0);
  assert.equal(daysBetween("2026-03-01", "2026-03-05"), 4);
});

/* --------------------------------- budget --------------------------------- */

test("budget summary reports utilisation and over-spending", () => {
  const summary = summariseBudget([
    { budget: 1000000, actual: 900000, committed: 200000 },
    { budget: 500000, actual: 100000 },
  ]);
  assert.equal(summary.budget, 1500000);
  assert.equal(summary.actual, 1000000);
  assert.equal(summary.available, 300000);
  assert.equal(summary.overBudget, false);

  const overspent = summariseBudget([{ budget: 1000000, actual: 1100000, committed: 0 }]);
  assert.equal(overspent.overBudget, true);
  assert.equal(overspent.variance, -100000);
});

/* --------------------------------- payroll -------------------------------- */

test("banded tax is computed from configured bands only", () => {
  const bands = [
    { from: 0, to: 235000, ratePercent: 0 },
    { from: 235000, to: 335000, ratePercent: 10 },
    { from: 335000, to: null, ratePercent: 30 },
  ];
  assert.equal(calculateBandedTax(200000, bands), 0);
  assert.equal(calculateBandedTax(335000, bands), 10000);
  assert.equal(calculateBandedTax(435000, bands), 40000);
});

test("payslip totals follow configured allowances and deductions", () => {
  const payslip = calculatePayroll({
    basicPay: 800000,
    allowances: [
      { name: "Housing", amount: 200000 },
      { name: "Transport", amount: 100000, taxable: false },
    ],
    percentageDeductions: [
      { name: "Employee contribution", ratePercent: 5, appliesTo: "basic" },
    ],
    taxBands: [
      { from: 0, to: 235000, ratePercent: 0 },
      { from: 235000, to: null, ratePercent: 30 },
    ],
    fixedDeductions: [{ name: "Salary advance", amount: 50000 }],
  });
  assert.equal(payslip.grossPay, 1100000);
  assert.equal(payslip.chargeableIncome, 1000000);
  assert.equal(payslip.statutoryDeductions[0].amount, 40000);
  assert.equal(payslip.netPay, 1100000 - payslip.totalDeductions);
});

/* --------------------------------- assets --------------------------------- */

test("straight line depreciation respects useful life and residual value", () => {
  const result = computeDepreciation({
    cost: 12000000,
    residualValue: 0,
    usefulLifeYears: 4,
    method: "straight_line",
    monthsElapsed: 12,
  });
  assert.equal(result.annualAmount, 3000000);
  assert.equal(result.accumulated, 3000000);
  assert.equal(result.netBookValue, 9000000);
  assert.equal(result.fullyDepreciated, false);
});

test("reducing balance depreciation never depreciates below the residual", () => {
  const result = computeDepreciation({
    cost: 1000000,
    residualValue: 0,
    usefulLifeYears: 3,
    method: "reducing_balance",
    ratePercent: 40,
    monthsElapsed: 36,
  });
  // Reducing balance spreads the charge over the whole life without reaching
  // zero, so the book value must stay at or above the residual value.
  assert.ok(result.netBookValue > 0);
  assert.equal(result.accumulated, 1000000 - result.netBookValue);
  assert.equal(result.fullyDepreciated, false);

  const withResidual = computeDepreciation({
    cost: 1000000,
    residualValue: 200000,
    usefulLifeYears: 3,
    method: "reducing_balance",
    ratePercent: 60,
    monthsElapsed: 120,
  });
  assert.ok(withResidual.accumulated <= 800000);
  assert.ok(withResidual.netBookValue >= 200000);
});

/* ----------------------------- reconciliation ----------------------------- */

test("statement lines are matched to system transactions with confidence", () => {
  const matches = suggestReconciliationMatches(
    [{ statementId: "s1", reference: "FT2501", amount: 500000, valueDate: "2026-02-10" }],
    [
      { systemId: "t1", reference: "FT-2501", amount: 500000, valueDate: "2026-02-10" },
      { systemId: "t2", reference: "OTHER", amount: 500000, valueDate: "2026-02-11" },
    ],
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].systemId, "t1");
  assert.equal(matches[0].confidence, 1);
});

test("reconciliation difference separates explained and unexplained amounts", () => {
  const diff = reconciliationDifference({
    statementClosingBalance: 1000000,
    bookBalance: 900000,
    outstandingDeposits: 100000,
  });
  assert.equal(diff.difference, 100000);
  assert.equal(diff.unexplained, 0);
});

test("cash flow forecast chains closing balances", () => {
  const forecast = forecastCashFlow(
    {
      averageCollections: 2000000,
      expectedArrearsCollection: 300000,
      recurringExpenses: 800000,
      payroll: 900000,
      openingCash: 1000000,
    },
    2,
  );
  assert.equal(forecast[0].closing, 1600000);
  assert.equal(forecast[1].closing, 2200000);
});



