// hod portal — submit funding requests and track their status
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, money, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { createFinanceRequest } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { requireHodAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-requests")({
  beforeLoad: ({ context }) => requireHodAccess(context),
  head: () => ({ meta: [{ title: "Finance requests · EduTrack" }] }),
  component: FinanceRequestsPage,
});

const PRIORITIES: { value: "low" | "medium" | "high"; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_TONE: Record<string, "success" | "warning" | "muted" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  processing: "muted",
};

const EMPTY_FORM = {
  subject: "",
  description: "",
  amount: "",
  priority: "medium" as "low" | "medium" | "high",
  dateNeeded: "",
};

function FinanceRequestsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);

  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["hod-finance-requests", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("finance_requests")
        .select(
          "id, school_id, hod_id, subject, description, amount, priority, date_needed, status, finance_remarks, created_at",
        )
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: () =>
      createFinanceRequest({
        data: {
          schoolId: schoolId!,
          subject: form.subject.trim(),
          description: form.description.trim(),
          amount: Number(form.amount),
          priority: form.priority,
          dateNeeded: form.dateNeeded || null,
        },
      }),
    onSuccess: () => {
      toast.success("Finance request submitted");
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["hod-finance-requests", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      if (!withdrawTarget) return;
      const { data: auth } = await (db as any).auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await (db as any)
        .from("finance_requests")
        .update({
          status: "rejected",
          finance_remarks: "Withdrawn by HOD",
          updated_at: new Date().toISOString(),
        })
        .eq("id", withdrawTarget)
        .eq("hod_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Request withdrawn");
      setWithdrawTarget(null);
      queryClient.invalidateQueries({ queryKey: ["hod-finance-requests", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  // __CHUNK2__

  const filtered = (data ?? []).filter((r: any) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${r.subject} ${r.status}`.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const total = filtered.reduce((sum, r: any) => sum + asNumber(r.amount), 0);
  const pendingCount = filtered.filter((r: any) => r.status === "pending").length;

  if (!canView) {
    return <PageHeader title="Finance requests" description="You do not have permission to view this area." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance requests"
        description="Submit funding and expense requests to the Bursar, then track their status."
        eyebrow="Head of department"
        actions={
          <Btn variant="ghost" onClick={() => window.print()}>
            Print
          </Btn>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total requested" value={money(total, settings)} hint={`${filtered.length} requests`} />
        <Stat label="Pending review" value={pendingCount} hint="Awaiting Bursar decision" />
        <Stat label="Requests submitted" value={filtered.length} hint="This school" />
      </div>

      <Panel title="New request">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Subject">
            <input className={inputClass} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Lab equipment replacement" />
          </Field>
          <Field label="Description">
            <textarea className={`${inputClass} min-h-[96px] resize-y`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is needed and why." rows={3} />
          </Field>
          <Field label="Amount (UGX)">
            <input className={inputClass} type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label="Priority">
            <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as "low" | "medium" | "high" })}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Required by (optional)">
            <input className={inputClass} type="date" value={form.dateNeeded} onChange={(e) => setForm({ ...form, dateNeeded: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2 xl:col-span-3">
            <Btn variant="accent" onClick={() => create.mutate()} disabled={create.isPending || !form.subject.trim() || !form.description.trim() || !form.amount}>
              {create.isPending ? "Submitting…" : "Submit request"}
            </Btn>
            <Btn variant="ghost" onClick={() => setForm(EMPTY_FORM)}>
              Clear
            </Btn>
          </div>
        </div>
      </Panel>

      {/* __CHUNK3__ */}
      <Panel title={`Your requests (${filtered.length})`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            className="min-w-[180px] flex-1 rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject or status"
          />
          <select
            className={`rounded-xl border border-input bg-background px-3 py-2.5 text-sm ${inputClass}`}
            style={{ width: "auto" }}
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
          <p className="py-8 text-sm text-muted-foreground">Loading your requests…</p>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No finance requests yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Submit one above — the Bursar reviews every request.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3">Subject</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Priority</th>
                  <th className="pb-2 pr-3">Required by</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Submitted</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2.5 pr-3 font-medium">{row.subject}</td>
                    <td className="py-2.5 pr-3 text-right">{money(row.amount, settings)}</td>
                    <td className="py-2.5 pr-3">
                      <Pill tone={row.priority === "high" ? "danger" : row.priority === "medium" ? "warning" : "muted"}>
                        {row.priority}
                      </Pill>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{row.date_needed ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <Pill tone={STATUS_TONE[row.status] ?? "muted"}>{row.status}</Pill>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5">
                      {row.status === "pending" ? (
                        <Btn variant="ghost" onClick={() => setWithdrawTarget(row.id)}>
                          Withdraw
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {withdrawTarget && (
          <Panel title="Withdraw request" className="mt-4 border-accent/30 bg-accent/5">
            <p className="text-sm text-muted-foreground">
              Withdrawing this request marks it as rejected and notifies the Bursar. This cannot be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <Btn variant="danger" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
                {withdraw.isPending ? "Withdrawing…" : "Confirm withdrawal"}
              </Btn>
              <Btn variant="ghost" onClick={() => setWithdrawTarget(null)}>
                Cancel
              </Btn>
            </div>
          </Panel>
        )}
      </Panel>
    </div>
  );
}
