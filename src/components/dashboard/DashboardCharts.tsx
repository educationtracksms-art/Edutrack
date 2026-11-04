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

import { Panel } from "@/components/ui-kit";

type PlatformChartRow = {
  name: string;
  status: string;
  users: number;
  students: number;
  logins: number;
};

type AttendanceChartRow = {
  name: string;
  present: number;
  absent: number;
  rate: number;
};

type FinanceChartRow = {
  name: string;
  collected: number;
  outstanding: number;
};

type TimetableChartRow = {
  name: string;
  periods: number;
  teachers: number;
};

type DepartmentChartRow = {
  name: string;
  average: number;
  teachers: number;
};

type CoCurricularChartRow = {
  name: string;
  students: number;
};

type TeacherWorkloadRow = {
  name: string;
  subjects: number;
  classes: number;
};

type SchoolChartData = {
  subjectPerformance: Array<{ name: string; average: number }>;
  gradeBuckets: Array<{ name: string; value: number }>;
  trend: Array<{ term: string; average: number }>;
  genderSplit: Array<{ name: string; value: number }>;
  statusBreakdown?: Array<{ name: string; value: number }>;
  studentStatus?: Array<{ name: string; value: number }>;
  classDistribution?: Array<{ name: string; students: number }>;
  classPerformance?: Array<{ name: string; average: number }>;
  attendanceByClass?: AttendanceChartRow[];
  attendanceTrend?: Array<{ date: string; present: number; absent: number }>;
  feeCollection?: FinanceChartRow[];
  departmentPerformance?: DepartmentChartRow[];
  teacherWorkload?: TeacherWorkloadRow[];
  coCurricularParticipation?: CoCurricularChartRow[];
  timetableUtilization?: TimetableChartRow[];
  moduleAdoption?: Array<{ name: string; value: number }>;
};

type DashboardChartsProps =
  { kind: "platform"; data: PlatformChartRow[] } | ({ kind: "school" } & SchoolChartData);

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

function ChartEmptyState({ message, height = 260 }: { message: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground"
      style={{ minHeight: height }}
    >
      {message}
    </div>
  );
}

export default function DashboardCharts(props: DashboardChartsProps) {
  if (props.kind === "platform") {
    const schoolStatuses = [
      ...new Set(props.data.map((school) => (school.status || "other").trim().toLowerCase())),
    ].map((status) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: props.data.filter(
        (school) => (school.status || "other").trim().toLowerCase() === status,
      ).length,
    }));

    return (
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Learners and staff by school">
          {props.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={props.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="students" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="users" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="School data will appear here when schools are added." />
          )}
        </Panel>
        <Panel title="Logins in the last 30 days">
          {props.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={props.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="logins" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="Login activity will appear here when schools are active." />
          )}
        </Panel>
        <Panel title="Schools by status">
          {schoolStatuses.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={schoolStatuses} dataKey="value" nameKey="name" outerRadius={90} label>
                  {schoolStatuses.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState
              message="School status data will appear here when schools are added."
              height={240}
            />
          )}
        </Panel>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Panel title="Subject performance">
        {props.subjectPerformance.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.subjectPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Average"]} />
              <Bar dataKey="average" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="Subject results will appear here after marks are recorded." />
        )}
      </Panel>

      <Panel title="Assessment score histogram">
        {props.gradeBuckets.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.gradeBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Assessments" radius={[4, 4, 0, 0]}>
                {props.gradeBuckets.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="The score histogram will appear here after marks are recorded." />
        )}
      </Panel>

      <Panel title="Performance trend">
        {props.trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={props.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="term" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Average"]} />
              <Line
                type="monotone"
                dataKey="average"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={{ fill: "var(--color-chart-2)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState
            message="Term averages will appear here when results are available."
            height={240}
          />
        )}
      </Panel>

      <Panel title="Learner gender">
        {props.genderSplit.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={props.genderSplit}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                label
              >
                {props.genderSplit.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState
            message="Learner records will appear here when they are added."
            height={240}
          />
        )}
      </Panel>

      <Panel title="Assessment status">
        {props.statusBreakdown && props.statusBreakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={props.statusBreakdown}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label
              >
                {props.statusBreakdown.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState
            message="Assessment counts will appear here when assessments are entered."
            height={240}
          />
        )}
      </Panel>

      <Panel title="Learner status">
        {props.studentStatus && props.studentStatus.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={props.studentStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                {props.studentStatus.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState
            message="Learner status counts will appear here when learners are added."
            height={240}
          />
        )}
      </Panel>

      <Panel title="Learners by class">
        {props.classDistribution && props.classDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.classDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="students" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="Class counts will appear here when classes and learners are assigned." />
        )}
      </Panel>

      {props.classPerformance && (
        <Panel title="Average achievement by class">
          {props.classPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={props.classPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="average" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="Class averages will appear here after marks are recorded." />
          )}
        </Panel>
      )}

      {props.attendanceByClass && (
        <Panel title="Attendance rate by class">
          {props.attendanceByClass.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={props.attendanceByClass}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value}%`, ""]} />
                <Legend />
                <Bar
                  dataKey="present"
                  name="Present (%)"
                  fill="var(--color-chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="absent"
                  name="Absent (%)"
                  fill="var(--color-chart-5)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="Class attendance will appear here after attendance is recorded." />
          )}
        </Panel>
      )}

      {props.attendanceTrend && (
        <Panel title="Attendance trend">
          {props.attendanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={props.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value}%`, ""]} />
                <Legend />
                <Line
                  name="Present (%)"
                  type="monotone"
                  dataKey="present"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-chart-1)" }}
                />
                <Line
                  name="Absent (%)"
                  type="monotone"
                  dataKey="absent"
                  stroke="var(--color-chart-5)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-chart-5)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="Daily attendance will appear here after records are entered." />
          )}
        </Panel>
      )}

      {props.feeCollection && props.feeCollection.length > 0 && (
        <Panel title="Fee collection by class">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.feeCollection}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="collected" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outstanding" fill="var(--color-chart-6)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {props.departmentPerformance && props.departmentPerformance.length > 0 && (
        <Panel title="Department performance">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.departmentPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="average" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {props.teacherWorkload && props.teacherWorkload.length > 0 && (
        <Panel title="Teacher workload by subject">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.teacherWorkload}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="subjects" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="classes" fill="var(--color-chart-7)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {props.coCurricularParticipation && props.coCurricularParticipation.length > 0 && (
        <Panel title="Co-curricular participation">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={props.coCurricularParticipation}
                dataKey="students"
                nameKey="name"
                outerRadius={90}
                label
              >
                {props.coCurricularParticipation.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {props.timetableUtilization && props.timetableUtilization.length > 0 && (
        <Panel title="Timetable periods per day">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.timetableUtilization}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="periods" fill="var(--color-chart-8)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {props.moduleAdoption && props.moduleAdoption.length > 0 && (
        <Panel title="Module adoption">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={props.moduleAdoption}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label
              >
                {props.moduleAdoption.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      )}
    </div>
  );
}
