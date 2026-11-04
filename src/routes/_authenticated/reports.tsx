import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ALevelReportCard } from "@/components/report/ALevelReportCard";
import { OLevelReportCard } from "@/components/report/OLevelReportCard";
import { Btn, PageHeader, Panel, Stat, inputClass } from "@/components/ui-kit";
import { friendlyAdminError } from "@/lib/admin-errors";
import { logReportPrint } from "@/lib/admin.functions";
import { getALevelReportCards, getOLevelReportCards } from "@/lib/report.functions";
import type { ReportCardData } from "@/lib/report-types";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type ClassRow = { id: string; name: string; education_level: string | null };
type StreamRow = { id: string; name: string; class_id: string | null };
type StudentRow = {
  id: string;
  full_name: string;
  class_id: string | null;
  stream_id: string | null;
};
type TermRow = { id: string; name: string; is_current: boolean; academic_year_id: string | null };
type AcademicYearRow = { id: string; name: string; is_current: boolean };
type AttendanceRecord = { student_id: string; status: string; attendance_date: string };
type AttendanceSummary = {
  student_id: string;
  days_present: number;
  days_absent: number;
  total_days: number | null;
};

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const canPrintReports = (roles ?? []).some((item) =>
      ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(item.role),
    );
    if (!canPrintReports) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Reports · EduTrack" },
      {
        name: "description",
        content: "Generate academic and attendance reports for learners and classes.",
      },
      { property: "og:title", content: "Reports · EduTrack" },
      {
        property: "og:description",
        content: "Print learner report cards and review school attendance trends.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: me } = useCurrentUser();
  const buildOLevel = useServerFn(getOLevelReportCards);
  const buildALevel = useServerFn(getALevelReportCards);
  const logPrint = useServerFn(logReportPrint);
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [reportLevel, setReportLevel] = useState<"ordinary" | "advanced">("ordinary");
  const [selected, setSelected] = useState<string[]>([]);
  const [cards, setCards] = useState<ReportCardData[]>([]);
  const [reportTab, setReportTab] = useState<"academic" | "attendance">("academic");
  const [attendanceTermId, setAttendanceTermId] = useState("");
  const [attendanceClassId, setAttendanceClassId] = useState("");

  const { data: classes } = useQuery<ClassRow[]>({
    queryKey: ["classes"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name, education_level").order("name")).data ?? [],
  });
  const { data: streams } = useQuery<StreamRow[]>({
    queryKey: ["report-streams"],
    queryFn: async () =>
      (await supabase.from("streams").select("id, name, class_id").order("name")).data ?? [],
  });
  const { data: students } = useQuery<StudentRow[]>({
    queryKey: ["students-active"],
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id, full_name, class_id, stream_id")
          .eq("status", "active")
          .order("full_name")
      ).data ?? [],
  });
  const { data: terms } = useQuery<TermRow[]>({
    queryKey: ["report-terms"],
    queryFn: async () =>
      (
        await supabase
          .from("terms")
          .select("id, name, is_current, academic_year_id")
          .order("start_date", { ascending: false })
      ).data ?? [],
  });
  const { data: academicYears } = useQuery<AcademicYearRow[]>({
    queryKey: ["report-academic-years"],
    queryFn: async () =>
      (
        await supabase
          .from("academic_years")
          .select("id, name, is_current")
          .order("name", { ascending: false })
      ).data ?? [],
  });

  const currentTermId = useMemo(
    () => terms?.find((term) => term.is_current)?.id ?? terms?.[0]?.id ?? "",
    [terms],
  );

  useEffect(() => {
    if (!termId && currentTermId) setTermId(currentTermId);
  }, [currentTermId, termId]);

  useEffect(() => {
    if (!attendanceTermId && currentTermId) setAttendanceTermId(currentTermId);
  }, [attendanceTermId, currentTermId]);

  const attendanceQuery = useQuery({
    queryKey: ["attendance-report", me?.profile?.school_id, attendanceTermId],
    enabled: reportTab === "attendance" && !!me?.profile?.school_id && !!attendanceTermId,
    queryFn: async () => {
      const [summaryResult, recordsResult] = await Promise.all([
        supabase
          .from("attendance_summaries")
          .select("student_id, days_present, days_absent, total_days")
          .eq("school_id", me!.profile!.school_id!)
          .eq("term_id", attendanceTermId),
        supabase
          .from("attendance_records")
          .select("student_id, status, attendance_date")
          .eq("school_id", me!.profile!.school_id!)
          .eq("term_id", attendanceTermId)
          .order("attendance_date"),
      ]);
      if (summaryResult.error) throw new Error(summaryResult.error.message);
      if (recordsResult.error) throw new Error(recordsResult.error.message);
      return {
        summaries: (summaryResult.data ?? []) as AttendanceSummary[],
        records: (recordsResult.data ?? []) as AttendanceRecord[],
      };
    },
  });

  useEffect(() => {
    setClassId("");
    setStreamId("");
    setSelected([]);
    setCards([]);
  }, [reportLevel]);

  const visible = useMemo(() => {
    return (students ?? [])
      .filter((student) => (classId ? student.class_id === classId : true))
      .filter((student) => (streamId ? student.stream_id === streamId : true))
      .filter((student) => {
        const classRow = classes?.find((item) => item.id === student.class_id);
        const level = classRow?.education_level === "advanced" ? "advanced" : "ordinary";
        return level === reportLevel;
      })
      .sort((a, b) => {
        const classA = classes?.find((item) => item.id === a.class_id)?.name ?? "";
        const classB = classes?.find((item) => item.id === b.class_id)?.name ?? "";
        const streamA = streams?.find((item) => item.id === a.stream_id)?.name ?? "";
        const streamB = streams?.find((item) => item.id === b.stream_id)?.name ?? "";
        return (
          classA.localeCompare(classB) ||
          streamA.localeCompare(streamB) ||
          a.full_name.localeCompare(b.full_name)
        );
      });
  }, [classId, classes, reportLevel, streamId, students, streams]);

  const reportStreams = useMemo(
    () =>
      (streams ?? []).filter((stream) => {
        if (classId && stream.class_id !== classId) return false;
        const streamClass = classes?.find((item) => item.id === stream.class_id);
        return (
          (streamClass?.education_level === "advanced" ? "advanced" : "ordinary") === reportLevel
        );
      }),
    [classId, classes, reportLevel, streams],
  );

  const visibleStudentIds = useMemo(() => visible.map((student) => student.id), [visible]);

  const activeAcademicYears = academicYears ?? [];
  const attendanceStudents = useMemo(() => (students ?? []).filter((student) =>
    attendanceClassId ? student.class_id === attendanceClassId : true,
  ), [attendanceClassId, students]);
  const attendanceRows = useMemo(() => {
    const summaries = new Map((attendanceQuery.data?.summaries ?? []).map((row) => [row.student_id, row]));
    const recordsByStudent = new Map<string, AttendanceRecord[]>();
    for (const record of attendanceQuery.data?.records ?? []) {
      const current = recordsByStudent.get(record.student_id) ?? [];
      current.push(record);
      recordsByStudent.set(record.student_id, current);
    }
    return attendanceStudents.map((student) => {
      const summary = summaries.get(student.id);
      const daily = recordsByStudent.get(student.id) ?? [];
      const daysPresent = summary
        ? Number(summary.days_present ?? 0)
        : daily.filter((record) => record.status !== "absent").length;
      const daysAbsent = summary
        ? Number(summary.days_absent ?? 0)
        : daily.filter((record) => record.status === "absent").length;
      const totalDays = Number(summary?.total_days ?? daysPresent + daysAbsent);
      return {
        ...student,
        daysPresent,
        daysAbsent,
        totalDays,
        rate: totalDays > 0 ? (daysPresent / totalDays) * 100 : 0,
      };
    });
  }, [attendanceQuery.data, attendanceStudents]);
  const attendanceStats = useMemo(() => {
    const totals = attendanceRows.reduce((acc, row) => ({
      present: acc.present + row.daysPresent,
      absent: acc.absent + row.daysAbsent,
      total: acc.total + row.totalDays,
    }), { present: 0, absent: 0, total: 0 });
    return {
      ...totals,
      rate: totals.total ? (totals.present / totals.total) * 100 : 0,
      tracked: attendanceRows.filter((row) => row.totalDays > 0).length,
      noData: attendanceRows.filter((row) => row.totalDays === 0).length,
      belowTarget: attendanceRows.filter((row) => row.totalDays > 0 && row.rate < 80).length,
    };
  }, [attendanceRows]);
  const attendanceCharts = useMemo(() => {
    const monthTotals = new Map<string, { present: number; absent: number }>();
    const visibleStudentIds = new Set(attendanceRows.map((row) => row.id));
    for (const record of attendanceQuery.data?.records ?? []) {
      if (!visibleStudentIds.has(record.student_id)) continue;
      const month = record.attendance_date.slice(0, 7);
      const value = monthTotals.get(month) ?? { present: 0, absent: 0 };
      if (record.status === "absent") value.absent += 1;
      else value.present += 1;
      monthTotals.set(month, value);
    }
    const monthly = [...monthTotals]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, value]) => ({ month, ...value }));
    const classTotals = new Map<string, { present: number; total: number }>();
    for (const row of attendanceRows) {
      const className = classes?.find((item) => item.id === row.class_id)?.name ?? "Unassigned";
      const value = classTotals.get(className) ?? { present: 0, total: 0 };
      value.present += row.daysPresent;
      value.total += row.totalDays;
      classTotals.set(className, value);
    }
    const byClass = [...classTotals]
      .map(([name, value]) => ({ name, rate: value.total ? Math.round((value.present / value.total) * 10) / 10 : 0 }))
      .filter((row) => row.rate > 0)
      .sort((a, b) => b.rate - a.rate);
    return { monthly, byClass };
  }, [attendanceQuery.data?.records, attendanceRows, classes]);

  function exportAttendanceCsv() {
    const termName = terms?.find((term) => term.id === attendanceTermId)?.name ?? "Term";
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Learner", "Class", "Stream", "Days present", "Days absent", "Total days", "Attendance rate"],
      ...attendanceRows.map((row) => [
        row.full_name,
        classes?.find((item) => item.id === row.class_id)?.name ?? "Unassigned",
        streams?.find((item) => item.id === row.stream_id)?.name ?? "Unassigned",
        row.daysPresent,
        row.daysAbsent,
        row.totalDays,
        `${row.rate.toFixed(1)}%`,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(quote).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${termName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const filteredTerms = useMemo(() => {
    return (terms ?? []).filter((term) =>
      academicYearId ? term.academic_year_id === academicYearId : true,
    );
  }, [academicYearId, terms]);

  useEffect(() => {
    if (
      classId &&
      !classes?.some(
        (item) =>
          item.id === classId &&
          (item.education_level === "advanced" ? "advanced" : "ordinary") === reportLevel,
      )
    ) {
      setClassId("");
      setStreamId("");
      setSelected([]);
    }
  }, [classId, classes, reportLevel]);

  useEffect(() => {
    if (streamId && !reportStreams.some((stream) => stream.id === streamId)) {
      setStreamId("");
      setSelected([]);
    }
  }, [reportStreams, streamId]);

  useEffect(() => {
    if (termId && !filteredTerms.some((term) => term.id === termId)) {
      setTermId("");
      setSelected([]);
      setCards([]);
    }
  }, [filteredTerms, termId]);

  useEffect(() => {
    if (!academicYearId && currentTermId) {
      const currentTerm = terms?.find((term) => term.id === currentTermId);
      if (currentTerm?.academic_year_id) setAcademicYearId(currentTerm.academic_year_id);
    }
  }, [academicYearId, currentTermId, terms]);

  const generate = useMutation({
    mutationFn: async () => {
      const ids = selected.length ? selected : visible.map((student) => student.id);
      if (!ids.length) throw new Error("Select at least one learner");
      if (!termId) throw new Error("Select a term before generating report cards");
      if (!(terms ?? []).some((term) => term.id === termId)) {
        throw new Error("The selected term is no longer available. Choose a term again");
      }
      if (ids.some((id) => !(students ?? []).some((student) => student.id === id))) {
        throw new Error(
          "One selected learner is no longer available. Refresh and select learners again",
        );
      }
      return reportLevel === "advanced"
        ? buildALevel({ data: { studentIds: ids, termId: termId || undefined } })
        : buildOLevel({ data: { studentIds: ids, termId: termId || undefined } });
    },
    onSuccess: (result) => {
      setCards(result);
      toast.success(`${result.length} report card(s) ready`);
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  function print() {
    logPrint({ data: { count: cards.length, scope: classId || "all" } }).catch(() => undefined);
    window.print();
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Academic reports, attendance summaries and school performance analytics."
        actions={reportTab === "academic" ? (
          <>
            <Btn variant="accent" onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? "Generating…" : "Generate"}
            </Btn>
            {cards.length > 0 && <Btn onClick={print}>Print / Save PDF</Btn>}
          </>
        ) : undefined}
      />

      <nav className="no-print mb-4 flex flex-wrap gap-2" aria-label="Report types">
        {([["academic", "Academic report cards"], ["attendance", "Attendance reports"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setReportTab(tab)}
            aria-pressed={reportTab === tab}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${reportTab === tab ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {reportTab === "academic" && <>
      {generate.isError && (
        <p role="alert" className="no-print mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Report generation failed: {friendlyAdminError(generate.error as Error)}
        </p>
      )}

      <Panel className="no-print mb-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select
            className={`${inputClass} max-w-xs`}
            value={reportLevel}
            onChange={(event) =>
              setReportLevel(event.target.value === "advanced" ? "advanced" : "ordinary")
            }
          >
            <option value="ordinary">O-Level report</option>
            <option value="advanced">A-Level report</option>
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={academicYearId}
            onChange={(event) => {
              setAcademicYearId(event.target.value);
              setTermId("");
              setSelected([]);
            }}
          >
            <option value="">All years</option>
            {activeAcademicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.is_current ? " (Current)" : ""}
              </option>
            ))}
          </select>
          <select
            required
            className={`${inputClass} max-w-xs`}
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
          >
            <option value="">Select term</option>
            {filteredTerms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
                {term.is_current ? " (Current)" : ""}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setStreamId("");
              setSelected([]);
            }}
          >
            <option value="">All classes</option>
            {(classes ?? [])
              .filter(
                (item) =>
                  (item.education_level === "advanced" ? "advanced" : "ordinary") === reportLevel,
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={streamId}
            onChange={(event) => {
              setStreamId(event.target.value);
              setSelected([]);
            }}
          >
            <option value="">All streams</option>
            {(streams ?? [])
              .filter((stream) => reportStreams.some((available) => available.id === stream.id))
              .map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.name}
                </option>
              ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="ghost"
              onClick={() => setSelected(visibleStudentIds)}
              disabled={visibleStudentIds.length === 0}
            >
              Select all
            </Btn>
            <Btn variant="ghost" onClick={() => setSelected([])} disabled={selected.length === 0}>
              Clear
            </Btn>
          </div>
          <span className="text-sm text-muted-foreground">
            {selected.length
              ? `${selected.length} selected`
              : `${visible.length} learner(s) in scope`}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((student) => (
            <label
              key={student.id}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(student.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, student.id]
                      : selected.filter((id) => id !== student.id),
                  )
                }
              />
              {student.full_name}
            </label>
          ))}
        </div>
      </Panel>

      <div className="space-y-6">
        {cards.map((card) =>
          card.gradingLevel === "advanced" ? (
            <ALevelReportCard key={card.studentId} data={card} />
          ) : (
            <OLevelReportCard key={card.studentId} data={card} />
          ),
        )}
      </div>
      </>}

      {reportTab === "attendance" && (
        <div className="space-y-4">
          <Panel title="Attendance report filters">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">
                <span>Academic term</span>
                <select className={inputClass} value={attendanceTermId} onChange={(event) => setAttendanceTermId(event.target.value)}>
                  <option value="">Select a term</option>
                  {(terms ?? []).map((term) => <option key={term.id} value={term.id}>{term.name}{term.is_current ? " (Current)" : ""}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Class</span>
                <select className={inputClass} value={attendanceClassId} onChange={(event) => setAttendanceClassId(event.target.value)}>
                  <option value="">All classes</option>
                  {(classes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            </div>
          </Panel>
          {attendanceQuery.isError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Could not load attendance data: {friendlyAdminError(attendanceQuery.error as Error)}
            </p>
          )}
          {attendanceQuery.isLoading ? (
            <Panel><p className="text-sm text-muted-foreground">Loading attendance report…</p></Panel>
          ) : attendanceTermId && !attendanceQuery.isError ? <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label="Overall attendance" value={`${attendanceStats.rate.toFixed(1)}%`} />
              <Stat label="Days present" value={attendanceStats.present} />
              <Stat label="Days absent" value={attendanceStats.absent} />
              <Stat label="Learners with records" value={attendanceStats.tracked} hint={`${attendanceStats.noData} without attendance data`} />
              <Stat label="Below 80% attendance" value={attendanceStats.belowTarget} hint="Learners to follow up" />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Monthly roll call">
                {attendanceCharts.monthly.length === 0 ? <p className="text-sm text-muted-foreground">No daily roll call records have been saved for this term.</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={attendanceCharts.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="present" name="Present" stackId="attendance" fill="var(--color-chart-1)" />
                      <Bar dataKey="absent" name="Absent" stackId="attendance" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
              <Panel title="Attendance rate by class">
                {attendanceCharts.byClass.length === 0 ? <p className="text-sm text-muted-foreground">No term attendance summaries are available to compare classes.</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={attendanceCharts.byClass}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value}%`, "Attendance"]} />
                      <Bar dataKey="rate" name="Attendance rate" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
              <Panel title="Presence and absence totals">
                {attendanceStats.total === 0 ? <p className="text-sm text-muted-foreground">No attendance totals are available for this selection.</p> : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={[{ name: "Present", value: attendanceStats.present }, { name: "Absent", value: attendanceStats.absent }].filter((item) => item.value > 0)} dataKey="value" nameKey="name" outerRadius={85} label>
                        {[{ name: "Present", value: attendanceStats.present }, { name: "Absent", value: attendanceStats.absent }]
                          .filter((item) => item.value > 0)
                          .map((item) => <Cell key={item.name} fill={item.name === "Present" ? "var(--color-chart-1)" : "var(--color-chart-4)"} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Panel>
              <Panel title="Learner attendance details" className="xl:col-span-2">
                {attendanceRows.length === 0 ? <p className="text-sm text-muted-foreground">No active learners match this selection.</p> : (
                  <div className="overflow-x-auto">
                    <div className="mb-3 flex justify-end"><Btn variant="accent" onClick={exportAttendanceCsv}>Export CSV</Btn></div>
                    <table className="w-full min-w-[680px] text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr><th className="pb-2">Learner</th><th className="pb-2">Class / Stream</th><th className="pb-2">Present</th><th className="pb-2">Absent</th><th className="pb-2">Total</th><th className="pb-2">Rate</th></tr>
                      </thead>
                      <tbody>{attendanceRows.map((row) => (
                        <tr key={row.id} className={`border-t border-border ${row.totalDays > 0 && row.rate < 80 ? "bg-destructive/5" : ""}`}>
                          <td className="py-2 font-medium">{row.full_name}</td>
                          <td className="py-2">{classes?.find((item) => item.id === row.class_id)?.name ?? "Unassigned"} / {streams?.find((item) => item.id === row.stream_id)?.name ?? "—"}</td>
                          <td className="py-2">{row.daysPresent}</td><td className="py-2">{row.daysAbsent}</td><td className="py-2">{row.totalDays}</td><td className="py-2 font-semibold">{row.totalDays ? `${row.rate.toFixed(1)}%` : "—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          </> : <Panel><p className="text-sm text-muted-foreground">Select a term to view attendance reports.</p></Panel>}
        </div>
      )}
    </div>
  );
}
