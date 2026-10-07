// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Panel, Stat } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { Btn } from "@/components/ui-kit";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-reports")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Finance reports · EduTrack" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { schoolId, canView, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const { data } = useQuery({
    queryKey: ["bursar-reports", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [transactions, payments, budgets, lines] = await Promise.all([
        db.from("transactions").select("id, transaction_number, transaction_date, transaction_type, total_amount").eq("school_id", schoolId!).order("transaction_date", { ascending: false }).limit(500),
        db.from("payments").select("id, payment_date, payment_method, amount").eq("school_id", schoolId!).order("payment_date", { ascending: false }).limit(500),
        db.from("budgets").select("id, title").eq("school_id", schoolId!),
        db.from("budget_lines").select("id, budget_category, approved_amount, actual_amount").eq("school_id", schoolId!),
      ]);
      return { transactions: transactions.data ?? [], payments: payments.data ?? [], budgets: budgets.data ?? [], lines: lines.data ?? [] };
    },
  });
  const income = ((data?.transactions ?? []) as any[]).filter((row) => row.transaction_type === "income").reduce((sum, row) => sum + asNumber(row.total_amount), 0);
  const expenses = ((data?.transactions ?? []) as any[]).filter((row) => row.transaction_type === "expense").reduce((sum, row) => sum + asNumber(row.total_amount), 0);
  const monthly = useMemo(() => {
    const incomeByMonth: Record<string, number> = {};
    const expenseByMonth: Record<string, number> = {};
    for (const row of (data?.transactions ?? []) as any[]) {
      const month = String(row.transaction_date ?? "").slice(0, 7);
      if (!month) continue;
      if (row.transaction_type === "income") incomeByMonth[month] = (incomeByMonth[month] ?? 0) + asNumber(row.total_amount);
      if (row.transaction_type === "expense") expenseByMonth[month] = (expenseByMonth[month] ?? 0) + asNumber(row.total_amount);
    }
    return Object.keys({ ...incomeByMonth, ...expenseByMonth }).sort().slice(-8).map((month) => ({
      month,
      income: Math.round(incomeByMonth[month] ?? 0),
      expenses: Math.round(expenseByMonth[month] ?? 0),
    }));
  }, [data]);
  if (!canView) return <PageHeader title="Reports" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader title="Finance reports" description="Income, expenditure, surplus and exports for leadership." eyebrow="Bursar" actions={<Btn variant="ghost" onClick={() => downloadCsv("income-expenditure.csv", toCsv(((data?.transactions ?? []) as any[]).map((row) => ({ date: String(row.transaction_date ?? "").slice(0, 10), type: row.transaction_type, reference: row.transaction_number, amount: row.total_amount })), ["date", "type", "reference", "amount"]))}>Export CSV</Btn>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Income" value={money(income, settings)} hint="Live ledger" />
        <Stat label="Expenditure" value={money(expenses, settings)} hint="Live ledger" />
        <Stat label="Surplus" value={money(income - expenses, settings)} hint="Income minus expenditure" />
      </div>
      <Panel title="Income vs expenditure">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" fill="#16a34a" name="Income" />
              <Bar dataKey="expenses" fill="#dc2626" name="Expenditure" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

