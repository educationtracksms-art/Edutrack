import { supabase } from "@/integrations/supabase/client";

const APPROVAL_RESULT_PAGE_SIZE = 1000;

async function fetchAllApprovalRows(
  queryPage: (from: number, to: number) => PromiseLike<any>,
) {
  const rows: any[] = [];
  for (let from = 0; ; from += APPROVAL_RESULT_PAGE_SIZE) {
    const { data, error } = await queryPage(from, from + APPROVAL_RESULT_PAGE_SIZE - 1);
    if (error) return { data: null, error };

    const page = (data ?? []) as any[];
    rows.push(...page);
    if (page.length < APPROVAL_RESULT_PAGE_SIZE) return { data: rows, error: null };
  }
}

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
  education_level?: "ordinary" | "advanced" | string | null;
  formative: number | null;
  mark?: number | null;
  summative: number | null;
  score?: number | null;
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
  const [assessments, aLevelAssessments, formativeMarks, students, classes, streams, subjects, subjectPapers, terms, allocations, periods] = await Promise.all([
    fetchAllApprovalRows((from, to) =>
      supabase
        .from("assessments")
        .select(
          "id, student_id, subject_id, paper_id, term_id, exam_type, formative, summative, score, is_missing, status, locked, rejection_reason, created_at, submitted_by",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      (supabase as any)
        .from("a_level_assessments")
        .select("id, student_id, subject_id, paper_id, term_id, exam_type, score, is_missing, status, locked, rejection_reason, created_at, submitted_by")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      (supabase as any)
        .from("formative_marks")
        .select("id, student_id, subject_id, paper_id, term_id, mark, is_missing, status, locked, created_at, submitted_by")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      supabase.from("students").select("id, full_name, class_id, stream_id, status").eq("school_id", schoolId).order("id").range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      supabase.from("classes").select("id, name, education_level").eq("school_id", schoolId).order("id").range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      supabase.from("streams").select("id, name").eq("school_id", schoolId).order("id").range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      supabase.from("subjects").select("id, name, education_level").eq("school_id", schoolId).order("id").range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      (supabase as any).from("subject_papers").select("id, subject_id, name").eq("school_id", schoolId).order("id").range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      supabase.from("terms").select("id, name").eq("school_id", schoolId).order("id").range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      (supabase as any)
        .from("teacher_allocations")
        .select("id, teacher_id, subject_id, paper_id, class_id, stream_id")
        .eq("school_id", schoolId)
        .order("id")
        .range(from, to),
    ),
    fetchAllApprovalRows((from, to) =>
      (supabase as any)
        .from("assessment_periods")
        .select("term_id, exam_type, is_active")
        .eq("school_id", schoolId)
        .order("term_id")
        .order("exam_type")
        .range(from, to),
    ),
  ]);

  const failedResult = [assessments, aLevelAssessments, formativeMarks, students, classes, streams, subjects, subjectPapers, terms, allocations, periods].find(
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

  const assessmentRecords = [
    ...((assessments.data ?? []) as unknown as ApprovalRow[]),
    ...((aLevelAssessments.data ?? []) as unknown as ApprovalRow[]).map((row) => ({
      ...row,
      formative: null,
      summative: null,
    })),
  ];
  const summativeRows = assessmentRecords.map((row) => {
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
      education_level: classLevelMap.get(classId ?? "") ?? "ordinary",
      student_name: studentMap.get(row.student_id) ?? "Unknown learner",
      subject_name: subjectMap.get(row.subject_id) ?? "Unknown subject",
      paper_name: row.paper_id ? paperMap.get(row.paper_id) ?? "Unknown paper" : "",
      term_name: termMap.get(row.term_id) ?? "Unknown term",
      class_name: classMap.get(classId ?? "") ?? "Unknown class",
      stream_name: streamMap.get(streamId ?? "") ?? "Unknown stream",
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
      education_level: classLevelMap.get(classId ?? "") ?? "ordinary",
      student_name: studentMap.get(row.student_id) ?? "Unknown learner",
      subject_name: subjectMap.get(row.subject_id) ?? "Unknown subject",
      paper_name: row.paper_id ? paperMap.get(row.paper_id) ?? "Unknown paper" : "",
      term_name: termMap.get(row.term_id) ?? "Unknown term",
      class_name: classMap.get(classId ?? "") ?? "Unknown class",
      stream_name: streamMap.get(streamId ?? "") ?? "Unknown stream",
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

  return {
    rows,
  };
}

