import { supabase } from "@/integrations/supabase/client";

export type ApprovalRow = {
  id: string;
  record_type?: "summative" | "formative";
  student_id: string;
  subject_id: string;
  paper_id?: string | null;
  term_id: string;
  exam_type?: "beginning_of_term" | "mid_term" | "end_of_term" | string | null;
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

type LookupRow = { id: string; name?: string; full_name?: string; class_id?: string | null; stream_id?: string | null };

export async function fetchDosApprovalRows(schoolId: string) {
  const [assessments, formativeMarks, students, classes, streams, subjects, subjectPapers, terms, profiles] = await Promise.all([
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
    supabase.from("students").select("id, full_name, class_id, stream_id").eq("school_id", schoolId),
    supabase.from("classes").select("id, name").eq("school_id", schoolId),
    supabase.from("streams").select("id, name").eq("school_id", schoolId),
    supabase.from("subjects").select("id, name").eq("school_id", schoolId),
    (supabase as any).from("subject_papers").select("id, subject_id, name").eq("school_id", schoolId),
    supabase.from("terms").select("id, name").eq("school_id", schoolId),
    supabase.from("profiles").select("id, full_name").eq("school_id", schoolId),
  ]);

  const failedResult = [assessments, formativeMarks, students, classes, streams, subjects, subjectPapers, terms, profiles].find(
    (result) => result.error,
  );
  if (failedResult?.error) {
    throw new Error(`Unable to load approval records: ${failedResult.error.message}`);
  }

  const studentRows = (students.data ?? []) as LookupRow[];
  const classRows = (classes.data ?? []) as LookupRow[];
  const streamRows = (streams.data ?? []) as LookupRow[];
  const subjectRows = (subjects.data ?? []) as LookupRow[];
  const subjectPaperRows = (subjectPapers.data ?? []) as LookupRow[];
  const termRows = (terms.data ?? []) as LookupRow[];
  const profileRows = (profiles.data ?? []) as LookupRow[];

  const studentMap = new Map(studentRows.map((row) => [row.id, row.full_name ?? "Unknown learner"]));
  const studentClassMap = new Map(studentRows.map((row) => [row.id, row.class_id ?? null]));
  const studentStreamMap = new Map(studentRows.map((row) => [row.id, row.stream_id ?? null]));
  const classMap = new Map(classRows.map((row) => [row.id, row.name ?? "Unknown class"]));
  const streamMap = new Map(streamRows.map((row) => [row.id, row.name ?? "Unknown stream"]));
  const subjectMap = new Map(subjectRows.map((row) => [row.id, row.name ?? "Unknown subject"]));
  const paperMap = new Map(subjectPaperRows.map((row) => [row.id, row.name ?? "Unknown paper"]));
  const termMap = new Map(termRows.map((row) => [row.id, row.name ?? "Unknown term"]));
  const profileMap = new Map(profileRows.map((row) => [row.id, row.full_name ?? "Unknown teacher"]));

  const summativeRows = (assessments.data ?? []).map((row: ApprovalRow) => {
    const classId = studentClassMap.get(row.student_id) ?? null;
    const streamId = studentStreamMap.get(row.student_id) ?? null;

    return {
      ...row,
      record_type: "summative" as const,
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
  return [...summativeRows, ...formativeRows].sort(
    (a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
}

