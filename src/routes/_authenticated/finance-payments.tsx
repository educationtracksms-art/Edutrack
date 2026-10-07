// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { PAYMENT_METHOD_OPTIONS, asNumber, downloadCsv, money, paymentMethodLabel, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { findDuplicatePayments } from "@/lib/finance-calc";
import { recordBursarPayment } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-payments")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Payments · EduTrack" }] }),
  component: PaymentsPage,
});

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#06b6d4", "#f43f5e", "#64748b"];

function PaymentsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [method, setMethod] = useState("all");
  const [form, setForm] = useState({ studentId: "", amount: "", paymentMethod: "cash", referenceNumber: "" });
  const { data, isPending } = useQuery({
    queryKey: ["bursar-payments", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [payments, students, receipts] = await Promise.all([
        db.from("payments").select("id, student_id, payment_number, payment_date, amount, payment_method, reference_number, status").eq("school_id", schoolId!).order("payment_date", { ascending: false }).limit(500),
        db.from("students").select("id, full_name, student_number").eq("school_id", schoolId!).is("deleted_at", null).order("full_name").limit(1000),
        db.from("receipts").select("id, receipt_number, payment_id, amount, status").eq("school_id", schoolId!).order("issued_at", { ascending: false }).limit(500),
      ]);
      return { payments: payments.data ?? [], students: students.data ?? [], receipts: receipts.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => recordBursarPayment({ data: { studentId: form.studentId, amount: Number(form.amount), paymentMethod: form.paymentMethod, referenceNumber: form.referenceNumber || null } }),
    onSuccess: () => {
      toast.success("Payment recorded and receipt issued");
      setForm({ studentId: "", amount: "", paymentMethod: "cash", referenceNumber: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-payments", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const byMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of (data?.payments ?? []) as any[]) totals[row.payment_method ?? "other"] = (totals[row.payment_method ?? "other"] ?? 0) + asNumber(row.amount);
    return Object.entries(totals).map(([name, value]) => ({ name: paymentMethodLabel(name), value: Math.round(value) }));
  }, [data]);
  const total = byMethod.reduce((sum, row) => sum + row.value, 0);
  const rows = useMemo(() => ((data?.payments ?? []) as any[]).filter((row) => method === "all" || row.payment_method === method), [data, method]);
  const duplicates = useMemo(() => {
    const payments = rows.map((row) => ({
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
  }, [rows]);
  const receiptsByPayment = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of (data?.receipts ?? []) as any[]) if (row.payment_id) map.set(row.payment_id, row);
    return map;
  }, [data]);
  const learners = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of (data?.students ?? []) as any[]) map.set(row.id, row.full_name);
    return map;
  }, [data]);
  if (!canView) return <PageHeader title="Payments" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Cash, bank, cheque, card, Airtel Money and MTN Mobile Money with duplicate protection."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("payments.csv", toCsv(rows.map((row: any) => ({ payment: row.payment_number, date: String(row.payment_date ?? "").slice(0, 10), learner: learners.get(row.student_id) ?? "", method: row.payment_method, amount: row.amount, receipt: receiptsByPayment.get(row.id)?.receipt_number ?? "" })), ["payment", "date", "learner", "method", "amount", "receipt"]))}>Export payments</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Collections in view" value={money(total, settings)} hint={`${(data?.payments ?? []).length} payments`} />
        <Stat label="Methods accepted" value={PAYMENT_METHOD_OPTIONS.length} hint="No M-Pesa or SchoolPay" />
      </div>
      {canManage && (
        <Panel title="Record payment">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Learner">
              <select className={inputClass} value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
                <option value="">Select learner</option>
                {((data?.students ?? []) as any[]).map((student: any) => (<option key={student.id} value={student.id}>{student.full_name}</option>))}
              </select>
            </Field>
            <Field label="Amount (UGX)">
              <input className={inputClass} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" placeholder="500000" />
            </Field>
            <Field label="Method">
              <select className={inputClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                {PAYMENT_METHOD_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
              </select>
            </Field>
            <Field label="Reference">
              <input className={inputClass} value={form.referenceNumber} onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })} placeholder="MM txn / cheque no." />
            </Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Record payment"}</Btn></div>
        </Panel>
      )}
      <Panel title={`Recent payments (${rows.length})`}>
        <div className="mb-3">
          <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="all">All methods</option>
            {PAYMENT_METHOD_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>
        </div>
        {duplicates.length > 0 && (
          <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
            {duplicates.length} possible duplicate{duplicates.length === 1 ? "" : "s"} in this view. Confirm the reference and date before receipting again.
          </p>
        )}
        {isPending ? <p className="text-sm text-muted-foreground">Loading payments…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Payment</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Learner</th><th className="py-2 pr-3">Method</th><th className="py-2 pr-3">Receipt</th><th className="py-2 pr-3 text-right">Amount</th></tr></thead>
              <tbody>
                {rows.slice(0, 200).map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{row.payment_number}</td>
                    <td className="py-2 pr-3">{String(row.payment_date ?? "").slice(0, 10)}</td>
                    <td className="py-2 pr-3">{learners.get(row.student_id) ?? "—"}</td>
                    <td className="py-2 pr-3">{paymentMethodLabel(row.payment_method)}</td>
                    <td className="py-2 pr-3 text-xs">{receiptsByPayment.get(row.id)?.receipt_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{money(row.amount, settings)}</td>
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


