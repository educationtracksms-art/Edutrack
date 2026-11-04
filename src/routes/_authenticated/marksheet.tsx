import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { BookOpen, Download, Filter, Users } from "lucide-react";

import { PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getMarksheetResults } from "@/lib/report.functions";
import type { SubjectRow } from "@/lib/report-types";
import { isModuleEnabled } from "@/lib/modules";
import { supabase } from "@/integrations/supabase/client";

type ClassRow = { id: string; name: string; education_level: string | null };
type StreamRow = { id: string; name: string; class_id: string | null };
type TermRow = { id: string; name: string; is_current: boolean; academic_year_id: string | null };
type StudentRow = {
  id: string;
  full_name: string;
  class_id: string | null;
  stream_id: string | null;
};
type MarksheetResult = {
  studentId: string;
  gradingLevel: "ordinary" | "advanced";
  rows: SubjectRow[];
  activeSummativePeriods: Array<"BOT" | "MOT" | "EOT">;
};
type MarksheetRow = {
  key: string;
  student: StudentRow;
  row: SubjectRow;
  gradingLevel: "ordinary" | "advanced";
};

const ALLOWED_ROLES = [
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "class_teacher",
  "subject_teacher",
  "super_admin",
] as const;

export const Route = createFileRoute("/_authenticated/marksheet")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleNames = (roles ?? []).map((item) => item.role);
    if (!roleNames.some((role) => ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]))) {
      throw redirect({ to: "/dashboard" });
    }
    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "academics"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Marksheet · EduTrack" },
      {
        name: "description",
        content: "View approved learner results using the same assessment rules as report cards.",
      },
    ],
  }),
  component: MarksheetPage,
});

function MarksheetPage() {
  const buildMarksheet = useServerFn(getMarksheetResults);
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [termId, setTermId] = useState("");

  const schoolQuery = (query: any) => (schoolId ? query.eq("school_id", schoolId) : query);

  const { data: classes = [] } = useQuery<ClassRow[]>({
    queryKey: ["marksheet-classes", schoolId],
    queryFn: async () => {
      const { data, error } = await schoolQuery(
        supabase.from("classes").select("id, name, education_level").order("name"),
      );
      if (error) throw new Error(`Unable to load classes: ${error.message}`);
      return data ?? [];
    },
  });
  const { data: streams = [] } = useQuery<StreamRow[]>({
    queryKey: ["marksheet-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await schoolQuery(
        supabase.from("streams").select("id, name, class_id").order("name"),
      );
      if (error) throw new Error(`Unable to load streams: ${error.message}`);
      return data ?? [];
    },
  });
  const { data: terms = [] } = useQuery<TermRow[]>({
    queryKey: ["marksheet-terms", schoolId],
    queryFn: async () => {
      const { data, error } = await schoolQuery(
        supabase
          .from("terms")
          .select("id, name, is_current, academic_year_id")
          .order("start_date", { ascending: false }),
      );
      if (error) throw new Error(`Unable to load terms: ${error.message}`);
      return data ?? [];
    },
  });
  const { data: students = [] } = useQuery<StudentRow[]>({
    queryKey: ["marksheet-students", schoolId],
    queryFn: async () => {
      const { data, error } = await schoolQuery(
        supabase
          .from("students")
          .select("id, full_name, class_id, stream_id")
          .eq("status", "active")
          .order("full_name"),
      );
      if (error) throw new Error(`Unable to load learners: ${error.message}`);
      return data ?? [];
    },
  });

  const currentTermId = useMemo(
    () => terms.find((term) => term.is_current)?.id ?? terms[0]?.id ?? "",
    [terms],
  );
  const selectedTermId = termId || currentTermId;
  const visibleStudents = useMemo(
    () =>
      students
        .filter((student) => !classId || student.class_id === classId)
        .filter((student) => !streamId || student.stream_id === streamId)
        .sort((a, b) => {
          const classA = classes.find((item) => item.id === a.class_id)?.name ?? "";
          const classB = classes.find((item) => item.id === b.class_id)?.name ?? "";
          const streamA = streams.find((item) => item.id === a.stream_id)?.name ?? "";
          const streamB = streams.find((item) => item.id === b.stream_id)?.name ?? "";
          return classA.localeCompare(classB) || streamA.localeCompare(streamB) || a.full_name.localeCompare(b.full_name);
        }),
    [classId, classes, streamId, streams, students],
  );
  const visibleStudentIds = useMemo(() => visibleStudents.map((student) => student.id), [visibleStudents]);
  const visibleStreams = useMemo(
    () => streams.filter((stream) => !classId || stream.class_id === classId),
    [classId, streams],
  );
  const selectedClassId = classId || streams.find((stream) => stream.id === streamId)?.class_id || "";
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const selectedStreamName = streams.find((item) => item.id === streamId)?.name ?? "";
  const selectedTermName = terms.find((term) => term.id === selectedTermId)?.name ?? "";

  const {
    data: reportResults = [],
    isLoading: resultsLoading,
    error: resultsError,
  } = useQuery<MarksheetResult[]>({
    queryKey: ["marksheet-report-results", schoolId, selectedTermId, visibleStudentIds],
    enabled: !!schoolId && !!selectedTermId && visibleStudentIds.length > 0,
    queryFn: async () =>
      buildMarksheet({ data: { studentIds: visibleStudentIds, termId: selectedTermId } }),
    staleTime: 1000 * 60,
  });

  const resultByStudent = useMemo(
    () => new Map(reportResults.map((result) => [result.studentId, result])),
    [reportResults],
  );
  const rows = useMemo<MarksheetRow[]>(
    () =>
      visibleStudents.flatMap((student) => {
        const result = resultByStudent.get(student.id);
        return (result?.rows ?? []).map((row, index) => ({
          key: `${student.id}:${row.subjectId ?? row.subject}:${row.paperId ?? "subject"}:${index}`,
          student,
          row,
          gradingLevel: result?.gradingLevel ?? "ordinary",
        }));
      }),
    [resultByStudent, visibleStudents],
  );
  const activePeriods = reportResults[0]?.activeSummativePeriods ?? [];
  const subjectResultRows = rows.filter(
    ({ row, gradingLevel }) => gradingLevel !== "advanced" || Boolean(row.isSubjectSummary),
  );
  const completeCount = subjectResultRows.filter(
    ({ row }) => row.total.trim() !== "" && row.total !== "MISSING MARK",
  ).length;
  const missingCount = subjectResultRows.filter(({ row }) => row.total === "MISSING MARK").length;
  const subjectCount = new Set(rows.map(({ row }) => row.subjectId ?? row.subject)).size;
  const title = useMemo(() => {
    const scope = [
      selectedClass ? `${selectedClass.name} (${selectedClass.education_level === "advanced" ? "A-Level" : "O-Level"})` : "",
      selectedStreamName,
    ].filter(Boolean);
    return scope.length ? `${scope.join(" · ")} Marksheet` : "School Marksheet";
  }, [selectedClass, selectedStreamName]);

  async function downloadExcel() {
    if (!rows.length || (!classId && !streamId)) return;
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EduTrack";
    workbook.subject = "Marksheet";
    workbook.title = title;
    const sheet = workbook.addWorksheet("Marksheet", {
      views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
      properties: { defaultRowHeight: 22 },
    });
    const headers = [
      "Learner",
      "Class",
      "Stream",
      "Subject",
      "Paper",
      "Formative",
      ...activePeriods,
      "Total",
      "Average",
      "Grade",
      "Grade descriptor / points",
      "Teacher",
    ];
    sheet.addRow(headers);
    for (const entry of rows) {
      const className = classes.find((item) => item.id === entry.student.class_id)?.name ?? "";
      const streamName = streams.find((item) => item.id === entry.student.stream_id)?.name ?? "";
      const score = entry.row;
      sheet.addRow([
        entry.student.full_name,
        className,
        streamName,
        score.subject,
        score.paperName ?? "",
        score.formative,
        ...activePeriods.map((period) =>
          period === "BOT" ? score.bot : period === "MOT" ? score.mot : score.eot,
        ),
        score.total,
        score.totalAverage ?? "",
        score.grade,
        entry.gradingLevel === "advanced" ? score.subjectPoints : score.gradeDetail,
        score.teacher,
      ]);
    }
    const header = sheet.getRow(1);
    header.height = 28;
    header.eachCell((cell) => {
      cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123A63" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    sheet.columns = headers.map((headerText, index) => ({
      width: index === 0 ? 28 : headerText === "Subject" ? 24 : headerText === "Grade descriptor / points" ? 24 : 14,
    }));
    sheet.autoFilter = { from: "A1", to: sheet.getCell(sheet.rowCount, headers.length).address };
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FC" } };
        });
      }
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        if (cell.value === "MISSING MARK") {
          cell.font = { color: { argb: "FFB42318" }, bold: true };
        }
      });
    }
    const safeName = `${title}_${selectedTermName}`
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "marksheet";
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Approved marks and missing results follow the same calculations and paper breakdown as report cards."
        actions={
          <button
            type="button"
            onClick={downloadExcel}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            disabled={!rows.length || (!classId && !streamId)}
          >
            <Download className="h-4 w-4" />
            {classId || streamId ? "Download Excel" : "Select a class or stream to download"}
          </button>
        }
      />

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Filters</p>
            <p className="text-xs text-muted-foreground">Choose a term, class, and stream.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="muted"><Users className="mr-1 inline h-3.5 w-3.5" />{visibleStudents.length} learners</Pill>
            <Pill tone="muted"><BookOpen className="mr-1 inline h-3.5 w-3.5" />{subjectCount} subjects</Pill>
            <Pill tone="success">{completeCount} complete results</Pill>
            {missingCount > 0 && <Pill tone="danger">{missingCount} missing results</Pill>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Term
            <select className={inputClass} value={selectedTermId} onChange={(event) => setTermId(event.target.value)}>
              <option value="">Select term</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>{term.name}{term.is_current ? " (Current)" : ""}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Class
            <select
              className={inputClass}
              value={classId}
              onChange={(event) => { setClassId(event.target.value); setStreamId(""); }}
            >
              <option value="">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.education_level === "advanced" ? "A-Level" : "O-Level"})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stream
            <select className={inputClass} value={streamId} onChange={(event) => setStreamId(event.target.value)}>
              <option value="">All streams</option>
              {visibleStreams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </Panel>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            {selectedTermName || "Select term"}
          </div>
          <Pill tone="muted">Report card results</Pill>
          <Pill tone="muted">Approved marks only</Pill>
        </div>

        {resultsError ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Unable to load marks: {resultsError.message}
          </p>
        ) : resultsLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading approved results…</p>
        ) : visibleStudents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No active learners match these filters.</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No assigned subjects or approved results were found for these learners in this term.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[1050px] w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Learner</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Stream</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Paper</th>
                  <th className="px-3 py-3 text-right">Formative</th>
                  {activePeriods.map((period) => <th key={period} className="px-3 py-3 text-right">{period}</th>)}
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-right">Average</th>
                  <th className="px-3 py-3">Grade</th>
                  <th className="px-3 py-3">Descriptor / points</th>
                  <th className="px-3 py-3">Teacher</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const { row, student, gradingLevel } = entry;
                  const isSummary = Boolean(row.isSubjectSummary);
                  const className = classes.find((item) => item.id === student.class_id)?.name ?? "—";
                  const streamName = streams.find((item) => item.id === student.stream_id)?.name ?? "—";
                  const periodScore = (period: "BOT" | "MOT" | "EOT") =>
                    period === "BOT" ? row.bot : period === "MOT" ? row.mot : row.eot;
                  const detail = gradingLevel === "advanced" ? row.subjectPoints : row.gradeDetail;
                  return (
                    <tr
                      key={entry.key}
                      className={`border-t border-border ${isSummary ? "bg-blue-50/70 font-semibold dark:bg-blue-950/20" : ""}`}
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-medium">{student.full_name}</td>
                      <td className="whitespace-nowrap px-3 py-3">{className}</td>
                      <td className="whitespace-nowrap px-3 py-3">{streamName}</td>
                      <td className="px-3 py-3">{row.subject}</td>
                      <td className="px-3 py-3">{row.paperName || (isSummary ? "Subject total" : "—")}</td>
                      <td className="px-3 py-3 text-right">{row.formative || "—"}</td>
                      {activePeriods.map((period) => (
                        <td key={period} className="px-3 py-3 text-right">{periodScore(period) || "—"}</td>
                      ))}
                      <td className={`px-3 py-3 text-right ${row.total === "MISSING MARK" ? "font-semibold text-red-700" : ""}`}>
                        {row.total || "—"}
                      </td>
                      <td className={`px-3 py-3 text-right ${row.totalAverage === "MISSING MARK" ? "font-semibold text-red-700" : ""}`}>
                        {row.totalAverage || "—"}
                      </td>
                      <td className="px-3 py-3">{row.grade || "—"}</td>
                      <td className="px-3 py-3">{detail || "—"}</td>
                      <td className="px-3 py-3">{row.teacher || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
