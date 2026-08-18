import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, Filter, LayoutGrid, Users } from "lucide-react";
import ExcelJS from "exceljs";

import { PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
type SubjectRow = { id: string; name: string };
type AssessmentRow = {
  student_id: string;
  subject_id: string;
  formative: number | null;
  summative: number | null;
};
type GradingScaleRow = {
  grade: string;
  min_score: number;
  max_score: number;
  descriptor: string;
  education_level: string | null;
  points: number | null;
};

const ALLOWED_ROLES = ["head_teacher", "deputy_head_teacher", "dos", "class_teacher"] as const;

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
      { title: "Marksheet - EduTrack" },
      {
        name: "description",
        content:
          "View learner marks by subject with formative, summative, total and grade columns.",
      },
    ],
  }),
  component: MarksheetPage,
});

function MarksheetPage() {
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [termId, setTermId] = useState("");

  const schoolQuery = (query: any) => (schoolId ? query.eq("school_id", schoolId) : query);

  const { data: classes } = useQuery<ClassRow[]>({
    queryKey: ["marksheet-classes", schoolId],
    queryFn: async () =>
      (
        await schoolQuery(
          supabase.from("classes").select("id, name, education_level").order("name"),
        )
      ).data ?? [],
  });

  const { data: streams } = useQuery<StreamRow[]>({
    queryKey: ["marksheet-streams", schoolId],
    queryFn: async () =>
      (await schoolQuery(supabase.from("streams").select("id, name, class_id").order("name")))
        .data ?? [],
  });

  const { data: terms } = useQuery<TermRow[]>({
    queryKey: ["marksheet-terms", schoolId],
    queryFn: async () =>
      (
        await schoolQuery(
          supabase
            .from("terms")
            .select("id, name, is_current, academic_year_id")
            .order("start_date", { ascending: false }),
        )
      ).data ?? [],
  });

  const { data: subjects } = useQuery<SubjectRow[]>({
    queryKey: ["marksheet-subjects", schoolId],
    queryFn: async () =>
      (await schoolQuery(supabase.from("subjects").select("id, name").order("position"))).data ??
      [],
  });

  const { data: students } = useQuery<StudentRow[]>({
    queryKey: ["marksheet-students", schoolId],
    queryFn: async () =>
      (
        await schoolQuery(
          supabase
            .from("students")
            .select("id, full_name, class_id, stream_id")
            .eq("status", "active")
            .order("full_name"),
        )
      ).data ?? [],
  });

  const currentTermId = useMemo(
    () => terms?.find((term) => term.is_current)?.id ?? terms?.[0]?.id ?? "",
    [terms],
  );
  const selectedTermId = termId || currentTermId;

  const { data: assessments } = useQuery<AssessmentRow[]>({
    queryKey: ["marksheet-assessments", schoolId, selectedTermId],
    enabled: !!selectedTermId,
    queryFn: async () =>
      (
        await schoolQuery(
          supabase
            .from("assessments")
            .select("student_id, subject_id, formative, summative")
            .eq("term_id", selectedTermId)
            .eq("status", "approved"),
        )
      ).data ?? [],
  });
  const { data: gradingScales } = useQuery<GradingScaleRow[]>({
    queryKey: ["marksheet-grading-scales", schoolId],
    enabled: !!schoolId,
    queryFn: async () =>
      (
        await schoolQuery(
          supabase
            .from("grading_scales")
            .select("grade, min_score, max_score, descriptor, education_level, points")
            .eq("school_id", schoolId)
            .order("min_score", { ascending: false }),
        )
      ).data ?? [],
  });

  const visibleStudents = useMemo(
    () =>
      (students ?? [])
        .filter((student) => (classId ? student.class_id === classId : true))
        .filter((student) => (streamId ? student.stream_id === streamId : true))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [classId, streamId, students],
  );

  const visibleStreams = useMemo(
    () => (streams ?? []).filter((stream) => !classId || stream.class_id === classId),
    [classId, streams],
  );

  const selectedClassLevel = useMemo<"ordinary" | "advanced">(() => {
    const item = classes?.find((row) => row.id === classId);
    return item?.education_level === "advanced" ? "advanced" : "ordinary";
  }, [classId, classes]);
  const classLabel = (item: ClassRow | undefined) => {
    if (!item) return "";
    return `${item.name}${item.education_level === "advanced" ? " (A-Level)" : " (O-Level)"}`;
  };
  const selectedClassLabel = useMemo(
    () => classLabel(classes?.find((item) => item.id === classId)) ?? "",
    [classId, classes],
  );
  const selectedStreamName = useMemo(
    () => streams?.find((item) => item.id === streamId)?.name ?? "",
    [streamId, streams],
  );
  const title = useMemo(() => {
    const parts = [];
    if (selectedClassLabel) parts.push(selectedClassLabel);
    if (selectedStreamName) parts.push(selectedStreamName);
    const base = parts.length ? `${parts.join(" ")} Mark Sheet` : "Mark Sheet";
    return base.replace(/\s+/g, " ").trim();
  }, [selectedClassLabel, selectedStreamName]);

  const assessmentLookup = useMemo(() => {
    const map = new Map<string, AssessmentRow>();
    for (const item of assessments ?? []) {
      map.set(`${item.student_id}:${item.subject_id}`, item);
    }
    return map;
  }, [assessments]);

  const gradeFor = (total: number, level: "ordinary" | "advanced") => {
    const hit = (gradingScales ?? []).find(
      (scale) =>
        (scale.education_level ?? "ordinary") === level &&
        total >= Number(scale.min_score) &&
        total <= Number(scale.max_score),
    );
    return level === "advanced"
      ? (hit?.points?.toString() ?? hit?.grade ?? "")
      : (hit?.grade ?? "");
  };

  const scoreStats = useMemo(() => {
    const subjectCount = subjects?.length ?? 0;
    const learnerCount = visibleStudents.length;
    const assessedCells = visibleStudents.reduce((count, student) => {
      return (
        count +
        (subjects ?? []).filter((subject) => assessmentLookup.has(`${student.id}:${subject.id}`))
          .length
      );
    }, 0);
    return { subjectCount, learnerCount, assessedCells };
  }, [assessmentLookup, subjects, visibleStudents]);

  async function downloadExcel() {
    if (!subjects?.length || (!classId && !streamId)) return;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EduTrack";
    workbook.lastModifiedBy = "EduTrack";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = "Marksheet";
    workbook.title = title;
    const titleText = title;
    const scopeText =
      selectedClassLabel && selectedStreamName
        ? `${selectedClassLabel} / ${selectedStreamName}`
        : selectedClassLabel || selectedStreamName;
    const gradeHeader = selectedClassLevel === "advanced" ? "Points" : "Grade";
    const infoText = [
      `Term: ${terms?.find((term) => term.id === selectedTermId)?.name ?? "N/A"}`,
      scopeText ? `Scope: ${scopeText}` : "",
      `Learners: ${visibleStudents.length}`,
      `Subjects: ${subjects.length}`,
    ]
      .filter(Boolean)
      .join("  |  ");

    const headerRow1: string[] = ["Learner"];
    const headerRow2: string[] = ["Learner"];
    for (const subject of subjects) {
      headerRow1.push(subject.name, "", "", "");
      headerRow2.push("Formative", "Summative", "Total", gradeHeader);
    }

    const sheet = workbook.addWorksheet("Marksheet", {
      views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
      properties: { defaultRowHeight: 22 },
    });
    const subjectCount = subjects.length;
    const totalColumns = 1 + subjectCount * 4;
    const headerFill = "FFE8EEF9";
    const subjectFill = "FFDCE6F7";
    const learnerFill = "FFF5F7FB";
    const border = {
      top: { style: "thin", color: { argb: "FFD9DEE8" } },
      left: { style: "thin", color: { argb: "FFD9DEE8" } },
      bottom: { style: "thin", color: { argb: "FFD9DEE8" } },
      right: { style: "thin", color: { argb: "FFD9DEE8" } },
    } as const;

    const titleRow = sheet.addRow([titleText]);
    const infoRow = sheet.addRow([infoText]);
    sheet.addRow([]);
    const subjectRow = sheet.addRow(headerRow1);
    const detailRow = sheet.addRow(headerRow2);

    titleRow.height = 24;
    infoRow.height = 20;
    subjectRow.height = 22;
    detailRow.height = 20;

    for (const student of visibleStudents) {
      const values: (string | number | null)[] = [student.full_name];
      for (const subject of subjects) {
        const record = assessmentLookup.get(`${student.id}:${subject.id}`);
        const formative = record?.formative ?? null;
        const summative = record?.summative ?? null;
        const total =
          record?.formative != null || record?.summative != null
            ? Number(record.formative ?? 0) + Number(record.summative ?? 0)
            : null;
        const grade = total == null ? null : gradeFor(Number(total));
        values.push(formative, summative, total, grade);
      }
      sheet.addRow(values);
    }

    sheet.mergeCells(1, 1, 1, totalColumns);
    sheet.mergeCells(2, 1, 2, totalColumns);
    for (let index = 0; index < subjects.length; index += 1) {
      const start = 2 + index * 4;
      sheet.mergeCells(4, start, 4, start + 3);
    }

    const applyBanding = (rowNumber: number, fill: string, fontSize: number, bold = false) => {
      const row = sheet.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.font = { name: "Aptos", size: fontSize, bold, color: { argb: "FF1F2937" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = border;
      });
    };

    applyBanding(1, "FF123A63", 14, true);
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { name: "Aptos", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    });

    applyBanding(2, "FFEAF1FB", 10, false);
    applyBanding(4, subjectFill, 11, true);
    applyBanding(5, headerFill, 10, true);

    const learnerHeader = sheet.getCell("A5");
    learnerHeader.value = "Learner";
    learnerHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
    learnerHeader.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FF1F2937" } };
    learnerHeader.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    learnerHeader.border = border;

    for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = border;
        cell.alignment =
          colNumber === 1
            ? { vertical: "middle", horizontal: "left", wrapText: true }
            : { vertical: "middle", horizontal: "center", wrapText: true };
        if (colNumber === 1) {
          cell.font = { name: "Aptos", size: 10.5, bold: true, color: { argb: "FF111827" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: learnerFill } };
        } else {
          cell.font = { name: "Aptos", size: 10.5, color: { argb: "FF111827" } };
        }
      });
      if (rowNumber % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber !== 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }
        });
      }
    }

    const columns = [
      { width: 34 },
      ...subjects.flatMap(() => [{ width: 14 }, { width: 14 }, { width: 12 }, { width: 10 }]),
    ];
    sheet.columns = columns as { width: number }[];
    sheet.autoFilter = { from: "A5", to: sheet.getCell(sheet.rowCount, totalColumns).address };

    const schoolName = "EduTrack";
    const termName = terms?.find((term) => term.id === selectedTermId)?.name ?? "N/A";
    const safeTitle =
      `${schoolName}_${title}_${termName}`.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") ||
      "marksheet";

    await workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeTitle}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div>
      <PageHeader
        title={title}
        description="View learner scores by subject with formative, summative, total and grade columns."
        actions={
          <button
            type="button"
            onClick={downloadExcel}
            className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            disabled={!visibleStudents.length || !subjects?.length || (!classId && !streamId)}
          >
            {classId || streamId ? "Download Excel" : "Select class or stream to download"}
          </button>
        }
      />

      <Panel className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Filters</p>
            <p className="text-xs text-muted-foreground">
              Narrow the sheet by term, class, and stream.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="muted">{scoreStats.learnerCount} learners</Pill>
            <Pill tone="muted">{scoreStats.subjectCount} subjects</Pill>
            <Pill tone="muted">{scoreStats.assessedCells} scored cells</Pill>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Term
            </label>
            <select
              className={inputClass}
              value={selectedTermId}
              onChange={(event) => setTermId(event.target.value)}
            >
              <option value="">Select term</option>
              {(terms ?? []).map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                  {term.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-4">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Class
            </label>
            <select
              className={inputClass}
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setStreamId("");
              }}
            >
              <option value="">All classes</option>
              {(classes ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {classLabel(item)}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-4">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stream
            </label>
            <select
              className={inputClass}
              value={streamId}
              onChange={(event) => setStreamId(event.target.value)}
            >
              <option value="">All streams</option>
              {visibleStreams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Marksheet overview
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5" />
            Wide subject matrix
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Learners
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Subjects
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-max border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-30 w-56 border-b border-border bg-card px-3 py-3">
                  Learner
                </th>
                {(subjects ?? []).map((subject) => (
                  <th
                    key={subject.id}
                    colSpan={4}
                    className="min-w-[18rem] border-b border-border px-3 py-3 text-center text-foreground"
                  >
                    {subject.name}
                  </th>
                ))}
              </tr>
              <tr className="bg-card text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="sticky left-0 z-30 w-56 border-b border-border bg-card px-3 py-2" />
                {(subjects ?? []).map((subject) => (
                  <th
                    key={`${subject.id}-subheads`}
                    colSpan={4}
                    className="border-b border-border px-3 py-2"
                  >
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <span>Formative</span>
                      <span>Summative</span>
                      <span>Total</span>
                      <span>{selectedClassLevel === "advanced" ? "Points" : "Grade"}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student, index) => (
                <tr key={student.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="sticky left-0 z-20 w-56 border-b border-border bg-inherit px-3 py-3 align-middle">
                    <div className="font-medium leading-tight">{student.full_name}</div>
                  </td>
                  {(subjects ?? []).map((subject) => {
                    const record = assessmentLookup.get(`${student.id}:${subject.id}`);
                    const formative = record?.formative ?? "";
                    const summative = record?.summative ?? "";
                    const gradeTotal = Number(formative || 0) + Number(summative || 0);
                    const grade = gradeFor(gradeTotal, selectedClassLevel);
                    const total =
                      record?.formative != null || record?.summative != null
                        ? Number(record.formative ?? 0) + Number(record.summative ?? 0)
                        : "";
                    return (
                      <td
                        key={`${student.id}:${subject.id}`}
                        colSpan={4}
                        className="min-w-[18rem] border-b border-border px-3 py-3 align-middle"
                      >
                        <div className="grid grid-cols-4 gap-2 text-center text-xs sm:text-sm">
                          <span className="rounded-md bg-muted/40 px-2 py-1 font-medium">
                            {formative === "" ? "-" : formative}
                          </span>
                          <span className="rounded-md bg-muted/40 px-2 py-1 font-medium">
                            {summative === "" ? "-" : summative}
                          </span>
                          <span className="rounded-md bg-muted/40 px-2 py-1 font-semibold">
                            {total === "" ? "-" : total}
                          </span>
                          <span className="rounded-md bg-muted/40 px-2 py-1 font-semibold">
                            {grade || "-"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {visibleStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={1 + (subjects ?? []).length * 4}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    No learners match the selected filters.
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
