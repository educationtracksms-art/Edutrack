import { supabase } from "@/integrations/supabase/client";

export type ApprovalRow = {
  id: string;
  student_id: string;
  subject_id: string;
  term_id: string;
  class_id?: string | null;
  stream_id?: string | null;
  formative: number | null;
  summative: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  rejection_reason: string | null;
  created_at?: string;
  submitted_by?: string | null;
  student_name?: string;
  subject_name?: string;
  term_name?: string;
  class_name?: string;
  stream_name?: string;
  submitted_by_name?: string;
};

type LookupRow = { id: string; name?: string; full_name?: string; class_id?: string | null; stream_id?: string | null };

export async function fetchDosApprovalRows(schoolId: string) {
  const [assessments, students, classes, streams, subjects, terms, profiles] = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "id, student_id, subject_id, term_id, formative, summative, status, locked, rejection_reason, created_at, submitted_by",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase.from("students").select("id, full_name, class_id, stream_id").eq("school_id", schoolId),
    supabase.from("classes").select("id, name").eq("school_id", schoolId),
    supabase.from("streams").select("id, name").eq("school_id", schoolId),
    supabase.from("subjects").select("id, name").eq("school_id", schoolId),
    supabase.from("terms").select("id, name").eq("school_id", schoolId),
    supabase.from("profiles").select("id, full_name").eq("school_id", schoolId),
  ]);

  const studentRows = (students.data ?? []) as LookupRow[];
  const classRows = (classes.data ?? []) as LookupRow[];
  const streamRows = (streams.data ?? []) as LookupRow[];
  const subjectRows = (subjects.data ?? []) as LookupRow[];
  const termRows = (terms.data ?? []) as LookupRow[];
  const profileRows = (profiles.data ?? []) as LookupRow[];

  const studentMap = new Map(studentRows.map((row) => [row.id, row.full_name ?? "Unknown learner"]));
  const studentClassMap = new Map(studentRows.map((row) => [row.id, row.class_id ?? null]));
  const studentStreamMap = new Map(studentRows.map((row) => [row.id, row.stream_id ?? null]));
  const classMap = new Map(classRows.map((row) => [row.id, row.name ?? "Unknown class"]));
  const streamMap = new Map(streamRows.map((row) => [row.id, row.name ?? "Unknown stream"]));
  const subjectMap = new Map(subjectRows.map((row) => [row.id, row.name ?? "Unknown subject"]));
  const termMap = new Map(termRows.map((row) => [row.id, row.name ?? "Unknown term"]));
  const profileMap = new Map(profileRows.map((row) => [row.id, row.full_name ?? "Unknown teacher"]));

  return (assessments.data ?? []).map((row: ApprovalRow) => {
    const classId = studentClassMap.get(row.student_id) ?? null;
    const streamId = studentStreamMap.get(row.student_id) ?? null;

    return {
      ...row,
      class_id: classId,
      stream_id: streamId,
      student_name: studentMap.get(row.student_id) ?? "Unknown learner",
      subject_name: subjectMap.get(row.subject_id) ?? "Unknown subject",
      term_name: termMap.get(row.term_id) ?? "Unknown term",
      class_name: classMap.get(classId ?? "") ?? "Unknown class",
      stream_name: streamMap.get(streamId ?? "") ?? "Unknown stream",
      submitted_by_name: row.submitted_by
        ? (profileMap.get(row.submitted_by) ?? "Unknown teacher")
        : "Not submitted",
    } satisfies ApprovalRow;
  });
}

