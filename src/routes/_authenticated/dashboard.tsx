import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";
import {
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
import { getEnabledModuleMap } from "@/lib/modules";

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

const EMPTY_DASHBOARD = {
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
};

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type DashboardStudentRow = {
  id: string;
  full_name: string;
  status: string;
  class_id: string | null;
  stream_id: string | null;
};

function useDashboardData(
  schoolId: string | null | undefined,
  isSuper: boolean,
  isTeacher: boolean,
  teacherId?: string | null,
) {
  return useQuery({
    queryKey: ["dashboard", schoolId, isSuper, isTeacher, teacherId],
    retry: 3,
    queryFn: async () => {
      if (!isSuper && !schoolId) return EMPTY_DASHBOARD;

      const schoolQuery =
        !isSuper && schoolId
          ? (query: any) => query.eq("school_id", schoolId)
          : (query: any) => query;

      const [students, assessments, subjects, classes, streams, terms, teacherAllocations] =
        await Promise.all([
          schoolQuery(
            supabase
              .from("students")
              .select("id, full_name, gender, status, class_id, stream_id, school_id"),
          ),
          schoolQuery(
            supabase
              .from("assessments")
              .select(
                "id, student_id, subject_id, term_id, formative, summative, status, school_id, approved_by, approved_at",
              ),
          ),
          supabase.from("subjects").select("id, name"),
          schoolQuery(supabase.from("classes").select("id, name, class_teacher_id")),
          schoolQuery(supabase.from("streams").select("id, name, class_id, stream_teacher_id")),
          schoolQuery(
            supabase
              .from("terms")
              .select("id, name, is_current")
              .order("start_date", { ascending: false }),
          ),
          isTeacher && teacherId
            ? supabase
                .from("teacher_allocations")
                .select("subject_id, class_id, stream_id")
                .eq("teacher_id", teacherId)
            : Promise.resolve({ data: [] as any[] }),
        ]);

      const [schoolsResult, profilesResult, activityResult] = await Promise.all([
        isTeacher
          ? Promise.resolve({ data: [] as any[] })
          : schoolQuery(supabase.from("schools").select("id, name, status")),
        isTeacher
          ? Promise.resolve({ data: [] as any[] })
          : schoolQuery(supabase.from("profiles").select("id, full_name, school_id")),
        isTeacher
          ? Promise.resolve({ data: [] as any[] })
          : schoolQuery(
              supabase
                .from("audit_logs")
                .select("action, user_name, created_at")
                .order("created_at", { ascending: false })
                .limit(8),
            ),
      ]);
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
      };
    },
  });
}

function Dashboard() {
  const { data: me, isLoading: isUserLoading } = useCurrentUser();
  const dashboardLoading = !me;
  const isSuper = hasAny(me?.roles, ["super_admin"]);

  if (isUserLoading || dashboardLoading) {
    return (
      <DashboardLoadingState
        label="Loading dashboard"
        description="Preparing your account and school data."
      />
    );
  }

  if (isSuper) return <PlatformDashboard />;
  return (
    <SchoolDashboard me={me} isTeacher={hasAny(me?.roles, ["subject_teacher", "class_teacher"])} />
  );
}

function DashboardLoadingState({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-primary/15" />
        <h1 className="mt-4 text-xl font-semibold">{label}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
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
  const { data, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("platform_school_stats");
        if (error) throw new Error(error.message);
        return data ?? [];
      } catch (error) {
        console.error("Platform dashboard failed to load", error);
        return [];
      }
    },
  });

  if (isLoading || !data)
    return (
      <DashboardLoadingState
        label="Loading platform metrics"
        description="Fetching the latest school overview."
      />
    );

  const totalUsers = data.reduce((sum, row) => sum + Number(row.user_count), 0);
  const totalStudents = data.reduce((sum, row) => sum + Number(row.student_count), 0);
  const activeSchools = data.filter((row) => row.status === "active").length;
  const chart = data.map((row) => ({
    name: row.code,
    users: Number(row.user_count),
    students: Number(row.student_count),
  }));

  return (
    <div>
      <PageHeader
        title="Platform overview"
        description="Tenant, subscription and usage metrics only - academic records stay inside each school."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Schools"
          value={data.length}
          hint={`${data.length - activeSchools} suspended`}
        />
        <Stat label="Active schools" value={activeSchools} />
        <Stat label="Staff accounts" value={totalUsers} />
        <Stat label="Enrolled learners" value={totalStudents} />
      </div>

      {data.length === 0 && (
        <div className="mt-4">
          <EmptyDashboardState
            title="No platform data yet"
            description="Schools, staff accounts, and learners will appear here once records are added."
          />
        </div>
      )}

      <Panel title="Usage by school" className="mt-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="students" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="users" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Tenants" className="mt-4">
        <ResponsiveTable
          desktop={
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">School</th>
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Staff</th>
                  <th className="pb-2">Learners</th>
                  <th className="pb-2">Logins (30d)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.school_id} className="border-t border-border">
                    <td className="py-2 font-medium">{row.school_name}</td>
                    <td>{row.code}</td>
                    <td className="capitalize">{row.subscription_plan}</td>
                    <td className="capitalize">{row.status}</td>
                    <td>{Number(row.user_count)}</td>
                    <td>{Number(row.student_count)}</td>
                    <td>{Number(row.logins_30d)}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No schools yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          }
          mobile={
            <>
              {data.map((row) => (
                <div
                  key={row.school_id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.school_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Code: {row.code}</p>
                    </div>
                    <Pill tone={row.status === "active" ? "success" : "muted"}>{row.status}</Pill>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Plan</p>
                      <p className="mt-1 font-medium capitalize">{row.subscription_plan}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Staff</p>
                      <p className="mt-1 font-medium">{Number(row.user_count)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Learners</p>
                      <p className="mt-1 font-medium">{Number(row.student_count)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Logins</p>
                      <p className="mt-1 font-medium">{Number(row.logins_30d)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          }
        />
      </Panel>
    </div>
  );
}

function TeacherDashboard({ data, me }: { data: any; me: any }) {
  const teacherAllocations = data.teacherAllocations as Array<{
    subject_id: string;
    class_id: string | null;
    stream_id: string | null;
  }>;
  const subjectById = new Map(
    (data.subjects ?? []).map((subject: any) => [subject.id, subject.name as string]),
  );
  const classById = new Map(
    (data.classes ?? []).map((item: any) => [item.id, item.name as string]),
  );
  const streamById = new Map(
    (data.streams ?? []).map((item: any) => [
      item.id,
      { name: item.name as string, class_id: item.class_id as string | null },
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
  const canEditComments = isClassTeacher;
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

      {canEditComments && (
        <CommentEditorPanel
          schoolId={me?.profile?.school_id ?? null}
          commentRole="class_teacher"
          title="Class teacher comment rules"
          description="These comments are applied automatically from the learner's overall descriptor."
        />
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
  const [draft, setDraft] = useState({ id: "", descriptor: "Outstanding", comment: "" });
  const { data: rules } = useQuery({
    queryKey: ["dashboard-report-comment-rules", schoolId, commentRole],
    enabled: !!schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("report_comment_rules")
          .select("id, descriptor, comment")
          .eq("school_id", schoolId)
          .eq("comment_role", commentRole)
          .order("descriptor", { ascending: true })
      ).data ?? [],
  });

  useEffect(() => {
    if (!rules) return;
    const first = rules[0] as { id: string; descriptor: string; comment: string } | undefined;
    setDraft((current) => ({
      id: first?.id ?? current.id ?? "",
      descriptor: first?.descriptor ?? current.descriptor,
      comment: first?.comment ?? current.comment,
    }));
  }, [rules]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      saveRule({
        data: {
          id: draft.id || null,
          commentRole,
          descriptor: draft.descriptor,
          comment: draft.comment,
        },
      }),
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
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Descriptor</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={draft.descriptor}
            onChange={(event) => setDraft({ ...draft, descriptor: event.target.value })}
          >
            <option value="Outstanding">Outstanding</option>
            <option value="Modulate">Modulate</option>
            <option value="Basic">Basic</option>
          </select>
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
              <th className="pb-2">Descriptor</th>
              <th className="pb-2">Comment</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).map((rule: { id: string; descriptor: string; comment: string }) => (
              <tr key={rule.id} className="border-t border-border">
                <td className="py-2 pr-4">{rule.descriptor}</td>
                <td className="py-2 pr-4">{rule.comment}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    onClick={() => setDraft(rule)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
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
  const isDos = hasAny(me?.roles, ["dos"]);
  const canSeeActivity = hasAny(me?.roles, ["school_admin", "head_teacher", "deputy_head_teacher"]);
  const canApprove = hasAny(me?.roles, [
    "dos",
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "super_admin",
  ]);
  const canEditHeadComments = hasAny(me?.roles, [
    "head_teacher",
    "deputy_head_teacher",
    "dos",
    "school_admin",
    "super_admin",
  ]);
  const { data: moduleMap } = useQuery({
    queryKey: ["enabled-modules", schoolId],
    enabled: !!schoolId,
    queryFn: async () => getEnabledModuleMap(supabase, schoolId),
  });
  const moduleToggleMutation = useMutation({
    mutationFn: async (vars: { module: string; enabled: boolean }) => {
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
  const updateStatus = useServerFn(updateAssessmentStatus);
  const [reviewClassId, setReviewClassId] = useState("");
  const [reviewStreamId, setReviewStreamId] = useState("");
  const { data, isLoading } = useDashboardData(schoolId, isSuper, isTeacher, me?.userId);
  const reportCardsEnabled = moduleMap?.get("report_cards") ?? true;
  const coCurricularEnabled = moduleMap?.get("co_curricular") ?? true;
  const timetableEnabled = moduleMap?.get("timetable") ?? true;
  const classById = new Map(
    (data?.classes ?? []).map((item: any) => [item.id, item.name as string]),
  );
  const streamById = new Map(
    (data?.streams ?? []).map((item: any) => [
      item.id,
      { name: item.name as string, class_id: item.class_id as string | null },
    ]),
  );
  const { data: timetableSummary } = useQuery({
    queryKey: ["dashboard-timetable", schoolId],
    enabled: !!schoolId && isDos && timetableEnabled,
    queryFn: async () => {
      const [entries, allocations] = await Promise.all([
        supabase
          .from("timetable_entries")
          .select("id, teacher_id, class_id, stream_id, subject_id, is_published, school_id")
          .eq("school_id", schoolId!),
        supabase
          .from("teacher_allocations")
          .select("id, teacher_id, class_id, stream_id, subject_id, school_id")
          .eq("school_id", schoolId!),
      ]);
      return {
        entries: entries.data ?? [],
        allocations: allocations.data ?? [],
      };
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
  const bulkApproveMutation = useMutation({
    mutationFn: async () =>
      reviewMarks({
        data: {
          ids: reviewedAssessments.map((assessment) => assessment.id),
          action: "approve",
          classId: reviewClassId || null,
          streamId: reviewStreamId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Submitted marks approved");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  if (isLoading || !data)
    return (
      <DashboardLoadingState
        label="Loading analytics"
        description="Fetching learners, assessments, and approvals."
      />
    );

  if (isTeacher) {
    return <TeacherDashboard data={data} me={me} />;
  }

  const totals = data.assessments.map((a) => Number(a.formative ?? 0) + Number(a.summative ?? 0));
  const average = totals.length ? totals.reduce((x, y) => x + y, 0) / totals.length : 0;

  const subjectPerformance = data.subjects
    .map((subject) => {
      const marks = data.assessments.filter((a) => a.subject_id === subject.id);
      const scores = marks.map((m) => Number(m.formative ?? 0) + Number(m.summative ?? 0));
      return {
        name: subject.name.length > 12 ? `${subject.name.slice(0, 12)}...` : subject.name,
        average: scores.length
          ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10
          : 0,
      };
    })
    .filter((s) => s.average > 0);

  const gradeBuckets = [
    { name: "80+", value: totals.filter((t) => t >= 80).length },
    { name: "70-79", value: totals.filter((t) => t >= 70 && t < 80).length },
    { name: "60-69", value: totals.filter((t) => t >= 60 && t < 70).length },
    { name: "45-59", value: totals.filter((t) => t >= 45 && t < 60).length },
    { name: "Below 45", value: totals.filter((t) => t < 45).length },
  ].filter((bucket) => bucket.value > 0);

  const genderSplit = [
    { name: "Female", value: data.students.filter((s) => s.gender === "Female").length },
    { name: "Male", value: data.students.filter((s) => s.gender === "Male").length },
  ].filter((g) => g.value > 0);

  const approved = data.assessments.filter((assessment) => assessment.status === "approved").length;
  const rejected = data.assessments.filter((a) => a.status === "rejected").length;
  const submitted = data.assessments.filter((a) => a.status === "submitted").length;
  const draft = data.assessments.filter((a) => a.status === "draft").length;
  const completion = data.assessments.length
    ? Math.round((approved / data.assessments.length) * 100)
    : 0;
  const pendingStudents = data.students.filter((student) => student.status === "pending");
  const assessmentsTable = data.assessments.map((assessment) => ({
    ...assessment,
    studentName:
      data.students.find((student) => student.id === assessment.student_id)?.full_name ?? "Unknown",
    subjectName:
      data.subjects.find((subject) => subject.id === assessment.subject_id)?.name ?? "Unknown",
    termName: data.terms.find((term) => term.id === assessment.term_id)?.name ?? "Unknown",
    gradeDescriptor: assessment.grade_descriptor ?? "Unknown",
    total: Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0),
  }));
  const reviewClassOptions = data.classes ?? [];
  const reviewStreamOptions = (data.streams ?? []).filter(
    (stream) => !reviewClassId || stream.class_id === reviewClassId,
  );
  const reviewedAssessments = assessmentsTable.filter((assessment) => {
    const student = data.students.find((item) => item.id === assessment.student_id);
    if (!student) return false;
    if (reviewClassId && student.class_id !== reviewClassId) return false;
    if (reviewStreamId && student.stream_id !== reviewStreamId) return false;
    return true;
  });
  const visibleAssessments = reviewedAssessments;
  const dosMarkRows = data.assessments
    .map((assessment) => {
      const student = data.students.find((item) => item.id === assessment.student_id);
      const subject = data.subjects.find((item) => item.id === assessment.subject_id);
      const classId = student?.class_id ?? null;
      const className = classId ? classById.get(classId) ?? "Unknown class" : null;
      if (!student || !subject || !className) return null;
      if (reviewClassId && classId !== reviewClassId) return null;
      if (reviewStreamId && student.stream_id !== reviewStreamId) return null;
      return {
        id: assessment.id,
        student_name: student.full_name ?? "Unknown learner",
        class_name: className,
        subject: subject.name ?? "Unknown subject",
        formative: assessment.formative,
        summative: assessment.summative,
        total_marks: Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0),
        status: assessment.status,
      };
    })
    .filter(
      (
        row,
      ): row is {
        id: string;
        student_name: string;
        class_name: string;
        subject: string;
        formative: number | null;
        summative: number | null;
        total_marks: number;
        status: string;
      } => row !== null,
    )
    .sort((left, right) =>
      `${left.class_name} ${left.student_name} ${left.subject}`.localeCompare(
        `${right.class_name} ${right.student_name} ${right.subject}`,
      ),
    );

  const trend = ["Term I", "Term II", "Term III"].map((term, index) => ({
    term,
    average: Math.round(Math.max(0, average - (2 - index) * 3) * 10) / 10,
  }));
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

  return (
    <div>
      <PageHeader
        title="School dashboard"
        description="Performance, approvals and learner status for your school."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Learners"
          value={data.students.length}
          hint={`${data.students.filter((s) => s.status === "pending").length} awaiting verification`}
        />
        <Stat label="Staff accounts" value={data.profiles.length} />
        <Stat label="Average achievement" value={`${average.toFixed(1)}%`} />
        <Stat
          label="Pending approvals"
          value={submitted}
          hint={`${rejected} returned, ${draft} drafts`}
        />
        <Stat label="Approved assessments" value={approved} />
        <Stat label="Assessment completion" value={`${completion}%`} />
      </div>

      <Panel title="Module controls" className="mt-4">
        <p className="text-sm text-muted-foreground">
          Turn school modules on or off from the dashboard. Disabled modules disappear from staff
          navigation and route guards.
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
                              data.students.find((item) => item.id === assessment.student_id)
                                ?.class_id ?? null,
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {resolveStreamName(
                              data.students.find((item) => item.id === assessment.student_id)
                                ?.stream_id ?? null,
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
                                data.students.find((item) => item.id === assessment.student_id)
                                  ?.class_id ?? null,
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground">Stream</p>
                            <p className="mt-1 font-medium">
                              {resolveStreamName(
                                data.students.find((item) => item.id === assessment.student_id)
                                  ?.stream_id ?? null,
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Subject performance">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={subjectPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="average" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Grade distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={gradeBuckets} dataKey="value" nameKey="name" outerRadius={90} label>
                {gradeBuckets.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Performance trend">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="term" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="average"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Gender distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={genderSplit}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                label
              >
                {genderSplit.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

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
  );
}
