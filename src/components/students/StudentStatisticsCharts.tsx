import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export type StudentStatisticsChartsData = {
  attendanceEnabled: boolean;
  subjectPerformance: Array<{ name: string; average: number }>;
  performanceByTerm: Array<{ name: string; average: number }>;
  formativeBySubject: Array<{ name: string; average: number }>;
  formativeByTerm: Array<{ name: string; average: number }>;
  scoreDistribution: Array<{ name: string; value: number }>;
  attendanceByMonth: Array<{ name: string; rate: number }>;
  attendanceByTerm: Array<{ name: string; rate: number }>;
  assessmentStatus: Array<{ name: string; value: number }>;
};

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function StudentStatisticsCharts({
  attendanceEnabled,
  subjectPerformance,
  performanceByTerm,
  formativeBySubject,
  formativeByTerm,
  scoreDistribution,
  attendanceByMonth,
  attendanceByTerm,
  assessmentStatus,
}: StudentStatisticsChartsData) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Average score by subject">
        {subjectPerformance.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={subjectPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Average"]} />
              <Bar dataKey="average" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Approved subject marks will appear here." />
        )}
      </Panel>

      <Panel title="Performance by term">
        {performanceByTerm.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={performanceByTerm}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
          <EmptyChart message="Term trends will appear here after marks are approved." />
        )}
      </Panel>

      <Panel title="Formative average by subject">
        {formativeBySubject.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formativeBySubject}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [value, "Average mark"]} />
              <Bar dataKey="average" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Approved formative marks will appear here." />
        )}
      </Panel>

      <Panel title="Formative trend by term">
        {formativeByTerm.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={formativeByTerm}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [value, "Average mark"]} />
              <Line
                type="monotone"
                dataKey="average"
                stroke="var(--color-chart-6)"
                strokeWidth={2}
                dot={{ fill: "var(--color-chart-6)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Formative averages will appear here when marks are approved." />
        )}
      </Panel>

      <Panel title="Score histogram">
        {scoreDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Assessments" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Score bands will appear here after marks are approved." />
        )}
      </Panel>

      <Panel title="Attendance by month">
        {!attendanceEnabled ? (
          <EmptyChart message="Attendance tracking is disabled for this school." />
        ) : attendanceByMonth.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={attendanceByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Present"]} />
              <Line
                type="monotone"
                dataKey="rate"
                name="Present (%)"
                stroke="var(--color-chart-3)"
                strokeWidth={2}
                dot={{ fill: "var(--color-chart-3)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Monthly attendance will appear here when daily records are entered." />
        )}
      </Panel>

      <Panel title="Attendance by term">
        {!attendanceEnabled ? (
          <EmptyChart message="Attendance tracking is disabled for this school." />
        ) : attendanceByTerm.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={attendanceByTerm}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Present"]} />
              <Bar dataKey="rate" name="Present (%)" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Term attendance will appear here after attendance is summarized." />
        )}
      </Panel>

      <Panel title="Assessment status">
        {assessmentStatus.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={assessmentStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                {assessmentStatus.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Assessment workflow status will appear here when marks are entered." />
        )}
      </Panel>
    </div>
  );
}
