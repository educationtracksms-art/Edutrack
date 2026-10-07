// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { reconciliationDifference, suggestReconciliationMatches } from "@/lib/finance-calc";
import { recordBankingMovement } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-banking")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Banking & cash · EduTrack" }] }),
  component: BankingPage,
});

function BankingPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [form, setForm] = useState({ accountKind: "bank", accountId: "", direction: "in", amount: "", reference: "" });
  const { data, isPending } = useQuery({
    queryKey: ["bursar-banking", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [banks, cash, mobile, reconciliations, movements, statements] = await Promise.all([
        db.from("finance_bank_accounts").select("id, account_name, bank_name, current_balance").eq("school_id", schoolId!),
        db.from("finance_cash_accounts").select("id, name, current_balance").eq("school_id", schoolId!),
        db.from("finance_mobile_money_accounts").select("id, provider_name, account_name, current_balance").eq("school_id", schoolId!),
        db.from("finance_bank_reconciliations").select("id, reconciliation_number, bank_account_id, statement_date, statement_balance, book_balance, difference, status").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(100),
        db.from("bank_transactions").select("id, bank_account_id, reference, amount, value_date, status").eq("school_id", schoolId!).order("value_date", { ascending: false }).limit(300),
        db.from("finance_bank_statement_lines").select("id, bank_account_id, reference, amount, value_date, matched").eq("school_id", schoolId!).order("value_date", { ascending: false }).limit(300),
      ]);
      return { banks: banks.data ?? [], cash: cash.data ?? [], mobile: mobile.data ?? [], reconciliations: reconciliations.data ?? [], movements: movements.data ?? [], statements: statements.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => recordBankingMovement({ data: { accountKind: form.accountKind as any, accountId: form.accountId, direction: form.direction as any, amount: Number(form.amount), reference: form.reference || null } }),
    onSuccess: () => {
      toast.success("Banking movement recorded");
      setForm({ accountKind: "bank", accountId: "", direction: "in", amount: "", reference: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-banking", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  if (!canView) return <PageHeader title="Banking" description="You do not have permission to view this area." />;
  const liquidTotal = ((data?.banks ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.current_balance), 0)
    + ((data?.cash ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.current_balance), 0)
    + ((data?.mobile ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.current_balance), 0);
  const matches = useMemo(
    () =>
      suggestReconciliationMatches(
        ((data?.statements ?? []) as any[]).filter((row) => !row.matched).map((row) => ({ statementId: row.id, reference: row.reference ?? "", amount: asNumber(row.amount), valueDate: String(row.value_date ?? "") })),
        ((data?.movements ?? []) as any[]).map((row) => ({ systemId: row.id, reference: row.reference ?? "", amount: asNumber(row.amount), valueDate: String(row.value_date ?? "") })),
      ),
    [data],
  );
  const latest = (data?.reconciliations ?? [])[0] as any | undefined;
  const latestDiff = latest ? reconciliationDifference({ statementClosingBalance: asNumber(latest.statement_balance), bookBalance: asNumber(latest.book_balance) }) : null;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Banking & cash"
        description="Banks, cash points and mobile money with statement matching and difference control."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("bank-accounts.csv", toCsv(((data?.banks ?? []) as any[]).map((row: any) => ({ account: row.account_name, bank: row.bank_name ?? "", balance: row.current_balance ?? 0 })), ["account", "bank", "balance"]))}>Export balances</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Liquid total" value={money(liquidTotal, settings)} hint="Banks + cash + mobile" />
        <Stat label="Bank accounts" value={(data?.banks ?? []).length} hint="Reconciled monthly" />
        <Stat label="Suggested matches" value={matches.length} hint="Statement to ledger" />
        <Stat label="Latest difference" value={latestDiff ? money(latestDiff.unexplained, settings) : money(0, settings)} hint={latest ? String(latest.reconciliation_number ?? "reconciliation") : "No reconciliation"} />
      </div>
      {canManage && (
        <Panel title="Record movement">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Account type">
              <select className={inputClass} value={form.accountKind} onChange={(event) => setForm({ ...form, accountKind: event.target.value, accountId: "" })}>
                <option value="bank">Bank</option><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="petty_cash">Petty cash</option>
              </select>
            </Field>
            <Field label="Direction">
              <select className={inputClass} value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}>
                <option value="in">Money in</option><option value="out">Money out</option>
              </select>
            </Field>
            <Field label="Amount (UGX)"><input className={inputClass} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" /></Field>
            <Field label="Reference"><input className={inputClass} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>Record movement</Btn></div>
        </Panel>
      )}
      <Panel title="Reconciliations">
        {matches.length > 0 && (
          <p className="mb-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {matches.length} unmatched statement line{matches.length === 1 ? "" : "s"} have a high-confidence ledger match. Confirm them before closing the month.
          </p>
        )}
        {isPending ? <p className="text-sm text-muted-foreground">Loading reconciliations…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Reference</th><th className="py-2 pr-3">Statement date</th><th className="py-2 pr-3 text-right">Book</th><th className="py-2 pr-3 text-right">Difference</th><th className="py-2 pr-3">Status</th></tr></thead>
              <tbody>
                {((data?.reconciliations ?? []) as any[]).map((row: any) => (
                  <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.reconciliation_number}</td><td className="py-2 pr-3">{String(row.statement_date ?? "").slice(0, 10)}</td><td className="py-2 pr-3 text-right">{money(row.book_balance, settings)}</td><td className="py-2 pr-3 text-right">{money(row.difference, settings)}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}


