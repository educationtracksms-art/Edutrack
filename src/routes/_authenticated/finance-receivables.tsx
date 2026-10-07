// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, downloadCsv, financeCurrency, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { AGING_BUCKET_LABELS, buildAgingSummary, collectionRate } from "@/lib/finance-calc";
import { recordBursarCollectionFollowUp } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-receivables")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Receivables & arrears · EduTrack" }] }),
  component: ReceivablesPage,
});

function ReceivablesPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const [search, setSearch] = useState("");
  const [followUp, setFollowUp] = useState({ studentId: "", actionType: "Reminder sent", note: "" });
  const { data: settings } = useFinanceSettings(schoolId);
  const currency = financeCurrency(settings);
  const { data, isPending } = useQuery({
    queryKey: ["bursar-receivables", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [students, invoices, cases, payments] = await Promise.all([
        db.from("students").select("id, full_name, student_number, fees_balance").eq("school_id", schoolId!).is("deleted_at", null).order("full_name").limit(1000),
        db.from("student_invoices").select("id, student_id, due_date, invoice_date, total_amount, amount_paid, balance_due, status").eq("school_id", schoolId!).order("due_date", { ascending: true }).limit(2000),
        db.from("collection_cases").select("id, student_id, status, priority, next_action_date").eq("school_id", schoolId!).order("next_action_date", { ascending: true }).limit(500),
        db.from("payments").select("id, amount, payment_date").eq("school_id", schoolId!).order("payment_date", { ascending: false }).limit(500),
      ]);
      return { students: students.data ?? [], invoices: invoices.data ?? [], cases: cases.data ?? [], payments: payments.data ?? [] };
    },
  });
  const debtors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ((data?.students ?? []) as any[])
      .filter((row) => asNumber(row.fees_balance) > 0)
      .filter((row) => !query || `${row.full_name ?? ""} ${row.student_number ?? ""}`.toLowerCase().includes(query))
      .sort((a, b) => asNumber(b.fees_balance) - asNumber(a.fees_balance));
  }, [data, search]);
  const totalArrears = debtors.reduce((sum, row) => sum + asNumber(row.fees_balance), 0);
  const aging = useMemo(
    () =>
      buildAgingSummary(
        ((data?.invoices ?? []) as any[]).map((row) => ({ dueDate: row.due_date ?? row.invoice_date, balance: asNumber(row.balance_due) })),
        new Date(),
        currency,
      ),
    [data, currency],
  );
  const billed = ((data?.invoices ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.total_amount), 0);
  const collected = ((data?.invoices ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.amount_paid), 0);
  const rate = collectionRate(billed, collected);
  const saveFollowUp = useMutation({
    mutationFn: async () => recordBursarCollectionFollowUp({ data: { studentId: followUp.studentId, actionType: followUp.actionType, note: followUp.note || null } }),
    onSuccess: () => {
      toast.success("Follow-up recorded");
      setFollowUp({ studentId: "", actionType: "Reminder sent", note: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-receivables", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const openCases = ((data?.cases ?? []) as any[]).filter((row) => row.status === "open");
  if (!canView) return <PageHeader title="Receivables" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Receivables & arrears"
        description="Live arrears aged from invoice due dates with a guarded collection queue."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("receivables.csv", toCsv(debtors.map((row: any) => ({ learner: row.full_name, admission: row.student_number ?? "", balance: row.fees_balance })), ["learner", "admission", "balance"]))}>Export debtors</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Outstanding arrears" value={money(totalArrears, settings)} hint={`${debtors.length} debtors`} />
        <Stat label="Collection rate" value={`${rate}%`} hint={`${money(collected, settings)} of ${money(billed, settings)}`} />
        <Stat label="90+ days overdue" value={money(aging.find((row) => row.bucket === "90+")?.amount ?? 0, settings)} hint="Priority collection" />
        <Stat label="Open cases" value={openCases.length} hint="Follow-up queue" />
      </div>
      <Panel title="Aging analysis">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aging.map((row) => ({ name: AGING_BUCKET_LABELS[row.bucket], amount: Math.round(row.amount), debtors: row.count }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#2563eb" name="Outstanding" />
              <Bar dataKey="debtors" fill="#f59e0b" name="Invoices" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      {canManage && (
        <Panel title="Record collection follow-up">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Learner">
              <select className={inputClass} value={followUp.studentId} onChange={(event) => setFollowUp({ ...followUp, studentId: event.target.value })}>
                <option value="">Select debtor</option>
                {debtors.slice(0, 200).map((row: any) => (<option key={row.id} value={row.id}>{row.full_name} · {money(row.fees_balance, settings)}</option>))}
              </select>
            </Field>
            <Field label="Action">
              <select className={inputClass} value={followUp.actionType} onChange={(event) => setFollowUp({ ...followUp, actionType: event.target.value })}>
                <option>Reminder sent</option><option>Parent called</option><option>Payment plan agreed</option><option>Final notice</option><option>Escalated</option>
              </select>
            </Field>
            <Field label="Note"><input className={inputClass} value={followUp.note} onChange={(event) => setFollowUp({ ...followUp, note: event.target.value })} placeholder="Outcome and next step" /></Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => saveFollowUp.mutate()} disabled={saveFollowUp.isPending || !followUp.studentId}>Save follow-up</Btn></div>
        </Panel>
      )}
      <Panel title={`Debtors (${debtors.length})`}>
        <input className="mb-3 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learner or admission number" />
        {isPending ? <p className="text-sm text-muted-foreground">Loading debtors…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Learner</th><th className="py-2 pr-3">Admission</th><th className="py-2 pr-3 text-right">Balance</th><th className="py-2 pr-3">Open invoices</th><th className="py-2 pr-3">Case</th></tr></thead>
              <tbody>
                {debtors.slice(0, 150).map((row: any) => {
                  const openInvoices = ((data?.invoices ?? []) as any[]).filter((item) => item.student_id === row.id && asNumber(item.balance_due) > 0);
                  const openCase = ((data?.cases ?? []) as any[]).find((item) => item.student_id === row.id && item.status === "open");
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="py-2 pr-3 font-medium">{row.full_name}</td>
                      <td className="py-2 pr-3">{row.student_number ?? "—"}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{money(row.fees_balance, settings)}</td>
                      <td className="py-2 pr-3 text-xs">{openInvoices.length ? `${openInvoices.length} open · ${money(openInvoices.reduce((sum, item) => sum + asNumber(item.balance_due), 0), settings)}` : "No open invoice"}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{openCase ? `${openCase.priority ?? "normal"} · ${String(openCase.next_action_date ?? "").slice(0, 10) || "no date"}` : "No case"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}


