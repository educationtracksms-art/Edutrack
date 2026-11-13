import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { Btn, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { ResponsiveCardTable } from "@/components/ui/responsive-card-table";
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
  const pendingGroups = useMemo(() => {
    const groups = new Map<string, { rows: ApprovalRow[]; pendingRows: ApprovalRow[] }>();
    for (const row of allRows ?? []) {
      const key = [
        row.student_id,
        row.subject_id,
        row.paper_id ?? "subject",
        row.term_id,
        row.class_id,
        row.stream_id,
      ].join(":");
      const group = groups.get(key) ?? { rows: [], pendingRows: [] };
      group.rows.push(row);
      if (row.status !== "approved") group.pendingRows.push(row);
      groups.set(key, group);
    }
    return Array.from(groups.entries())
      .filter(([, group]) => group.pendingRows.length > 0)
      .map(([key, group]) => ({ key, ...group, first: group.rows[0] }));
  }, [allRows]);
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
    const rows = [...pendingGroups];
    if (sortBy === "class") {
      return rows.sort((a, b) => {
        const classCompare = (a.first.class_name ?? "").localeCompare(b.first.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        const streamCompare = (a.first.stream_name ?? "").localeCompare(b.first.stream_name ?? "");
        if (streamCompare !== 0) return streamCompare;
        return (a.first.student_name ?? "").localeCompare(b.first.student_name ?? "");
      });
    }
    if (sortBy === "stream") {
      return rows.sort((a, b) => {
        const streamCompare = (a.first.stream_name ?? "").localeCompare(b.first.stream_name ?? "");
        if (streamCompare !== 0) return streamCompare;
        const classCompare = (a.first.class_name ?? "").localeCompare(b.first.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        return (a.first.student_name ?? "").localeCompare(b.first.student_name ?? "");
      });
    }
    if (sortBy === "subject") {
      return rows.sort((a, b) => {
        const subjectCompare = (a.first.subject_name ?? "").localeCompare(b.first.subject_name ?? "");
        if (subjectCompare !== 0) return subjectCompare;
        const classCompare = (a.first.class_name ?? "").localeCompare(b.first.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        return (a.first.student_name ?? "").localeCompare(b.first.student_name ?? "");
      });
    }
    return rows;
  }, [pendingGroups, sortBy]);

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
    submitted: ["approved", "rejected", "draft"],
    approved: ["rejected"],
    rejected: ["draft", "submitted"],
  };
  const allStatuses: ApprovalRow["status"][] = ["approved", "submitted", "draft", "rejected"];

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
            Marks for each learner, subject, and term are grouped into one row.
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
          ) : !pendingGroups.length ? (
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
                    <th className="px-3 py-3 text-right">O-Level Formative / 20</th>
                    <th className="px-3 py-3 text-right">BOT</th>
                    <th className="px-3 py-3 text-right">MOT</th>
                    <th className="px-3 py-3 text-right">EOT</th>
                    <th className="px-3 py-3 text-right">O-Level Total / A-Level Average</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleData.map((group) => {
                    const row = group.first;
                    const isALevel = row.education_level === "advanced";
                    const formative = group.rows.find((item) => item.record_type === "formative");
                    const periodRow = (examType: string) =>
                      group.rows.find(
                        (item) =>
                          item.record_type !== "formative" && item.exam_type === examType,
                      );
                    const displayedValue = (item: ApprovalRow | undefined, value: number | null | undefined) =>
                      item?.is_missing ? "MISSING MARK" : value ?? "—";
                    const formativeValue = displayedValue(formative, formative?.formative);
                    const botValue = displayedValue(
                      periodRow("beginning_of_term"),
                      periodRow("beginning_of_term")?.summative,
                    );
                    const motValue = displayedValue(
                      periodRow("mid_term"),
                      periodRow("mid_term")?.summative,
                    );
                    const eotValue = displayedValue(
                      periodRow("end_of_term"),
                      periodRow("end_of_term")?.summative,
                    );
                    const summativeValues = ["beginning_of_term", "mid_term", "end_of_term"]
                      .map((examType) => periodRow(examType)?.summative)
                      .filter((value): value is number => value != null);
                    const averageSummative = summativeValues.length
                      ? summativeValues.reduce((sum, value) => sum + Number(value), 0) /
                        summativeValues.length
                      : 0;
                    const hasNumericMarks = isALevel
                      ? summativeValues.length > 0
                      : formative?.formative != null || summativeValues.length > 0;
                    const total = hasNumericMarks
                      ? isALevel
                        ? averageSummative
                        : Number(formative?.formative ?? 0) + averageSummative
                      : null;
                    const statuses = Array.from(new Set(group.pendingRows.map((item) => item.status)));
                    const statusLabel = statuses.length === 1 ? statuses[0] : "Mixed";
                    return (
                      <tr key={group.key} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-3 font-medium">{row.student_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.class_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.subject_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.paper_name || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.stream_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.term_name}</td>
                        <td className="px-3 py-3 text-right">{isALevel ? "—" : formativeValue}</td>
                        <td className="px-3 py-3 text-right">{botValue}</td>
                        <td className="px-3 py-3 text-right">{motValue}</td>
                        <td className="px-3 py-3 text-right">{eotValue}</td>
                        <td className="px-3 py-3 text-right font-medium">
                          {group.rows.some((item) =>
                            item.is_missing && (!isALevel || item.record_type !== "formative"),
                          )
                            ? "MISSING MARK"
                            : total ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Pill
                            tone={
                              statusLabel === "rejected"
                                  ? "danger"
                                  : statusLabel === "submitted"
                                    ? "warning"
                                    : "muted"
                            }
                          >
                            {statusLabel}
                          </Pill>
                          {group.pendingRows.find((item) => item.rejection_reason)?.rejection_reason ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {group.pendingRows.find((item) => item.rejection_reason)?.rejection_reason}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            className={`${inputClass} min-w-40`}
                            aria-label={`Change status for ${row.student_name} ${row.subject_name}`}
                            value=""
                            onChange={(event) => {
                              const nextStatus = event.target.value as ApprovalRow["status"];
                              const eligibleRows = group.pendingRows.filter((item) =>
                                availableStatusChanges[item.status].includes(nextStatus),
                              );
                              if (eligibleRows.length) statusMutation.mutate({ rows: eligibleRows, status: nextStatus });
                            }}
                            disabled={statusMutation.isPending}
                          >
                            <option value="" disabled>
                              {statusLabel}
                            </option>
                            {allStatuses.map((status) => (
                              <option
                                key={status}
                                value={status}
                                disabled={!group.pendingRows.some((item) =>
                                  availableStatusChanges[item.status].includes(status),
                                )}
                              >
                                Change to {status.charAt(0).toUpperCase() + status.slice(1)}
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
                  <th className="pb-2">O-Level Formative / 20</th>
                  <th className="pb-2">BOT</th>
                  <th className="pb-2">MOT</th>
                  <th className="pb-2">EOT</th>
                  <th className="pb-2">O-Level Total / A-Level Average</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {approvedGroups.map((group) => {
                      const rows = group.rows;
                      const row = rows[0];
                      const isALevel = row.education_level === "advanced";
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
                      const isMissing = rows.some((item) =>
                        item.is_missing && (!isALevel || item.record_type !== "formative"),
                      ) ||
                        (!isALevel && !formative) ||
                        hasMissingPeriod;
                      const approvedSummatives = activeRows
                        .map((item) => item?.summative)
                        .filter((value): value is number => value != null);
                      const averageSummative = approvedSummatives.length
                        ? approvedSummatives.reduce((sum, value) => sum + Number(value), 0) / approvedSummatives.length
                        : null;
                      const total = isALevel
                        ? averageSummative
                        : Number(formative?.formative ?? 0) + Number(averageSummative ?? 0);
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
                            {isALevel
                              ? "—"
                              : !formative || formative.is_missing
                                ? "MISSING MARK"
                                : formative.formative ?? "—"}
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
