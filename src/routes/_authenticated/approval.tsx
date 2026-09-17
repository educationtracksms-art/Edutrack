import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import { fetchDosApprovalRows, type ApprovalRow } from "@/lib/dos-approvals";
import { updateAssessmentStatus } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

type SubmissionSummaryRow = {
  key: string;
  teacher_name: string;
  subject_name: string;
  class_name: string;
  stream_name: string;
  marks_submitted: number;
  submitted_count: number;
  expected_count: number;
};

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
  const [sortBy, setSortBy] = useState<"created_at" | "class" | "stream" | "subject">("created_at");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const isDos = hasAny(me?.roles, ["dos"]);
  const updateStatus = useServerFn(updateAssessmentStatus);

  const { data: allRows, isLoading } = useQuery({
    queryKey: ["dos-assessment-rows", schoolId],
    enabled: !!schoolId && isDos,
    queryFn: async () => fetchDosApprovalRows(schoolId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const data = useMemo(() => (allRows ?? []).filter((row) => row.status !== "approved"), [allRows]);

  const visibleData = useMemo(() => {
    const rows = [...(data ?? [])];
    const filteredRows = rows.filter((row) => {
      const matchesClass = classFilter === "all" || (row.class_id ?? "unknown-class") === classFilter;
      const matchesSubject =
        subjectFilter === "all" || (row.subject_id ?? "unknown-subject") === subjectFilter;
      return matchesClass && matchesSubject;
    });
    if (sortBy === "class") {
      return filteredRows.sort((a, b) => {
        const classCompare = (a.class_name ?? "").localeCompare(b.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        const streamCompare = (a.stream_name ?? "").localeCompare(b.stream_name ?? "");
        if (streamCompare !== 0) return streamCompare;
        return (a.student_name ?? "").localeCompare(b.student_name ?? "");
      });
    }
    if (sortBy === "stream") {
      return filteredRows.sort((a, b) => {
        const streamCompare = (a.stream_name ?? "").localeCompare(b.stream_name ?? "");
        if (streamCompare !== 0) return streamCompare;
        const classCompare = (a.class_name ?? "").localeCompare(b.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        return (a.student_name ?? "").localeCompare(b.student_name ?? "");
      });
    }
    if (sortBy === "subject") {
      return filteredRows.sort((a, b) => {
        const subjectCompare = (a.subject_name ?? "").localeCompare(b.subject_name ?? "");
        if (subjectCompare !== 0) return subjectCompare;
        const classCompare = (a.class_name ?? "").localeCompare(b.class_name ?? "");
        if (classCompare !== 0) return classCompare;
        return (a.student_name ?? "").localeCompare(b.student_name ?? "");
      });
    }
    return filteredRows;
  }, [data, sortBy, classFilter, subjectFilter]);

  const approvalGroups = useMemo(() => {
    const groups = new Map<string, { rows: ApprovalRow[]; first: ApprovalRow }>();
    for (const row of visibleData) {
      const key = [row.student_id, row.subject_id, row.paper_id ?? "subject", row.term_id, row.class_id, row.stream_id].join(":");
      const group = groups.get(key) ?? { rows: [], first: row };
      group.rows.push(row);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }, [visibleData]);

  const classOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const row of data ?? []) options.set(row.class_id ?? "unknown-class", row.class_name ?? "Unknown class");
    return Array.from(options.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const subjectOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const row of data ?? [])
      options.set(row.subject_id ?? "unknown-subject", row.subject_name ?? "Unknown subject");
    return Array.from(options.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const statusMutation = useMutation({
    mutationFn: async (vars: { rows: ApprovalRow[]; status: ApprovalRow["status"] }) => {
      for (const row of vars.rows) {
        if (row.record_type === "formative") {
          const { error } = await (supabase as any)
            .from("formative_marks")
            .update({
              status: vars.status,
              locked: vars.status === "approved",
              approved_by: vars.status === "approved" ? me?.userId ?? null : null,
              approved_at: vars.status === "approved" ? new Date().toISOString() : null,
            })
            .eq("id", row.id);
          if (error) throw new Error(error.message);
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

  const submissionSummaryRows = useMemo(() => {
    const rows = data ?? [];
    const expectedTotals = new Map<string, number>();
    const submittedTotals = new Map<string, number>();
    const teacherNames = new Map<string, string>();
    const subjectNames = new Map<string, string>();
    const classNames = new Map<string, string>();
    const streamNames = new Map<string, string>();

    for (const row of rows) {
      const coverageKey = [
        row.submitted_by ?? "unassigned",
        row.subject_id ?? "unknown-subject",
        row.class_id ?? "unknown-class",
        row.stream_id ?? "all-streams",
      ].join(":");

      if (row.submitted_by) {
        teacherNames.set(row.submitted_by, row.submitted_by_name ?? "Unknown teacher");
      }
      subjectNames.set(row.subject_id, row.subject_name ?? "Unknown subject");
      classNames.set(row.class_id ?? "unknown-class", row.class_name ?? "Unknown class");
      streamNames.set(row.stream_id ?? "all-streams", row.stream_name ?? "All streams");

      expectedTotals.set(coverageKey, (expectedTotals.get(coverageKey) ?? 0) + 1);
      if (row.status === "submitted" || row.status === "approved") {
        submittedTotals.set(coverageKey, (submittedTotals.get(coverageKey) ?? 0) + 1);
      }
    }

    const summary = new Map<string, SubmissionSummaryRow>();
    for (const row of rows) {
      if (!row.submitted_by) continue;
      const coverageKey = [
        row.submitted_by,
        row.subject_id ?? "unknown-subject",
        row.class_id ?? "unknown-class",
        row.stream_id ?? "all-streams",
      ].join(":");
      const expectedCount = expectedTotals.get(coverageKey) ?? 0;
      const submittedCount = submittedTotals.get(coverageKey) ?? 0;
      if (expectedCount === 0) continue;

      summary.set(coverageKey, {
        key: coverageKey,
        teacher_name: teacherNames.get(row.submitted_by) ?? "Unknown teacher",
        subject_name: subjectNames.get(row.subject_id) ?? "Unknown subject",
        class_name: classNames.get(row.class_id ?? "unknown-class") ?? "Unknown class",
        stream_name: streamNames.get(row.stream_id ?? "all-streams") ?? "All streams",
        marks_submitted: Math.round((submittedCount / expectedCount) * 100),
        submitted_count: submittedCount,
        expected_count: expectedCount,
      });
    }

    return Array.from(summary.values()).sort((a, b) => {
      const teacherCompare = a.teacher_name.localeCompare(b.teacher_name);
      if (teacherCompare !== 0) return teacherCompare;
      const subjectCompare = a.subject_name.localeCompare(b.subject_name);
      if (subjectCompare !== 0) return subjectCompare;
      return a.class_name.localeCompare(b.class_name);
    });
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals for DOS"
        description="Review submitted assessments and approve or return them for correction."
      />

      <Panel title="Submission coverage">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Teacher name</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">Stream</th>
                <th className="pb-2">Marks submitted</th>
              </tr>
            </thead>
            <tbody>
              {submissionSummaryRows.length ? (
                submissionSummaryRows.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium">{row.teacher_name}</td>
                    <td className="py-2 pr-4">{row.subject_name}{row.paper_name ? ` (${row.paper_name})` : ""}</td>
                    <td className="py-2 pr-4">{row.class_name}</td>
                    <td className="py-2 pr-4">{row.stream_name}</td>
                    <td className="py-2 pr-4">
                      {row.marks_submitted}%
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({row.submitted_count}/{row.expected_count})
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-muted-foreground">
                    No submitted marks found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="All assessments">
        <p className="mb-3 text-sm text-muted-foreground">
          This table shows every mark row in the database for the school, regardless of status.
        </p>
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <select
            className={`${inputClass} max-w-xs`}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
          >
            <option value="created_at">Sort by newest</option>
            <option value="class">Sort by class</option>
            <option value="stream">Sort by stream</option>
            <option value="subject">Sort by subject</option>
          </select>
          <select className={inputClass} value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="all">All classes</option>
            {classOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          >
            <option value="all">All subjects</option>
            {subjectOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading approvals…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">
            No assessments were found for this school.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Learner</th>
                  <th className="pb-2">Class</th>
                  <th className="pb-2">Stream</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Term</th>
                  <th className="pb-2">Formative</th>
                  <th className="pb-2">BOT</th>
                  <th className="pb-2">MOT</th>
                  <th className="pb-2">EOT</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {approvalGroups.map((group) => {
                  const row = group.first;
                  const formative = group.rows.find((item) => item.record_type === "formative");
                  const bot = group.rows.find((item) => item.exam_type === "beginning_of_term");
                  const mot = group.rows.find((item) => item.exam_type === "mid_term");
                  const eot = group.rows.find((item) => item.exam_type === "end_of_term");
                  const isMissing = group.rows.some((item) => item.is_missing);
                  const total = Number(formative?.formative ?? 0) +
                    ([bot, mot, eot].filter(Boolean).reduce((sum, item) => sum + Number(item?.summative ?? 0), 0) /
                      Math.max(1, [bot, mot, eot].filter(Boolean).length));
                  const groupStatus = group.rows.some((item) => item.status === "rejected")
                    ? "rejected"
                    : group.rows.some((item) => item.status === "submitted")
                      ? "submitted"
                      : group.rows[0]?.status ?? "draft";
                  return (
                    <tr key={`${row.student_id}-${row.subject_id}-${row.term_id}`} className="border-t border-border">
                      <td className="py-3 pr-4 font-medium">{row.student_name}</td>
                      <td className="py-3 pr-4">{row.class_name}</td>
                      <td className="py-3 pr-4">{row.stream_name}</td>
                      <td className="py-3 pr-4">{row.subject_name}{row.paper_name ? ` (${row.paper_name})` : ""}</td>
                      <td className="py-3 pr-4">{row.term_name}</td>
                      <td className="py-3 pr-4">{isMissing ? "MISSING MARK" : formative?.formative ?? "—"}</td>
                      <td className="py-3 pr-4">{isMissing ? "MISSING MARK" : bot?.summative ?? "—"}</td>
                      <td className="py-3 pr-4">{isMissing ? "MISSING MARK" : mot?.summative ?? "—"}</td>
                      <td className="py-3 pr-4">{isMissing ? "MISSING MARK" : eot?.summative ?? "—"}</td>
                      <td className="py-3 pr-4">{isMissing ? "MISSING MARK" : total}</td>
                      <td className="py-3 pr-4">
                        <Pill
                          tone={
                            groupStatus === "approved"
                              ? "success"
                              : groupStatus === "rejected"
                                ? "danger"
                                : groupStatus === "submitted"
                                  ? "warning"
                                  : "muted"
                          }
                        >
                          {groupStatus}
                        </Pill>
                        {row.rejection_reason ? (
                          <p className="mt-1 text-xs text-muted-foreground">{row.rejection_reason}</p>
                        ) : null}
                      </td>
                      <td className="py-3 text-right">
                        <select
                          className={inputClass}
                          value={groupStatus}
                          onChange={(event) => {
                            const nextStatus = event.target.value as ApprovalRow["status"];
                            if (nextStatus === groupStatus) return;
                            statusMutation.mutate({ rows: group.rows, status: nextStatus });
                          }}
                          disabled={statusMutation.isPending}
                        >
                          <option value="draft">Draft</option>
                          <option value="submitted">Submitted</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
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
    </div>
  );
}
