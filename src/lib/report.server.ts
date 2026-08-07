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
  const [{ data: assessments }, { data: attendance }, { data: activities }] = await Promise.all([
      supabase
        .from("assessments")
        .select(
          "student_id, subject_id, formative, summative, teacher_initials, grade_descriptor, status, approved_by, approved_at",
        )
        .in("student_id", ids)
        .eq("term_id", termFilterId)
        .eq("status", "approved"),
      supabase
        .from("attendance_summaries")
        .select("*")
        .in("student_id", ids)
        .eq("term_id", termFilterId),
      supabase.from("co_curricular").select("*").in("student_id", ids).eq("term_id", termFilterId),
    ]);

  const approvedAssessments = (assessments ?? []).filter((assessment: any) => assessment.status === "approved");

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
    const marks = approvedAssessments.filter((assessment: any) => assessment.student_id === student.id);
    const assignedSubjectIds = new Set(
      (studentSubjects ?? [])
        .filter((assignment: any) => assignment.student_id === student.id)
        .map((assignment: any) => assignment.subject_id),
    );
    const subjectIdsWithMarks = new Set(marks.map((mark: any) => mark.subject_id));
    const subjectIdsToRender = new Set([...assignedSubjectIds, ...subjectIdsWithMarks]);

    const totals: number[] = [];

    const rows: SubjectRow[] = (subjects ?? [])
      .filter((subject: any) => subjectIdsToRender.has(subject.id))
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
    const activity = activities?.find((a: any) => a.student_id === student.id);
    const approvedAssessment = marks.find((mark: any) => mark.approved_by || mark.approved_at);
    const approvedByName =
      approvedAssessment?.approved_by
        ? (profiles ?? []).find((p: any) => p.id === approvedAssessment.approved_by)?.full_name ?? ""
        : "";
    const gradeCounts: Record<"A" | "B" | "C" | "D" | "E", number> = rows.reduce(
      (counts, row) => {
        const grade = row.grade.trim().toUpperCase() as keyof typeof counts;
        if (grade in counts) {
          counts[grade] += 1;
        }
        return counts;
      },
      { A: 0, B: 0, C: 0, D: 0, E: 0 },
    );
    const learnerName = student.full_name ?? "";
    const resolveComment = (role: "class_teacher" | "head_teacher") => {
      if (gradeCounts.A >= 6) return "Exceptional Performance.";
      if (role === "class_teacher") {
        if (gradeCounts.A >= 4) return `${learnerName} demonstrates understanding of most competencies.`;
        if (gradeCounts.C >= 4) return `${learnerName} is making good progress in grasping key competencies.`;
        if (gradeCounts.B >= 3) return `${learnerName} has shown good performance but should consult to be exceptional.`;
        if (gradeCounts.D >= 3) return `${learnerName} needs to improve on concentration in class and time management.`;
        if (gradeCounts.E >= 2) return `${learnerName} should consult teachers for better results.`;
        return "";
      }

      if (gradeCounts.B >= 3) return `${learnerName} can do better.`;
      if (gradeCounts.C >= 4) return `${learnerName} is an average learner.`;
      if (gradeCounts.D >= 3) return `${learnerName} needs to improve.`;
      if (gradeCounts.E >= 2) return `${learnerName} should consult your facilitators.`;
      return "";
    };

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
      approval: approvedAssessment
        ? {
            name: approvedByName || "Director of Studies",
            role: "Director of Studies",
            approvedAt: approvedAssessment.approved_at
              ? new Date(approvedAssessment.approved_at).toLocaleDateString("en-UG", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "",
          }
        : null,
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
        classTeacher: resolveComment("class_teacher"),
        headTeacher: resolveComment("head_teacher"),
      },
      staff: {
        classTeacher: classTeacherName,
        headTeacher: headTeacherName,
      },
    } satisfies ReportCardData;
  });
}
