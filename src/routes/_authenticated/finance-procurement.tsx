// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Btn, PageHeader, Panel, Stat } from "@/components/ui-kit";
import { asNumber, downloadCsv, money, toCsv, useFinanceContext, useFinanceSettings } from "@/lib/bursar";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-procurement")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Procurement · EduTrack" }] }),
  component: ProcurementPage,
});

function ProcurementPage() {
  const { schoolId, canView, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const { data, isPending } = useQuery({
    queryKey: ["bursar-procurement", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [requests, orders, receipts, supplierInvoices, suppliers] = await Promise.all([
        db.from("purchase_requests").select("id, request_number, supplier_id, item_description, requested_amount, status, department_name").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(300),
        db.from("purchase_orders").select("id, order_number, supplier_id, status, total_amount").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(300),
        db.from("goods_receipts").select("id, receipt_number, purchase_order_id, status, items_received").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(300),
        db.from("approved_invoices").select("id, invoice_number, purchase_order_id, amount, approval_status").eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(300),
        db.from("suppliers").select("id, supplier_name").eq("school_id", schoolId!).order("supplier_name").limit(300),
      ]);
      return { requests: requests.data ?? [], orders: orders.data ?? [], receipts: receipts.data ?? [], supplierInvoices: supplierInvoices.data ?? [], suppliers: suppliers.data ?? [] };
    },
  });
  const suppliersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of (data?.suppliers ?? []) as any[]) map.set(row.id, row.supplier_name);
    return map;
  }, [data]);
  const orderValue = ((data?.orders ?? []) as any[]).reduce((sum, row) => sum + asNumber(row.total_amount), 0);
  const matchedOrders = ((data?.orders ?? []) as any[]).filter((row) => ((data?.receipts ?? []) as any[]).some((item) => item.purchase_order_id === row.id) && ((data?.supplierInvoices ?? []) as any[]).some((item) => item.purchase_order_id === row.id)).length;
  if (!canView) return <PageHeader title="Procurement" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Procurement"
        description="Requests, orders, goods received and matched supplier bills with three-way control."
        eyebrow="Bursar"
        actions={<Btn variant="ghost" onClick={() => downloadCsv("procurement.csv", toCsv(((data?.orders ?? []) as any[]).map((row: any) => ({ order: row.order_number, supplier: suppliersById.get(row.supplier_id) ?? "", amount: row.total_amount, status: row.status })), ["order", "supplier", "amount", "status"]))}>Export orders</Btn>}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Open requests" value={(data?.requests ?? []).filter((row: any) => row.status !== "approved").length} hint="Needs review" />
        <Stat label="Purchase orders" value={(data?.orders ?? []).length} hint={money(orderValue, settings)} />
        <Stat label="Three-way matched" value={matchedOrders} hint="Order, receipt, bill" />
        <Stat label="Supplier bills" value={(data?.supplierInvoices ?? []).length} hint="Matched queue" />
      </div>
      <Panel title="Purchase requests">
        {isPending ? <p className="text-sm text-muted-foreground">Loading procurement…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Request</th><th className="py-2 pr-3">Supplier</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Status</th></tr></thead>
              <tbody>
                {((data?.requests ?? []) as any[]).slice(0, 150).map((row: any) => (
                  <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.request_number}</td><td className="py-2 pr-3">{suppliersById.get(row.supplier_id) ?? "—"}</td><td className="py-2 pr-3">{row.item_description}</td><td className="py-2 pr-3 text-right">{money(row.requested_amount, settings)}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Purchase orders">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Supplier</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Received</th><th className="py-2 pr-3">Billed</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>
              {((data?.orders ?? []) as any[]).slice(0, 150).map((row: any) => (
                <tr key={row.id} className="border-t">
                  <td className="py-2 pr-3 font-medium">{row.order_number}</td>
                  <td className="py-2 pr-3">{suppliersById.get(row.supplier_id) ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">{money(row.total_amount, settings)}</td>
                  <td className="py-2 pr-3 text-xs">{((data?.receipts ?? []) as any[]).some((item) => item.purchase_order_id === row.id) ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3 text-xs">{((data?.supplierInvoices ?? []) as any[]).some((item) => item.purchase_order_id === row.id) ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3 text-xs">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

