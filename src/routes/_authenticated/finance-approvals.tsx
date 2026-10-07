// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { money, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { decideBursarApproval } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-approvals")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Approvals · EduTrack" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [comment, setComment] = useState("");
  const { data, isPending } = useQuery({
    queryKey: ["bursar-approvals", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [requests, rules] = await Promise.all([
        db.from("approval_requests").select("id, entity_type, reference, amount, summary, status, requested_at").eq("school_id", schoolId!).order("requested_at", { ascending: false }).limit(200),
        db.from("approval_rules").select("id, entity_type, label, threshold_amount, required_approvals, is_active").eq("school_id", schoolId!),
      ]);
      return { requests: requests.data ?? [], rules: rules.data ?? [] };
    },
  });
  const decide = useMutation({
    mutationFn: async (vars: { requestId: string; action: "approve" | "reject" }) => decideBursarApproval({ data: { requestId: vars.requestId, action: vars.action, comment: comment || null } }),
    onSuccess: () => {
      toast.success("Decision recorded");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["bursar-approvals", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const pending = ((data?.requests ?? []) as any[]).filter((row) => row.status === "pending");
  if (!canView) return <PageHeader title="Approvals" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader title="Approvals" description="Discounts, refunds, journals, expenses, payroll and assets awaiting decision." eyebrow="Bursar" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Pending" value={pending.length} hint="Needs a decision" />
        <Stat label="Pending value" value={money(pending.reduce((sum, row) => sum + Number(row.amount ?? 0), 0), settings)} hint="UGX exposure" />
        <Stat label="Approval rules" value={(data?.rules ?? []).length} hint="Threshold policy" />
      </div>
      <Panel title="Decision note">
        <Field label="Comment (stored with the decision)">
          <input className={inputClass} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Reason for approval or rejection" />
        </Field>
      </Panel>
      <Panel title={`Approval queue (${pending.length})`}>
        {isPending ? <p className="text-sm text-muted-foreground">Loading approvals…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Reference</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Summary</th><th className="py-2 pr-3">Actions</th></tr></thead>
              <tbody>
                {pending.map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{row.reference ?? row.id.slice(0, 8)}</td>
                    <td className="py-2 pr-3">{row.entity_type}</td>
                    <td className="py-2 pr-3 text-right">{money(row.amount, settings)}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{row.summary}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <Btn variant="accent" onClick={() => decide.mutate({ requestId: row.id, action: "approve" })}>Approve</Btn>
                        <Btn variant="ghost" onClick={() => decide.mutate({ requestId: row.id, action: "reject" })}>Reject</Btn>
                      </div>
                    </td>
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

