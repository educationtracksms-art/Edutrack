import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportCardData, SubjectRow } from "./report-types";
import { descriptorFromIdentifier } from "./descriptor";

type AnyClient = SupabaseClient<any, any, any>;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
// Score boundaries are configured values, not calculated marks. Keep their saved precision on reports.
const formatScoreBoundary = (value: unknown) => String(value ?? "").trim();

export async function buildReportCards(
  supabase: AnyClient,
  studentIds: string[],
  termId: string | null,
  requestedLevel?: "ordinary" | "advanced",
): Promise<ReportCardData[]> {
  if (studentIds.length === 0) return [];

  const requestedStudentIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (requestedStudentIds.length === 0) return [];

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select(
      "id, school_id, lin, student_number, full_name, house, schpay_code, fees_balance, photo_url, class_id, stream_id",
    )
    .in("id", requestedStudentIds);
  if (studentsError) throw new Error(`Unable to load learners for report cards: ${studentsError.message}`);
  if (!students || students.length === 0) {
    throw new Error("No selected learners were found in your school");
  }
  if (students.length !== requestedStudentIds.length) {
    throw new Error("One or more selected learners are no longer available");
  }

  const schoolId = students[0].school_id as string;
  if (students.some((student: any) => student.school_id !== schoolId)) {
    throw new Error("Selected learners must belong to the same school");
  }
  const ids = students.map((s: any) => s.id);

  const setupResults = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolId).maybeSingle(),
    supabase
      .from("classes")
      .select("id, name, class_teacher_id, education_level")
      .eq("school_id", schoolId),
    supabase.from("profiles").select("id, full_name, school_id").eq("school_id", schoolId),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("streams").select("id, name").eq("school_id", schoolId),
    supabase
      .from("subjects")
      .select("id, name, position, points, education_level, is_subsidiary")
      .eq("school_id", schoolId)
      .order("position"),
    (supabase as any)
      .from("subject_papers")
      .select("id, subject_id, name, position")
      .eq("school_id", schoolId)
      .order("position"),
    supabase
      .from("student_subjects")
      .select("student_id, subject_id")
      .in("student_id", ids)
      .eq("school_id", schoolId),
    supabase
      .from("grading_scales")
      .select("grade, min_score, max_score, grade_descriptor, education_level, points")
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
    supabase
      .from("report_comments")
      .select("student_id, term_id, class_teacher_comment, head_teacher_comment")
      .in("student_id", ids),
  ]);

  const setupError = setupResults.find((result) => result.error);
  if (setupError?.error) {
    throw new Error(`Unable to load report-card setup: ${setupError.error.message}`);
  }

  const [
    { data: school },
    { data: classes },
    { data: profiles },
    { data: roles },
    { data: streams },
    { data: subjects },
    { data: subjectPapers },
    { data: studentSubjects },
    { data: scales },
    { data: identifierScales },
    { data: toggles },
    { data: terms },
    { data: reportComments },
  ] = setupResults;

  const levelStudents = students.filter((student: any) => {
    const classRow = (classes ?? []).find((item: any) => item.id === student.class_id);
    const level = classRow?.education_level === "advanced" ? "advanced" : "ordinary";
    return requestedLevel ? level === requestedLevel : true;
  });
  const levelSet = new Set(
    students.map((student: any) => {
      const classRow = (classes ?? []).find((item: any) => item.id === student.class_id);
      return classRow?.education_level === "advanced" ? "advanced" : "ordinary";
    }),
  );
  if (!requestedLevel && levelSet.size > 1) {
    throw new Error("Generate O-Level and A-Level reports separately");
  }
  if (requestedLevel && levelStudents.length !== students.length) {
    throw new Error("The selected learners must all belong to the selected report level");
  }
  if (!levelStudents.length) {
    throw new Error("No learners were found for the selected report level");
  }
  const reportStudentIds = levelStudents.map((student: any) => student.id);

  const term = termId
    ? terms?.find((t: any) => t.id === termId) ?? null
    : terms?.find((t: any) => t.is_current) ?? terms?.[0] ?? null;
  if (termId && !term) throw new Error("The selected term is not available in your school");
  if (!term) throw new Error("Create an academic term before generating report cards");

  let yearName = "";
  {
    const { data: year, error: yearError } = await supabase
      .from("academic_years")
      .select("name")
      .eq("id", term.academic_year_id)
      .maybeSingle();
    if (yearError) throw new Error(`Unable to load the academic year: ${yearError.message}`);
    yearName = year?.name ?? "";
  }

  const termFilterId = term?.id ?? "00000000-0000-0000-0000-000000000000";
  const resultResults = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "student_id, subject_id, paper_id, exam_type, formative, summative, is_missing, teacher_initials, grade_descriptor, status, approved_by, approved_at",
      )
      .in("student_id", reportStudentIds)
      .eq("term_id", termFilterId)
      .eq("status", "approved"),
    supabase
      .from("attendance_summaries")
      .select("*")
      .in("student_id", reportStudentIds)
      .eq("term_id", termFilterId),
    supabase
      .from("co_curricular")
      .select("*")
      .in("student_id", reportStudentIds)
      .eq("term_id", termFilterId),
    (supabase as any)
      .from("formative_marks")
      .select("student_id, subject_id, paper_id, mark, is_missing, teacher_initials, status, approved_by, approved_at")
      .in("student_id", reportStudentIds)
      .eq("term_id", termFilterId)
      .eq("status", "approved"),
    (supabase as any)
      .from("assessment_periods")
      .select("exam_type")
      .eq("school_id", schoolId)
      .eq("term_id", termFilterId)
      .eq("is_active", true),
  ]);
  const resultError = resultResults.find((result) => result.error);
  if (resultError?.error) {
    throw new Error(`Unable to load report-card results: ${resultError.error.message}`);
  }
  const [
    { data: assessments },
    { data: attendance },
    { data: activities },
    { data: formativeMarks },
    { data: activePeriods },
  ] = resultResults;
  const { data: commentRules, error: commentRulesError } = await supabase
    .from("report_comment_rules")
    .select("comment_role, points, descriptor, comment")
    .eq("school_id", schoolId);
  if (commentRulesError) {
    throw new Error(`Unable to load report comment rules: ${commentRulesError.message}`);
  }

  // Only approved marks from periods activated for this term count towards a
  // report. Inactive BOT/MOT/EOT periods must not appear or affect totals.
  // A report must use the periods activated for the selected term. For older
  // schools that have approved marks but no assessment_periods rows yet,
  // retain those approved marks so report generation does not produce a blank
  // card; once periods are configured, the activation rule is enforced.
  const configuredActiveTypes = new Set((activePeriods ?? []).map((period: any) => period.exam_type));
  const activeTypes = configuredActiveTypes.size
    ? configuredActiveTypes
    : new Set((assessments ?? []).map((assessment: any) => assessment.exam_type));
  const approvedAssessments = (assessments ?? []).filter(
    (assessment: any) =>
      assessment.status === "approved" && activeTypes.has(assessment.exam_type),
  );

  const feesEnabled = toggles?.find((t: any) => t.module === "fees")?.enabled ?? true;
  const attendanceEnabled = toggles?.find((t: any) => t.module === "attendance")?.enabled ?? true;
  const coCurricularEnabled =
    toggles?.find((t: any) => t.module === "co_curricular")?.enabled ?? true;

  const gradeFor = (total: number, educationLevel: "ordinary" | "advanced") => {
    const hit = (scales ?? []).find(
      (s: any) =>
        (s.education_level ?? "ordinary") === educationLevel &&
        total >= Number(s.min_score) &&
        total <= Number(s.max_score),
    );
    if (!hit) {
      throw new Error(
        `No ${educationLevel} grading scale covers a total score of ${total}. Add a grading-scale range that includes this score.`,
      );
    }
    const grade = typeof hit.grade === "string" ? hit.grade.trim() : "";
    const descriptor =
      typeof hit.grade_descriptor === "string" ? hit.grade_descriptor.trim() : "";
    const points = Number(hit.points ?? 0);
    if (
      !grade ||
      (educationLevel === "ordinary" && !descriptor) ||
      (educationLevel === "advanced" && (!Number.isFinite(points) || points < 1 || points > 5))
    ) {
      throw new Error(
        educationLevel === "advanced"
          ? `The A-level grading scale for scores ${hit.min_score}–${hit.max_score} is incomplete. Add a grade and points value.`
          : `The ordinary-level grading scale for scores ${hit.min_score}–${hit.max_score} is incomplete. Add both a grade and grade descriptor.`,
      );
    }
    return { grade, descriptor, points };
  };

  const schoolInitials =
    (school?.code as string) ?? ((school?.name as string) ?? "").slice(0, 3).toUpperCase();
  const headTeacherIds = new Set(
    (roles ?? []).filter((r: any) => r.role === "head_teacher").map((r: any) => r.user_id),
  );
  const headTeacherName =
    (profiles ?? []).find((p: any) => headTeacherIds.has(p.id))?.full_name ?? "";

  return levelStudents.map((student: any) => {
    const cls = classes?.find((c: any) => c.id === student.class_id);
    const educationLevel = (cls?.education_level ?? "ordinary") as "ordinary" | "advanced";
    const className = cls?.name ?? "";
    const classTeacherName =
      (profiles ?? []).find((p: any) => p.id === cls?.class_teacher_id)?.full_name ?? "";
    const streamName = streams?.find((s: any) => s.id === student.stream_id)?.name ?? "";
    const marks = approvedAssessments.filter(
      (assessment: any) => assessment.student_id === student.id,
    );
    const studentFormativeMarks = (formativeMarks ?? []).filter(
      (mark: any) => mark.student_id === student.id,
    );
    const assignedSubjectIds = new Set(
      (studentSubjects ?? [])
        .filter((assignment: any) => assignment.student_id === student.id)
        .map((assignment: any) => assignment.subject_id),
    );
    const subjectIdsWithMarks = new Set([
      ...marks.map((mark: any) => mark.subject_id),
      ...studentFormativeMarks.map((mark: any) => mark.subject_id),
    ]);
    const subjectIdsToRender = new Set([...assignedSubjectIds, ...subjectIdsWithMarks]);

    const totals: number[] = [];

    const rows: SubjectRow[] = (subjects ?? [])
      .filter(
        (subject: any) =>
          subjectIdsToRender.has(subject.id) &&
          (subjectIdsWithMarks.has(subject.id) ||
            (subject.education_level ?? "ordinary") === educationLevel),
      )
      .map((subject: any) => {
        const isAssignedSubject = assignedSubjectIds.has(subject.id);
        const papers =
          educationLevel === "advanced"
            ? (subjectPapers ?? []).filter((p: any) => p.subject_id === subject.id)
            : [];
        const subjectMaxPoints = Number(subject.points ?? 0);
        const advancedGradeFor = (score: number) => {
          if (subject.is_subsidiary) {
            const passed = score >= 50;
            return {
              grade: passed ? "PASS" : "FAIL",
              descriptor: "",
              points: passed ? 1 : 0,
            };
          }
          return gradeFor(score, "advanced");
        };
        const paperRows = papers.length ? papers : [null];
        const renderedPaperRows = paperRows
          .map((paper: any) => {
            const subjectMarks = marks.filter(
              (m: any) =>
                m.subject_id === subject.id && (paper ? m.paper_id === paper.id : !m.paper_id),
            );
            const mark = subjectMarks[subjectMarks.length - 1];
            const summativeMarks = subjectMarks
              .filter((m: any) => m.summative != null)
              .map((m: any) => Number(m.summative))
              .filter((value: number) => Number.isFinite(value));
            const averageSummative = summativeMarks.length
              ? summativeMarks.reduce((sum: number, value: number) => sum + value, 0) /
                summativeMarks.length
              : null;
            const summativeByPeriod = {
              beginning_of_term: subjectMarks.find((m: any) => m.exam_type === "beginning_of_term")?.summative,
              mid_term: subjectMarks.find((m: any) => m.exam_type === "mid_term")?.summative,
              end_of_term: subjectMarks.find((m: any) => m.exam_type === "end_of_term")?.summative,
            };
            const periodValue = (period: keyof typeof summativeByPeriod) =>
              activeTypes.has(period) && summativeByPeriod[period] != null
                ? fmt(Number(summativeByPeriod[period]))
                : "";
            // Formative is one whole-term mark per paper. Legacy subject-level
            // records remain a fallback so historic report cards still render.
            const formativeRecord = studentFormativeMarks.find(
              (m: any) =>
                m.subject_id === subject.id &&
                (m.paper_id ?? null) === (paper?.id ?? null),
            ) ??
              (paper
                ? studentFormativeMarks.find(
                    (m: any) => m.subject_id === subject.id && !m.paper_id,
                  )
                : undefined);
            const standaloneFormative = formativeRecord?.mark;
            const legacyFormative = subjectMarks
              .map((m: any) => m.formative)
              .find((value: unknown) => value != null);
            const formativeMark =
              standaloneFormative != null
                ? Number(standaloneFormative)
                : legacyFormative != null
                  ? Number(legacyFormative)
                  : undefined;
            const hasExplicitMissingMark =
              Boolean(formativeRecord?.is_missing) || subjectMarks.some((item: any) => item.is_missing);
            const isMissingMark =
              hasExplicitMissingMark ||
              ((Boolean(mark) || formativeMark !== undefined) &&
                (formativeMark === undefined || averageSummative == null)) ||
              (isAssignedSubject && !mark && formativeMark === undefined);
            if (isMissingMark) {
              // An approved missing mark is a real result: show it on the report and
              // include it as zero when calculating the learner's average.
              if (educationLevel !== "advanced" || papers.length <= 1) totals.push(0);
              return {
                subject: subject.name,
                paperName: paper?.name ?? "",
                subjectId: subject.id,
                paperId: paper?.id ?? null,
                isPaper: false,
                formative: formativeMark === undefined ? "MISSING MARK" : fmt(formativeMark),
                summative: averageSummative == null ? "MISSING MARK" : fmt(averageSummative),
                bot: hasExplicitMissingMark ? "MISSING MARK" : periodValue("beginning_of_term"),
                mot: hasExplicitMissingMark ? "MISSING MARK" : periodValue("mid_term"),
                eot: hasExplicitMissingMark ? "MISSING MARK" : periodValue("end_of_term"),
                total: "MISSING MARK",
                grade: "",
                gradeDetail: "",
                subjectPoints: educationLevel === "advanced" ? "0" : "",
                teacher: mark?.teacher_initials ??
                  formativeRecord?.teacher_initials ??
                  "",
              };
            }
            if (!mark) {
              return {
                subject: subject.name,
                paperName: paper?.name ?? "",
                subjectId: subject.id,
                paperId: paper?.id ?? null,
                isPaper: false,
                formative: "",
                summative: "",
                bot: periodValue("beginning_of_term"),
                mot: periodValue("mid_term"),
                eot: periodValue("end_of_term"),
                total: "",
                grade: "",
                gradeDetail: "",
                subjectPoints: "",
                teacher:
                  formativeRecord?.teacher_initials ?? "",
              };
            }
            const formative = formativeMark ?? 0;
            const summative = averageSummative ?? 0;
            const total = Math.round((formative + summative) * 10) / 10;
            const g =
              educationLevel === "advanced"
                ? papers.length > 1
                  ? null
                  : advancedGradeFor(total)
                : gradeFor(total, educationLevel);
            const weightedPoints =
              educationLevel === "advanced"
                ? subject.is_subsidiary
                  ? total >= 50
                    ? 1
                    : 0
                    : Math.min(subjectMaxPoints || 0, g?.points || 0)
                : 0;
            if (educationLevel !== "advanced" || papers.length <= 1) totals.push(total);
            return {
              subject: subject.name,
              paperName: paper?.name ?? "",
              subjectId: subject.id,
              paperId: paper?.id ?? null,
              isPaper: false,
              formative: fmt(formative),
              summative: fmt(summative),
              bot: periodValue("beginning_of_term"),
              mot: periodValue("mid_term"),
              eot: periodValue("end_of_term"),
              total: fmt(total),
              grade: g?.grade ?? "",
              gradeDetail: educationLevel === "advanced" ? "" : g.descriptor,
              subjectPoints:
                educationLevel === "advanced"
                  ? String(
                      papers.length > 1
                        ? ""
                        : subject.is_subsidiary
                        ? weightedPoints
                        : weightedPoints || subjectMaxPoints || 0,
                    )
                  : "",
              teacher: mark.teacher_initials ?? "",
            };
          })
          .flat();
        if (educationLevel !== "advanced") return renderedPaperRows;

        if (papers.length <= 1) {
          const row = renderedPaperRows[0];
          if (!row || !String(row.total).trim()) return renderedPaperRows;
          if (row.total === "MISSING MARK") {
            return [
              ...renderedPaperRows,
              {
                subject: `${subject.name} - TOTAL`,
                subjectId: subject.id,
                paperId: null,
                isSubjectSummary: true,
                formative: "",
                summative: "",
                bot: "",
                mot: "",
                eot: "",
                total: "MISSING MARK",
                totalAverage: "MISSING MARK",
                grade: "",
                gradeDetail: "",
                subjectPoints: "0",
                teacher: "",
              },
            ];
          }
          const subjectTotal = Number(row.total);
          const subjectGrade = advancedGradeFor(subjectTotal);
          const subjectPoints = subject.is_subsidiary
            ? subjectGrade.points
            : Math.min(subjectMaxPoints || 0, subjectGrade.points || 0);
          return [
            ...renderedPaperRows,
            {
              subject: `${subject.name} - TOTAL`,
              subjectId: subject.id,
              paperId: null,
              isSubjectSummary: true,
              formative: "",
              summative: "",
              bot: "",
              mot: "",
              eot: "",
              total: fmt(subjectTotal),
              totalAverage: fmt(subjectTotal),
              grade: subjectGrade.grade,
              gradeDetail: "",
              subjectPoints: String(
                subject.is_subsidiary ? subjectPoints : subjectPoints || subjectMaxPoints || 0,
              ),
              teacher: row.teacher,
            },
          ];
        }

        const paperTotals = renderedPaperRows.map((row) =>
          String(row.total).trim() ? Number(row.total) : Number.NaN,
        );
        if (paperTotals.some((value) => !Number.isFinite(value))) {
          totals.push(0);
          return [
            ...renderedPaperRows,
            {
              subject: `${subject.name} - TOTAL`,
              subjectId: subject.id,
              paperId: null,
              isSubjectSummary: true,
              formative: "",
              summative: "",
              bot: "",
              mot: "",
              eot: "",
              total: "MISSING MARK",
              totalAverage: "MISSING MARK",
              grade: "",
              gradeDetail: "",
              subjectPoints: "0",
              teacher: "",
            },
          ];
        }
        const subjectTotal = Math.round(paperTotals.reduce((sum, value) => sum + value, 0) * 10) / 10;
        const subjectAverage = subjectTotal / papers.length;
        const subjectGrade = advancedGradeFor(subjectAverage);
        const subjectPoints = subject.is_subsidiary
          ? subjectAverage >= 50 ? 1 : 0
          : Math.min(subjectMaxPoints || 0, subjectGrade.points || 0);
        totals.push(subjectAverage);
        return [
          ...renderedPaperRows,
          {
            subject: `${subject.name} - TOTAL`,
            subjectId: subject.id,
            paperId: null,
            isSubjectSummary: true,
            formative: "",
            summative: "",
            bot: "",
            mot: "",
            eot: "",
            total: fmt(subjectTotal),
            totalAverage: fmt(subjectAverage),
            grade: subjectGrade.grade,
            gradeDetail: "",
            subjectPoints: String(subject.is_subsidiary ? subjectPoints : subjectPoints || subjectMaxPoints || 0),
            teacher: renderedPaperRows.map((row) => row.teacher).filter(Boolean).join(", "),
          },
        ];
      })
      .flat();

    const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const identifierAvg = (average / 100) * 3;
    const identifierDescriptor =
      educationLevel === "advanced"
        ? ""
        : ((identifierScales ?? []).find(
            (scale: any) =>
              identifierAvg >= Number(scale.min_score) && identifierAvg <= Number(scale.max_score),
          )?.descriptor ?? descriptorFromIdentifier(identifierAvg));
    const totalPoints =
      educationLevel === "advanced"
        ? rows
            .filter((row) =>
              row.isSubjectSummary ||
              !rows.some((summary) => summary.isSubjectSummary && summary.subjectId === row.subjectId),
            )
            .reduce((sum, row) => sum + Number(row.subjectPoints || 0), 0)
        : null;
    const hasSubsidiarySubject = (subjects ?? []).some(
      (subject: any) =>
        subject.education_level === "advanced" &&
        subject.is_subsidiary &&
        subjectIdsToRender.has(subject.id),
    );
    const att = attendance?.find((a: any) => a.student_id === student.id);
    const activity = activities?.find((a: any) => a.student_id === student.id);
    const savedComments = (reportComments ?? []).find(
      (comment: any) => comment.student_id === student.id && comment.term_id === term.id,
    );
    const approvedAssessment =
      marks.find((mark: any) => mark.approved_by || mark.approved_at) ??
      studentFormativeMarks.find((mark: any) => mark.approved_by || mark.approved_at);
    const approvedByName = approvedAssessment?.approved_by
      ? ((profiles ?? []).find((p: any) => p.id === approvedAssessment.approved_by)?.full_name ??
        "")
      : "";
    const gradeCounts: Record<"A" | "B" | "C" | "D" | "E", number> = rows.reduce(
      (counts, row) => {
        const grade = (row.grade ?? "").trim().toUpperCase() as keyof typeof counts;
        if (grade in counts) {
          counts[grade] += 1;
        }
        return counts;
      },
      { A: 0, B: 0, C: 0, D: 0, E: 0 },
    );
    const learnerName = student.full_name ?? "";
    const resolveComment = (role: "class_teacher" | "head_teacher") => {
      if (educationLevel === "advanced") {
        const matchedRule = (commentRules ?? []).find(
          (rule: any) =>
            rule.comment_role === role &&
            rule.points != null &&
            Number(rule.points) === Number(totalPoints ?? -1),
        );
        if (matchedRule) return matchedRule.comment as string;
        return "";
      }

      if (gradeCounts.A >= 6) return "Exceptional Performance.";
      if (role === "class_teacher") {
        if (gradeCounts.A >= 4)
          return `${learnerName} demonstrates understanding of most competencies.`;
        if (gradeCounts.C >= 4)
          return `${learnerName} is making good progress in grasping key competencies.`;
        if (gradeCounts.B >= 3)
          return `${learnerName} has shown good performance but should consult to be exceptional.`;
        if (gradeCounts.D >= 3)
          return `${learnerName} needs to improve on concentration in class and time management.`;
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
        reportPaymentReferenceType:
          (school?.report_payment_reference_type as "schpay_code" | "account_number" | null) ??
          "schpay_code",
        reportAccountNumber: school?.report_account_number ?? null,
        reportNextTermBeginsOn: school?.report_next_term_begins_on ?? null,
      },
      gradingLevel: educationLevel,
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
              total: att.total_days ?? att.days_present + att.days_absent,
            }
          : attendanceEnabled
            ? { present: 0, absent: 0, total: 0 }
            : null,
      rows,
      activeSummativePeriods: [
        activeTypes.has("beginning_of_term") ? "BOT" : null,
        activeTypes.has("mid_term") ? "MOT" : null,
        activeTypes.has("end_of_term") ? "EOT" : null,
      ].filter(Boolean) as ("BOT" | "MOT" | "EOT")[],
      overall: {
        average: `${average.toFixed(1)}%`,
        metricLabel: "Identifier out of three",
        metric: identifierAvg.toFixed(2),
        descriptor: identifierDescriptor,
      },
      totalPoints,
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
      gradeKeys:
        educationLevel === "advanced"
          ? [
              ...(scales ?? [])
                .filter((scale: any) => (scale.education_level ?? "ordinary") === "advanced")
                .map((scale: any) => ({
                  identifier: scale.grade as string,
                  range: `${formatScoreBoundary(scale.min_score)} - ${formatScoreBoundary(scale.max_score)}`,
                  detail: String(Number(scale.points ?? 0)),
                })),
              ...(hasSubsidiarySubject
                ? [
                    { identifier: "PASS", range: "50 - 100", detail: "1" },
                    { identifier: "FAIL", range: "0 - 49.9", detail: "0" },
                  ]
                : []),
            ]
          : (identifierScales ?? []).map((scale: any) => ({
              identifier: String(scale.identifier),
              range: `${formatScoreBoundary(scale.min_score)} - ${formatScoreBoundary(scale.max_score)}`,
              detail: scale.descriptor as string,
            })),
      coCurricular: {
        games: coCurricularEnabled ? (activity?.games ?? "") : "",
        clubs: coCurricularEnabled ? (activity?.clubs ?? "") : "",
        projects: coCurricularEnabled ? (activity?.projects ?? "") : "",
      },
      comments: {
        classTeacher:
          savedComments?.class_teacher_comment?.trim() || resolveComment("class_teacher"),
        headTeacher:
          savedComments?.head_teacher_comment?.trim() || resolveComment("head_teacher"),
      },
      staff: {
        classTeacher: classTeacherName,
        headTeacher: headTeacherName,
      },
    } satisfies ReportCardData;
  });
}
