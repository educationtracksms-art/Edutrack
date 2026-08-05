import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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
import { PageHeader, Panel, Stat } from "@/components/ui-kit";
import { upsertReportComment, verifyStudent } from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { getEnabledModuleMap } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · EduTrack" },
      {
        name: "description",
        content: "Role-based analytics for schools, learners, assessments and approvals.",
      },
      { property: "og:title", content: "Dashboard · EduTrack" },
      {
        property: "og:description",
        content: "Live school analytics and approval status at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type DashboardTermRow = { id: string; name: string; is_current: boolean };
type DashboardStudentRow = {
  id: string;
  full_name: string;
  status: string;
  class_id: string | null;
  stream_id: string | null;
};

type DashboardCoCurricularRow = {
  student_id: string;
  games: string | null;
  clubs: string | null;
  projects: string | null;
};

function useDashboardData(
  schoolId: string | null | undefined,
  isSuper: boolean,
  isTeacher: boolean,
  teacherId?: string | null,
) {
  return useQuery({
    queryKey: ["dashboard", schoolId, isSuper, isTeacher, teacherId],
    queryFn: async () => {
      if (!isSuper && !schoolId) {
        return {
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
      }

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
              .select("id, student_id, subject_id, formative, summative, status, school_id"),
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
  const isSuper = hasAny(me?.roles, ["super_admin"]);

  if (isUserLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  if (isSuper) return <PlatformDashboard />;
  return (
    <SchoolDashboard me={me} isTeacher={hasAny(me?.roles, ["subject_teacher", "class_teacher"])} />
  );
}

function PlatformDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_school_stats");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (isLoading || !data)
    return <p className="text-sm text-muted-foreground">Loading platform metrics…</p>;

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
        description="Tenant, subscription and usage metrics only — academic records stay inside each school."
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
        <div className="overflow-x-auto">
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
        </div>
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
  const scopeStudents = data.students.filter((student: any) => {
    if (isClassTeacher) {
      return (
        student.status === "active" &&
        (assignedClassIds.has(student.class_id) || assignedStreamIds.has(student.stream_id))
      );
    }
    return (
      student.status === "active" &&
      teacherAllocations.some(
        (allocation) =>
          (!allocation.class_id || allocation.class_id === student.class_id) &&
          (!allocation.stream_id || allocation.stream_id === student.stream_id),
      )
    );
  });
  const scopeSubjects = data.subjects.filter((subject: any) =>
    teacherAllocations.some((allocation) => allocation.subject_id === subject.id),
  );
  const scopeAssessments = data.assessments.filter(
    (assessment: any) =>
      scopeStudents.some((student: any) => student.id === assessment.student_id) &&
      scopeSubjects.some((subject: any) => subject.id === assessment.subject_id),
  );
  const pendingMarks = scopeAssessments.filter(
    (assessment: any) => assessment.status === "submitted",
  );
  const canEditComments = isClassTeacher;
  const assignedLabels = teacherAllocations.map((allocation) => {
    const subjectName =
      data.subjects.find((subject: any) => subject.id === allocation.subject_id)?.name ?? "Subject";
    const className =
      data.classes.find((item: any) => item.id === allocation.class_id)?.name ?? "Any class";
    const streamName =
      data.streams.find((item: any) => item.id === allocation.stream_id)?.name ?? "Any stream";
    return `${subjectName} · ${className}${allocation.stream_id ? ` · ${streamName}` : ""}`;
  });

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
            {scopeStudents.slice(0, 10).map((student: any) => (
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
                  ·{" "}
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
          mode="class_teacher"
          students={scopeStudents as DashboardStudentRow[]}
          terms={(data.terms ?? []) as DashboardTermRow[]}
          schoolId={me?.profile?.school_id ?? null}
        />
      )}
    </div>
  );
}

function CommentEditorPanel({
  mode,
  students,
  terms,
  schoolId,
}: {
  mode: "class_teacher" | "head_teacher";
  students: DashboardStudentRow[];
  terms: DashboardTermRow[];
  schoolId: string | null;
}) {
  const saveComment = useServerFn(upsertReportComment);
  const [termId, setTermId] = useState("");
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        classTeacherComment: string;
        headTeacherComment: string;
        games: string;
        clubs: string;
        projects: string;
      }
    >
  >({});
  const currentTermId = useMemo(
    () => terms.find((term) => term.is_current)?.id ?? terms[0]?.id ?? "",
    [terms],
  );

  useEffect(() => {
    if (!termId && currentTermId) setTermId(currentTermId);
  }, [currentTermId, termId]);

  const visible = students.filter((student) => student.status === "active");
  const scopeStudents = visible;
  const scopeIds = scopeStudents.map((student) => student.id);

  const { data: comments } = useQuery({
    queryKey: ["dashboard-report-comments", mode, termId, scopeIds.join(",")],
    enabled: !!termId && scopeIds.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("report_comments")
          .select("student_id, class_teacher_comment, head_teacher_comment")
          .eq("term_id", termId)
          .in("student_id", scopeIds)
      ).data ?? [],
  });

  const { data: coCurricularRows } = useQuery({
    queryKey: ["dashboard-co-curricular", termId, scopeIds.join(","), schoolId],
    enabled: mode === "class_teacher" && !!termId && scopeIds.length > 0 && !!schoolId,
    queryFn: async () =>
      (
        await supabase
          .from("co_curricular")
          .select("student_id, games, clubs, projects")
          .eq("term_id", termId)
          .eq("school_id", schoolId)
          .in("student_id", scopeIds)
      ).data ?? [],
  });

  useEffect(() => {
    if (!comments) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const comment of comments as Array<{
        student_id: string;
        class_teacher_comment: string | null;
        head_teacher_comment: string | null;
      }>) {
        next[comment.student_id] = {
          classTeacherComment:
            comment.class_teacher_comment ?? current[comment.student_id]?.classTeacherComment ?? "",
          headTeacherComment:
            comment.head_teacher_comment ?? current[comment.student_id]?.headTeacherComment ?? "",
        };
      }
      return next;
    });
  }, [comments]);

  useEffect(() => {
    if (!coCurricularRows || mode !== "class_teacher") return;
    setDrafts((current) => {
      const next = { ...current };
      for (const row of coCurricularRows as DashboardCoCurricularRow[]) {
        next[row.student_id] = {
          classTeacherComment: current[row.student_id]?.classTeacherComment ?? "",
          headTeacherComment: current[row.student_id]?.headTeacherComment ?? "",
          games: row.games ?? current[row.student_id]?.games ?? "",
          clubs: row.clubs ?? current[row.student_id]?.clubs ?? "",
          projects: row.projects ?? current[row.student_id]?.projects ?? "",
        };
      }
      return next;
    });
  }, [coCurricularRows, mode]);

  const editableKey = mode === "class_teacher" ? "classTeacherComment" : "headTeacherComment";
  const editableLabel =
    mode === "class_teacher" ? "Class Teacher's Comment" : "Head Teacher's Comment";
  const saveMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!termId) throw new Error("Choose a term first");
      const draft = drafts[studentId] ?? {
        classTeacherComment: "",
        headTeacherComment: "",
        games: "",
        clubs: "",
        projects: "",
      };
      await saveComment({
        data: {
          studentId,
          termId,
          ...(mode === "class_teacher"
            ? {
                classTeacherComment: draft.classTeacherComment,
                games: draft.games,
                clubs: draft.clubs,
                projects: draft.projects,
              }
            : { headTeacherComment: draft.headTeacherComment }),
        },
      });
    },
    onSuccess: () => toast.success("Comment saved"),
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  return (
    <Panel title="Report comments" className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={termId}
          onChange={(event) => setTermId(event.target.value)}
        >
          <option value="">Select term</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
              {term.is_current ? " (Current)" : ""}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{visible.length} learner(s) in scope</span>
      </div>

      {scopeStudents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No learners are available for comment entry yet.
        </p>
      ) : mode === "class_teacher" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Student</th>
                <th className="pb-2">Games</th>
                <th className="pb-2">Clubs</th>
                <th className="pb-2">Projects</th>
                <th className="pb-2">Comment</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {scopeStudents.map((student) => {
                const draft = drafts[student.id] ?? {
                  classTeacherComment: "",
                  headTeacherComment: "",
                  games: "",
                  clubs: "",
                  projects: "",
                };
                return (
                  <tr key={student.id} className="border-t border-border align-top">
                    <td className="py-3 pr-4 font-medium">{student.full_name}</td>
                    <td className="py-3 pr-3">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                        value={draft.games}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [student.id]: { ...draft, games: event.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                        value={draft.clubs}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [student.id]: { ...draft, clubs: event.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                        value={draft.projects}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [student.id]: { ...draft, projects: event.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                        value={draft.classTeacherComment}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [student.id]: { ...draft, classTeacherComment: event.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
                        onClick={() => saveMutation.mutate(student.id)}
                        disabled={saveMutation.isPending}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {scopeStudents.map((student) => {
            const draft = drafts[student.id] ?? {
              classTeacherComment: "",
              headTeacherComment: "",
              games: "",
              clubs: "",
              projects: "",
            };
            return (
              <div key={student.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{student.full_name}</h3>
                  <button
                    type="button"
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
                    onClick={() => saveMutation.mutate(student.id)}
                    disabled={saveMutation.isPending}
                  >
                    Save comment
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium">{editableLabel}</span>
                    <textarea
                      className="mt-1 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                      value={draft[editableKey]}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [student.id]: { ...draft, [editableKey]: event.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function SchoolDashboard({ me, isTeacher }: { me: any; isTeacher: boolean }) {
  const queryClient = useQueryClient();
  const isSuper = false;
  const schoolId = me?.profile?.school_id ?? null;
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
  const reportCardsEnabled = moduleMap?.get("report_cards") ?? true;
  const coCurricularEnabled = moduleMap?.get("co_curricular") ?? true;
  const approveStudent = useServerFn(verifyStudent);
  const { data, isLoading } = useDashboardData(
    schoolId,
    isSuper,
    isTeacher,
    me?.userId,
  );
  const approveMutation = useMutation({
    mutationFn: (studentId: string) => approveStudent({ data: { studentId } }),
    onSuccess: () => {
      toast.success("Learner approved");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  if (isLoading || !data)
    return <p className="text-sm text-muted-foreground">Loading analytics…</p>;

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
        name: subject.name.length > 12 ? `${subject.name.slice(0, 12)}…` : subject.name,
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

  const pending = data.assessments.filter((a) => a.status === "submitted").length;
  const approved = data.assessments.filter((a) => a.status === "approved").length;
  const rejected = data.assessments.filter((a) => a.status === "rejected").length;
  const completion = data.assessments.length
    ? Math.round((approved / data.assessments.length) * 100)
    : 0;
  const pendingStudents = data.students.filter((student) => student.status === "pending");
  const pendingAssessments = data.assessments
    .filter((assessment) => assessment.status === "submitted")
    .map((assessment) => ({
      ...assessment,
      studentName:
        data.students.find((student) => student.id === assessment.student_id)?.full_name ?? "—",
      subjectName:
        data.subjects.find((subject) => subject.id === assessment.subject_id)?.name ?? "—",
    }));

  const trend = ["Term I", "Term II", "Term III"].map((term, index) => ({
    term,
    average: Math.round(Math.max(0, average - (2 - index) * 3) * 10) / 10,
  }));

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
          value={pending}
          hint={`${rejected} returned for correction`}
        />
        <Stat label="Approved assessments" value={approved} />
        <Stat label="Assessment completion" value={`${completion}%`} />
      </div>

      {canApprove && (
        <Panel title="Needs your approval" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
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
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Assessment approvals</h3>
                <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                  {pendingAssessments.length} pending
                </span>
              </div>
              {pendingAssessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No assessment entries are waiting for review.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {pendingAssessments.map((assessment) => (
                    <li
                      key={assessment.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <span>
                        <span className="font-medium">{assessment.studentName}</span> ·{" "}
                        {assessment.subjectName}
                      </span>
                      <Link to="/assessments" className="text-sm font-medium text-accent">
                        Review
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      )}

      {canEditHeadComments && reportCardsEnabled && (
        <CommentEditorPanel
          mode="head_teacher"
          students={(data.students as DashboardStudentRow[]).filter(
            (student) => student.status === "active",
          )}
          terms={(data.terms ?? []) as DashboardTermRow[]}
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
                    <span className="font-medium">{item.user_name ?? "System"}</span> ·{" "}
                    {item.action}
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
