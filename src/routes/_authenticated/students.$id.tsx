import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { StudentStatisticsCharts } from "@/components/students/StudentStatisticsCharts";
import { Btn, PageHeader, Panel, Pill, Stat } from "@/components/ui-kit";
import { useClassesAndStreams } from "@/hooks/useClassesAndStreams";
import { SCHOOL_ROLES, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { getEnabledModuleMap } from "@/lib/modules";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({
    meta: [
      { title: "Learner statistics · EduTrack" },
      { name: "description", content: "Academic, attendance and fee statistics for a learner." },
    ],
  }),
  component: StudentStatisticsPage,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function formatScore(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

function messageForError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load this learner's statistics.";
}

function statusTone(status: string): "success" | "warning" | "muted" | "danger" {
  if (status === "approved" || status === "active") return "success";
  if (status === "rejected") return "danger";
  if (status === "submitted" || status === "pending") return "warning";
  return "muted";
}

function StudentStatisticsPage() {
  const { id: studentId } = Route.useParams();
  const { data: me, isLoading: isUserLoading } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canAccessStudents = hasAny(me?.roles, SCHOOL_ROLES);
  const isClassTeacher = hasAny(me?.roles, ["class_teacher"]);
  const { data: classesAndStreams, isLoading: assignmentsLoading, error: assignmentsError } =
    useClassesAndStreams();

  const { data: modules } = useQuery({
    queryKey: ["enabled-modules", schoolId],
    enabled: !!schoolId,
    staleTime: 10 * 60_000,
    queryFn: async () => getEnabledModuleMap(supabase, schoolId),
  });
  const attendanceEnabled = modules?.get("attendance") ?? true;
  const feesEnabled = modules?.get("fees") ?? true;

  const studentQuery = useQuery({
    queryKey: ["student-statistics-profile", schoolId, studentId],
    enabled: !!schoolId && canAccessStudents,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, full_name, student_number, lin, gender, date_of_birth, class_id, stream_id, house, status, fees_balance, photo_url, parent_name, parent_phone, guardian_name, guardian_phone, verified_at, created_at",
        )
        .eq("id", studentId)
        .eq("school_id", schoolId!)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const student = studentQuery.data;
  const assignedClassIds = new Set(
    (classesAndStreams?.classes ?? [])
      .filter((item) => item.class_teacher_id === me?.userId)
      .map((item) => item.id),
  );
  const assignedStreamIds = new Set(
    (classesAndStreams?.streams ?? [])
      .filter((item) => item.stream_teacher_id === me?.userId)
      .map((item) => item.id),
  );
  const canViewStudent =
    !!student &&
    (!isClassTeacher ||
      assignedClassIds.has(student.class_id ?? "") ||
      assignedStreamIds.has(student.stream_id ?? ""));

  const statisticsQuery = useQuery({
    queryKey: ["student-statistics", schoolId, studentId, attendanceEnabled],
    enabled: !!schoolId && !!student && canViewStudent,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const [
        assessments,
        attendanceRecords,
        attendanceSummaries,
        formativeMarks,
        subjects,
        terms,
      ] =
        await Promise.all([
          supabase
            .from("assessments")
            .select("id, subject_id, term_id, formative, summative, grade_descriptor, status, created_at, is_missing")
            .eq("school_id", schoolId!)
            .eq("student_id", studentId)
            .order("created_at", { ascending: false })
            .limit(5000),
          attendanceEnabled
            ? supabase
                .from("attendance_records")
                .select("id, status, attendance_date, term_id")
                .eq("school_id", schoolId!)
                .eq("student_id", studentId)
                .order("attendance_date", { ascending: false })
                .limit(5000)
            : Promise.resolve({ data: [], error: null }),
          attendanceEnabled
            ? supabase
                .from("attendance_summaries")
                .select("term_id, days_present, days_absent, total_days")
                .eq("school_id", schoolId!)
                .eq("student_id", studentId)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("formative_marks")
            .select("id, subject_id, term_id, mark, is_missing, status, created_at")
            .eq("school_id", schoolId!)
            .eq("student_id", studentId)
            .order("created_at", { ascending: false })
            .limit(5000),
          supabase.from("subjects").select("id, name").eq("school_id", schoolId!),
          supabase
            .from("terms")
            .select("id, name, is_current, start_date")
            .eq("school_id", schoolId!)
            .order("start_date", { ascending: true }),
        ]);

      const failedResult = [
        assessments,
        attendanceRecords,
        attendanceSummaries,
        formativeMarks,
        subjects,
        terms,
      ].find((result) => result.error);
      if (failedResult?.error) throw new Error(failedResult.error.message);

      return {
        assessments: assessments.data ?? [],
        attendanceRecords: attendanceRecords.data ?? [],
        attendanceSummaries: attendanceSummaries.data ?? [],
        formativeMarks: formativeMarks.data ?? [],
        subjects: subjects.data ?? [],
        terms: terms.data ?? [],
      };
    },
  });

  if (isUserLoading || studentQuery.isLoading || (isClassTeacher && assignmentsLoading)) {
    return <StudentStatisticsLoading />;
  }

  if (!canAccessStudents) {
    return <StudentStatisticsMessage title="No access" message="Your account cannot view learner records." />;
  }

  if (!schoolId) {
    return <StudentStatisticsMessage title="School not linked" message="Your account is not linked to a school." />;
  }

  if (studentQuery.error) {
    return (
      <StudentStatisticsMessage
        title="Learner details could not load"
        message={messageForError(studentQuery.error)}
        onRetry={() => void studentQuery.refetch()}
      />
    );
  }

  if (!student) {
    return (
      <StudentStatisticsMessage
        title="Learner not found"
        message="This learner may have been removed or belongs to another school."
      />
    );
  }

  if (isClassTeacher && assignmentsError) {
    return (
      <StudentStatisticsMessage
        title="Class assignments could not load"
        message={messageForError(assignmentsError)}
      />
    );
  }

  if (!canViewStudent) {
    return (
      <StudentStatisticsMessage
        title="Learner outside your classes"
        message="You can view statistics only for learners assigned to your class or stream."
      />
    );
  }

  if (statisticsQuery.isLoading) return <StudentStatisticsLoading />;

  if (statisticsQuery.error) {
    return (
      <StudentStatisticsMessage
        title="Learner statistics could not load"
        message={messageForError(statisticsQuery.error)}
        onRetry={() => void statisticsQuery.refetch()}
      />
    );
  }

  if (!statisticsQuery.data) {
    return (
      <StudentStatisticsMessage
        title="Learner statistics unavailable"
        message="No statistics were returned for this learner."
        onRetry={() => void statisticsQuery.refetch()}
      />
    );
  }

  const statistics = statisticsQuery.data;
  const subjectNameById = new Map(statistics.subjects.map((subject) => [subject.id, subject.name]));
  const termById = new Map(statistics.terms.map((term) => [term.id, term]));
  const className =
    classesAndStreams?.classes.find((item) => item.id === student.class_id)?.name ?? "Unassigned";
  const streamName =
    classesAndStreams?.streams.find((item) => item.id === student.stream_id)?.name ?? "—";
  const studentEducationLevel =
    classesAndStreams?.classes.find((item) => item.id === student.class_id)?.education_level;

  const assessmentRows = statistics.assessments.map((assessment) => {
    const hasScore =
      !assessment.is_missing &&
      (studentEducationLevel === "advanced"
        ? assessment.summative !== null
        : assessment.formative !== null || assessment.summative !== null);
    return {
      ...assessment,
      total: hasScore
        ? studentEducationLevel === "advanced"
          ? Number(assessment.summative ?? 0)
          : Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0)
        : null,
      subjectName: subjectNameById.get(assessment.subject_id) ?? "Unknown subject",
      termName: termById.get(assessment.term_id)?.name ?? "Unknown term",
    };
  });
  const approvedScores = assessmentRows.filter(
    (assessment) => assessment.status === "approved" && assessment.total !== null,
  );
  const averageScore = approvedScores.length
    ? approvedScores.reduce((sum, assessment) => sum + assessment.total!, 0) / approvedScores.length
    : null;
  const highestScore = approvedScores.length
    ? Math.max(...approvedScores.map((assessment) => assessment.total!))
    : null;

  const scoreBuckets = [
    { name: "Below 45", value: 0 },
    { name: "45–59", value: 0 },
    { name: "60–69", value: 0 },
    { name: "70–79", value: 0 },
    { name: "80+", value: 0 },
  ];
  for (const assessment of approvedScores) {
    const score = assessment.total!;
    if (score >= 80) scoreBuckets[4].value += 1;
    else if (score >= 70) scoreBuckets[3].value += 1;
    else if (score >= 60) scoreBuckets[2].value += 1;
    else if (score >= 45) scoreBuckets[1].value += 1;
    else scoreBuckets[0].value += 1;
  }
  const scoreDistribution = scoreBuckets.filter((bucket) => bucket.value > 0);

  const subjectTotals = new Map<string, { total: number; count: number }>();
  const termTotals = new Map<string, { total: number; count: number }>();
  for (const assessment of approvedScores) {
    const subject = subjectTotals.get(assessment.subject_id) ?? { total: 0, count: 0 };
    subject.total += assessment.total!;
    subject.count += 1;
    subjectTotals.set(assessment.subject_id, subject);

    const term = termTotals.get(assessment.term_id) ?? { total: 0, count: 0 };
    term.total += assessment.total!;
    term.count += 1;
    termTotals.set(assessment.term_id, term);
  }
  const subjectPerformance = [...subjectTotals]
    .map(([subjectId, total]) => ({
      name: subjectNameById.get(subjectId) ?? "Unknown subject",
      average: Math.round((total.total / total.count) * 10) / 10,
    }))
    .sort((left, right) => right.average - left.average);
  const performanceByTerm = statistics.terms
    .filter((term) => termTotals.has(term.id))
    .map((term) => {
      const total = termTotals.get(term.id)!;
      return {
        name: term.name,
        average: Math.round((total.total / total.count) * 10) / 10,
      };
    });
  const bestSubject = subjectPerformance[0] ?? null;

  const approvedFormativeMarks = statistics.formativeMarks.filter(
    (mark) => mark.status === "approved" && !mark.is_missing,
  );
  const formativeAverage = approvedFormativeMarks.length
    ? approvedFormativeMarks.reduce((sum, mark) => sum + Number(mark.mark), 0) /
      approvedFormativeMarks.length
    : null;
  const formativeSubjectTotals = new Map<string, { total: number; count: number }>();
  const formativeTermTotals = new Map<string, { total: number; count: number }>();
  for (const mark of approvedFormativeMarks) {
    const subject = formativeSubjectTotals.get(mark.subject_id) ?? { total: 0, count: 0 };
    subject.total += Number(mark.mark);
    subject.count += 1;
    formativeSubjectTotals.set(mark.subject_id, subject);

    const term = formativeTermTotals.get(mark.term_id) ?? { total: 0, count: 0 };
    term.total += Number(mark.mark);
    term.count += 1;
    formativeTermTotals.set(mark.term_id, term);
  }
  const formativeBySubject = [...formativeSubjectTotals]
    .map(([subjectId, total]) => ({
      name: subjectNameById.get(subjectId) ?? "Unknown subject",
      average: Math.round((total.total / total.count) * 10) / 10,
    }))
    .sort((left, right) => right.average - left.average);
  const formativeByTerm = statistics.terms
    .filter((term) => formativeTermTotals.has(term.id))
    .map((term) => {
      const total = formativeTermTotals.get(term.id)!;
      return {
        name: term.name,
        average: Math.round((total.total / total.count) * 10) / 10,
      };
    });

  const assessmentStatus = [...new Set(assessmentRows.map((assessment) => assessment.status))].map(
    (status) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: assessmentRows.filter((assessment) => assessment.status === status).length,
    }),
  );

  const attendanceByMonthTotals = new Map<string, { present: number; total: number }>();
  for (const record of statistics.attendanceRecords) {
    const month = record.attendance_date.slice(0, 7);
    const totals = attendanceByMonthTotals.get(month) ?? { present: 0, total: 0 };
    if (record.status !== "absent") totals.present += 1;
    totals.total += 1;
    attendanceByMonthTotals.set(month, totals);
  }
  const attendanceByMonth = [...attendanceByMonthTotals]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([month, total]) => ({
      name: new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      }),
      rate: Math.round((total.present / total.total) * 1000) / 10,
    }));

  const attendanceByTerm = statistics.attendanceSummaries
    .map((summary) => {
      const totalDays = Number(summary.total_days ?? summary.days_present + summary.days_absent);
      return {
        name: termById.get(summary.term_id)?.name ?? "Unknown term",
        present: Number(summary.days_present),
        absent: Number(summary.days_absent),
        total: totalDays,
        rate: totalDays ? Math.round((Number(summary.days_present) / totalDays) * 1000) / 10 : 0,
      };
    })
    .filter((summary) => summary.total > 0);
  const dailyAttendance = statistics.attendanceRecords.reduce(
    (totals, record) => {
      if (record.status === "absent") totals.absent += 1;
      else totals.present += 1;
      return totals;
    },
    { present: 0, absent: 0 },
  );
  const summaryAttendance = statistics.attendanceSummaries.reduce(
    (totals, summary) => ({
      present: totals.present + Number(summary.days_present),
      absent: totals.absent + Number(summary.days_absent),
    }),
    { present: 0, absent: 0 },
  );
  const attendanceTotals = statistics.attendanceRecords.length
    ? dailyAttendance
    : summaryAttendance;
  const attendanceTotalDays = attendanceTotals.present + attendanceTotals.absent;
  const attendanceRate = attendanceTotalDays
    ? (attendanceTotals.present / attendanceTotalDays) * 100
    : null;
  const averageLabel = formatScore(averageScore);
  const formativeAverageLabel =
    formativeAverage === null ? "—" : formativeAverage.toFixed(1);
  const currentTermAverage = statistics.terms.find((term) => term.is_current);
  const currentTermScore = currentTermAverage
    ? termTotals.get(currentTermAverage.id)
    : undefined;
  const guardianName = student.parent_name ?? student.guardian_name;
  const guardianPhone = student.parent_phone ?? student.guardian_phone;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student record"
        title={student.full_name}
        description={`${className}${streamName !== "—" ? ` · ${streamName}` : ""} · ${student.status}`}
        actions={
          <Link
            to="/students"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            Back to students
          </Link>
        }
      />

      <Panel title="Learner profile">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={student.full_name}
              className="h-24 w-24 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border text-2xl font-semibold text-muted-foreground">
              {student.full_name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileValue label="Student number" value={student.student_number ?? "—"} />
            <ProfileValue label="LIN" value={student.lin ?? "—"} />
            <ProfileValue label="Gender" value={student.gender ?? "—"} />
            <ProfileValue label="Date of birth" value={formatDate(student.date_of_birth)} />
            <ProfileValue label="Class and stream" value={`${className} · ${streamName}`} />
            <ProfileValue label="House" value={student.house ?? "—"} />
            <ProfileValue label="Parent / guardian" value={guardianName ?? "—"} />
            <ProfileValue label="Guardian phone" value={guardianPhone ?? "—"} />
            <ProfileValue label="Registered" value={formatDate(student.created_at)} />
            <ProfileValue label="Verified" value={formatDate(student.verified_at)} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admission status</p>
              <Pill tone={statusTone(student.status)}>{student.status}</Pill>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Approved average" value={averageLabel} />
        <Stat label="Highest approved score" value={formatScore(highestScore)} />
        <Stat
          label="Current term average"
          value={
            currentTermScore?.count
              ? formatScore(currentTermScore.total / currentTermScore.count)
              : "—"
          }
          hint={currentTermAverage?.name ?? "No current term"}
        />
        <Stat label="Assessments" value={assessmentRows.length} />
        <Stat label="Formative marks" value={statistics.formativeMarks.length} />
        <Stat
          label="Approved formative average"
          value={formativeAverageLabel}
          hint="Score points"
        />
        <Stat label="Subjects with approved marks" value={subjectPerformance.length} />
        <Stat
          label="Strongest subject"
          value={bestSubject?.name ?? "—"}
          hint={bestSubject ? formatScore(bestSubject.average) : "No approved marks yet"}
        />
        {attendanceEnabled && (
          <Stat
            label="Attendance rate"
            value={attendanceRate === null ? "—" : `${attendanceRate.toFixed(1)}%`}
            hint={`${attendanceTotals.present} present · ${attendanceTotals.absent} absent`}
          />
        )}
        {feesEnabled && (
          <Stat
            label="Outstanding fee balance"
            value={Number(student.fees_balance ?? 0).toLocaleString()}
          />
        )}
      </div>

      <StudentStatisticsCharts
        attendanceEnabled={attendanceEnabled}
        subjectPerformance={subjectPerformance}
        performanceByTerm={performanceByTerm}
        formativeBySubject={formativeBySubject}
        formativeByTerm={formativeByTerm}
        scoreDistribution={scoreDistribution}
        attendanceByMonth={attendanceEnabled ? attendanceByMonth : []}
        attendanceByTerm={attendanceEnabled ? attendanceByTerm : []}
        assessmentStatus={assessmentStatus}
      />

      <Panel title="Recent assessments">
        {assessmentRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Term</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Formative</th>
                  <th className="pb-2">Summative</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Grade</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {assessmentRows.slice(0, 20).map((assessment) => (
                  <tr key={assessment.id} className="border-t border-border">
                    <td className="py-2.5">{formatDate(assessment.created_at)}</td>
                    <td>{assessment.termName}</td>
                    <td>{assessment.subjectName}</td>
                    <td>{assessment.formative ?? "—"}</td>
                    <td>{assessment.summative ?? "—"}</td>
                    <td className="font-semibold">{assessment.total ?? "—"}</td>
                    <td>{assessment.grade_descriptor ?? "—"}</td>
                    <td>
                      <Pill tone={statusTone(assessment.status)}>
                        {assessment.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No assessments have been recorded for this learner.</p>
        )}
      </Panel>

      <Panel title="Recent formative marks">
        {statistics.formativeMarks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Term</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Mark</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {statistics.formativeMarks.slice(0, 20).map((mark) => (
                  <tr key={mark.id} className="border-t border-border">
                    <td className="py-2.5">{formatDate(mark.created_at)}</td>
                    <td>{termById.get(mark.term_id)?.name ?? "Unknown term"}</td>
                    <td>{subjectNameById.get(mark.subject_id) ?? "Unknown subject"}</td>
                    <td>{mark.is_missing ? "Missing" : mark.mark}</td>
                    <td><Pill tone={statusTone(mark.status)}>{mark.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No formative marks have been recorded for this learner.</p>
        )}
      </Panel>

      {attendanceEnabled && (
        <Panel title="Recent attendance">
          {statistics.attendanceRecords.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {statistics.attendanceRecords.slice(0, 12).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm"
                >
                  <span>{formatDate(record.attendance_date)}</span>
                  <Pill tone={record.status === "absent" ? "danger" : "success"}>{record.status}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No daily attendance records are available.</p>
          )}
        </Panel>
      )}
    </div>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function StudentStatisticsMessage({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Panel>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <div className="mt-4 flex gap-2">
        {onRetry && <Btn variant="ghost" onClick={onRetry}>Try again</Btn>}
        <Link
          to="/students"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Back to students
        </Link>
      </div>
    </Panel>
  );
}

function StudentStatisticsLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <span className="sr-only">Loading learner statistics</span>
    </div>
  );
}
