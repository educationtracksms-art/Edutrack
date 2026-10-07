// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, money, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { createBursarAsset } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-assets")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Assets & inventory · EduTrack" }] }),
  component: AssetsPage,
});

function AssetsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [form, setForm] = useState({ name: "", category: "Furniture", purchaseCost: "", location: "" });
  const { data, isPending } = useQuery({
    queryKey: ["bursar-assets", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [assets, inventory] = await Promise.all([
        db.from("fixed_assets").select("id, asset_code, name, category, purchase_cost, book_value, status").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(200),
        db.from("inventory_items").select("id, item_code, name, quantity, unit_cost, reorder_level").eq("school_id", schoolId!).order("name").limit(200),
      ]);
      return { assets: assets.data ?? [], inventory: inventory.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => createBursarAsset({ data: { name: form.name, category: form.category, purchaseCost: Number(form.purchaseCost), location: form.location || null } }),
    onSuccess: () => {
      toast.success("Asset registered");
      setForm({ name: "", category: "Furniture", purchaseCost: "", location: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-assets", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const assetValue = ((data?.assets ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.book_value ?? row.purchase_cost), 0);
  if (!canView) return <PageHeader title="Assets" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader title="Assets & inventory" description="Fixed asset register, depreciation and stock valuation." eyebrow="Bursar" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Asset book value" value={money(assetValue, settings)} hint={`${(data?.assets ?? []).length} assets`} />
        <Stat label="Inventory lines" value={(data?.inventory ?? []).length} hint="Stock on hand" />
        <Stat label="Low stock" value={(data?.inventory ?? []).filter((row: any) => asNumber(row.quantity) <= asNumber(row.reorder_level)).length} hint="Reorder soon" />
      </div>
      {canManage && (
        <Panel title="Register asset">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Asset name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Classroom desks" /></Field>
            <Field label="Category"><input className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
            <Field label="Cost (UGX)"><input className={inputClass} value={form.purchaseCost} onChange={(event) => setForm({ ...form, purchaseCost: event.target.value })} inputMode="decimal" /></Field>
            <Field label="Location"><input className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>Register asset</Btn></div>
        </Panel>
      )}
      <Panel title="Fixed assets">
        {isPending ? <p className="text-sm text-muted-foreground">Loading assets…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Asset</th><th className="py-2 pr-3">Code</th><th className="py-2 pr-3 text-right">Book value</th><th className="py-2 pr-3">Status</th></tr></thead>
              <tbody>
                {((data?.assets ?? []) as any[]).map((row: any) => (
                  <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.name}</td><td className="py-2 pr-3">{row.asset_code}</td><td className="py-2 pr-3 text-right">{money(row.book_value ?? row.purchase_cost, settings)}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}


