// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { trialBalanceDifference, validateJournalLines } from "@/lib/finance-calc";
import { createBursarJournal } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-accounting")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Accounting & journals · EduTrack" }] }),
  component: AccountingPage,
});

function AccountingPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [form, setForm] = useState({ description: "", debitAccount: "", creditAccount: "", amount: "" });
  const { data, isPending } = useQuery({
    queryKey: ["bursar-accounting", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [accounts, journals, lines] = await Promise.all([
        db.from("chart_of_accounts").select("id, code, name, account_type, is_active").eq("school_id", schoolId!).order("code").limit(500),
        db.from("journal_entries").select("id, entry_number, entry_date, description, status, total_debit, total_credit").eq("school_id", schoolId!).order("entry_date", { ascending: false }).limit(300),
        db.from("journal_entry_lines").select("id, journal_entry_id, account_id, debit, credit").eq("school_id", schoolId!).limit(2000),
      ]);
      return { accounts: accounts.data ?? [], journals: journals.data ?? [], lines: lines.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => createBursarJournal({
      data: {
        description: form.description,
        lines: [
          { accountId: form.debitAccount, debit: Number(form.amount), credit: 0 },
          { accountId: form.creditAccount, debit: 0, credit: Number(form.amount) },
        ],
      },
    }),
    onSuccess: () => {
      toast.success("Balanced journal posted");
      setForm({ description: "", debitAccount: "", creditAccount: "", amount: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-accounting", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const debitTotal = ((data?.lines ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.debit), 0);
  const creditTotal = ((data?.lines ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.credit), 0);
  const difference = trialBalanceDifference(((data?.lines ?? []) as any[]).map((row) => ({ debit: asNumber(row.debit), credit: asNumber(row.credit) })));
  const draftCheck = useMemo(() => validateJournalLines([
    { accountId: form.debitAccount || "debit", debit: Number(form.amount || 0), credit: 0 },
    { accountId: form.creditAccount || "credit", debit: 0, credit: Number(form.amount || 0) },
  ]), [form.debitAccount, form.creditAccount, form.amount]);
  if (!canView) return <PageHeader title="Accounting" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounting & journals"
        description="Balanced double-entry journals with trial-balance control. Posted entries are immutable."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("journals.csv", toCsv(((data?.journals ?? []) as any[]).map((row: any) => ({ entry: row.entry_number, date: String(row.entry_date ?? "").slice(0, 10), description: row.description ?? "", debit: row.total_debit ?? "", credit: row.total_credit ?? "", status: row.status })), ["entry", "date", "description", "debit", "credit", "status"]))}>Export journals</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="GL accounts" value={(data?.accounts ?? []).length} hint="School chart" />
        <Stat label="Journal entries" value={(data?.journals ?? []).length} hint="Posted and draft" />
        <Stat label="Debits in view" value={money(debitTotal, settings)} hint={money(creditTotal, settings)} />
        <Stat label="Trial difference" value={money(difference, settings)} hint={difference === 0 ? "Balanced" : "Investigate now"} />
      </div>
      {canManage && (
        <Panel title="Post balanced journal">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Description"><input className={inputClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Accrual, correction, transfer" /></Field>
            <Field label="Amount (UGX)"><input className={inputClass} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" /></Field>
            <Field label="Debit account">
              <select className={inputClass} value={form.debitAccount} onChange={(event) => setForm({ ...form, debitAccount: event.target.value })}>
                <option value="">Select account</option>
                {((data?.accounts ?? []) as any[]).map((row: any) => (<option key={row.id} value={row.id}>{row.code} · {row.name}</option>))}
              </select>
            </Field>
            <Field label="Credit account">
              <select className={inputClass} value={form.creditAccount} onChange={(event) => setForm({ ...form, creditAccount: event.target.value })}>
                <option value="">Select account</option>
                {((data?.accounts ?? []) as any[]).map((row: any) => (<option key={row.id} value={row.id}>{row.code} · {row.name}</option>))}
              </select>
            </Field>
          </div>
          {!draftCheck.ok && draftCheck.message && (
            <p className="mt-2 text-xs font-semibold text-destructive">{draftCheck.message}</p>
          )}
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending || !draftCheck.ok}>Post journal</Btn></div>
        </Panel>
      )}
      <Panel title="Recent journals">
        {isPending ? <p className="text-sm text-muted-foreground">Loading journals…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Entry</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3 text-right">Debit</th><th className="py-2 pr-3 text-right">Credit</th><th className="py-2 pr-3">Status</th></tr></thead>
              <tbody>
                {((data?.journals ?? []) as any[]).map((row: any) => (
                  <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.entry_number}</td><td className="py-2 pr-3">{String(row.entry_date ?? "").slice(0, 10)}</td><td className="py-2 pr-3">{row.description}</td><td className="py-2 pr-3 text-right">{money(row.total_debit, settings)}</td><td className="py-2 pr-3 text-right">{money(row.total_credit, settings)}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}


