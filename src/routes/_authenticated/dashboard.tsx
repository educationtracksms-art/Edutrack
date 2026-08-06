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
import { Field, PageHeader, Panel, Pill, Stat, inputClass } from "@/components/ui-kit";
import {
  reviewAssessments,
  upsertReportComment,
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
      try {
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
      } catch (error) {
        console.error("Dashboard data failed to load", error);
        return EMPTY_DASHBOARD;
      }
    },
  });
}

function Dashboard() {
  const { data: me, isLoading: isUserLoading } = useCurrentUser();
  const isSuper = hasAny(me?.roles, ["super_admin"]);

  if (isUserLoading) {
    return <DashboardLoadingState label="Loading dashboard" description="Preparing your account and school data." />;
  }

  if (isSuper) return <PlatformDashboard />;
  return (
    <SchoolDashboard me={me} isTeacher={hasAny(me?.roles, ["subject_teacher", "class_teacher"])} />
  );
}

function DashboardLoadingState({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
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

function EmptyDashboardState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
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
  const subjectById = new Map(
    (data.subjects ?? []).map((subject: any) => [subject.id, subject.name as string]),
  );
  const classById = new Map((data.classes ?? []).map((item: any) => [item.id, item.name as string]));
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

      const leftSubject = scopeAllocations
        .filter(
          (allocation) =>
            (!allocation.class_id || allocation.class_id === left.class_id) &&
            (!allocation.stream_id || allocation.stream_id === left.stream_id),
        )
        .map((allocation) => subjectById.get(allocation.subject_id) ?? "")
        .filter(Boolean)
        .sort()[0] ?? "";
      const rightSubject = scopeAllocations
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
      ? classById.get(allocation.class_id) ?? "Any class"
      : "Any class";
    const allocationStreamName = allocation.stream_id
      ? streamById.get(allocation.stream_id)?.name ?? "Any stream"
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
  const approveStudent = useServerFn(verifyStudent);
  const reviewMarks = useServerFn(reviewAssessments);
  const updateStatus = useServerFn(updateAssessmentStatus);
  const [reviewClassId, setReviewClassId] = useState("");
  const [reviewStreamId, setReviewStreamId] = useState("");
  const { data, isLoading } = useDashboardData(schoolId, isSuper, isTeacher, me?.userId);
  const reportCardsEnabled = moduleMap?.get("report_cards") ?? true;
  const coCurricularEnabled = moduleMap?.get("co_curricular") ?? true;
  const classById = new Map((data?.classes ?? []).map((item: any) => [item.id, item.name as string]));
  const streamById = new Map(
    (data?.streams ?? []).map((item: any) => [
      item.id,
      { name: item.name as string, class_id: item.class_id as string | null },
    ]),
  );
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

  const approved = data.assessments.filter((a) => a.status === "approved").length;
  const rejected = data.assessments.filter((a) => a.status === "rejected").length;
  const submitted = data.assessments.filter((a) => a.status === "submitted").length;
  const draft = data.assessments.filter((a) => a.status === "draft").length;
  const completion = data.assessments.length
    ? Math.round((approved / data.assessments.length) * 100)
    : 0;
  const pendingStudents = data.students.filter((student) => student.status === "pending");
  const hasSchoolData =
    data.students.length > 0 ||
    data.assessments.length > 0 ||
    data.subjects.length > 0 ||
    data.classes.length > 0 ||
    data.streams.length > 0 ||
    data.activity.length > 0;
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
  const reviewStreamOptions = useMemo(
    () =>
      (data.streams ?? []).filter((stream) => !reviewClassId || stream.class_id === reviewClassId),
    [data.streams, reviewClassId],
  );
  const reviewedAssessments = useMemo(() => {
    return assessmentsTable.filter((assessment) => {
      const student = data.students.find((item) => item.id === assessment.student_id);
      if (!student) return false;
      if (reviewClassId && student.class_id !== reviewClassId) return false;
      if (reviewStreamId && student.stream_id !== reviewStreamId) return false;
      return true;
    });
  }, [assessmentsTable, data.students, reviewClassId, reviewStreamId]);
  const submittedAssessments = useMemo(
    () => reviewedAssessments.filter((assessment) => assessment.status === "submitted"),
    [reviewedAssessments],
  );

  const trend = ["Term I", "Term II", "Term III"].map((term, index) => ({
    term,
    average: Math.round(Math.max(0, average - (2 - index) * 3) * 10) / 10,
  }));
  const resolveClassName = (classId: string | null | undefined) =>
    classId ? classById.get(classId) ?? "Unknown" : "Unknown";
  const resolveStreamName = (streamId: string | null | undefined) =>
    streamId ? streamById.get(streamId)?.name ?? "Unknown" : "Unknown";

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

      {!hasSchoolData && (
        <div className="mt-4">
          <EmptyDashboardState
            title="Dashboard ready"
            description="There is no school data yet. Once learners, classes, assessments, and terms are added, the dashboard will fill in automatically."
          />
        </div>
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
            Review submitted marks only. Rejected marks return to teachers for correction and
            approved marks stay locked.
          </p>
          <div className="mt-4 overflow-x-auto">
            {submittedAssessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No student marks are available.</p>
            ) : (
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
                  {(reviewClassId || reviewStreamId ? submittedAssessments : submittedAssessments).map(
                    (assessment) => (
                      <tr key={assessment.id} className="border-t border-border">
                      <td className="py-2 pr-4 font-medium">{assessment.studentName}</td>
                      <td className="py-2 pr-4">
                        {resolveClassName(
                          data.students.find((item) => item.id === assessment.student_id)?.class_id ??
                            null,
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {resolveStreamName(
                          data.students.find((item) => item.id === assessment.student_id)?.stream_id ??
                            null,
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
                              | "draft"
                              | "submitted"
                              | "approved"
                              | "rejected";
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
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
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
                    <span className="font-medium">{item.user_name ?? "System"}</span> - 
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

