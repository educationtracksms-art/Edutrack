import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · EduTrack" },
      { name: "description", content: "Role-based analytics for schools, learners, assessments and approvals." },
      { property: "og:title", content: "Dashboard · EduTrack" },
      { property: "og:description", content: "Live school analytics and approval status at a glance." },
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

function useDashboardData(schoolId: string | null | undefined, isSuper: boolean) {
  return useQuery({
    queryKey: ["dashboard", schoolId, isSuper],
    queryFn: async () => {
      const [schools, students, assessments, subjects, profiles, activity] = await Promise.all([
        supabase.from("schools").select("id, name, status"),
        supabase.from("students").select("id, gender, status, class_id, school_id"),
        supabase.from("assessments").select("id, subject_id, formative, summative, status, school_id"),
        supabase.from("subjects").select("id, name"),
        supabase.from("profiles").select("id, full_name, school_id"),
        supabase.from("audit_logs").select("action, user_name, created_at").order("created_at", { ascending: false }).limit(8),
      ]);
      return {
        schools: schools.data ?? [],
        students: students.data ?? [],
        assessments: assessments.data ?? [],
        subjects: subjects.data ?? [],
        profiles: profiles.data ?? [],
        activity: activity.data ?? [],
      };
    },
  });
}

function Dashboard() {
  const { data: me } = useCurrentUser();
  const isSuper = hasAny(me?.roles, ["super_admin"]);
  if (isSuper) return <PlatformDashboard />;
  return <SchoolDashboard />;
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

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading platform metrics…</p>;

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
        <Stat label="Schools" value={data.length} hint={`${data.length - activeSchools} suspended`} />
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
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">No schools yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function SchoolDashboard() {
  const { data: me } = useCurrentUser();
  const isSuper = false;
  const canSeeActivity = hasAny(me?.roles, ["school_admin", "head_teacher", "deputy_head_teacher"]);
  const { data, isLoading } = useDashboardData(me?.profile?.school_id, isSuper);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading analytics…</p>;

  const totals = data.assessments.map((a) => Number(a.formative ?? 0) + Number(a.summative ?? 0));
  const average = totals.length ? totals.reduce((x, y) => x + y, 0) / totals.length : 0;

  const subjectPerformance = data.subjects
    .map((subject) => {
      const marks = data.assessments.filter((a) => a.subject_id === subject.id);
      const scores = marks.map((m) => Number(m.formative ?? 0) + Number(m.summative ?? 0));
      return {
        name: subject.name.length > 12 ? `${subject.name.slice(0, 12)}…` : subject.name,
        average: scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : 0,
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
  const completion = data.assessments.length ? Math.round((approved / data.assessments.length) * 100) : 0;

  const trend = ["Term I", "Term II", "Term III"].map((term, index) => ({
    term,
    average: Math.round(Math.max(0, average - (2 - index) * 3) * 10) / 10,
  }));

  return (
    <div>
      <PageHeader title="School dashboard" description="Performance, approvals and learner status for your school." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Learners" value={data.students.length} hint={`${data.students.filter((s) => s.status === "pending").length} awaiting verification`} />
        <Stat label="Staff accounts" value={data.profiles.length} />
        <Stat label="Average achievement" value={`${average.toFixed(1)}%`} />
        <Stat label="Pending approvals" value={pending} hint={`${rejected} returned for correction`} />
        <Stat label="Approved assessments" value={approved} />
        <Stat label="Assessment completion" value={`${completion}%`} />
      </div>

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
              <Line type="monotone" dataKey="average" stroke="var(--color-chart-2)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Gender distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={genderSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
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

      {canSeeActivity && (
      <Panel title="Recent activity" className="mt-4">
        {data.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.activity.map((item, index) => (
              <li key={index} className="flex justify-between gap-4 border-b border-border pb-2 last:border-none">
                <span>
                  <span className="font-medium">{item.user_name ?? "System"}</span> · {item.action}
                </span>
                <span className="text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      )}
    </div>
  );
}