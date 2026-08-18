import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
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
  class_id?: string | null;
  stream_id?: string | null;
  formative: number | null;
  summative: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  rejection_reason: string | null;
  student_name?: string;
  subject_name?: string;
  term_name?: string;
  class_name?: string;
  stream_name?: string;
  submitted_by_name?: string;
};

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

export const Route = createFileRoute("/_authenticated/approved")({
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
  const [approvedGroupBy, setApprovedGroupBy] = useState<"class" | "subject">("class");
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const isDos = hasAny(me?.roles, ["dos"]);
  const updateStatus = useServerFn(updateAssessmentStatus);

  const buildRows = async (scope: "non-approved" | "approved") => {
    const [assessments, students, classes, streams, subjects, terms, profiles] = await Promise.all([
      supabase
        .from("assessments")
        .select(
          "id, student_id, subject_id, term_id, formative, summative, status, locked, rejection_reason, created_at, submitted_by",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      supabase.from("students").select("id, full_name, class_id, stream_id").eq("school_id", schoolId),
      supabase.from("classes").select("id, name").eq("school_id", schoolId),
      supabase.from("streams").select("id, name").eq("school_id", schoolId),
      supabase.from("subjects").select("id, name").eq("school_id", schoolId),
      supabase.from("terms").select("id, name").eq("school_id", schoolId),
      supabase.from("profiles").select("id, full_name").eq("school_id", schoolId),
    ]);

    const studentMap = new Map((students.data ?? []).map((row: any) => [row.id, row.full_name]));
    const studentClassMap = new Map((students.data ?? []).map((row: any) => [row.id, row.class_id]));
    const studentStreamMap = new Map((students.data ?? []).map((row: any) => [row.id, row.stream_id]));
    const classMap = new Map((classes.data ?? []).map((row: any) => [row.id, row.name]));
    const streamMap = new Map((streams.data ?? []).map((row: any) => [row.id, row.name]));
    const subjectMap = new Map((subjects.data ?? []).map((row: any) => [row.id, row.name]));
    const termMap = new Map((terms.data ?? []).map((row: any) => [row.id, row.name]));
    const profileMap = new Map((profiles.data ?? []).map((row: any) => [row.id, row.full_name]));

    return (assessments.data ?? [])
      .filter((row: any) => (scope === "approved" ? row.status === "approved" : row.status !== "approved"))
      .map((row: any): ApprovalRow => ({
        ...row,
        student_name: studentMap.get(row.student_id) ?? "Unknown learner",
        subject_name: subjectMap.get(row.subject_id) ?? "Unknown subject",
        term_name: termMap.get(row.term_id) ?? "Unknown term",
        class_id: studentClassMap.get(row.student_id) ?? null,
        stream_id: studentStreamMap.get(row.student_id) ?? null,
        class_name: classMap.get(studentClassMap.get(row.student_id)) ?? "Unknown class",
        stream_name: streamMap.get(studentStreamMap.get(row.student_id)) ?? "Unknown stream",
        submitted_by_name: row.submitted_by
          ? (profileMap.get(row.submitted_by) ?? "Unknown teacher")
          : "Not submitted",
      }));
  };

  const { data: pendingRows, isLoading } = useQuery({
    queryKey: ["dos-approvals", schoolId],
    enabled: !!schoolId && isDos,
    queryFn: async () => buildRows("non-approved"),
  });

  const { data: approvedRows, isLoading: isApprovedLoading } = useQuery({
    queryKey: ["dos-approved-approvals", schoolId],
    enabled: !!schoolId && isDos,
    queryFn: async () => buildRows("approved"),
  });

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
    mutationFn: async (vars: { assessmentId: string; status: ApprovalRow["status"] }) => {
      await updateStatus({
        data: {
          assessmentId: vars.assessmentId,
          status: vars.status,
          reason: null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["dos-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dos-approved-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const submissionSummaryRows = useMemo(() => {
    const rows = pendingRows ?? [];
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
  }, [pendingRows]);

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
                    <td className="py-2 pr-4">{row.subject_name}</td>
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
          This table shows every non-approved mark row in the database for the school.
        </p>
        <div className="mb-3 grid gap-2 md:grid-cols-1">
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
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading approvals…</p>
        ) : !pendingRows?.length ? (
          <p className="text-sm text-muted-foreground">
            No non-approved assessments were found for this school.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Learner</th>
                  <th className="pb-2">Class</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {visibleData.map((row) => {
                  const total = Number(row.formative ?? 0) + Number(row.summative ?? 0);
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-3 pr-4 font-medium">{row.student_name}</td>
                      <td className="py-3 pr-4">{row.class_name}</td>
                      <td className="py-3 pr-4">{row.subject_name}</td>
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
                        <select
                          className={inputClass}
                          value={row.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value as ApprovalRow["status"];
                            if (nextStatus === row.status) return;
                            statusMutation.mutate({ assessmentId: row.id, status: nextStatus });
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

      <Panel title="Approved assessments">
        <p className="mb-3 text-sm text-muted-foreground">
          This table is independent from the one above and shows only approved marks.
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
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {approvedGroupRows.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="border-t border-border bg-muted/30">
                      <td className="py-2 pr-4 font-semibold" colSpan={6}>
                        {group.label}
                      </td>
                    </tr>
                    {group.rows.map((row) => {
                      const total = Number(row.formative ?? 0) + Number(row.summative ?? 0);
                      return (
                        <tr key={row.id} className="border-t border-border">
                          <td className="py-3 pr-4">
                            {approvedGroupBy === "class" ? row.class_name : row.subject_name}
                          </td>
                          <td className="py-3 pr-4 font-medium">{row.student_name}</td>
                          <td className="py-3 pr-4">{row.subject_name}</td>
                          <td className="py-3 pr-4">{total}</td>
                          <td className="py-3 pr-4">
                            <Pill tone="success">{row.status}</Pill>
                          </td>
                          <td className="py-3 text-right">
                            <select
                              className={inputClass}
                              value={row.status}
                              onChange={(event) => {
                                const nextStatus = event.target.value as ApprovalRow["status"];
                                if (nextStatus === row.status) return;
                                statusMutation.mutate({
                                  assessmentId: row.id,
                                  status: nextStatus,
                                });
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
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
