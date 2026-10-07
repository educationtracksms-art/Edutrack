// bursar page
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { money, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { createBursarGrant } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";

import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-grants")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Grants & aid · EduTrack" }] }),
  component: GrantsPage,
});

function GrantsPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage, db } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);
  const [grant, setGrant] = useState({ title: "", donor: "", amount: "" });
  const [aid, setAid] = useState({ studentId: "", title: "Bursary award", amount: "" });
  const { data } = useQuery({
    queryKey: ["bursar-grants", schoolId],
    enabled: !!schoolId && canView,
    queryFn: async () => {
      const [grants, awards, students] = await Promise.all([
        db.from("grants").select("id, grant_code, title, donor_name, total_amount, status").eq("school_id", schoolId!).order("created_at", { ascending: false }),
        db.from("financial_aid_awards").select("id, award_name, sponsor_name, amount, status").eq("school_id", schoolId!).order("created_at", { ascending: false }),
        db.from("students").select("id, full_name").eq("school_id", schoolId!).is("deleted_at", null).order("full_name").limit(500),
      ]);
      return { grants: grants.data ?? [], awards: awards.data ?? [], students: students.data ?? [] };
    },
  });
  const saveGrant = useMutation({
    mutationFn: async () => createBursarGrant({ data: { kind: "grant", title: grant.title, donor: grant.donor || null, amount: Number(grant.amount) } }),
    onSuccess: () => {
      toast.success("Grant recorded");
      setGrant({ title: "", donor: "", amount: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-grants", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const saveAid = useMutation({
    mutationFn: async () => createBursarGrant({ data: { kind: "aid", title: aid.title, studentId: aid.studentId, amount: Number(aid.amount) } }),
    onSuccess: () => {
      toast.success("Aid award recorded");
      setAid({ studentId: "", title: "Bursary award", amount: "" });
      queryClient.invalidateQueries({ queryKey: ["bursar-grants", schoolId] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  if (!canView) return <PageHeader title="Grants" description="You do not have permission to view this area." />;
  return (
    <div className="space-y-4">
      <PageHeader title="Grants & aid" description="Donor grants, sponsorships and learner financial aid." eyebrow="Bursar" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active grants" value={(data?.grants ?? []).filter((row: any) => row.status === "active").length} hint="Donor funded" />
        <Stat label="Grant pipeline" value={money(((data?.grants ?? []) as any[]).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0), settings)} hint="Total pledged" />
        <Stat label="Aid awards" value={(data?.awards ?? []).length} hint="Learner support" />
      </div>
      {canManage && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Record grant">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Grant title"><input className={inputClass} value={grant.title} onChange={(event) => setGrant({ ...grant, title: event.target.value })} /></Field>
              <Field label="Donor"><input className={inputClass} value={grant.donor} onChange={(event) => setGrant({ ...grant, donor: event.target.value })} /></Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Amount (UGX)"><input className={inputClass} value={grant.amount} onChange={(event) => setGrant({ ...grant, amount: event.target.value })} inputMode="decimal" /></Field>
              <div className="flex items-end"><Btn variant="accent" onClick={() => saveGrant.mutate()} disabled={saveGrant.isPending}>Save grant</Btn></div>
            </div>
          </Panel>
          <Panel title="Award financial aid">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Learner">
                <select className={inputClass} value={aid.studentId} onChange={(event) => setAid({ ...aid, studentId: event.target.value })}>
                  <option value="">Select learner</option>
                  {((data?.students ?? []) as any[]).map((student: any) => (<option key={student.id} value={student.id}>{student.full_name}</option>))}
                </select>
              </Field>
              <Field label="Amount (UGX)"><input className={inputClass} value={aid.amount} onChange={(event) => setAid({ ...aid, amount: event.target.value })} inputMode="decimal" /></Field>
            </div>
            <div className="mt-3"><Btn variant="accent" onClick={() => saveAid.mutate()} disabled={saveAid.isPending}>Save award</Btn></div>
          </Panel>
        </div>
      )}
      <Panel title="Grants">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Grant</th><th className="py-2 pr-3">Donor</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>
              {((data?.grants ?? []) as any[]).map((row: any) => (
                <tr key={row.id} className="border-t"><td className="py-2 pr-3 font-medium">{row.title}</td><td className="py-2 pr-3">{row.donor_name ?? "—"}</td><td className="py-2 pr-3 text-right">{money(row.total_amount, settings)}</td><td className="py-2 pr-3 text-xs">{row.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}


