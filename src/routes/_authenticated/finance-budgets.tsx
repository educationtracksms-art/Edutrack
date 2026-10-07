// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { createBursarBudget } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-budgets")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Budgets · EduTrack" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [form, setForm] = useState({ title: "", departmentName: "", proposedAmount: "" });
  const { data } = useQuery({
    queryKey: ["bursar-budgets", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [budgets, lines, years] = await Promise.all([
        db.from("budgets").select("id, title, financial_year_id, department_name, status").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(200),
        db.from("budget_lines").select("id, budget_id, budget_category, proposed_amount, approved_amount, revised_amount, actual_amount, committed_amount").eq("school_id", schoolId!).limit(2000),
        db.from("financial_years").select("id, name, is_current").eq("school_id", schoolId!).order("name", { ascending: false }),
      ]);
      return { budgets: budgets.data ?? [], lines: lines.data ?? [], years: years.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => createBursarBudget({ data: { title: form.title, departmentName: form.departmentName || null, proposedAmount: Number(form.proposedAmount) } }),
    onSuccess: () => {
      toast.success("Budget created");
      setForm({ title: "", departmentName: "", proposedAmount: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-budgets", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const chart = useMemo(() => {
    const byCategory = new Map<string, { approved: number; actual: number; committed: number }>();
    for (const row of (data?.lines ?? []) as any[]) {
      const name = row.budget_category ?? "General";
      const current = byCategory.get(name) ?? { approved: 0, actual: 0, committed: 0 };
      current.approved += asNumber(row.approved_amount ?? row.revised_amount ?? row.proposed_amount);
      current.actual += asNumber(row.actual_amount);
      current.committed += asNumber(row.committed_amount);
      byCategory.set(name, current);
    }
    return Array.from(byCategory.entries()).map(([name, values]) => ({ name, ...values }));
  }, [data]);
  const approvedTotal = chart.reduce((sum, row) => sum + row.approved, 0);
  const actualTotal = chart.reduce((sum, row) => sum + row.actual, 0);
  if (!canView) return <PageHeader title="Budgets" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Budgets"
        description="Department budgets with approved, committed, actual and variance tracking."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("budgets.csv", toCsv(chart.map((row) => ({ category: row.name, approved: row.approved, committed: row.committed, actual: row.actual })), ["category", "approved", "committed", "actual"]))}>Export budgets</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Budgets" value={(data?.budgets ?? []).length} hint="All departments" />
        <Stat label="Approved" value={money(approvedTotal, settings)} hint="Live total" />
        <Stat label="Committed" value={money(chart.reduce((sum, row) => sum + row.committed, 0), settings)} hint="Orders and vouchers" />
        <Stat label="Actual" value={money(actualTotal, settings)} hint="Posted spend" />
      </div>
      {canManage && (
        <Panel title="Create budget">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Title"><input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="2026 operations budget" /></Field>
            <Field label="Department"><input className={inputClass} value={form.departmentName} onChange={(event) => setForm({ ...form, departmentName: event.target.value })} placeholder="Science" /></Field>
            <Field label="Proposed (UGX)"><input className={inputClass} value={form.proposedAmount} onChange={(event) => setForm({ ...form, proposedAmount: event.target.value })} inputMode="decimal" /></Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>Create budget</Btn></div>
        </Panel>
      )}
      <Panel title="Approved by category">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="approved" fill="#2563eb" name="Approved" />
              <Bar dataKey="committed" fill="#f59e0b" name="Committed" />
              <Bar dataKey="actual" fill="#16a34a" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Budgets">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Budget</th><th className="py-2 pr-3">Year</th><th className="py-2 pr-3">Department</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>
              {((data?.budgets ?? []) as any[]).map((row: any) => (
                <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.title}</td><td className="py-2 pr-3">{((data?.years ?? []) as any[]).find((year) => year.id === row.financial_year_id)?.name ?? "—"}</td><td className="py-2 pr-3">{row.department_name ?? "—"}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}


