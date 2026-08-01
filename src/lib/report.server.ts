import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportCardData, SubjectRow } from "./report-types";

type AnyClient = SupabaseClient<any, any, any>;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export async function buildReportCards(
  supabase: AnyClient,
  studentIds: string[],
  termId: string | null,
): Promise<ReportCardData[]> {
  if (studentIds.length === 0) return [];

  const { data: students } = await supabase
    .from("students")
    .select(
      "id, school_id, lin, student_number, full_name, house, schpay_code, fees_balance, photo_url, class_id, stream_id",
    )
    .in("id", studentIds);
  if (!students || students.length === 0) return [];

  const schoolId = students[0].school_id as string;

  const [
    { data: school },
    { data: classes },
    { data: streams },
    { data: subjects },
    { data: scales },
    { data: toggles },
    { data: terms },
  ] = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolId).maybeSingle(),
    supabase.from("classes").select("id, name").eq("school_id", schoolId),
    supabase.from("streams").select("id, name").eq("school_id", schoolId),
    supabase.from("subjects").select("id, name, position").eq("school_id", schoolId).order("position"),
    supabase.from("grading_scales").select("*").eq("school_id", schoolId).order("min_score", { ascending: false }),
    supabase.from("feature_toggles").select("module, enabled").eq("school_id", schoolId),
    supabase.from("terms").select("id, name, is_current, academic_year_id").eq("school_id", schoolId),
  ]);

  const term =
    (termId ? terms?.find((t: any) => t.id === termId) : terms?.find((t: any) => t.is_current)) ??
    terms?.[0] ??
    null;

  let yearName = "";
  if (term) {
    const { data: year } = await supabase
      .from("academic_years")
      .select("name")
      .eq("id", term.academic_year_id)
      .maybeSingle();
    yearName = year?.name ?? "";
  }

  const ids = students.map((s: any) => s.id);
  const termFilterId = term?.id ?? "00000000-0000-0000-0000-000000000000";
  const [{ data: assessments }, { data: attendance }, { data: comments }, { data: activities }] =
    await Promise.all([
      supabase
        .from("assessments")
        .select("student_id, subject_id, formative, summative, teacher_initials, grade_descriptor, status")
        .in("student_id", ids)
        .eq("term_id", termFilterId)
        .eq("status", "approved"),
      supabase.from("attendance_summaries").select("*").in("student_id", ids).eq("term_id", termFilterId),
      supabase.from("report_comments").select("*").in("student_id", ids).eq("term_id", termFilterId),
      supabase.from("co_curricular").select("*").in("student_id", ids).eq("term_id", termFilterId),
    ]);

  const feesEnabled = toggles?.find((t: any) => t.module === "fees")?.enabled ?? true;
  const attendanceEnabled = toggles?.find((t: any) => t.module === "attendance")?.enabled ?? true;
  const coCurricularEnabled = toggles?.find((t: any) => t.module === "co_curricular")?.enabled ?? true;

  const gradeFor = (total: number) => {
    const hit = (scales ?? []).find(
      (s: any) => total >= Number(s.min_score) && total <= Number(s.max_score),
    );
    return hit
      ? { grade: hit.grade as string, descriptor: hit.descriptor as string, identifier: Number(hit.identifier) }
      : { grade: "", descriptor: "", identifier: 0 };
  };

  const overallDescriptor = (identifier: number) =>
    identifier >= 2.5 ? "Outstanding" : identifier >= 1.5 ? "Moderate" : identifier > 0 ? "Basic" : "";

  const schoolInitials = (school?.code as string) ?? (school?.name as string ?? "").slice(0, 3).toUpperCase();

  return students.map((student: any) => {
    const className = classes?.find((c: any) => c.id === student.class_id)?.name ?? "";
    const streamName = streams?.find((s: any) => s.id === student.stream_id)?.name ?? "";
    const marks = (assessments ?? []).filter((a: any) => a.student_id === student.id);

    const totals: number[] = [];
    const identifiers: number[] = [];

    const rows: SubjectRow[] = (subjects ?? []).map((subject: any) => {
      const mark = marks.find((m: any) => m.subject_id === subject.id);
      if (!mark || (mark.formative == null && mark.summative == null)) {
        return {
          subject: subject.name,
          formative: "",
          summative: "",
          total: "",
          grade: "",
          descriptor: "",
          teacher: mark?.teacher_initials ?? "",
        };
      }
      const formative = Number(mark.formative ?? 0);
      const summative = Number(mark.summative ?? 0);
      const total = Math.round((formative + summative) * 10) / 10;
      const g = gradeFor(total);
      totals.push(total);
      identifiers.push(g.identifier);
      return {
        subject: subject.name,
        formative: fmt(formative),
        summative: fmt(summative),
        total: fmt(total),
        grade: g.grade,
        descriptor: (mark.grade_descriptor as string | null) ?? g.descriptor,
        teacher: mark.teacher_initials ?? "",
      };
    });

    const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const identifierAvg = identifiers.length
      ? identifiers.reduce((a, b) => a + b, 0) / identifiers.length
      : 0;

    const att = attendance?.find((a: any) => a.student_id === student.id);
    const comment = comments?.find((c: any) => c.student_id === student.id);
    const activity = activities?.find((a: any) => a.student_id === student.id);

    return {
      studentId: student.id,
      school: {
        name: school?.name ?? "",
        address: school?.address ?? "",
        email: school?.email ?? "",
        phone: school?.phone ?? "",
        logoUrl: school?.logo_url ?? null,
        initials: schoolInitials,
      },
      title: `LEARNER'S END OF ${term?.name ?? ""} REPORT CARD ${yearName}`.replace(/\s+/g, " ").trim(),
      student: {
        lin: student.lin ?? student.student_number ?? "",
        name: student.full_name,
        schpayCode: student.schpay_code ?? "",
        feesBalance: feesEnabled ? String(student.fees_balance ?? 0) : null,
        house: student.house ?? "",
        classStream: [className, streamName].filter(Boolean).join(" "),
        photoUrl: student.photo_url ?? null,
      },
      attendance:
        attendanceEnabled && att
          ? {
              present: att.days_present,
              absent: att.days_absent,
              total: att.days_present + att.days_absent,
            }
          : attendanceEnabled
            ? { present: 0, absent: 0, total: 0 }
            : null,
      rows,
      overall: {
        average: `${average.toFixed(1)}%`,
        identifier: identifierAvg.toFixed(2),
        descriptor: overallDescriptor(identifierAvg),
      },
      gradeKeys: [
        { identifier: "3", range: "2.5 - 3.0", descriptor: "Outstanding" },
        { identifier: "2", range: "1.5 - 2.49", descriptor: "Moderate" },
        { identifier: "1", range: "0.9 - 1.49", descriptor: "Basic" },
      ],
      coCurricular: {
        games: coCurricularEnabled ? (activity?.games ?? "") : "",
        clubs: coCurricularEnabled ? (activity?.clubs ?? "") : "",
        projects: coCurricularEnabled ? (activity?.projects ?? "") : "",
      },
      comments: {
        classTeacher: comment?.class_teacher_comment ?? "",
        headTeacher: comment?.head_teacher_comment ?? "",
      },
    } satisfies ReportCardData;
  });
}
