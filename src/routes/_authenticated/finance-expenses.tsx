// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { PAYMENT_METHOD_OPTIONS, asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { recordBursarExpense } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-expenses")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Expenses & payables · EduTrack" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [form, setForm] = useState({ payeeName: "", amount: "", paymentMethod: "bank_transfer", narration: "", accountCode: "5000" });
  const { data, isPending } = useQuery({
    queryKey: ["bursar-expenses", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [transactions, suppliers, invoices, vouchers, accounts] = await Promise.all([
        db.from("transactions").select("id, transaction_number, transaction_date, narration, total_amount").eq("school_id", schoolId!).eq("transaction_type", "expense").order("transaction_date", { ascending: false }).limit(300),
        db.from("suppliers").select("id, supplier_name, status").eq("school_id", schoolId!).order("supplier_name").limit(300),
        db.from("approved_invoices").select("id, invoice_number, supplier_id, amount, approval_status, due_date").eq("school_id", schoolId!).order("due_date", { ascending: true }).limit(300),
        db.from("payment_vouchers").select("id, voucher_number, payee_name, amount, status, created_at").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(300),
        db.from("chart_of_accounts").select("id, code, name, account_type").eq("school_id", schoolId!).order("code").limit(300),
      ]);
      return { transactions: transactions.data ?? [], suppliers: suppliers.data ?? [], invoices: invoices.data ?? [], vouchers: vouchers.data ?? [], accounts: accounts.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => recordBursarExpense({ data: { payeeName: form.payeeName, amount: Number(form.amount), paymentMethod: form.paymentMethod, narration: form.narration || null } }),
    onSuccess: () => {
      toast.success("Expense recorded");
      setForm({ payeeName: "", amount: "", paymentMethod: "bank_transfer", narration: "", accountCode: "5000" });
      queryClient.invalidateQueries({ queryKey: ["bursar-expenses", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const totalExpenses = ((data?.transactions ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.total_amount), 0);
  const pendingBills = useMemo(() => ((data?.invoices ?? []) as any[]).filter((row) => row.approval_status === "pending"), [data]);
  const pendingValue = pendingBills.reduce((sum, row) => sum + asNumber(row.amount), 0);
  if (!canView) return <PageHeader title="Expenses" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses & payables"
        description="Supplier bills, payment vouchers and posted expenses with approval guardrails."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("expenses.csv", toCsv(((data?.transactions ?? []) as any[]).map((row: any) => ({ date: String(row.transaction_date ?? "").slice(0, 10), reference: row.transaction_number, narration: row.narration ?? "", amount: row.total_amount })), ["date", "reference", "narration", "amount"]))}>Export expenses</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Posted expenses" value={money(totalExpenses, settings)} hint={`${(data?.transactions ?? []).length} transactions`} />
        <Stat label="Pending supplier bills" value={pendingBills.length} hint={money(pendingValue, settings)} />
        <Stat label="Open vouchers" value={(data?.vouchers ?? []).filter((row: any) => row.status !== "paid").length} hint="Draft and approved" />
      </div>
      {canManage && (
        <Panel title="Record expense">
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Payee"><input className={inputClass} value={form.payeeName} onChange={(event) => setForm({ ...form, payeeName: event.target.value })} placeholder="Supplier or payee" /></Field>
            <Field label="Amount (UGX)"><input className={inputClass} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" /></Field>
            <Field label="Expense account">
              <select className={inputClass} value={form.accountCode} onChange={(event) => setForm({ ...form, accountCode: event.target.value })}>
                {((data?.accounts ?? []) as any[]).filter((row) => row.account_type === "expense").map((row: any) => (<option key={row.id} value={row.code}>{row.code} · {row.name}</option>))}
              </select>
            </Field>
            <Field label="Method">
              <select className={inputClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                {PAYMENT_METHOD_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
              </select>
            </Field>
            <Field label="Narration"><input className={inputClass} value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} placeholder="What was paid for" /></Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>Record expense</Btn></div>
        </Panel>
      )}
      <Panel title="Supplier bills awaiting approval">
        {isPending ? <p className="text-sm text-muted-foreground">Loading bills…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Bill</th><th className="py-2 pr-3">Supplier</th><th className="py-2 pr-3">Due</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Status</th></tr></thead>
              <tbody>
                {((data?.invoices ?? []) as any[]).slice(0, 150).map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{row.invoice_number}</td>
                    <td className="py-2 pr-3">{((data?.suppliers ?? []) as any[]).find((item) => item.id === row.supplier_id)?.supplier_name ?? "—"}</td>
                    <td className="py-2 pr-3">{String(row.due_date ?? "—").slice(0, 10)}</td>
                    <td className="py-2 pr-3 text-right">{money(row.amount, settings)}</td>
                    <td className="py-2 pr-3 text-xs">{row.approval_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Payment vouchers">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Voucher</th><th className="py-2 pr-3">Payee</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>
              {((data?.vouchers ?? []) as any[]).slice(0, 100).map((row: any) => (
                <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.voucher_number}</td><td className="py-2 pr-3">{row.payee_name}</td><td className="py-2 pr-3 text-right">{money(row.amount, settings)}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}


