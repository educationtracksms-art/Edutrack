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
  users: number;
  students: number;
};

type SchoolChartData = {
  subjectPerformance: Array<{ name: string; average: number }>;
  gradeBuckets: Array<{ name: string; value: number }>;
  trend: Array<{ term: string; average: number }>;
  genderSplit: Array<{ name: string; value: number }>;
  statusBreakdown?: Array<{ name: string; value: number }>;
  classDistribution?: Array<{ name: string; students: number }>;
};

type DashboardChartsProps =
  { kind: "platform"; data: PlatformChartRow[] } | ({ kind: "school" } & SchoolChartData);

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export default function DashboardCharts(props: DashboardChartsProps) {
  if (props.kind === "platform") {
    return (
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
    );
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Panel title="Subject performance">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={props.subjectPerformance}>
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
            <Pie data={props.gradeBuckets} dataKey="value" nameKey="name" outerRadius={90} label>
              {props.gradeBuckets.map((entry, index) => (
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
          <LineChart data={props.trend}>
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
      </Panel>

      {props.statusBreakdown && props.statusBreakdown.length > 0 && (
        <Panel title="Assessment status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={props.statusBreakdown} dataKey="value" nameKey="name" outerRadius={90} label>
                {props.statusBreakdown.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {props.classDistribution && props.classDistribution.length > 0 && (
        <Panel title="Learners by class">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={props.classDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="students" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}
    </div>
  );
}
