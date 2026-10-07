// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, inputClass } from "@/components/ui-kit";
import { PAYMENT_METHOD_OPTIONS, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { saveBursarSettings } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-settings")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Finance settings · EduTrack" }] }),
  component: FinanceSettingsPage,
});

function FinanceSettingsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [form, setForm] = useState({ currency: "UGX", invoicePrefix: "INV", receiptPrefix: "RCT", paymentPrefix: "PAY", defaultFeeDueDays: "30", approvalThresholdAmount: "500000", pettyCashFloatLimit: "200000" });
  useEffect(() => {
    if (settings) {
      setForm({
        currency: String(settings.currency ?? "UGX"),
        invoicePrefix: String(settings.invoice_prefix ?? "INV"),
        receiptPrefix: String(settings.receipt_prefix ?? "RCT"),
        paymentPrefix: String(settings.payment_prefix ?? "PAY"),
        defaultFeeDueDays: String(settings.default_fee_due_days ?? 30),
        approvalThresholdAmount: String(settings.approval_threshold_amount ?? 500000),
        pettyCashFloatLimit: String(settings.petty_cash_float_limit ?? 200000),
      });
    }
  }, [settings]);
  const { data: methods } = useQuery({
    queryKey: ["bursar-settings", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => (await db.from("finance_payment_methods").select("id, code, name, category, is_active").eq("school_id", schoolId!).order("sort_order")).data ?? [],
  });
  const save = useMutation({
    mutationFn: async () => saveBursarSettings({ data: { currency: form.currency, invoicePrefix: form.invoicePrefix, receiptPrefix: form.receiptPrefix, paymentPrefix: form.paymentPrefix, defaultFeeDueDays: Number(form.defaultFeeDueDays), approvalThresholdAmount: Number(form.approvalThresholdAmount), pettyCashFloatLimit: Number(form.pettyCashFloatLimit) } }),
    onSuccess: () => {
      toast.success("Finance settings saved");
      queryClient.invalidateQueries({ queryKey: ["finance-settings", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  if (!canView) return <PageHeader title="Finance settings" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader title="Finance settings" description="UGX currency, numbering, thresholds and accepted payment methods." eyebrow="Bursar" />
      {canManage && (
        <Panel title="General settings">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Currency"><input className={inputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></Field>
            <Field label="Invoice prefix"><input className={inputClass} value={form.invoicePrefix} onChange={(event) => setForm({ ...form, invoicePrefix: event.target.value })} /></Field>
            <Field label="Receipt prefix"><input className={inputClass} value={form.receiptPrefix} onChange={(event) => setForm({ ...form, receiptPrefix: event.target.value })} /></Field>
            <Field label="Payment prefix"><input className={inputClass} value={form.paymentPrefix} onChange={(event) => setForm({ ...form, paymentPrefix: event.target.value })} /></Field>
            <Field label="Fee due days"><input className={inputClass} value={form.defaultFeeDueDays} onChange={(event) => setForm({ ...form, defaultFeeDueDays: event.target.value })} inputMode="numeric" /></Field>
            <Field label="Approval threshold (UGX)"><input className={inputClass} value={form.approvalThresholdAmount} onChange={(event) => setForm({ ...form, approvalThresholdAmount: event.target.value })} inputMode="decimal" /></Field>
          </div>
          <div className="mt-3"><Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>Save settings</Btn></div>
        </Panel>
      )}
      <Panel title="Accepted payment methods">
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_METHOD_OPTIONS.map((option) => {
            const active = (methods as any[] ?? []).find((row: any) => row.code === option.value);
            return <div key={option.value} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"><span>{option.label}</span><span className="text-xs text-muted-foreground">{active ? (active.is_active ? "Active" : "Disabled") : "Default"}</span></div>;
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">M-Pesa and SchoolPay are never accepted. Add other providers under Settings without touching the accounting engine.</p>
      </Panel>
    </div>
  );
}

