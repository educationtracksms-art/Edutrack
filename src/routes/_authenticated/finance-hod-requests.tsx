// bursar portal — review and decide HOD finance requests
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, Stat } from "@/components/ui-kit";
import { asNumber, money, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { decideFinanceRequest, listFinanceRequestsForSchool } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-hod-requests")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "HOD finance requests · EduTrack" }] }),
  component: FinanceHodRequestsPage,
});

type DecideAction = "approve" | "reject" | "processing";

const STATUS_TONE: Record<string, "success" | "warning" | "muted" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  processing: "muted",
};

function hodName(row: any): string {
  const p = row?.profiles;
  if (Array.isArray(p)) return p[0]?.full_name ?? "—";
  return p?.full_name ?? "—";
}

function FinanceHodRequestsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [decision, setDecision] = useState<{ id: string; action: DecideAction } | null>(null);
  const [remarks, setRemarks] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["hod-finance-requests-for-school", schoolId],
    enabled: !!schoolId && canView,
    queryFn: () => listFinanceRequestsForSchool(),
  });

  const decide = useMutation({
    mutationFn: () =>
      decideFinanceRequest({
        data: {
          requestId: decision!.id,
          schoolId: schoolId!,
          action: decision!.action,
          remarks: remarks.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Request updated");
      setDecision(null);
      setRemarks("");
      queryClient.invalidateQueries({ queryKey: ["hod-finance-requests-for-school", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  // __CHUNK2__ — filtering, stats, and the review table

  if (!canView) {
    return <PageHeader title="HOD finance requests" description="You do not have permission to view this area." />;
  }

  const rows = ((data ?? []) as any[]).filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${r.subject} ${r.status} ${hodName(r)}`.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pending = rows.filter((r) => r.status === "pending").length;
  const approvedRows = rows.filter((r) => r.status === "approved");
  const approvedTotal = approvedRows.reduce((s, r) => s + asNumber(r.amount), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="HOD finance requests"
        description="Review funding and expense requests submitted by heads of department."
        eyebrow="Bursar · Reviews"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Pending review" value={pending} hint="Awaiting your decision" />
        <Stat label="Approved total" value={money(approvedTotal, settings)} hint={`${approvedRows.length} approved`} />
        <Stat label="Total requests" value={rows.length} hint="This school" />
      </div>

      <Panel title={`Requests (${rows.length})`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            className="min-w-[180px] flex-1 rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, HOD or status"
          />
          <select
            className="w-auto rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {isPending ? (
          <p className="py-8 text-sm text-muted-foreground">Loading requests…</p>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No requests match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3">Subject</th>
                  <th className="pb-2 pr-3">HOD</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Priority</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Remarks</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const canDecide = row.status === "pending" || row.status === "processing";
                  return (
                    <tr key={row.id} className="border-t align-top">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{row.subject}</p>
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{hodName(row)}</td>
                      <td className="py-2.5 pr-3 text-right">{money(row.amount, settings)}</td>
                      <td className="py-2.5 pr-3">
                        <Pill tone={row.priority === "high" ? "danger" : row.priority === "medium" ? "warning" : "muted"}>
                          {row.priority}
                        </Pill>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Pill tone={STATUS_TONE[row.status] ?? "muted"}>{row.status}</Pill>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{row.finance_remarks ?? "—"}</td>
                      <td className="py-2.5">
                        {canDecide ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Btn variant="ghost" onClick={() => setDecision({ id: row.id, action: "approve" })}>
                              Approve
                            </Btn>
                            <Btn variant="ghost" onClick={() => setDecision({ id: row.id, action: "reject" })}>
                              Reject
                            </Btn>
                            {row.status === "pending" ? (
                              <Btn variant="ghost" onClick={() => setDecision({ id: row.id, action: "processing" })}>
                                Mark processing
                              </Btn>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* __DECISION__ */}
        {decision && (
          <Panel
            title={decision.action === "approve" ? "Approve request" : decision.action === "reject" ? "Reject request" : "Mark as processing"}
            className="mt-4 border-accent/30 bg-accent/5"
          >
            <Field label="Remarks (shared with the HOD)">
              <textarea
                className="min-h-[80px] w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Optional note about this decision"
              />
            </Field>
            <div className="mt-3 flex gap-2">
              <Btn variant={decision.action === "reject" ? "danger" : "primary"} onClick={() => decide.mutate()} disabled={decide.isPending}>
                {decide.isPending ? "Saving…" : "Confirm"}
              </Btn>
              <Btn variant="ghost" onClick={() => { setDecision(null); setRemarks(""); }}>
                Cancel
              </Btn>
            </div>
          </Panel>
        )}
      </Panel>
    </div>
  );
}
