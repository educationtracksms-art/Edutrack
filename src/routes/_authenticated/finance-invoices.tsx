// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { allocatePayment, findDuplicatePayments } from "@/lib/finance-calc";
import { issueBursarInvoice } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-invoices")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Invoices & receipts · EduTrack" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({ studentId: "", amount: "", feeType: "Tuition", dueDate: "" });
  const { data, isPending } = useQuery({
    queryKey: ["bursar-invoices", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [invoices, receipts, students, payments] = await Promise.all([
        db.from("student_invoices").select("id, student_id, invoice_number, invoice_date, due_date, status, total_amount, amount_paid, balance_due").eq("school_id", schoolId!).order("invoice_date", { ascending: false }).limit(500),
        db.from("receipts").select("id, receipt_number, status, issued_at, amount").eq("school_id", schoolId!).order("issued_at", { ascending: false }).limit(300),
        db.from("students").select("id, full_name, student_number").eq("school_id", schoolId!).is("deleted_at", null).order("full_name").limit(1000),
        db.from("payments").select("id, payment_number, payment_date, amount, payment_method, reference_number, student_id").eq("school_id", schoolId!).order("payment_date", { ascending: false }).limit(300),
      ]);
      return { invoices: invoices.data ?? [], receipts: receipts.data ?? [], students: students.data ?? [], payments: payments.data ?? [] };
    },
  });
  const issue = useMutation({
    mutationFn: async () => issueBursarInvoice({ data: { studentId: form.studentId, amount: Number(form.amount), feeType: form.feeType, dueDate: form.dueDate || null } }),
    onSuccess: () => {
      toast.success("Invoice issued");
      setForm({ studentId: "", amount: "", feeType: "Tuition", dueDate: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-invoices", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const rows = useMemo(() => ((data?.invoices ?? []) as any[]).filter((row) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || `${row.invoice_number ?? ""} ${row.status ?? ""}`.toLowerCase().includes(query);
    const matchesStatus = status === "all" || row.status === status;
    return matchesQuery && matchesStatus;
  }), [data, search, status]);
  const billed = rows.reduce((sum, row) => sum + asNumber(row.total_amount), 0);
  const collected = rows.reduce((sum, row) => sum + asNumber(row.amount_paid), 0);
  const duplicates = useMemo(() => {
    const payments = ((data?.payments ?? []) as any[]).map((row) => ({
      id: row.id,
      referenceNumber: row.reference_number ?? row.payment_number,
      amount: asNumber(row.amount),
      paymentDate: String(row.payment_date ?? "").slice(0, 10),
    }));
    const flagged = new Set<string>();
    for (const payment of payments) {
      for (const match of findDuplicatePayments(payment, payments.filter((other) => other.id !== payment.id))) {
        flagged.add(match.id);
      }
    }
    return Array.from(flagged);
  }, [data]);
  const allocationPreview = useMemo(() => {
    const open = ((data?.invoices ?? []) as any[])
      .filter((row) => asNumber(row.balance_due) > 0)
      .map((row) => ({ id: row.invoice_number ?? row.id, dueDate: String(row.due_date ?? row.invoice_date ?? ""), balanceDue: asNumber(row.balance_due) }));
    const latest = asNumber((data?.payments ?? [])[0]?.amount ?? 0);
    if (!latest || !open.length) return null;
    return allocatePayment(latest, open);
  }, [data]);
  if (!canView) return <PageHeader title="Invoices" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices & receipts"
        description="Issue fee invoices, preview oldest-first allocation, and catch duplicate collections."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("invoices.csv", toCsv(rows.map((row: any) => ({ invoice: row.invoice_number, date: String(row.invoice_date ?? "").slice(0, 10), total: row.total_amount, paid: row.amount_paid, balance: row.balance_due, status: row.status })), ["invoice", "date", "total", "paid", "balance", "status"]))}>Export invoices</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Billed" value={money(billed, settings)} hint={`${rows.length} invoices`} />
        <Stat label="Collected" value={money(collected, settings)} hint="Against these invoices" />
        <Stat label="Outstanding" value={money(billed - collected, settings)} hint="Live balance" />
      </div>
      {canManage && (
        <Panel title="Issue invoice">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Learner">
              <select className={inputClass} value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
                <option value="">Select learner</option>
                {((data?.students ?? []) as any[]).map((student: any) => (
                  <option key={student.id} value={student.id}>{student.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount (UGX)">
              <input className={inputClass} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" placeholder="1500000" />
            </Field>
            <Field label="Fee type">
              <input className={inputClass} value={form.feeType} onChange={(event) => setForm({ ...form, feeType: event.target.value })} />
            </Field>
            <Field label="Due date">
              <input className={inputClass} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => issue.mutate()} disabled={issue.isPending}>{issue.isPending ? "Issuing…" : "Issue invoice"}</Btn></div>
        </Panel>
      )}
      <Panel title={`Invoices (${rows.length})`}>
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <input className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number or status" />
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option><option value="issued">Issued</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
          </select>
        </div>
        {duplicates.length > 0 && (
          <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
            {duplicates.length} possible duplicate payment{duplicates.length === 1 ? "" : "s"} need review before receipting again.
          </p>
        )}
        {allocationPreview && (
          <p className="mb-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Latest payment of {money(allocationPreview.allocatedTotal, settings)} would clear {allocationPreview.allocations.length} invoice{allocationPreview.allocations.length === 1 ? "" : "s"} oldest-first
            {allocationPreview.unallocated > 0 ? ` with ${money(allocationPreview.unallocated, settings)} left as advance.` : "."}
          </p>
        )}
        {isPending ? <p className="text-sm text-muted-foreground">Loading invoices…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Invoice</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3 text-right">Total</th><th className="py-2 pr-3 text-right">Paid</th><th className="py-2 pr-3 text-right">Balance</th><th className="py-2 pr-3">Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 150).map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{row.invoice_number}</td>
                    <td className="py-2 pr-3">{String(row.invoice_date ?? "").slice(0, 10)}</td>
                    <td className="py-2 pr-3 text-right">{money(row.total_amount, settings)}</td>
                    <td className="py-2 pr-3 text-right">{money(row.amount_paid, settings)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{money(row.balance_due, settings)}</td>
                    <td className="py-2 pr-3 text-xs">{row.status}</td>
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


