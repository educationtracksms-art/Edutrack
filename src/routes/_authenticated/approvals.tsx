import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import { updateAssessmentStatus } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

type ApprovalRow = {
  id: string;
  student_id: string;
  subject_id: string;
  term_id: string;
  formative: number | null;
  summative: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  rejection_reason: string | null;
  student_name?: string;
  subject_name?: string;
  term_name?: string;
};

export const Route = createFileRoute("/_authenticated/approvals")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleNames = (roles ?? []).map((item) => item.role);
    if (!roleNames.includes("dos")) throw redirect({ to: "/dashboard" });
    if (!profile?.school_id) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Approvals for DOS · EduTrack" },
      {
        name: "description",
        content: "Director of Studies approval queue for submitted assessments.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const isDos = hasAny(me?.roles, ["dos"]);
  const approveEntry = useServerFn(updateAssessmentStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["dos-approvals", schoolId],
    enabled: !!schoolId && isDos,
    queryFn: async () => {
      const [assessments, students, subjects, terms] = await Promise.all([
        supabase
          .from("assessments")
          .select(
            "id, student_id, subject_id, term_id, formative, summative, status, locked, rejection_reason",
          )
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false }),
        supabase.from("students").select("id, full_name").eq("school_id", schoolId),
        supabase.from("subjects").select("id, name").eq("school_id", schoolId),
        supabase.from("terms").select("id, name").eq("school_id", schoolId),
      ]);

      const studentMap = new Map((students.data ?? []).map((row: any) => [row.id, row.full_name]));
      const subjectMap = new Map((subjects.data ?? []).map((row: any) => [row.id, row.name]));
      const termMap = new Map((terms.data ?? []).map((row: any) => [row.id, row.name]));

      return (assessments.data ?? []).map((row: any): ApprovalRow => ({
        ...row,
        student_name: studentMap.get(row.student_id) ?? "Unknown learner",
        subject_name: subjectMap.get(row.subject_id) ?? "Unknown subject",
        term_name: termMap.get(row.term_id) ?? "Unknown term",
      }));
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (vars: { assessmentId: string; status: "approved" | "rejected" }) => {
      const reason =
        vars.status === "rejected" ? window.prompt("Enter a rejection reason")?.trim() : null;
      if (vars.status === "rejected" && !reason) {
        throw new Error("A rejection reason is required");
      }
      await approveEntry({
        data: {
          assessmentId: vars.assessmentId,
          status: vars.status,
          reason: reason ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Approval updated");
      queryClient.invalidateQueries({ queryKey: ["dos-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals for DOS"
        description="Review submitted assessments and approve or return them for correction."
      />

      <Panel title="All assessments">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading approvals…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">No assessments were found for this school.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Learner</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Term</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const total = Number(row.formative ?? 0) + Number(row.summative ?? 0);
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-3 pr-4 font-medium">{row.student_name}</td>
                      <td className="py-3 pr-4">{row.subject_name}</td>
                      <td className="py-3 pr-4">{row.term_name}</td>
                      <td className="py-3 pr-4">{total}</td>
                      <td className="py-3 pr-4">
                        <Pill
                          tone={
                            row.status === "approved"
                              ? "success"
                              : row.status === "rejected"
                                ? "danger"
                                : row.status === "submitted"
                                  ? "warning"
                                  : "muted"
                          }
                        >
                          {row.status}
                        </Pill>
                        {row.rejection_reason ? (
                          <p className="mt-1 text-xs text-muted-foreground">{row.rejection_reason}</p>
                        ) : null}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <select
                            className={inputClass}
                            value={row.status}
                            onChange={(event) => {
                              const nextStatus = event.target.value as
                                | "draft"
                                | "submitted"
                                | "approved"
                                | "rejected";
                              if (nextStatus === row.status) return;
                              actionMutation.mutate({
                                assessmentId: row.id,
                                status: nextStatus,
                              });
                            }}
                            disabled={actionMutation.isPending}
                          >
                            <option value="draft">Draft</option>
                            <option value="submitted">Submitted</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
