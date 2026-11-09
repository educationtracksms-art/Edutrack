import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";
import {
  Btn,
  Field,
  PageHeader,
  Panel,
  Pill,
  ResponsiveTable,
  Stat,
  inputClass,
} from "@/components/ui-kit";
import {
  reviewAssessments,
  deleteReportCommentRule,
  upsertReportCommentRule,
  verifyStudent,
  updateAssessmentStatus,
} from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { canManageSchoolModules, getEnabledModuleMap } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - EduTrack" },
      {
        name: "description",
        content: "Role-based analytics for schools, learners, assessments and approvals.",
      },
      { property: "og:title", content: "Dashboard - EduTrack" },
      {
        property: "og:description",
        content: "Live school analytics and approval status at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

const DashboardCharts = lazy(() => import("@/components/dashboard/DashboardCharts"));

function DashboardChartFallback({ height = 280 }: { height?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-live="polite">
      {[0, 1, 2, 3].map((chart) => (
        <div
          key={chart}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
          style={{ minHeight: height }}
        >
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-6 flex h-[190px] items-end gap-3 border-b border-l border-border px-4 pb-3">
            {[42, 68, 52, 84, 60].map((bar, index) => (
              <div
                key={index}
                className="flex-1 animate-pulse rounded-t bg-primary/15"
                style={{ height: `${bar}%` }}
              />
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading charts</span>
    </div>
  );
}

function DashboardDataError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
      <h2 className="text-base font-semibold">Dashboard charts could not load</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

type DashboardStudentRow = {
  id: string;
  full_name: string;
  status: string;
  gender: string | null;
  school_id: string;
  class_id: string | null;
  stream_id: string | null;
};

type DashboardData = {
  schools: Array<{ id: string; name: string; status: string }>;
  students: DashboardStudentRow[];
  assessments: Array<{
    id: string;
    student_id: string;
    subject_id: string;
    term_id: string;
    formative: number | null;
    summative: number | null;
    grade_descriptor: string | null;
    status: "draft" | "submitted" | "approved" | "rejected";
    school_id: string;
  }>;
  subjects: Array<{ id: string; name: string }>;
  profiles: Array<{ id: string; full_name: string | null; school_id: string | null }>;
  activity: Array<{ action: string; user_name: string | null; created_at: string }>;
  classes: Array<{ id: string; name: string; class_teacher_id: string | null }>;
  streams: Array<{ id: string; name: string; class_id: string | null; stream_teacher_id: string | null }>;
  terms: Array<{ id: string; name: string; is_current: boolean; start_date?: string | null }>;
  teacherAllocations: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }>;
  departments: Array<{ id: string; name: string }>;
  purchaseRequests: Array<{
    id: string;
    request_number: string;
    department_name: string | null;
    item_description: string;
    requested_amount: number;
    approved_amount: number | null;
    approval_status: string;
    status: string;
    created_at: string;
  }>;
};

const EMPTY_DASHBOARD: DashboardData = {
  schools: [],
  students: [],
  assessments: [],
  subjects: [],
  profiles: [],
  activity: [],
  classes: [],
  streams: [],
  terms: [],
  teacherAllocations: [],
  departments: [],
  purchaseRequests: [],
};

function useDashboardData(
  schoolId: string | null | undefined,
  isSuper: boolean,
  isTeacher: boolean,
  teacherId?: string | null,
  isHod = false,
  departmentId?: string | null,
  chartsOnly = false,
) {
  return useQuery<DashboardData>({
    queryKey: ["dashboard", schoolId, isSuper, isTeacher, teacherId, isHod, departmentId, chartsOnly],
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
    retry: 1,
    queryFn: async () => {
      if (!isSuper && !schoolId) return EMPTY_DASHBOARD;

      const schoolQuery =
        !isSuper && schoolId
          ? (query: any) => query.eq("school_id", schoolId)
          : (query: any) => query;

      const [students, assessments, subjects, classes, streams, terms, teacherAllocations, departmentsResult, schoolsResult, profilesResult, activityResult] =
        await Promise.all([
          schoolQuery(
            supabase
              .from("students")
              .select("id, full_name, gender, status, class_id, stream_id, school_id")
              .order("full_name", { ascending: true })
              .limit(2000),
          ),
          schoolQuery(
            supabase
              .from("assessments")
              .select(
                "id, student_id, subject_id, term_id, formative, summative, grade_descriptor, status, school_id",
              )
              .order("created_at", { ascending: false })
              .limit(3000),
          ),
          supabase.from("subjects").select("id, name"),
          schoolQuery(supabase.from("classes").select("id, name, class_teacher_id").limit(500)),
          schoolQuery(supabase.from("streams").select("id, name, class_id, stream_teacher_id").limit(500)),
          schoolQuery(
            supabase
              .from("terms")
              .select("id, name, is_current, start_date")
              .order("start_date", { ascending: false })
              .limit(20),
          ),
          isTeacher && teacherId
            ? supabase
                .from("teacher_allocations")
                .select("subject_id, class_id, stream_id")
                .eq("teacher_id", teacherId)
            : Promise.resolve({ data: [] as any[] }),
          isTeacher || chartsOnly
            ? Promise.resolve({ data: [] as any[] })
            : schoolQuery(supabase.from("departments").select("id, name").limit(200)),
          isTeacher || chartsOnly
            ? Promise.resolve({ data: [] as any[] })
            : schoolQuery(supabase.from("schools").select("id, name, status").limit(50)),
          isTeacher || chartsOnly
            ? Promise.resolve({ data: [] as any[] })
            : schoolQuery(
                supabase
                  .from("profiles")
                  .select("id, full_name, school_id")
                  .order("full_name", { ascending: true })
                  .limit(2000),
              ),
          isTeacher || chartsOnly
            ? Promise.resolve({ data: [] as any[] })
            : schoolQuery(
                supabase
                  .from("audit_logs")
                  .select("action, user_name, created_at")
                  .order("created_at", { ascending: false })
                  .limit(8),
              ),
        ]);

      const requiredResults = [students, assessments, subjects, classes, streams, terms];
      const failedResult = requiredResults.find((result) => result.error);
      if (failedResult?.error) {
        throw new Error(`Unable to load school dashboard data: ${failedResult.error.message}`);
      }

      let purchaseRequestsResult: { data: any[] } = { data: [] as any[] };
      if (!isTeacher && !isHod && !chartsOnly) {
        purchaseRequestsResult = await schoolQuery(
          supabase
            .from("purchase_requests")
            .select("id, request_number, department_name, item_description, requested_amount, approved_amount, approval_status, status, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
        );
      } else if (!isTeacher && isHod && !chartsOnly) {
        let requestsQuery = schoolQuery(
          supabase
            .from("purchase_requests")
            .select("id, request_number, department_name, item_description, requested_amount, approved_amount, approval_status, status, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
        );
        const departmentName = (departmentsResult.data ?? []).find(
          (department: { id: string; name: string }) => department.id === departmentId,
        )?.name;
        requestsQuery = requestsQuery.eq("department_name", departmentName ?? "__unassigned__");
        purchaseRequestsResult = await requestsQuery;
      }
      return {
        schools: schoolsResult.data ?? [],
        students: students.data ?? [],
        assessments: assessments.data ?? [],
        subjects: subjects.data ?? [],
        profiles: profilesResult.data ?? [],
        activity: activityResult.data ?? [],
        classes: classes.data ?? [],
        streams: streams.data ?? [],
        terms: terms.data ?? [],
        teacherAllocations: teacherAllocations.data ?? [],
        departments: departmentsResult.data ?? [],
        purchaseRequests: purchaseRequestsResult.data ?? [],
      };
    },
  });
}

function Dashboard() {
  const { data: me, isLoading: isUserLoading } = useCurrentUser();
  const dashboardLoading = !me;
  const isSuper = hasAny(me?.roles, ["super_admin"]);

  if (isUserLoading || dashboardLoading) {
    return <DashboardChartFallback />;
  }

  if (isSuper) return <PlatformDashboard />;
  const isSchoolLeader = hasAny(me?.roles, [
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "dos",
  ]);
  return (
    <SchoolDashboard
      me={me}
      isTeacher={!isSchoolLeader && hasAny(me?.roles, ["subject_teacher", "class_teacher"])}
    />
  );
}

function EmptyDashboardState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PlatformDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-stats"],
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_school_stats");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (isLoading)
    return (
      <DashboardChartFallback height={280} />
    );

  if (error || !data) {
    return (
      <DashboardDataError
        message={error instanceof Error ? error.message : "Platform analytics are unavailable."}
        onRetry={() => void refetch()}
      />
    );
  }

  const chart = data.map((row) => ({
    name: row.code,
    status: row.status,
    users: Number(row.user_count),
    students: Number(row.student_count),
    logins: Number(row.logins_30d),
  }));

  return (
    <Suspense fallback={<DashboardChartFallback />}>
      <DashboardCharts kind="platform" data={chart} />
    </Suspense>
  );


}

function TeacherDashboard({ data, me }: { data: any; me: any }) {
  const teacherAllocations = data.teacherAllocations as Array<{
    subject_id: string;
    class_id: string | null;
    stream_id: string | null;
  }>;
  const subjectById = new Map<string, string>(
    (data.subjects ?? []).map((subject: any): [string, string] => [subject.id, subject.name]),
  );
  const classById = new Map<string, string>(
    (data.classes ?? []).map((item: any): [string, string] => [item.id, item.name]),
  );
  const streamById = new Map<string, { name: string; class_id: string | null }>(
    (data.streams ?? []).map((item: any): [string, { name: string; class_id: string | null }] => [
      item.id,
      { name: item.name, class_id: item.class_id },
    ]),
  );
  const assignedClassIds = new Set(
    (data.classes ?? [])
      .filter((item: any) => item.class_teacher_id === me?.userId)
      .map((item: any) => item.id),
  );
  const assignedStreamIds = new Set(
    (data.streams ?? [])
      .filter((item: any) => item.stream_teacher_id === me?.userId)
      .map((item: any) => item.id),
  );
  const isClassTeacher = hasAny(me?.roles, ["class_teacher"]);
  const scopeAllocations = teacherAllocations.filter((allocation) => {
    if (!isClassTeacher) return true;
    const classMatch = allocation.class_id ? assignedClassIds.has(allocation.class_id) : true;
    const streamMatch = allocation.stream_id ? assignedStreamIds.has(allocation.stream_id) : true;
    return classMatch && streamMatch;
  });
  const scopeSubjectIds = new Set(scopeAllocations.map((allocation) => allocation.subject_id));
  const scopeStudents = data.students
    .filter((student: any) => {
      if (student.status !== "active") return false;
      return scopeAllocations.some((allocation) => {
        const classMatches = allocation.class_id ? allocation.class_id === student.class_id : true;
        const streamMatches = allocation.stream_id
          ? allocation.stream_id === student.stream_id
          : true;
        return classMatches && streamMatches;
      });
    })
    .sort((left: any, right: any) => {
      const leftClass = classById.get(left.class_id) ?? "";
      const rightClass = classById.get(right.class_id) ?? "";
      if (leftClass !== rightClass) return leftClass.localeCompare(rightClass);

      const leftStream = streamById.get(left.stream_id)?.name ?? "";
      const rightStream = streamById.get(right.stream_id)?.name ?? "";
      if (leftStream !== rightStream) return leftStream.localeCompare(rightStream);

      const leftSubject =
        scopeAllocations
          .filter(
            (allocation) =>
              (!allocation.class_id || allocation.class_id === left.class_id) &&
              (!allocation.stream_id || allocation.stream_id === left.stream_id),
          )
          .map((allocation) => subjectById.get(allocation.subject_id) ?? "")
          .filter(Boolean)
          .sort()[0] ?? "";
      const rightSubject =
        scopeAllocations
          .filter(
            (allocation) =>
              (!allocation.class_id || allocation.class_id === right.class_id) &&
              (!allocation.stream_id || allocation.stream_id === right.stream_id),
          )
          .map((allocation) => subjectById.get(allocation.subject_id) ?? "")
          .filter(Boolean)
          .sort()[0] ?? "";
      if (leftSubject !== rightSubject) return leftSubject.localeCompare(rightSubject);

      return left.full_name.localeCompare(right.full_name);
    });
  const scopeSubjects = data.subjects.filter((subject: any) => scopeSubjectIds.has(subject.id));
  const scopeAssessments = data.assessments.filter(
    (assessment: any) =>
      scopeStudents.some((student: any) => student.id === assessment.student_id) &&
      scopeSubjects.some((subject: any) => subject.id === assessment.subject_id),
  );
  const pendingMarks = scopeAssessments.filter(
    (assessment: any) => assessment.status === "submitted",
  );
  const canManageCommentCriteria = hasAny(me?.roles, [
    "dos",
    "head_teacher",
    "deputy_head_teacher",
  ]);
  const assignedLabels = scopeAllocations.map((allocation) => {
    const subjectName = subjectById.get(allocation.subject_id) ?? "Subject";
    const allocationClassName = allocation.class_id
      ? (classById.get(allocation.class_id) ?? "Any class")
      : "Any class";
    const allocationStreamName = allocation.stream_id
      ? (streamById.get(allocation.stream_id)?.name ?? "Any stream")
      : "Any stream";
    return `${subjectName} - ${allocationClassName}${allocation.stream_id ? ` - ${allocationStreamName}` : ""}`;
  });
  const visibleLearners = scopeStudents.slice(0, 10);

  const totals = scopeAssessments.map(
    (assessment: any) => Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0),
  );
  const average = totals.length
    ? totals.reduce((sum: number, value: number) => sum + value, 0) / totals.length
    : 0;
  const teacherGradeBuckets = [
    { name: "80+", value: totals.filter((score: number) => score >= 80).length },
    { name: "70-79", value: totals.filter((score: number) => score >= 70 && score < 80).length },
    { name: "60-69", value: totals.filter((score: number) => score >= 60 && score < 70).length },
    { name: "45-59", value: totals.filter((score: number) => score >= 45 && score < 60).length },
    { name: "Below 45", value: totals.filter((score: number) => score < 45).length },
  ].filter((bucket) => bucket.value > 0);
  const teacherStatus = ["approved", "submitted", "rejected", "draft"].map((status) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: scopeAssessments.filter((assessment: any) => assessment.status === status).length,
  })).filter((item) => item.value > 0);
  const teacherSubjectPerformance = scopeSubjects.map((subject: any) => {
    const subjectScores = scopeAssessments
      .filter((assessment: any) => assessment.subject_id === subject.id)
      .map((assessment: any) => Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0));
    return { name: subject.name, average: subjectScores.length ? subjectScores.reduce((sum: number, score: number) => sum + score, 0) / subjectScores.length : 0 };
  }).filter((item: any) => item.average > 0);
  const teacherGenderCounts = new Map<string, number>();
  for (const student of scopeStudents) {
    const label = student.gender?.trim() || "Not recorded";
    teacherGenderCounts.set(label, (teacherGenderCounts.get(label) ?? 0) + 1);
  }
  const teacherGenderSplit = [...teacherGenderCounts].map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader
        title="Teacher dashboard"
        description="This view is limited to the learners, streams, and subjects assigned to you."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assigned learners" value={scopeStudents.length} />
        <Stat label="Assigned subjects" value={scopeSubjects.length} />
        <Stat label="Pending marks" value={pendingMarks.length} />
        <Stat label="Average achievement" value={`${average.toFixed(1)}%`} />
      </div>

      <Suspense fallback={<DashboardChartFallback height={280} />}>
        <DashboardCharts
          kind="school"
          subjectPerformance={teacherSubjectPerformance}
          gradeBuckets={teacherGradeBuckets}
          trend={[]}
          genderSplit={teacherGenderSplit}
          statusBreakdown={teacherStatus}
          classDistribution={[]}
        />
      </Suspense>

      <Panel title="Your assignments" className="mt-4">
        {assignedLabels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teaching allocations have been assigned to your account yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {assignedLabels.map((label) => (
              <li key={label} className="rounded-md border border-border px-3 py-2">
                {label}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Learners in scope" className="mt-4">
        {scopeStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No learners match your current allocations.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {visibleLearners.map((student: any) => (
              <li
                key={student.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>{student.full_name}</span>
                <Link to="/assessments" className="text-sm font-medium text-accent">
                  Enter marks
                </Link>
              </li>
            ))}
            {scopeStudents.length > 10 && (
              <li className="text-xs text-muted-foreground">Showing the first 10 learners only.</li>
            )}
          </ul>
        )}
      </Panel>

      <Panel title="Marks waiting for submission" className="mt-4">
        {pendingMarks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No marks are waiting for submission.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pendingMarks.map((assessment: any) => (
              <li
                key={assessment.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>
                  <span className="font-medium">
                    {scopeStudents.find((student: any) => student.id === assessment.student_id)
                      ?.full_name ?? "Learner"}
                  </span>{" "}
                  -{" "}
                  {scopeSubjects.find((subject: any) => subject.id === assessment.subject_id)
                    ?.name ?? "Subject"}
                </span>
                <Link to="/assessments" className="text-sm font-medium text-accent">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {canManageCommentCriteria && (
        <>
          <CommentEditorPanel
            schoolId={me?.profile?.school_id ?? null}
            commentRole="class_teacher"
            title="Class teacher comment rules"
            description="Use point-based rules for A-level learners and descriptor rules for O-level learners."
          />
          <CommentEditorPanel
            schoolId={me?.profile?.school_id ?? null}
            commentRole="head_teacher"
            title="Head teacher comment rules"
            description="Use a separate set of point-based comments for the head teacher's report remark."
          />
        </>
      )}
    </div>
  );
}

function CommentEditorPanel({
  commentRole,
  schoolId,
  title,
  description,
}: {
  commentRole: "class_teacher" | "head_teacher";
  schoolId: string | null;
  title: string;
  description: string;
}) {
  const saveRule = useServerFn(upsertReportCommentRule);
  const deleteRule = useServerFn(deleteReportCommentRule);
  const [draft, setDraft] = useState<{
    id: string;
    descriptor: string;
    points: string;
    comment: string;
  }>({ id: "", descriptor: "Outstanding", points: "", comment: "" });
  const { data: rules } = useQuery({
    queryKey: ["dashboard-report-comment-rules", schoolId, commentRole],
    enabled: !!schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("report_comment_rules")
          .select("id, descriptor, points, comment")
          .eq("school_id", schoolId!)
          .eq("comment_role", commentRole)
          .order("points", { ascending: true, nullsFirst: false })
          .order("descriptor", { ascending: true })
      ).data ?? [],
  });

  useEffect(() => {
    if (!rules) return;
    const first = rules[0] as
      { id: string; descriptor: string; points: number | null; comment: string } | undefined;
    setDraft((current) => ({
      id: first?.id ?? current.id ?? "",
      descriptor: first?.descriptor ?? current.descriptor,
      points: first?.points != null ? String(first.points) : current.points,
      comment: first?.comment ?? current.comment,
    }));
  }, [rules]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const comment = draft.comment.trim();
      if (!comment) throw new Error("Enter the comment text first");
      if (draft.points) {
        const points = Number(draft.points);
        if (!Number.isInteger(points) || points < 3 || points > 17) {
          throw new Error("Points must be a whole number between 3 and 17");
        }
      } else if (!draft.descriptor.trim()) {
        throw new Error("Choose a descriptor first");
      }
      return saveRule({
        data: {
          id: draft.id || null,
          commentRole,
          descriptor: draft.points ? draft.points : draft.descriptor,
          points: draft.points ? Number(draft.points) : null,
          comment,
        },
      });
    },
    onSuccess: () => toast.success("Comment rule saved"),
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      deleteRule({
        data: {
          id,
          commentRole,
        },
      }),
    onSuccess: () => toast.success("Comment rule deleted"),
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  return (
    <Panel title={title} className="mt-4">
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="block text-sm">
          <span className="font-medium">Rule type</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={draft.points ? "points" : "descriptor"}
            onChange={(event) =>
              setDraft({
                ...draft,
                points: event.target.value === "points" ? draft.points || "3" : "",
              })
            }
          >
            <option value="descriptor">Descriptor</option>
            <option value="points">Point based</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">{draft.points ? "Points" : "Descriptor"}</span>
          {draft.points ? (
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={draft.points}
              onChange={(event) => setDraft({ ...draft, points: event.target.value })}
            >
              {Array.from({ length: 15 }, (_, index) => index + 3).map((point) => (
                <option key={point} value={point}>
                  {point}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={draft.descriptor}
              onChange={(event) => setDraft({ ...draft, descriptor: event.target.value })}
            >
              <option value="Outstanding">Outstanding</option>
              <option value="Modulate">Modulate</option>
              <option value="Basic">Basic</option>
            </select>
          )}
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-medium">Comment</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
            value={draft.comment}
            onChange={(event) => setDraft({ ...draft, comment: event.target.value })}
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          Save rule
        </button>
        {draft.id && (
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
            onClick={() => deleteMutation.mutate(draft.id)}
            disabled={deleteMutation.isPending}
          >
            Delete rule
          </button>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2">Descriptor / Points</th>
              <th className="pb-2">Comment</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).map(
              (rule: {
                id: string;
                descriptor: string;
                points: number | null;
                comment: string;
              }) => (
                <tr key={rule.id} className="border-t border-border">
                  <td className="py-2 pr-4">
                    {rule.points != null ? `Points ${rule.points}` : rule.descriptor}
                  </td>
                  <td className="py-2 pr-4">{rule.comment}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      onClick={() =>
                        setDraft({
                          id: rule.id,
                          descriptor: rule.descriptor,
                          points: rule.points != null ? String(rule.points) : "",
                          comment: rule.comment,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ml-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (window.confirm("Delete this comment rule?")) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
            {(rules ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-muted-foreground">
                  No rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SchoolDashboard({ me, isTeacher }: { me: any; isTeacher: boolean }) {
  const queryClient = useQueryClient();
  const isSuper = false;
  const schoolId = me?.profile?.school_id ?? null;
  const isDos = hasAny(me?.roles, ["dos", "head_teacher", "deputy_head_teacher"]);
  const isHeadTeacher = hasAny(me?.roles, ["head_teacher"]);
  const isDeputyHead = hasAny(me?.roles, ["deputy_head_teacher"]);
  const isDirectorOfStudies = hasAny(me?.roles, ["dos"]);
  const isChartsOnlyRole = hasAny(me?.roles, [
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "dos",
  ]);
  const isHod = hasAny(me?.roles, ["hod"]);
  const canSeeActivity = hasAny(me?.roles, ["school_admin", "head_teacher", "deputy_head_teacher", "dos"]);
  const canApprove = hasAny(me?.roles, [
    "dos",
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
  ]);
  const canEditHeadComments = hasAny(me?.roles, [
    "head_teacher",
    "deputy_head_teacher",
    "dos",
    "school_admin",
  ]);
  const { data: moduleMap } = useQuery({
    queryKey: ["enabled-modules", schoolId],
    enabled: !!schoolId,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => getEnabledModuleMap(supabase, schoolId),
  });
  const moduleToggleMutation = useMutation({
    mutationFn: async (vars: { module: string; enabled: boolean }) => {
      if (!canManageSchoolModules(me?.roles)) {
        throw new Error("Only DOS, Head Teacher, and Deputy Head Teacher can change school modules");
      }
      if (!schoolId) throw new Error("No school linked to your account");
      const { data: existing, error: selectError } = await supabase
        .from("feature_toggles")
        .select("id")
        .eq("school_id", schoolId)
        .eq("module", vars.module)
        .maybeSingle();
      if (selectError) throw new Error(selectError.message);

      if (existing?.id) {
        const { error } = await supabase
          .from("feature_toggles")
          .update({ enabled: vars.enabled })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return;
      }

      const { error } = await supabase.from("feature_toggles").insert({
        school_id: schoolId,
        module: vars.module,
        enabled: vars.enabled,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enabled-modules", schoolId] });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", schoolId, false, isTeacher, me?.userId],
      });
      toast.success("Module setting updated");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const approveStudent = useServerFn(verifyStudent);
  const reviewMarks = useServerFn(reviewAssessments);
  const updateAssessmentStatusFn = useServerFn(updateAssessmentStatus);
  const [reviewClassId, setReviewClassId] = useState("");
  const [reviewStreamId, setReviewStreamId] = useState("");
  const [dashboardTab, setDashboardTab] = useState<"overview" | "requests">("overview");
  const { data, isLoading, error, refetch } = useDashboardData(
    schoolId,
    isSuper,
    isTeacher,
    me?.userId,
    isHod,
    me?.profile?.department_id,
    isChartsOnlyRole,
  );
  const reportCardsEnabled = moduleMap?.get("report_cards") ?? true;
  const coCurricularEnabled = moduleMap?.get("co_curricular") ?? true;
  const timetableEnabled = moduleMap?.get("timetable") ?? true;
  const attendanceEnabled = moduleMap?.get("attendance") ?? true;
  const classById = new Map<string, string>(
    (data?.classes ?? []).map((item) => [item.id, item.name]),
  );
  const streamById = new Map<string, { name: string; class_id: string | null }>(
    (data?.streams ?? []).map((item) => [
      item.id,
      { name: item.name, class_id: item.class_id },
    ]),
  );
  // Reuse indexed lookups below. The dashboard can contain thousands of
  // assessments, so repeated Array.find calls become noticeable on every
  // filter or status change.
  const studentById = new Map<string, DashboardStudentRow>(
    (data?.students ?? []).map((item) => [item.id, item]),
  );
  const subjectById = new Map<string, { id: string; name: string }>(
    (data?.subjects ?? []).map((item) => [item.id, item]),
  );
  const termById = new Map<string, { id: string; name: string; is_current: boolean }>(
    (data?.terms ?? []).map((item) => [item.id, item]),
  );
  const { data: timetableSummary } = useQuery({
    queryKey: ["dashboard-timetable", schoolId],
    enabled: !!schoolId && isDos && !isChartsOnlyRole && timetableEnabled && !!data,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const [entries, allocations] = await Promise.all([
        supabase
          .from("timetable_entries")
          .select("id, teacher_id, class_id, stream_id, subject_id, is_published, school_id")
          .eq("school_id", schoolId!)
          .limit(2000),
        supabase
          .from("teacher_allocations")
          .select("id, teacher_id, class_id, stream_id, subject_id, school_id")
          .eq("school_id", schoolId!)
          .limit(2000),
      ]);
      return {
        entries: entries.data ?? [],
        allocations: allocations.data ?? [],
      };
    },
  });
  const currentTerm = data?.terms.find((term) => term.is_current) ?? null;
  const { data: leadershipAttendance } = useQuery({
    queryKey: ["leadership-attendance", schoolId, currentTerm?.id],
    enabled: !!schoolId && isChartsOnlyRole && attendanceEnabled && !!currentTerm?.id,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const [summaries, records] = await Promise.all([
        supabase
          .from("attendance_summaries")
          .select("student_id, days_present, days_absent, total_days")
          .eq("school_id", schoolId!)
          .eq("term_id", currentTerm!.id)
          .limit(3000),
        supabase
          .from("attendance_records")
          .select("student_id, status, attendance_date")
          .eq("school_id", schoolId!)
          .eq("term_id", currentTerm!.id)
          .order("attendance_date", { ascending: true })
          .limit(5000),
      ]);
      if (summaries.error) throw new Error(summaries.error.message);
      if (records.error) throw new Error(records.error.message);
      return { summaries: summaries.data ?? [], records: records.data ?? [] };
    },
  });
  const approveMutation = useMutation({
    mutationFn: (studentId: string) => approveStudent({ data: { studentId } }),
    onSuccess: () => {
      toast.success("Learner approved");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const updateStatus = useMutation({
    mutationFn: (data: {
      assessmentId: string;
      status: "draft" | "submitted" | "approved" | "rejected";
      reason?: string | null;
    }) => updateAssessmentStatusFn({ data }),
    onSuccess: () => {
      toast.success("Assessment status updated");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
    const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const submittedIds = reviewedAssessments
        .filter((assessment) => assessment.status === "submitted")
        .map((assessment) => assessment.id);
      if (!submittedIds.length) {
        throw new Error("No submitted marks found to approve");
      }
      return reviewMarks({
        data: {
          ids: submittedIds,
          action: "approve",
          classId: reviewClassId || null,
          streamId: reviewStreamId || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Submitted marks approved");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  if (isLoading)
    return (
      <DashboardChartFallback height={280} />
    );

  if (error || !data) {
    return (
      <DashboardDataError
        message={error instanceof Error ? error.message : "School analytics are unavailable."}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isTeacher) {
    return <TeacherDashboard data={data} me={me} />;
  }

  const totals: number[] = [];
  const subjectStats = new Map<string, { total: number; count: number }>();
  let approved = 0;
  let rejected = 0;
  let submitted = 0;
  let draft = 0;
  for (const assessment of data.assessments) {
    const total = Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0);
    totals.push(total);
    const current = subjectStats.get(assessment.subject_id) ?? { total: 0, count: 0 };
    current.total += total;
    current.count += 1;
    subjectStats.set(assessment.subject_id, current);
    if (assessment.status === "approved") approved += 1;
    if (assessment.status === "rejected") rejected += 1;
    if (assessment.status === "submitted") submitted += 1;
    if (assessment.status === "draft") draft += 1;
  }
  const average = totals.length ? totals.reduce((x, y) => x + y, 0) / totals.length : 0;

  const subjectPerformance = data.subjects
    .filter((subject) => subjectStats.has(subject.id))
    .map((subject) => {
      const stats = subjectStats.get(subject.id);
      const average = stats ? stats.total / stats.count : 0;
      return {
        name: subject.name.length > 12 ? `${subject.name.slice(0, 12)}...` : subject.name,
        average: Math.round(average * 10) / 10,
      };
    });

  const gradeCounts = [0, 0, 0, 0, 0];
  for (const total of totals) {
    if (total >= 80) gradeCounts[0] += 1;
    else if (total >= 70) gradeCounts[1] += 1;
    else if (total >= 60) gradeCounts[2] += 1;
    else if (total >= 45) gradeCounts[3] += 1;
    else gradeCounts[4] += 1;
  }
  const gradeBuckets = ["80+", "70-79", "60-69", "45-59", "Below 45"]
    .map((name, index) => ({ name, value: gradeCounts[index] }))
    .filter((bucket) => bucket.value > 0);

  const genderCounts = new Map<string, number>();
  for (const student of data.students) {
    const label = student.gender?.trim() || "Not recorded";
    genderCounts.set(label, (genderCounts.get(label) ?? 0) + 1);
  }
  const genderSplit = [...genderCounts].map(([name, value]) => ({ name, value }));

  const completion = data.assessments.length
    ? Math.round((approved / data.assessments.length) * 100)
    : 0;
  const pendingStudents = data.students.filter((student) => student.status === "pending");
  const assessmentsTable = data.assessments.map((assessment) => ({
    ...assessment,
    studentName: studentById.get(assessment.student_id)?.full_name ?? "Unknown",
    subjectName: subjectById.get(assessment.subject_id)?.name ?? "Unknown",
    termName: termById.get(assessment.term_id)?.name ?? "Unknown",
    gradeDescriptor: assessment.grade_descriptor ?? "Unknown",
    total: Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0),
  }));
  const reviewClassOptions = data.classes ?? [];
  const reviewStreamOptions = (data.streams ?? []).filter(
    (stream) => !reviewClassId || stream.class_id === reviewClassId,
  );
  const reviewedAssessments = assessmentsTable.filter((assessment) => {
    const student = studentById.get(assessment.student_id);
    if (!student) return false;
    if (reviewClassId && student.class_id !== reviewClassId) return false;
    if (reviewStreamId && student.stream_id !== reviewStreamId) return false;
    return true;
  });
  const visibleAssessments = reviewedAssessments;

  const trend = [...data.terms]
    .sort((left, right) => (left.start_date ?? "").localeCompare(right.start_date ?? ""))
    .filter((term) => data.assessments.some((assessment) => assessment.term_id === term.id))
    .slice(-8)
    .map((term) => {
      const termScores = data.assessments
        .filter((assessment) => assessment.term_id === term.id)
        .map((assessment) => Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0));
      return {
        term: term.name,
        average: termScores.length
          ? Math.round((termScores.reduce((sum, score) => sum + score, 0) / termScores.length) * 10) / 10
          : 0,
      };
    });
  const trendTerms = [...data.terms]
    .sort((left, right) => (left.start_date ?? "").localeCompare(right.start_date ?? ""))
    .filter((term) => data.assessments.some((assessment) => assessment.term_id === term.id))
    .slice(-8);
  const assessmentStatusByTerm = trendTerms.map((term) => {
    const termAssessments = data.assessments.filter((assessment) => assessment.term_id === term.id);
    return {
      term: term.name,
      approved: termAssessments.filter((assessment) => assessment.status === "approved").length,
      submitted: termAssessments.filter((assessment) => assessment.status === "submitted").length,
      rejected: termAssessments.filter((assessment) => assessment.status === "rejected").length,
    };
  });
  const classPerformanceSeries = data.classes
    .map((schoolClass) => {
      const studentIds = new Set(
        data.students
          .filter((student) => student.class_id === schoolClass.id)
          .map((student) => student.id),
      );
      const assessmentCount = data.assessments.filter((assessment) =>
        studentIds.has(assessment.student_id),
      ).length;
      return { key: `class_${schoolClass.id}`, name: schoolClass.name, studentIds, assessmentCount };
    })
    .filter((schoolClass) => schoolClass.assessmentCount > 0)
    .sort((left, right) => right.assessmentCount - left.assessmentCount)
    .slice(0, 5);
  const classPerformanceByTerm = trendTerms.map((term) => {
    const point: Record<string, string | number | null> = { term: term.name };
    for (const schoolClass of classPerformanceSeries) {
      const scores = data.assessments
        .filter(
          (assessment) =>
            assessment.term_id === term.id &&
            schoolClass.studentIds.has(assessment.student_id),
        )
        .map((assessment) => Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0));
      point[schoolClass.key] = scores.length
        ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
        : null;
    }
    return point;
  });
  const classPerformance = data.classes.map((item) => {
    const classStudentIds = new Set(data.students.filter((student) => student.class_id === item.id).map((student) => student.id));
    const classScores = data.assessments
      .filter((assessment) => classStudentIds.has(assessment.student_id))
      .map((assessment) => Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0));
    return {
      name: item.name,
      average: classScores.length ? Math.round((classScores.reduce((sum, score) => sum + score, 0) / classScores.length) * 10) / 10 : 0,
      assessmentCount: classScores.length,
    };
  }).filter((item) => item.assessmentCount > 0).map(({ name, average }) => ({ name, average }));
  const studentStatus = [...new Set(data.students.map((student) => student.status))]
    .map((status) => ({ name: status.charAt(0).toUpperCase() + status.slice(1), value: data.students.filter((student) => student.status === status).length }))
    .filter((item) => item.value > 0);
  const summaryByStudent = new Map(
    (leadershipAttendance?.summaries ?? []).map((summary) => [summary.student_id, summary]),
  );
  const dailyByStudent = new Map<string, { present: number; absent: number }>();
  const dailyByDate = new Map<string, { present: number; absent: number }>();
  for (const record of leadershipAttendance?.records ?? []) {
    const status = record.status === "absent" ? "absent" : "present";
    const studentTotals = dailyByStudent.get(record.student_id) ?? { present: 0, absent: 0 };
    studentTotals[status] += 1;
    dailyByStudent.set(record.student_id, studentTotals);
    const dateTotals = dailyByDate.get(record.attendance_date) ?? { present: 0, absent: 0 };
    dateTotals[status] += 1;
    dailyByDate.set(record.attendance_date, dateTotals);
  }
  const attendanceTotals = data.students.reduce(
    (totals, student) => {
      const summary = summaryByStudent.get(student.id);
      const daily = dailyByStudent.get(student.id) ?? { present: 0, absent: 0 };
      const present = Number(summary?.days_present ?? daily.present);
      const absent = Number(summary?.days_absent ?? daily.absent);
      return {
        present: totals.present + present,
        absent: totals.absent + absent,
        total: totals.total + Number(summary?.total_days ?? present + absent),
      };
    },
    { present: 0, absent: 0, total: 0 },
  );
  const attendanceRate = attendanceTotals.total
    ? (attendanceTotals.present / attendanceTotals.total) * 100
    : 0;
  const attendanceByClass = data.classes
    .map((schoolClass) => {
      const classStudents = data.students.filter((student) => student.class_id === schoolClass.id);
      const totals = classStudents.reduce(
        (result, student) => {
          const summary = summaryByStudent.get(student.id);
          const daily = dailyByStudent.get(student.id) ?? { present: 0, absent: 0 };
          const present = Number(summary?.days_present ?? daily.present);
          const absent = Number(summary?.days_absent ?? daily.absent);
          return {
            present: result.present + present,
            absent: result.absent + absent,
            total: result.total + Number(summary?.total_days ?? present + absent),
          };
        },
        { present: 0, absent: 0, total: 0 },
      );
      return {
        name: schoolClass.name,
        present: totals.total ? Math.round((totals.present / totals.total) * 1000) / 10 : 0,
        absent: totals.total ? Math.round((totals.absent / totals.total) * 1000) / 10 : 0,
        rate: totals.total ? Math.round((totals.present / totals.total) * 1000) / 10 : 0,
      };
    })
    .filter((row) => row.rate > 0 || row.absent > 0);
  const attendanceTrend = [...dailyByDate]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-14)
    .map(([date, totals]) => {
      const count = totals.present + totals.absent;
      return {
        date: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        present: count ? Math.round((totals.present / count) * 1000) / 10 : 0,
        absent: count ? Math.round((totals.absent / count) * 1000) / 10 : 0,
      };
    });
  const leadershipLineCharts = {
    performanceByTerm: trend,
    attendanceByDate: attendanceTrend.map(({ date, present }) => ({ date, rate: present })),
    assessmentStatusByTerm,
    classPerformanceByTerm,
    classPerformanceSeries: classPerformanceSeries.map(({ key, name }) => ({ key, name })),
  };
  const learnersBelowAttendanceTarget = data.students.filter((student) => {
    const summary = summaryByStudent.get(student.id);
    const daily = dailyByStudent.get(student.id) ?? { present: 0, absent: 0 };
    const present = Number(summary?.days_present ?? daily.present);
    const absent = Number(summary?.days_absent ?? daily.absent);
    const total = Number(summary?.total_days ?? present + absent);
    return total > 0 && (present / total) * 100 < 80;
  }).length;
  const resolveClassName = (classId: string | null | undefined) =>
    classId ? (classById.get(classId) ?? "Unknown") : "Unknown";
  const resolveStreamName = (streamId: string | null | undefined) =>
    streamId ? (streamById.get(streamId)?.name ?? "Unknown") : "Unknown";
  const moduleOptions = [
    { key: "academics", label: "Academics" },
    { key: "attendance", label: "Attendance" },
    { key: "library", label: "Library" },
    { key: "report_cards", label: "Report cards" },
    { key: "co_curricular", label: "Co-curricular" },
    { key: "students", label: "Students" },
    { key: "timetable", label: "Timetable" },
    { key: "fees", label: "Fees" },
  ] as const;
  const learnerDistributionByClass = data.classes
    .map((cls) => {
      const classStudents = data.students.filter((student) => student.class_id === cls.id);
      return {
        name: cls.name,
        students: classStudents.length,
        active: classStudents.filter((student) => student.status === "active").length,
      };
    })
    .filter((item) => item.students > 0);
  const learnerDistributionByStream = data.streams
    .map((stream) => {
      const streamStudents = data.students.filter((student) => student.stream_id === stream.id);
      const className = stream.class_id ? classById.get(stream.class_id) : null;
      return {
        name: className ? `${stream.name} (${className})` : stream.name,
        students: streamStudents.length,
      };
    })
    .filter((item) => item.students > 0);

  if (isChartsOnlyRole) {
    return (
      <Suspense fallback={<DashboardChartFallback height={280} />}>
        <DashboardCharts
          kind="school"
          subjectPerformance={subjectPerformance}
          gradeBuckets={gradeBuckets}
          trend={trend}
          genderSplit={genderSplit}
          statusBreakdown={[
            { name: "Approved", value: approved },
            { name: "Submitted", value: submitted },
            { name: "Rejected", value: rejected },
            { name: "Draft", value: draft },
          ].filter((bucket) => bucket.value > 0)}
          studentStatus={studentStatus}
          classPerformance={classPerformance}
          leadershipLineCharts={leadershipLineCharts}
          classDistribution={learnerDistributionByClass}
          streamDistribution={learnerDistributionByStream}
          attendanceByClass={isChartsOnlyRole && attendanceEnabled ? attendanceByClass : undefined}
          attendanceTrend={isChartsOnlyRole && attendanceEnabled ? attendanceTrend : undefined}
        />
      </Suspense>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Home"
        title={isDirectorOfStudies ? "Director of Studies dashboard" : isHeadTeacher ? "Head teacher dashboard" : isDeputyHead ? "Deputy head teacher dashboard" : "School dashboard"}
        description={isDos ? "School-wide academic, attendance and learner progress at a glance." : "Performance, approvals and learner status for your school."}
        actions={
          <Link
            to="/assessments"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:brightness-95"
          >
            Open assessments
          </Link>
        }
      />

      {isHod && (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Dashboard sections">
          {([
            ["overview", "Overview"],
            ["requests", "My department requests"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDashboardTab(tab)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                dashboardTab === tab
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      <div className={!isHod || dashboardTab === "overview" ? "space-y-4" : "hidden"}>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Learners"
          value={data.students.length}
          hint={`${data.students.filter((s) => s.status === "active").length} active · ${pendingStudents.length} awaiting verification`}
        />
        <Stat label="Classes" value={data.classes.length} />
        <Stat label="Streams" value={data.streams.length} />
        <Stat label="Subjects" value={data.subjects.length} />
        <Stat label="Staff accounts" value={data.profiles.length} />
        <Stat label="Average achievement" value={`${average.toFixed(1)}%`} />
        <Stat
          label="Pending approvals"
          value={submitted}
          hint={`${rejected} returned, ${draft} drafts`}
        />
        <Stat label="Approved assessments" value={approved} />
        <Stat label="Assessment completion" value={`${completion}%`} />
        {isDos && attendanceEnabled && (
          <Stat
            label={`Attendance${currentTerm ? ` · ${currentTerm.name}` : ""}`}
            value={currentTerm ? `${attendanceRate.toFixed(1)}%` : "No current term"}
            hint={`${attendanceTotals.present} present days · ${attendanceTotals.absent} absent days`}
          />
        )}
        {isDeputyHead && attendanceEnabled && (
          <Stat label="Learners below 80% attendance" value={learnersBelowAttendanceTarget} hint="Current term follow-up" />
        )}
      </div>

      {canManageSchoolModules(me?.roles) && (
        <Panel title="Module controls" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Turn school modules on or off from the dashboard. Disabled modules disappear from staff
            navigation, route guards, and report output.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {moduleOptions.map((module) => {
              const enabled = moduleMap?.get(module.key) ?? true;
              return (
                <label
                  key={module.key}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <span className="text-sm font-medium">{module.label}</span>
                  <input
                    id={`module-${module.key}`}
                    name="module-toggle"
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      moduleToggleMutation.mutate({
                        module: module.key,
                        enabled: e.target.checked,
                      })
                    }
                    disabled={moduleToggleMutation.isPending}
                  />
                </label>
              );
            })}
          </div>
        </Panel>
      )}

      {isDos && timetableEnabled && (
        <Panel title="Timetable snapshot" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Allocations" value={timetableSummary?.allocations.length ?? 0} />
            <Stat label="Lessons" value={timetableSummary?.entries.length ?? 0} />
            <Stat
              label="Published"
              value={timetableSummary?.entries.filter((entry) => entry.is_published).length ?? 0}
            />
            <Stat
              label="Draft"
              value={
                timetableSummary
                  ? timetableSummary.entries.filter((entry) => !entry.is_published).length
                  : 0
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/timetable"
              className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground"
            >
              Open timetable builder
            </Link>
            <Link
              to="/academics"
              className="rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted"
            >
              Review teaching allocations
            </Link>
          </div>
        </Panel>
      )}

      {canApprove && (
        <Panel title="Needs your approval" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Learner admissions</h3>
            <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
              {pendingStudents.length} pending
            </span>
          </div>
          {pendingStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No learner admissions are waiting for verification.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingStudents.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span>{student.full_name ?? "Unnamed learner"}</span>
                  <div className="flex items-center gap-2">
                    <Link to="/students" className="text-sm font-medium text-accent">
                      Review
                    </Link>
                    <button
                      type="button"
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
                      onClick={() => approveMutation.mutate(student.id)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {isDos && (
        <Panel title="Director of Studies approval" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Class">
              <select
                className={inputClass}
                value={reviewClassId}
                onChange={(event) => {
                  setReviewClassId(event.target.value);
                  setReviewStreamId("");
                }}
              >
                <option value="">All classes</option>
                {reviewClassOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stream">
              <select
                className={inputClass}
                value={reviewStreamId}
                onChange={(event) => setReviewStreamId(event.target.value)}
              >
                <option value="">All streams</option>
                {reviewStreamOptions.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Review all marks in the selected scope. Submitted marks can be approved, while drafts,
            rejected, and approved marks remain visible for oversight.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Btn
              variant="accent"
              onClick={() => bulkApproveMutation.mutate()}
              disabled={
                bulkApproveMutation.isPending ||
                !reviewedAssessments.some((assessment) => assessment.status === "submitted")
              }
            >
              {bulkApproveMutation.isPending
                ? "Approving..."
                : "Approve all submitted marks"}
            </Btn>
            <span className="text-sm text-muted-foreground">
              Draft marks must first be submitted by their teachers before they can be approved.
            </span>
          </div>
          <div className="mt-4">
            {visibleAssessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No student marks are available.</p>
            ) : (
              <ResponsiveTable
                desktop={
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">Learner</th>
                        <th className="pb-2">Class</th>
                        <th className="pb-2">Stream</th>
                        <th className="pb-2">Subject</th>
                        <th className="pb-2">Term</th>
                        <th className="pb-2">Grade descriptor</th>
                        <th className="pb-2">Formative</th>
                        <th className="pb-2">Summative</th>
                        <th className="pb-2">Total</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAssessments.map((assessment) => (
                        <tr key={assessment.id} className="border-t border-border">
                          <td className="py-2 pr-4 font-medium">{assessment.studentName}</td>
                          <td className="py-2 pr-4">
                            {resolveClassName(
                              studentById.get(assessment.student_id)?.class_id ?? null,
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {resolveStreamName(
                              studentById.get(assessment.student_id)?.stream_id ?? null,
                            )}
                          </td>
                          <td className="py-2 pr-4">{assessment.subjectName}</td>
                          <td className="py-2 pr-4">{assessment.termName}</td>
                          <td className="py-2 pr-4">{assessment.gradeDescriptor}</td>
                          <td className="py-2 pr-4">{Number(assessment.formative ?? 0)}</td>
                          <td className="py-2 pr-4">{Number(assessment.summative ?? 0)}</td>
                          <td className="py-2 pr-4 font-semibold">{assessment.total}</td>
                          <td className="py-2 pr-4">
                            <Pill tone="warning">{assessment.status}</Pill>
                          </td>
                          <td className="py-2 text-right">
                            <select
                              className={inputClass}
                              value={assessment.status}
                              onChange={(event) => {
                                const nextStatus = event.target.value as
                                  "draft" | "submitted" | "approved" | "rejected";
                                if (nextStatus === assessment.status) return;
                                updateStatus.mutate({
                                  assessmentId: assessment.id,
                                  status: nextStatus,
                                  reason:
                                    nextStatus === "rejected"
                                      ? "Returned for correction"
                                      : undefined,
                                });
                              }}
                              disabled={updateStatus.isPending}
                            >
                              <option value="draft">Draft</option>
                              <option value="submitted">Submitted</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                mobile={
                  <>
                    {visibleAssessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{assessment.studentName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {assessment.subjectName} · {assessment.termName}
                            </p>
                          </div>
                          <Pill tone="warning">{assessment.status}</Pill>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-xl bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground">Class</p>
                            <p className="mt-1 font-medium">
                              {resolveClassName(
                                studentById.get(assessment.student_id)?.class_id ?? null,
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground">Stream</p>
                            <p className="mt-1 font-medium">
                              {resolveStreamName(
                                studentById.get(assessment.student_id)?.stream_id ?? null,
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="mt-1 font-medium">{assessment.total}</p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground">Grade</p>
                            <p className="mt-1 font-medium">{assessment.gradeDescriptor}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <select
                            className={inputClass}
                            value={assessment.status}
                            onChange={(event) => {
                              const nextStatus = event.target.value as
                                "draft" | "submitted" | "approved" | "rejected";
                              if (nextStatus === assessment.status) return;
                              updateStatus.mutate({
                                assessmentId: assessment.id,
                                status: nextStatus,
                                reason:
                                  nextStatus === "rejected" ? "Returned for correction" : undefined,
                              });
                            }}
                            disabled={updateStatus.isPending}
                          >
                            <option value="draft">Draft</option>
                            <option value="submitted">Submitted</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </>
                }
              />
            )}
          </div>
        </Panel>
      )}

      {canEditHeadComments && reportCardsEnabled && (
        <CommentEditorPanel
          commentRole="head_teacher"
          schoolId={me?.profile?.school_id ?? null}
          title="Head teacher comment rules"
          description="These comments are applied automatically from the learner's overall descriptor."
        />
      )}

      <Suspense fallback={<DashboardChartFallback height={280} />}>
        <DashboardCharts
          kind="school"
          subjectPerformance={subjectPerformance}
          gradeBuckets={gradeBuckets}
          trend={trend}
          genderSplit={genderSplit}
          statusBreakdown={[
            { name: "Approved", value: approved },
            { name: "Submitted", value: submitted },
            { name: "Rejected", value: rejected },
            { name: "Draft", value: draft },
          ].filter((b) => b.value > 0)}
          studentStatus={studentStatus}
          classPerformance={classPerformance}
          leadershipLineCharts={leadershipLineCharts}
          classDistribution={learnerDistributionByClass}
          streamDistribution={learnerDistributionByStream}
          attendanceByClass={isDos && attendanceEnabled ? attendanceByClass : undefined}
          attendanceTrend={isDos && attendanceEnabled ? attendanceTrend : undefined}
        />
      </Suspense>

      {canSeeActivity && coCurricularEnabled && (
        <Panel title="Recent activity" className="mt-4">
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.activity.map((item, index) => (
                <li
                  key={index}
                  className="flex justify-between gap-4 border-b border-border pb-2 last:border-none"
                >
                  <span>
                    <span className="font-medium">{item.user_name ?? "System"}</span> -{item.action}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      </div>

      {isHod && (
        <div className={dashboardTab === "requests" ? "space-y-4" : "hidden"}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Department requests" value={data.purchaseRequests.length} />
            <Stat
              label="Pending review"
              value={data.purchaseRequests.filter((request: any) =>
                ["pending", "submitted"].includes(request.approval_status ?? request.status),
              ).length}
            />
            <Stat
              label="Approved value"
              value={data.purchaseRequests
                .filter((request: any) => request.approval_status === "approved")
                .reduce((sum: number, request: any) => sum + Number(request.approved_amount ?? request.requested_amount ?? 0), 0)
                .toLocaleString()}
            />
          </div>

          <Panel title="My department purchase requests">
            {data.purchaseRequests.length === 0 ? (
              <EmptyDashboardState
                title="No department requests yet"
                description="Requests raised by your department will appear here for tracking."
              />
            ) : (
              <div className="space-y-3">
                {data.purchaseRequests.map((request: any) => (
                  <div
                    key={request.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{request.item_description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.request_number} · {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium">
                        {Number(request.requested_amount ?? 0).toLocaleString()}
                      </span>
                      <Pill
                        tone={
                          request.approval_status === "approved"
                            ? "success"
                            : request.approval_status === "rejected"
                              ? "danger"
                              : "muted"
                        }
                      >
                        {request.approval_status ?? request.status ?? "pending"}
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link
                to="/finance"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Open finance workspace
              </Link>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
