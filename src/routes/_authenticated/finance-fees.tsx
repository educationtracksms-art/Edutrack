// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { proRateAmount } from "@/lib/finance-calc";
import { manageFeeSetup } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-fees")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Fees & billing · EduTrack" }] }),
  component: FeesPage,
});

function FeesPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [category, setCategory] = useState({ name: "", code: "" });
  const [structure, setStructure] = useState({ name: "Term 1 tuition", amount: "", feeType: "Tuition", effectiveFrom: "", dueDate: "" });
  const { data } = useQuery({
    queryKey: ["bursar-fees", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [categories, structures, lines, adjustments, years, terms] = await Promise.all([
        db.from("fee_categories").select("id, code, name, is_active").eq("school_id", schoolId!).order("name"),
        db.from("fee_structures").select("id, name, academic_year_id, term_id, status, currency").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(200),
        db.from("fee_structure_lines").select("id, structure_id, name, amount, is_optional").eq("school_id", schoolId!).limit(1000),
        db.from("fee_adjustments").select("id, amount, adjustment_type, status").eq("school_id", schoolId!).limit(500),
        db.from("academic_years").select("id, name, is_current").eq("school_id", schoolId!).order("name", { ascending: false }),
        db.from("terms").select("id, name, academic_year_id, is_current").eq("school_id", schoolId!).order("name"),
      ]);
      return { categories: categories.data ?? [], structures: structures.data ?? [], lines: lines.data ?? [], adjustments: adjustments.data ?? [], years: years.data ?? [], terms: terms.data ?? [] };
    },
  });
  const saveCategory = useMutation({
    mutationFn: async () => manageFeeSetup({ data: { action: "category", name: category.name, code: category.code || null } }),
    onSuccess: () => {
      toast.success("Fee category saved");
      setCategory({ name: "", code: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-fees", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const saveStructure = useMutation({
    mutationFn: async () => manageFeeSetup({ data: { action: "structure", name: structure.name, amount: Number(structure.amount) } }),
    onSuccess: () => {
      toast.success("Fee structure saved");
      setStructure({ name: "Term 1 tuition", amount: "", feeType: "Tuition", effectiveFrom: "", dueDate: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-fees", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const structureTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of (data?.lines ?? []) as any[]) map.set(row.structure_id, (map.get(row.structure_id) ?? 0) + asNumber(row.amount));
    return map;
  }, [data]);
  const approvedAdjustments = ((data?.adjustments ?? []) as any[]).filter((row) => row.status === "approved").reduce((sum, row) => sum + asNumber(row.amount), 0);
  if (!canView) return <PageHeader title="Fees" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Fees & billing"
        description="Configurable fee categories, term structures, pro-rata previews and guarded adjustments."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("fee-structures.csv", toCsv(((data?.structures ?? []) as any[]).map((row: any) => ({ name: row.name, total: structureTotals.get(row.id) ?? 0, status: row.status })), ["name", "total", "status"]))}>Export structures</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Fee categories" value={(data?.categories ?? []).length} hint="Recurring and optional" />
        <Stat label="Billed structures value" value={money(Array.from(structureTotals.values()).reduce((sum, value) => sum + value, 0), settings)} hint={`${(data?.structures ?? []).length} structures`} />
        <Stat label="Approved adjustments" value={money(approvedAdjustments, settings)} hint="Discounts and waivers" />
      </div>
      {canManage && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="New fee category">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><input className={inputClass} value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} placeholder="Tuition" /></Field>
              <Field label="Code"><input className={inputClass} value={category.code} onChange={(event) => setCategory({ ...category, code: event.target.value })} placeholder="TUITION" /></Field>
            </div>
            <div className="mt-3"><Btn variant="accent" onClick={() => saveCategory.mutate()} disabled={saveCategory.isPending}>Save category</Btn></div>
          </Panel>
          <Panel title="New fee structure">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><input className={inputClass} value={structure.name} onChange={(event) => setStructure({ ...structure, name: event.target.value })} /></Field>
              <Field label="Amount (UGX)"><input className={inputClass} value={structure.amount} onChange={(event) => setStructure({ ...structure, amount: event.target.value })} inputMode="decimal" /></Field>
              <Field label="Fee type"><input className={inputClass} value={structure.feeType} onChange={(event) => setStructure({ ...structure, feeType: event.target.value })} /></Field>
              <Field label="Due date"><input className={inputClass} type="date" value={structure.dueDate} onChange={(event) => setStructure({ ...structure, dueDate: event.target.value })} /></Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Half-term joining preview: {money(proRateAmount(Number(structure.amount || 0), 6, 12), settings)} for 6 of 12 weeks.</p>
            <div className="mt-3"><Btn variant="accent" onClick={() => saveStructure.mutate()} disabled={saveStructure.isPending}>Save structure</Btn></div>
          </Panel>
        </div>
      )}
      <Panel title="Fee structures">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Structure</th><th className="py-2 pr-3 text-right">Billed lines</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>
              {((data?.structures ?? []) as any[]).map((row: any) => (
                <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.name}</td><td className="py-2 pr-3 text-right">{money(structureTotals.get(row.id) ?? 0, settings)}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}


