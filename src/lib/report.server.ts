import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportCardData, SubjectRow } from "./report-types";
import { descriptorFromIdentifier } from "./descriptor";

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
  const ids = students.map((s: any) => s.id);

  const [
    { data: school },
    { data: classes },
    { data: profiles },
    { data: roles },
    { data: streams },
    { data: subjects },
    { data: studentSubjects },
    { data: scales },
    { data: identifierScales },
    { data: toggles },
    { data: terms },
  ] = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolId).maybeSingle(),
    supabase.from("classes").select("id, name, class_teacher_id").eq("school_id", schoolId),
    supabase.from("profiles").select("id, full_name, school_id").eq("school_id", schoolId),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("streams").select("id, name").eq("school_id", schoolId),
    supabase
      .from("subjects")
      .select("id, name, position")
      .eq("school_id", schoolId)
      .order("position"),
    supabase
      .from("student_subjects")
      .select("student_id, subject_id")
      .in("student_id", ids)
      .eq("school_id", schoolId),
    supabase
      .from("grading_scales")
      .select("*")
      .eq("school_id", schoolId)
      .order("min_score", { ascending: false }),
    supabase
      .from("grading_identifier_scales")
      .select("*")
      .eq("school_id", schoolId)
      .order("identifier", { ascending: false }),
    supabase.from("feature_toggles").select("module, enabled").eq("school_id", schoolId),
    supabase
      .from("terms")
      .select("id, name, is_current, academic_year_id")
      .eq("school_id", schoolId),
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

  const termFilterId = term?.id ?? "00000000-0000-0000-0000-000000000000";
  const [{ data: assessments }, { data: attendance }, { data: comments }, { data: activities }] =
    await Promise.all([
      supabase
        .from("assessments")
        .select(
          "student_id, subject_id, formative, summative, teacher_initials, grade_descriptor, status",
        )
        .in("student_id", ids)
        .eq("term_id", termFilterId)
        .eq("status", "approved"),
      supabase
        .from("attendance_summaries")
        .select("*")
        .in("student_id", ids)
        .eq("term_id", termFilterId),
      supabase
        .from("report_comments")
        .select("*")
        .in("student_id", ids)
        .eq("term_id", termFilterId),
      supabase.from("co_curricular").select("*").in("student_id", ids).eq("term_id", termFilterId),
    ]);

  const feesEnabled = toggles?.find((t: any) => t.module === "fees")?.enabled ?? true;
  const attendanceEnabled = toggles?.find((t: any) => t.module === "attendance")?.enabled ?? true;
  const reportCardsEnabled = toggles?.find((t: any) => t.module === "report_cards")?.enabled ?? true;
  const coCurricularEnabled =
    toggles?.find((t: any) => t.module === "co_curricular")?.enabled ?? true;

  if (!reportCardsEnabled) {
    throw new Error("Report cards module is disabled");
  }

  const gradeFor = (total: number) => {
    const hit = (scales ?? []).find(
      (s: any) => total >= Number(s.min_score) && total <= Number(s.max_score),
    );
    return hit
      ? {
          grade: hit.grade as string,
          descriptor: hit.grade_descriptor as string,
          identifier: Number(hit.identifier),
        }
      : { grade: "", descriptor: "", identifier: 0 };
  };

  const schoolInitials =
    (school?.code as string) ?? ((school?.name as string) ?? "").slice(0, 3).toUpperCase();
  const headTeacherIds = new Set(
    (roles ?? []).filter((r: any) => r.role === "head_teacher").map((r: any) => r.user_id),
  );
  const headTeacherName =
    (profiles ?? []).find((p: any) => headTeacherIds.has(p.id))?.full_name ?? "";

  return students.map((student: any) => {
    const cls = classes?.find((c: any) => c.id === student.class_id);
    const className = cls?.name ?? "";
    const classTeacherName =
      (profiles ?? []).find((p: any) => p.id === cls?.class_teacher_id)?.full_name ?? "";
    const streamName = streams?.find((s: any) => s.id === student.stream_id)?.name ?? "";
    const marks = (assessments ?? []).filter((a: any) => a.student_id === student.id);
    const assignedSubjectIds = new Set(
      (studentSubjects ?? [])
        .filter((assignment: any) => assignment.student_id === student.id)
        .map((assignment: any) => assignment.subject_id),
    );

    const totals: number[] = [];

    const rows: SubjectRow[] = (subjects ?? [])
      .filter((subject: any) => assignedSubjectIds.has(subject.id))
      .map((subject: any) => {
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
        return {
          subject: subject.name,
          formative: fmt(formative),
          summative: fmt(summative),
          total: fmt(total),
          grade: g.grade,
          gradeDescriptor: g.descriptor,
          teacher: mark.teacher_initials ?? "",
        };
      });

    const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const identifierAvg = (average / 100) * 3;
    const identifierDescriptor =
      (identifierScales ?? []).find(
        (scale: any) =>
          identifierAvg >= Number(scale.min_score) && identifierAvg <= Number(scale.max_score),
      )?.descriptor ?? descriptorFromIdentifier(identifierAvg);

    const att = attendance?.find((a: any) => a.student_id === student.id);
    const comment = comments?.find((c: any) => c.student_id === student.id);
    const activity = activities?.find((a: any) => a.student_id === student.id);

    return {
      studentId: student.id,
      school: {
        name: school?.name ?? "",
        motto: school?.motto ?? null,
        address: school?.address ?? "",
        email: school?.email ?? "",
        phone: school?.phone ?? "",
        logoUrl: school?.logo_url ?? null,
        initials: schoolInitials,
      },
      title: `LEARNER'S END OF ${term?.name ?? ""} REPORT CARD ${yearName}`
        .replace(/\s+/g, " ")
        .trim(),
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
        descriptor: identifierDescriptor,
      },
      gradeKeys: (identifierScales ?? []).map((scale: any) => ({
        identifier: String(scale.identifier),
        range: `${fmt(Number(scale.min_score))} - ${fmt(Number(scale.max_score))}`,
        descriptor: scale.descriptor as string,
      })),
      coCurricular: {
        games: coCurricularEnabled ? (activity?.games ?? "") : "",
        clubs: coCurricularEnabled ? (activity?.clubs ?? "") : "",
        projects: coCurricularEnabled ? (activity?.projects ?? "") : "",
      },
      comments: {
        classTeacher: comment?.class_teacher_comment ?? "",
        headTeacher: comment?.head_teacher_comment ?? "",
      },
      staff: {
        classTeacher: classTeacherName,
        headTeacher: headTeacherName,
      },
    } satisfies ReportCardData;
  });
}
