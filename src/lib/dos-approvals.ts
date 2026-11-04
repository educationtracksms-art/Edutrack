import { supabase } from "@/integrations/supabase/client";

export type ApprovalRow = {
  id: string;
  record_type?: "summative" | "formative";
  student_id: string;
  subject_id: string;
  paper_id?: string | null;
  term_id: string;
  exam_type?: "beginning_of_term" | "mid_term" | "end_of_term" | string | null;
  active_exam_types?: string[];
  assessment_periods_configured?: boolean;
  class_id?: string | null;
  stream_id?: string | null;
  formative: number | null;
  mark?: number | null;
  summative: number | null;
  is_missing?: boolean;
  status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  rejection_reason: string | null;
  created_at?: string;
  submitted_by?: string | null;
  student_name?: string;
  subject_name?: string;
  paper_name?: string;
  term_name?: string;
  class_name?: string;
  stream_name?: string;
  submitted_by_name?: string;
};

export type AssessmentCoverageRow = {
  key: string;
  teacher_name: string;
  subject_name: string;
  paper_name: string;
  class_name: string;
  stream_name: string;
  term_name: string;
  assessed_count: number;
  submitted_count: number;
  approved_count: number;
  expected_count: number;
};

type LookupRow = {
  id: string;
  name?: string;
  full_name?: string;
  class_id?: string | null;
  stream_id?: string | null;
  status?: string;
  education_level?: string | null;
};

export async function fetchDosApprovalRows(schoolId: string) {
  const [assessments, formativeMarks, students, classes, streams, subjects, subjectPapers, terms, profiles, allocations, periods] = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "id, student_id, subject_id, paper_id, term_id, exam_type, formative, summative, is_missing, status, locked, rejection_reason, created_at, submitted_by",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("formative_marks")
      .select("id, student_id, subject_id, paper_id, term_id, mark, is_missing, status, locked, created_at, submitted_by")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase.from("students").select("id, full_name, class_id, stream_id, status").eq("school_id", schoolId),
    supabase.from("classes").select("id, name, education_level").eq("school_id", schoolId),
    supabase.from("streams").select("id, name").eq("school_id", schoolId),
    supabase.from("subjects").select("id, name, education_level").eq("school_id", schoolId),
    (supabase as any).from("subject_papers").select("id, subject_id, name").eq("school_id", schoolId),
    supabase.from("terms").select("id, name").eq("school_id", schoolId),
    supabase.from("profiles").select("id, full_name").eq("school_id", schoolId),
    (supabase as any)
      .from("teacher_allocations")
      .select("id, teacher_id, subject_id, paper_id, class_id, stream_id")
      .eq("school_id", schoolId),
    (supabase as any)
      .from("assessment_periods")
      .select("term_id, exam_type, is_active")
      .eq("school_id", schoolId),
  ]);

  const failedResult = [assessments, formativeMarks, students, classes, streams, subjects, subjectPapers, terms, profiles, allocations, periods].find(
    (result) => result.error,
  );
  if (failedResult?.error) {
    throw new Error(`Unable to load approval records: ${failedResult.error.message}`);
  }

  const studentRows = (students.data ?? []) as LookupRow[];
  const classRows = (classes.data ?? []) as LookupRow[];
  const streamRows = (streams.data ?? []) as LookupRow[];
  const subjectRows = (subjects.data ?? []) as LookupRow[];
  const subjectPaperRows = (subjectPapers.data ?? []) as Array<{
    id: string;
    name: string;
    subject_id: string;
  }>;
  const termRows = (terms.data ?? []) as LookupRow[];
  const profileRows = (profiles.data ?? []) as LookupRow[];
  const allocationRows = (allocations.data ?? []) as Array<{
    id: string;
    teacher_id: string;
    subject_id: string;
    paper_id: string | null;
    class_id: string | null;
    stream_id: string | null;
  }>;
  const periodRows = (periods.data ?? []) as Array<{
    term_id: string;
    exam_type: string;
    is_active: boolean;
  }>;

  const studentMap = new Map(studentRows.map((row) => [row.id, row.full_name ?? "Unknown learner"]));
  const studentClassMap = new Map(studentRows.map((row) => [row.id, row.class_id ?? null]));
  const studentStreamMap = new Map(studentRows.map((row) => [row.id, row.stream_id ?? null]));
  const classMap = new Map(classRows.map((row) => [row.id, row.name ?? "Unknown class"]));
  const classLevelMap = new Map(classRows.map((row) => [row.id, row.education_level ?? "ordinary"]));
  const streamMap = new Map(streamRows.map((row) => [row.id, row.name ?? "Unknown stream"]));
  const subjectMap = new Map(subjectRows.map((row) => [row.id, row.name ?? "Unknown subject"]));
  const paperMap = new Map(subjectPaperRows.map((row) => [row.id, row.name ?? "Unknown paper"]));
  const termMap = new Map(termRows.map((row) => [row.id, row.name ?? "Unknown term"]));
  const profileMap = new Map(profileRows.map((row) => [row.id, row.full_name ?? "Unknown teacher"]));

  const summativeRows = ((assessments.data ?? []) as unknown as ApprovalRow[]).map((row) => {
    const classId = studentClassMap.get(row.student_id) ?? null;
    const streamId = studentStreamMap.get(row.student_id) ?? null;

    return {
      ...row,
      record_type: "summative" as const,
      active_exam_types: periodRows
        .filter((period) => period.term_id === row.term_id && period.is_active)
        .map((period) => period.exam_type),
      assessment_periods_configured: periodRows.some((period) => period.term_id === row.term_id),
      // Formative is represented by the separate formative_marks record.
      // Do not display the legacy copy stored on a summative assessment row.
      formative: null,
      class_id: classId,
      stream_id: streamId,
      student_name: studentMap.get(row.student_id) ?? "Unknown learner",
      subject_name: subjectMap.get(row.subject_id) ?? "Unknown subject",
      paper_name: row.paper_id ? paperMap.get(row.paper_id) ?? "Unknown paper" : "",
      term_name: termMap.get(row.term_id) ?? "Unknown term",
      class_name: classMap.get(classId ?? "") ?? "Unknown class",
      stream_name: streamMap.get(streamId ?? "") ?? "Unknown stream",
      submitted_by_name: row.submitted_by
        ? (profileMap.get(row.submitted_by) ?? "Unknown teacher")
        : "Not submitted",
    } satisfies ApprovalRow;
  });
  const formativeRows = ((formativeMarks.data ?? []) as ApprovalRow[]).map((row) => {
    const classId = studentClassMap.get(row.student_id) ?? null;
    const streamId = studentStreamMap.get(row.student_id) ?? null;
    return {
      ...row,
      record_type: "formative" as const,
      formative: row.mark ?? null,
      summative: null,
      class_id: classId,
      stream_id: streamId,
      student_name: studentMap.get(row.student_id) ?? "Unknown learner",
      subject_name: subjectMap.get(row.subject_id) ?? "Unknown subject",
      paper_name: row.paper_id ? paperMap.get(row.paper_id) ?? "Unknown paper" : "",
      term_name: termMap.get(row.term_id) ?? "Unknown term",
      class_name: classMap.get(classId ?? "") ?? "Unknown class",
      stream_name: streamMap.get(streamId ?? "") ?? "Unknown stream",
      submitted_by_name: row.submitted_by
        ? (profileMap.get(row.submitted_by) ?? "Unknown teacher")
        : "Not submitted",
    } satisfies ApprovalRow;
  });
  const rows = [...summativeRows, ...formativeRows].sort(
    (a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );

  const activePeriodsByTerm = new Map<string, string[]>();
  for (const period of periodRows) {
    if (!period.is_active) continue;
    const activeTypes = activePeriodsByTerm.get(period.term_id) ?? [];
    if (!activeTypes.includes(period.exam_type)) activeTypes.push(period.exam_type);
    activePeriodsByTerm.set(period.term_id, activeTypes);
  }

  const recordLookup = new Map<string, ApprovalRow>();
  for (const row of rows) {
    const recordKey = [
      row.record_type,
      row.student_id,
      row.subject_id,
      row.paper_id ?? "subject",
      row.term_id,
      row.record_type === "formative" ? "formative" : row.exam_type ?? "end_of_term",
    ].join(":");
    recordLookup.set(recordKey, row);
  }
  const getRecord = (
    recordType: "formative" | "summative",
    studentId: string,
    subjectId: string,
    paperId: string | null,
    termId: string,
    examType: string,
  ) => recordLookup.get([recordType, studentId, subjectId, paperId ?? "subject", termId, examType].join(":"));

  const coverage: AssessmentCoverageRow[] = [];
  for (const allocation of allocationRows) {
    const subject = subjectRows.find((row) => row.id === allocation.subject_id);
    const assignedStudents = studentRows.filter(
      (student) =>
        student.status === "active" &&
        (classLevelMap.get(student.class_id ?? "") ?? "ordinary") ===
          (subject?.education_level ?? "ordinary") &&
        (!allocation.class_id || student.class_id === allocation.class_id) &&
        (!allocation.stream_id || student.stream_id === allocation.stream_id),
    );
    const subjectPapersForAllocation = subjectPaperRows.filter(
      (row) => row.subject_id === allocation.subject_id,
    );
    const coveragePapers = allocation.paper_id
      ? [
          subjectPapersForAllocation.find((row) => row.id === allocation.paper_id) ?? {
            id: allocation.paper_id,
            name: "Unknown paper",
            subject_id: allocation.subject_id,
          },
        ]
      : subjectPapersForAllocation.length
        ? subjectPapersForAllocation
        : [null];
    const teacherName = profileMap.get(allocation.teacher_id) ?? "Unknown teacher";

    for (const paper of coveragePapers) {
      const paperId = paper?.id ?? null;
      for (const [termId, activeTypes] of activePeriodsByTerm) {
        let assessedCount = 0;
        let submittedCount = 0;
        let approvedCount = 0;
        const expectedCount = assignedStudents.length * (activeTypes.length + 1);

        for (const student of assignedStudents) {
          const formative = getRecord(
            "formative",
            student.id,
            allocation.subject_id,
            paperId,
            termId,
            "formative",
          );
          const expectedRecords: (ApprovalRow | undefined)[] = [formative];
          for (const examType of activeTypes) {
            expectedRecords.push(
              getRecord(
                "summative",
                student.id,
                allocation.subject_id,
                paperId,
                termId,
                examType,
              ),
            );
          }
          for (const record of expectedRecords) {
            if (!record) continue;
            assessedCount += 1;
            if (record.status === "submitted" || record.status === "approved") submittedCount += 1;
            if (record.status === "approved") approvedCount += 1;
          }
        }

        const term = termRows.find((row) => row.id === termId);
        const classId = allocation.class_id;
        const streamId = allocation.stream_id;
        coverage.push({
          key: `${allocation.id}:${paperId ?? "subject"}:${termId}`,
          teacher_name: teacherName,
          subject_name: subjectMap.get(allocation.subject_id) ?? subject?.name ?? "Unknown subject",
          paper_name: paper?.name ?? "",
          class_name: classId ? classMap.get(classId) ?? "Unknown class" : "All classes",
          stream_name: streamId ? streamMap.get(streamId) ?? "Unknown stream" : "All streams",
          term_name: termMap.get(termId) ?? term?.name ?? "Unknown term",
          assessed_count: assessedCount,
          submitted_count: submittedCount,
          approved_count: approvedCount,
          expected_count: expectedCount,
        });
      }
    }
  }

  return {
    rows,
    coverage: coverage.sort(
      (a, b) =>
        a.term_name.localeCompare(b.term_name) ||
        a.class_name.localeCompare(b.class_name) ||
        a.subject_name.localeCompare(b.subject_name) ||
        a.teacher_name.localeCompare(b.teacher_name),
    ),
  };
}

