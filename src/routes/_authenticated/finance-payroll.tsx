// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { calculatePayroll } from "@/lib/finance-calc";
import { createBursarPayrollRun, updateBursarPayrollStatus } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-payroll")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Payroll · EduTrack" }] }),
  component: PayrollPage,
});

function PayrollPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [form, setForm] = useState({ periodName: "", grossAmount: "", deductions: "", basicPay: "", allowance: "" });
  const { data, isPending } = useQuery({
    queryKey: ["bursar-payroll", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [runs, lines, taxes] = await Promise.all([
        db.from("payroll_runs").select("id, period_name, pay_date, gross_amount, deductions, net_amount, status").eq("school_id", schoolId!).order("pay_date", { ascending: false }).limit(200),
        db.from("payroll_lines").select("id, payroll_run_id, gross_pay, total_deductions, net_pay").eq("school_id", schoolId!).limit(2000),
        db.from("tax_rates").select("id, name, rate, applies_to, is_active").eq("school_id", schoolId!).order("name"),
      ]);
      return { runs: runs.data ?? [], lines: lines.data ?? [], taxes: taxes.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => createBursarPayrollRun({ data: { periodName: form.periodName, grossAmount: Number(form.grossAmount), deductions: Number(form.deductions || 0) } }),
    onSuccess: () => {
      toast.success("Payroll run created");
      setForm({ periodName: "", grossAmount: "", deductions: "", basicPay: "", allowance: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-payroll", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const setStatus = useMutation({
    mutationFn: async (vars: { payrollRunId: string; status: string }) => updateBursarPayrollStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Payroll updated");
      queryClient.invalidateQueries({ queryKey: ["bursar-payroll", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const preview = useMemo(() => {
    const basic = Number(form.basicPay || 0);
    const allowance = Number(form.allowance || 0);
    if (!basic && !allowance) return null;
    return calculatePayroll({
      basicPay: basic,
      allowances: allowance ? [{ name: "Allowance", amount: allowance }] : [],
      percentageDeductions: [{ name: "NSSF", ratePercent: 5, appliesTo: "basic" }],
      fixedDeductions: Number(form.deductions || 0) ? [{ name: "Other deductions", amount: Number(form.deductions) }] : [],
    });
  }, [form.basicPay, form.allowance, form.deductions]);
  const netTotal = ((data?.runs ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.net_amount), 0);
  if (!canView) return <PageHeader title="Payroll" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll"
        description="Monthly runs with approvals, statutory deductions and net-pay control."
        eyebrow="Bursar"
        actions={
          <Btn
            variant="ghost"
            onClick={() =>
              downloadCsv(
                "payroll.csv",
                toCsv(
                  ((data?.runs ?? []) as any[]).map((row: any) => ({
                    period: row.period_name,
                    payDate: String(row.pay_date ?? "").slice(0, 10),
                    gross: row.gross_amount,
                    deductions: row.deductions,
                    net: row.net_amount,
                    status: row.status,
                  })),
                  ["period", "payDate", "gross", "deductions", "net", "status"],
                ),
              )
            }
          >
            Export CSV
          </Btn>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Payroll runs" value={(data?.runs ?? []).length} hint="This financial year" />
        <Stat label="Net paid" value={money(netTotal, settings)} hint="Across all runs" />
        <Stat label="Tax rules" value={(data?.taxes ?? []).length} hint="PAYE, NSSF, local tax" />
      </div>
      {canManage && (
        <Panel title="New payroll run">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Period"><input className={inputClass} value={form.periodName} onChange={(event) => setForm({ ...form, periodName: event.target.value })} placeholder="September 2026" /></Field>
            <Field label="Gross (UGX)"><input className={inputClass} value={form.grossAmount} onChange={(event) => setForm({ ...form, grossAmount: event.target.value })} inputMode="decimal" /></Field>
            <Field label="Deductions (UGX)"><input className={inputClass} value={form.deductions} onChange={(event) => setForm({ ...form, deductions: event.target.value })} inputMode="decimal" /></Field>
            <Field label="Net pay preview - basic (UGX)"><input className={inputClass} value={form.basicPay} onChange={(event) => setForm({ ...form, basicPay: event.target.value })} inputMode="decimal" /></Field>
            <Field label="Net pay preview - allowance (UGX)"><input className={inputClass} value={form.allowance} onChange={(event) => setForm({ ...form, allowance: event.target.value })} inputMode="decimal" /></Field>
          </div>
          {preview && (
            <p className="mt-3 text-sm text-muted-foreground">
              Preview: gross {money(preview.grossPay, settings)} · deductions {money(preview.totalDeductions, settings)} · net {money(preview.netPay, settings)}
            </p>
          )}
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>Create run</Btn></div>
        </Panel>
      )}
      <Panel title="Payroll runs">
        {isPending ? <p className="text-sm text-muted-foreground">Loading payroll…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Period</th><th className="py-2 pr-3 text-right">Gross</th><th className="py-2 pr-3 text-right">Net</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Actions</th></tr></thead>
              <tbody>
                {((data?.runs ?? []) as any[]).map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{row.period_name}</td>
                    <td className="py-2 pr-3 text-right">{money(row.gross_amount, settings)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{money(row.net_amount, settings)}</td>
                    <td className="py-2 pr-3 text-xs">{row.status}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <Btn variant="ghost" onClick={() => setStatus.mutate({ payrollRunId: row.id, status: "approved" })}>Approve</Btn>
                        <Btn variant="ghost" onClick={() => setStatus.mutate({ payrollRunId: row.id, status: "paid" })}>Pay</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
