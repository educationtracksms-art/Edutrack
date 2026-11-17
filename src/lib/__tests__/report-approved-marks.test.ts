import assert from "node:assert/strict";
import test from "node:test";

import { buildReportCards } from "../report.server";

const schoolId = "school-1";
const termId = "term-1";
const yearId = "year-1";
const studentId = "student-1";
const subjectId = "subject-1";

function createReportClient(
  educationLevel: "ordinary" | "advanced",
  ordinaryFormativeOnly = false,
  includeSecondLearnerBeyondFirstPage = false,
) {
  const examType = educationLevel === "ordinary" ? "end_of_term" : "beginning_of_term";
  const secondStudentId = "student-2";
  const ordinaryAssessments = includeSecondLearnerBeyondFirstPage
    ? [
        ...Array.from({ length: 1000 }, (_, index) => ({
          id: `assessment-${String(index).padStart(4, "0")}`,
          student_id: studentId,
          term_id: termId,
          subject_id: subjectId,
          paper_id: null,
          exam_type: examType,
          score: 65,
          formative: 0,
          summative: 65,
          is_missing: false,
          teacher_initials: "AB",
          status: "approved",
          approved_by: null,
          approved_at: "2026-11-10T12:00:00Z",
        })),
        {
          id: "assessment-last-page",
          student_id: secondStudentId,
          term_id: termId,
          subject_id: subjectId,
          paper_id: null,
          exam_type: examType,
          score: 42,
          formative: 0,
          summative: 42,
          is_missing: false,
          teacher_initials: "EF",
          status: "approved",
          approved_by: null,
          approved_at: "2026-11-10T12:00:00Z",
        },
      ]
    : null;
  const dataByTable: Record<string, any[]> = {
    students: [
      {
        id: studentId,
        school_id: schoolId,
        full_name: "Test Learner",
        class_id: "class-1",
        stream_id: null,
      },
      ...(includeSecondLearnerBeyondFirstPage
        ? [
            {
              id: secondStudentId,
              school_id: schoolId,
              full_name: "Second Learner",
              class_id: "class-1",
              stream_id: null,
            },
          ]
        : []),
    ],
    schools: [{ id: schoolId, name: "Test School", code: "TST" }],
    classes: [
      {
        id: "class-1",
        school_id: schoolId,
        name: educationLevel === "ordinary" ? "Senior 3" : "Senior 5",
        class_teacher_id: null,
        education_level: educationLevel,
      },
    ],
    profiles: [],
    user_roles: [],
    streams: [],
    subjects: [
      {
        id: subjectId,
        school_id: schoolId,
        name: educationLevel === "ordinary" ? "Mathematics" : "Biology",
        position: 1,
        points: 3,
        education_level: educationLevel,
        is_subsidiary: false,
      },
    ],
    subject_papers: [],
    grading_scales: [
      {
        school_id: schoolId,
        grade: "A",
        min_score: 0,
        max_score: 100,
        grade_descriptor: "Excellent",
        education_level: educationLevel,
        points: 5,
      },
    ],
    grading_identifier_scales: [],
    feature_toggles: [],
    terms: [{ id: termId, school_id: schoolId, name: "Term 1", is_current: true, academic_year_id: yearId }],
    report_comments: [],
    academic_years: [{ id: yearId, name: "2026" }],
    assessments:
      educationLevel === "ordinary" && !ordinaryFormativeOnly
        ? ordinaryAssessments ?? [
            {
              student_id: studentId,
              term_id: termId,
              subject_id: subjectId,
              paper_id: null,
              exam_type: examType,
              score: 80,
              formative: 15,
              summative: 65,
              is_missing: false,
              teacher_initials: "AB",
              status: "approved",
              approved_by: null,
              approved_at: "2026-11-10T12:00:00Z",
            },
          ]
        : [],
    a_level_assessments:
      educationLevel === "advanced"
        ? [
            {
              student_id: studentId,
              term_id: termId,
              subject_id: subjectId,
              paper_id: null,
              exam_type: examType,
              score: 72,
              is_missing: false,
              teacher_initials: "CD",
              status: "approved",
              approved_by: null,
              approved_at: "2026-11-10T12:00:00Z",
            },
          ]
        : [],
    attendance_summaries: [],
    co_curricular: [],
    formative_marks:
      educationLevel === "ordinary" && ordinaryFormativeOnly
        ? [
            {
              student_id: studentId,
              term_id: termId,
              subject_id: subjectId,
              paper_id: null,
              mark: 12,
              is_missing: false,
              teacher_initials: "AB",
              status: "approved",
              approved_by: null,
              approved_at: "2026-11-10T12:00:00Z",
            },
          ]
        : [],
    assessment_periods: [{ school_id: schoolId, term_id: termId, exam_type: examType, is_active: false }],
    report_comment_rules: [],
  };

  return {
    from(table: string) {
      const filters: Array<(row: any) => boolean> = [];
      let rangeFrom = 0;
      let rangeTo = Number.POSITIVE_INFINITY;
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        order() {
          return query;
        },
        range(from: number, to: number) {
          rangeFrom = from;
          rangeTo = to;
          return query;
        },
        result() {
          return {
            data: (dataByTable[table] ?? [])
              .filter((row) => filters.every((filter) => filter(row)))
              .slice(rangeFrom, rangeTo + 1),
            error: null,
          };
        },
        async maybeSingle() {
          return { ...query.result(), data: query.result().data[0] ?? null };
        },
        then(resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(query.result()).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

for (const educationLevel of ["ordinary", "advanced"] as const) {
  test(`${educationLevel === "ordinary" ? "O-Level" : "A-Level"} report includes a subject with an approved assessment`, async () => {
    const [report] = await buildReportCards(
      createReportClient(educationLevel) as any,
      [studentId],
      termId,
      educationLevel,
    );

    assert.ok(report, "expected a report card for the learner");
    const subjectRow = report.rows.find((row) => !row.isSubjectSummary);
    assert.ok(subjectRow, "expected the assessed subject to appear on the report");
    assert.equal(subjectRow.subject, educationLevel === "ordinary" ? "Mathematics" : "Biology");
    assert.equal(subjectRow.total, educationLevel === "ordinary" ? "80" : "72");
    assert.deepEqual(report.activeSummativePeriods, [educationLevel === "ordinary" ? "EOT" : "BOT"]);
  });
}

test("O-Level report shows an approved formative mark without an approved summative mark", async () => {
  const [report] = await buildReportCards(
    createReportClient("ordinary", true) as any,
    [studentId],
    termId,
    "ordinary",
  );

  const subjectRow = report.rows.find((row) => !row.isSubjectSummary);
  assert.ok(subjectRow, "expected the formative subject to appear on the report");
  assert.equal(subjectRow.formative, "12");
  assert.equal(subjectRow.total, "");
});

test("report generation paginates approved marks for learners after the first 1000 results", async () => {
  const [firstReport, secondReport] = await buildReportCards(
    createReportClient("ordinary", false, true) as any,
    [studentId, "student-2"],
    termId,
    "ordinary",
  );

  const secondLearnerSubject = secondReport.rows.find((row) => !row.isSubjectSummary);
  assert.ok(secondLearnerSubject, "expected the second learner's assessed subject on the report");
  assert.equal(secondLearnerSubject.total, "42");
  assert.equal(firstReport.studentId, studentId);
});
