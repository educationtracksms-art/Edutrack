import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { Btn, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import { fetchDosApprovalRows, type ApprovalRow } from "@/lib/dos-approvals";
import { updateAssessmentStatus, updateFormativeMarkStatus } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/approval")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleNames = (roles ?? []).map((item) => item.role);
    if (!roleNames.some((role) => ["dos", "head_teacher", "deputy_head_teacher", "school_admin"].includes(role))) throw redirect({ to: "/dashboard" });
    if (!profile?.school_id) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Marks approvals · EduTrack" },
      {
        name: "description",
        content: "Director of Studies approval queue for submitted assessments.",
      },
    ],
  }),
  component: () => <ApprovalsPage view="pending" />,
});

export function ApprovalsPage({ view }: { view: "pending" | "approved" }) {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<"created_at" | "class" | "stream" | "subject">("created_at");
  const [approvedGroupBy, setApprovedGroupBy] = useState<"class" | "subject">("class");
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canManageApprovals = hasAny(me?.roles, ["dos", "head_teacher", "deputy_head_teacher", "school_admin"]);
  const updateStatus = useServerFn(updateAssessmentStatus);
  const updateFormativeStatus = useServerFn(updateFormativeMarkStatus);

  const { data: approvalData, isLoading } = useQuery({
    queryKey: ["dos-assessment-rows", schoolId],
    enabled: !!schoolId && canManageApprovals,
    queryFn: async () => fetchDosApprovalRows(schoolId!),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const allRows = approvalData?.rows;
  const pendingRows = useMemo(
    () => (allRows ?? []).filter((row) => row.status !== "approved"),
    [allRows],
  );
  const approvedRows = useMemo(
    () => (allRows ?? []).filter((row) => row.status === "approved"),
    [allRows],
  );
  const approvedGroups = useMemo(() => {
    const groups = new Map<string, { rows: ApprovalRow[]; first: ApprovalRow }>();
    for (const row of approvedRows) {
      const key = [row.student_id, row.subject_id, row.paper_id ?? "subject", row.term_id, row.class_id, row.stream_id].join(":");
      const group = groups.get(key) ?? { rows: [], first: row };
      group.rows.push(row);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }, [approvedRows]);
  const isApprovedLoading = isLoading;

  const visibleData = useMemo(() => {
    const rows = [...(pendingRows ?? [])];
    if (sortBy === "class") {
      return rows.sort((a, b) => {
        const classCompare = (a.class_name ?? "").localeCompare(b.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        const streamCompare = (a.stream_name ?? "").localeCompare(b.stream_name ?? "");
        if (streamCompare !== 0) return streamCompare;
        return (a.student_name ?? "").localeCompare(b.student_name ?? "");
      });
    }
    if (sortBy === "stream") {
      return rows.sort((a, b) => {
        const streamCompare = (a.stream_name ?? "").localeCompare(b.stream_name ?? "");
        if (streamCompare !== 0) return streamCompare;
        const classCompare = (a.class_name ?? "").localeCompare(b.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        return (a.student_name ?? "").localeCompare(b.student_name ?? "");
      });
    }
    if (sortBy === "subject") {
      return rows.sort((a, b) => {
        const subjectCompare = (a.subject_name ?? "").localeCompare(b.subject_name ?? "");
        if (subjectCompare !== 0) return subjectCompare;
        const classCompare = (a.class_name ?? "").localeCompare(b.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        return (a.student_name ?? "").localeCompare(b.student_name ?? "");
      });
    }
    return rows;
  }, [pendingRows, sortBy]);

  const statusMutation = useMutation({
    mutationFn: async (vars: { rows: ApprovalRow[]; status: ApprovalRow["status"] }) => {
      for (const row of vars.rows) {
        if (row.record_type === "formative") {
          await updateFormativeStatus({
            data: { markId: row.id, status: vars.status, reason: null },
          });
        } else {
          await updateStatus({
            data: { assessmentId: row.id, status: vars.status, reason: null },
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["dos-assessment-rows"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const availableStatusChanges: Record<ApprovalRow["status"], ApprovalRow["status"][]> = {
    draft: ["submitted"],
    submitted: ["approved", "rejected"],
    approved: ["rejected"],
    rejected: ["draft", "submitted"],
  };

  const approvedGroupRows = useMemo(() => {
    const rows = [...(approvedRows ?? [])];
    const groups = new Map<string, ApprovalRow[]>();
    for (const row of rows) {
      const key = approvedGroupBy === "class"
        ? (row.class_id ?? row.class_name ?? "unknown-class")
        : (row.subject_id ?? row.subject_name ?? "unknown-subject");
      const existing = groups.get(key) ?? [];
      existing.push(row);
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).map(([key, groupRows]) => ({
      key,
      label:
        approvedGroupBy === "class"
          ? groupRows[0]?.class_name ?? "Unknown class"
          : groupRows[0]?.subject_name ?? "Unknown subject",
      rows: groupRows,
    }));
  }, [approvedRows, approvedGroupBy]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={view === "pending" ? "Marks approvals" : "Approved results"}
        description={
          view === "pending"
            ? "Review marks, change their status, and approve or return submitted assessments."
            : "Review approved marks and return them for correction if needed."
        }
        actions={
          <>
            <Link
              to="/approval"
              className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                view === "pending"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-primary-soft"
              }`}
            >
              Pending marks
            </Link>
            <Link
              to="/approved"
              className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                view === "approved"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-primary-soft"
              }`}
            >
              Approved marks
            </Link>
          </>
        }
      />

      {view === "pending" && (
        <Panel title="Marks awaiting action">
          <p className="mb-3 text-sm text-muted-foreground">
            This table shows every non-approved mark row in the database for the school.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              className={`${inputClass} w-full max-w-xs`}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            >
              <option value="created_at">Sort by newest</option>
              <option value="class">Sort by class</option>
              <option value="stream">Sort by stream</option>
              <option value="subject">Sort by subject</option>
            </select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading approvals…</p>
          ) : !pendingRows?.length ? (
            <p className="text-sm text-muted-foreground">
              No non-approved assessments were found for this school.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-[1180px] w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Learner</th>
                    <th className="px-3 py-3">Class</th>
                    <th className="px-3 py-3">Subject</th>
                    <th className="px-3 py-3">Paper</th>
                    <th className="px-3 py-3">Stream</th>
                    <th className="px-3 py-3">Term</th>
                    <th className="px-3 py-3 text-right">Formative</th>
                    <th className="px-3 py-3 text-right">BOT</th>
                    <th className="px-3 py-3 text-right">MOT</th>
                    <th className="px-3 py-3 text-right">EOT</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleData.map((row) => {
                    const isFormative = row.record_type === "formative";
                    const isBot = row.exam_type === "beginning_of_term";
                    const isMot = row.exam_type === "mid_term";
                    const isEot = row.exam_type === "end_of_term";
                    const isMissing = Boolean(row.is_missing);
                    const total = Number(row.formative ?? 0) + Number(row.summative ?? 0);
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-3 font-medium">{row.student_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.class_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.subject_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.paper_name || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.stream_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.term_name}</td>
                        <td className="px-3 py-3 text-right">{isMissing ? "MISSING MARK" : isFormative ? row.formative ?? "—" : "—"}</td>
                        <td className="px-3 py-3 text-right">{isMissing ? "MISSING MARK" : isBot ? row.summative ?? "—" : "—"}</td>
                        <td className="px-3 py-3 text-right">{isMissing ? "MISSING MARK" : isMot ? row.summative ?? "—" : "—"}</td>
                        <td className="px-3 py-3 text-right">{isMissing ? "MISSING MARK" : isEot ? row.summative ?? "—" : "—"}</td>
                        <td className="px-3 py-3 text-right font-medium">{isMissing ? "MISSING MARK" : total}</td>
                        <td className="px-3 py-3">
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
                        <td className="px-3 py-3">
                          <select
                            className={`${inputClass} min-w-40`}
                            aria-label={`Change status for ${row.student_name} ${row.subject_name}`}
                            value={row.status}
                            onChange={(event) => {
                              const nextStatus = event.target.value as ApprovalRow["status"];
                              if (nextStatus !== row.status) {
                                statusMutation.mutate({ rows: [row], status: nextStatus });
                              }
                            }}
                            disabled={statusMutation.isPending}
                          >
                            <option value={row.status}>{row.status}</option>
                            {availableStatusChanges[row.status].map((status) => (
                              <option key={status} value={status}>
                                Change to {status}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {view === "approved" && (
      <Panel title="Approved assessments">
        <p className="mb-3 text-sm text-muted-foreground">
          Review approved marks and return them to teachers for correction if needed.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className={inputClass}
            value={approvedGroupBy}
            onChange={(event) => setApprovedGroupBy(event.target.value as typeof approvedGroupBy)}
          >
            <option value="class">Display by class</option>
            <option value="subject">Display by subject</option>
          </select>
        </div>

        {isApprovedLoading ? (
          <p className="text-sm text-muted-foreground">Loading approved assessments…</p>
        ) : !approvedRows?.length ? (
          <p className="text-sm text-muted-foreground">No approved assessments were found yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">{approvedGroupBy === "class" ? "Class" : "Subject"}</th>
                  <th className="pb-2">Learner</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Paper</th>
                  <th className="pb-2">Stream</th>
                  <th className="pb-2">Term</th>
                  <th className="pb-2">Formative</th>
                  <th className="pb-2">BOT</th>
                  <th className="pb-2">MOT</th>
                  <th className="pb-2">EOT</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {approvedGroups.map((group) => {
                      const rows = group.rows;
                      const row = rows[0];
                      const formative = rows.find((item) => item.record_type === "formative");
                      const periodConfigurationExists = rows.some((item) => item.assessment_periods_configured);
                      const configuredActiveTypes = rows.find((item) => item.assessment_periods_configured)
                        ?.active_exam_types ?? [];
                      const activeTypes = periodConfigurationExists
                        ? configuredActiveTypes
                        : rows
                            .filter((item) => item.record_type === "summative")
                            .map((item) => item.exam_type ?? "end_of_term");
                      const activeRows = activeTypes.map((type) =>
                        rows.find((item) => item.exam_type === type && item.record_type === "summative"),
                      );
                      const hasMissingPeriod = activeRows.some((item) => !item || item.summative == null);
                      const isMissing = rows.some((item) => item.is_missing) || !formative || hasMissingPeriod;
                      const approvedSummatives = activeRows
                        .map((item) => item?.summative)
                        .filter((value): value is number => value != null);
                      const averageSummative = approvedSummatives.length
                        ? approvedSummatives.reduce((sum, value) => sum + Number(value), 0) / approvedSummatives.length
                        : null;
                      const total = Number(formative?.formative ?? 0) + Number(averageSummative ?? 0);
                      const periodValue = (examType: string) => {
                        if (!activeTypes.includes(examType)) return "—";
                        const assessment = rows.find(
                          (item) => item.record_type === "summative" && item.exam_type === examType,
                        );
                        return !assessment || assessment.summative == null || assessment.is_missing
                          ? "MISSING MARK"
                          : assessment.summative;
                      };
                      return (
                        <tr key={`${row.student_id}-${row.subject_id}-${row.paper_id ?? "subject"}-${row.term_id}`} className="border-t border-border">
                          <td className="py-3 pr-4">
                            {approvedGroupBy === "class" ? row.class_name : row.subject_name}
                          </td>
                          <td className="py-3 pr-4 font-medium">{row.student_name}</td>
                          <td className="py-3 pr-4">{row.subject_name}</td>
                          <td className="py-3 pr-4">{row.paper_name || "—"}</td>
                          <td className="py-3 pr-4">{row.stream_name}</td>
                          <td className="py-3 pr-4">{row.term_name}</td>
                          <td className="py-3 pr-4">
                            {!formative || formative.is_missing ? "MISSING MARK" : formative.formative ?? "—"}
                          </td>
                          <td className="py-3 pr-4">{periodValue("beginning_of_term")}</td>
                          <td className="py-3 pr-4">{periodValue("mid_term")}</td>
                          <td className="py-3 pr-4">{periodValue("end_of_term")}</td>
                          <td className="py-3 pr-4">{isMissing ? "MISSING MARK" : total}</td>
                          <td className="py-3 pr-4">
                            <Pill tone="success">{row.status}</Pill>
                          </td>
                          <td className="py-3 text-right">
                            <Btn
                              variant="danger"
                              onClick={() => statusMutation.mutate({ rows, status: "rejected" })}
                              disabled={statusMutation.isPending}
                            >
                              Return for correction
                            </Btn>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      )}
    </div>
  );
}
