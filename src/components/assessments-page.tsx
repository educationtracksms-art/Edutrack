import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import {
  deleteReportComment,
  deleteAssessmentGroup,
  reviewAssessments,
  updateAssessmentDraftEntry,
  submitAssessmentEntry,
  submitAssessmentEntries,
  upsertAssessmentEntry,
  upsertReportComment,
} from "@/lib/admin.functions";
import { descriptorFromAssessmentScore } from "@/lib/descriptor";
import { supabase } from "@/integrations/supabase/client";

type TeacherAllocationView = {
  key: string;
  subject_id: string;
  paper_id: string | null;
  class_id: string | null;
  stream_id: string | null;
  label: string;
};

type AssessmentRow = {
  id: string;
  student_id: string;
  subject_id: string;
  paper_id?: string | null;
  term_id: string;
  exam_type?: string;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  formative: number | null;
  summative: number | null;
  is_missing?: boolean;
  teacher_initials?: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  grade_descriptor: string | null;
};

type FormativeMarkRow = {
  id: string;
  student_id: string;
  subject_id: string;
  paper_id?: string | null;
  term_id: string;
  mark: number | null;
  is_missing?: boolean;
  status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
};

type StudentRow = {
  id: string;
  full_name: string;
  class_id: string | null;
  stream_id: string | null;
  status: string;
};

type SubjectPaperRow = { id: string; subject_id: string; name: string; position: number };
type SubjectRow = {
  id: string;
  name: string;
  department_id?: string | null;
  education_level?: string | null;
};
type GradingScaleRow = {
  grade: string;
  min_score: number;
  max_score: number;
  descriptor: string;
  education_level: string | null;
  points: number | null;
};
type TermRow = { id: string; name: string; is_current: boolean; academic_year_id?: string | null };
type ClassRow = {
  id: string;
  name: string;
  class_teacher_id: string | null;
  education_level: string | null;
};
type StreamRow = { id: string; name: string; class_id: string | null };
type ProfileRow = { initials: string | null };
type StaffProfileRow = { id: string; full_name: string };
type CommentRow = {
  student_id: string;
  class_teacher_comment: string | null;
  head_teacher_comment: string | null;
};
type CoCurricularRow = {
  student_id: string;
  games: string | null;
  clubs: string | null;
  projects: string | null;
};

function readAssessmentMark(value: string, label: string, maximum: number) {
  if (!value.trim()) throw new Error(`Add the ${label} mark before saving the assessment`);
  const mark = Number(value);
  if (!Number.isFinite(mark) || mark < 0 || mark > maximum) {
    throw new Error(`${label} mark must be between 0 and ${maximum}`);
  }
  return mark;
}

type AssessmentsData = {
  assessments: AssessmentRow[];
  formativeMarks: FormativeMarkRow[];
  students: StudentRow[];
  subjects: SubjectRow[];
  subjectPapers: SubjectPaperRow[];
  terms: TermRow[];
  classes: ClassRow[];
  streams: StreamRow[];
  coCurricular: CoCurricularRow[];
  allocations: TeacherAllocationView[];
  gradingScales: GradingScaleRow[];
  currentTermId: string;
  activeAssessmentPeriods: string[];
  openAssessmentPeriods: string[];
  teacherInitials: string;
  staffProfileMap: Map<string, string>;
};

type LearnerSortKey = "class" | "stream";

function isMissingRelationError(result: { error?: { message?: string } } | null | undefined) {
  const message = result?.error?.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("could not find the table");
}

export function AssessmentsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const isAssignedTeacher = hasAny(me?.roles, ["subject_teacher", "class_teacher", "hod", "dos"]);
  const isTeacher = isAssignedTeacher;
  const canViewAllAssessments = hasAny(me?.roles, [
    "dos",
    "hod",
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
  ]);
  const canEnter =
    !!schoolId &&
    hasAny(me?.roles, [
      "subject_teacher",
      "class_teacher",
      "hod",
      "dos",
      "school_admin",
      "head_teacher",
      "deputy_head_teacher",
    ]);
  const isClassTeacher = hasAny(me?.roles, ["class_teacher"]);
  const isHeadTeacher = hasAny(me?.roles, ["head_teacher", "deputy_head_teacher"]);
  const canEditComments = isClassTeacher || isHeadTeacher;
  const upsertEntry = useServerFn(upsertAssessmentEntry);
  const updateDraftEntry = useServerFn(updateAssessmentDraftEntry);
  const submitEntry = useServerFn(submitAssessmentEntry);
  const submitEntries = useServerFn(submitAssessmentEntries);
  const deleteGroup = useServerFn(deleteAssessmentGroup);
  const saveComment = useServerFn(upsertReportComment);
  const removeComment = useServerFn(deleteReportComment);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [tableSubjectFilter, setTableSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [assessmentSort, setAssessmentSort] = useState<"created_at" | "class" | "stream" | "subject">("created_at");
  const [allocationKey, setAllocationKey] = useState("");
  const [reviewClassId, setReviewClassId] = useState("");
  const [reviewStreamId, setReviewStreamId] = useState("");
  const [learnerSearch, setLearnerSearch] = useState("");
  const [learnerSortKey, setLearnerSortKey] = useState<LearnerSortKey>("class");
  const [learnerSortDirection, setLearnerSortDirection] = useState<"asc" | "desc">("asc");
  const [activeCommentStudentId, setActiveCommentStudentId] = useState("");
  const [editingAssessmentId, setEditingAssessmentId] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<
    Record<
      string,
      {
        classTeacherComment: string;
        headTeacherComment: string;
        games: string;
        clubs: string;
        projects: string;
      }
    >
  >({});
  const [entryForm, setEntryForm] = useState({
    studentId: "",
    subjectId: "",
    termId: "",
    examType: "end_of_term",
    formative: "",
    summative: "",
    summativeBot: "",
    summativeMot: "",
    summativeEot: "",
    isMissing: false,
    teacherInitials: "",
    paperId: "",
  });
  const [edits, setEdits] = useState<
    Record<string, { formative?: string; summative?: string; gradeDescriptor?: string }>
  >({});

  const {
    data,
    isLoading: isAssessmentsLoading,
    isError: isAssessmentsError,
    error: assessmentsError,
  } = useQuery<AssessmentsData>({
    queryKey: ["assessments", schoolId, me?.userId],
    queryFn: async () => {
      const schoolQuery = (query: any) => (schoolId ? query.eq("school_id", schoolId) : query);
      let [
        assessmentsResult,
        formativeMarksResult,
        assessmentPeriodsResult,
        studentsResult,
        subjectsResult,
        subjectPapersResult,
        termsResult,
        classesResult,
        streamsResult,
        allocationsResult,
        gradingScalesResult,
        profilesResult,
        profileResult,
      ] = (await Promise.all([
        schoolQuery(supabase.from("assessments").select("*").order("created_at")),
        schoolQuery(
          (supabase as any)
            .from("formative_marks")
            .select("id, student_id, subject_id, paper_id, term_id, mark, is_missing, status, locked"),
        ),
        schoolQuery(
          (supabase as any)
            .from("assessment_periods")
            .select("term_id, exam_type, is_active, is_locked"),
        ),
        schoolQuery(
          supabase
            .from("students")
            .select("id, full_name, class_id, stream_id, status")
            .eq("status", "active")
            .order("full_name"),
        ),
        schoolQuery(supabase.from("subjects").select("id, name, department_id, education_level").order("position")),
        schoolQuery((supabase as any).from("subject_papers").select("id, subject_id, name, position").order("position")),
        schoolQuery(
          supabase
            .from("terms")
            .select("id, name, is_current")
            .order("start_date", { ascending: false }),
        ),
        schoolQuery(
          supabase
            .from("classes")
            .select("id, name, class_teacher_id, education_level")
            .order("name"),
        ),
        schoolQuery(supabase.from("streams").select("id, name, class_id").order("name")),
        schoolId && me?.userId
          ? supabase
              .from("teacher_allocations")
              .select("subject_id, paper_id, class_id, stream_id")
              .eq("school_id", schoolId)
              .eq("teacher_id", me.userId)
          : Promise.resolve({ data: [] as any[] }),
        schoolQuery(
          supabase
            .from("grading_scales")
            .select("grade, min_score, max_score, grade_descriptor, education_level, points")
            .order("min_score", { ascending: false }),
        ),
        schoolQuery(supabase.from("profiles").select("id, full_name")),
        me?.userId
          ? supabase.from("profiles").select("initials").eq("id", me.userId).maybeSingle()
          : Promise.resolve({ data: null as ProfileRow | null }),
      ])) as any[];

      // Keep the assessments page usable while an older deployment is waiting
      // for the teacher-allocation paper migration to be applied.
      if (allocationsResult?.error?.message?.includes("paper_id")) {
        allocationsResult = schoolId && me?.userId
          ? await supabase
              .from("teacher_allocations")
              .select("subject_id, class_id, stream_id")
              .eq("school_id", schoolId)
              .eq("teacher_id", me.userId)
          : { data: [], error: null };
      }

      // These datasets were added after the original assessments workflow. Keep
      // the core page available while a deployment is catching up with them.
      if (isMissingRelationError(formativeMarksResult)) {
        formativeMarksResult = { data: [], error: null };
      }
      if (isMissingRelationError(assessmentPeriodsResult)) {
        assessmentPeriodsResult = { data: [], error: null };
      }
      if (isMissingRelationError(subjectPapersResult)) {
        subjectPapersResult = { data: [], error: null };
      }

      const failedResult = [
        assessmentsResult,
        formativeMarksResult,
        assessmentPeriodsResult,
        studentsResult,
        subjectsResult,
        subjectPapersResult,
        termsResult,
        classesResult,
        streamsResult,
        allocationsResult,
        gradingScalesResult,
        profilesResult,
        profileResult,
      ].find((result) => result.error);
      if (failedResult?.error) throw new Error(`Unable to load assessments: ${failedResult.error.message}`);

      const assessmentRows = (assessmentsResult.data ?? []) as AssessmentRow[];
      const formativeMarkRows = (formativeMarksResult.data ?? []) as FormativeMarkRow[];
      const assessmentPeriods = (assessmentPeriodsResult.data ?? []) as Array<{
        term_id: string;
        exam_type: string;
        is_active: boolean;
        is_locked: boolean;
      }>;
      const studentRows = (studentsResult.data ?? []) as StudentRow[];
      const subjectRows = (subjectsResult.data ?? []) as SubjectRow[];
      const subjectPaperRows = (subjectPapersResult.data ?? []) as SubjectPaperRow[];
      const termRows = (termsResult.data ?? []) as TermRow[];
      const classRows = (classesResult.data ?? []) as ClassRow[];
      const streamRows = (streamsResult.data ?? []) as StreamRow[];
      const allocationRows = (allocationsResult.data ?? []) as Array<{
        subject_id: string;
        paper_id: string | null;
        class_id: string | null;
        stream_id: string | null;
      }>;
      const gradingScaleRows = ((gradingScalesResult.data ?? []) as Array<
        Omit<GradingScaleRow, "descriptor"> & { grade_descriptor: string }
      >).map((scale) => ({
        ...scale,
        descriptor: scale.grade_descriptor,
      }));
      const staffProfiles = (profilesResult.data ?? []) as StaffProfileRow[];
      const staffProfileMap = new Map(
        staffProfiles.map((profile) => [profile.id, profile.full_name]),
      );
      const teacherInitials = (profileResult.data?.initials ?? "") as string;
      const currentTermId = termRows.find((term) => term.is_current)?.id ?? "";
      const { data: coCurricularData, error: coCurricularError } = currentTermId && studentRows.length
        ? await supabase
            .from("co_curricular")
            .select("student_id, games, clubs, projects")
            .eq("term_id", currentTermId)
            .in(
              "student_id",
              studentRows.map((student) => student.id),
            )
        : { data: [] as CoCurricularRow[] };
      if (coCurricularError) {
        throw new Error(`Unable to load co-curricular records: ${coCurricularError.message}`);
      }
      const coCurricularRows = (coCurricularData ?? []) as CoCurricularRow[];

      const allocationOptions: TeacherAllocationView[] = isTeacher
        ? allocationRows.map((allocation) => {
            const subjectName =
              subjectRows.find((subject) => subject.id === allocation.subject_id)?.name ??
              "Subject";
            const className =
              classRows.find((item) => item.id === allocation.class_id)?.name ?? "Any class";
            const streamName =
              streamRows.find((item) => item.id === allocation.stream_id)?.name ?? "Any stream";
            return {
              key: `${allocation.subject_id}:${allocation.paper_id ?? "subject"}:${allocation.class_id ?? ""}:${allocation.stream_id ?? ""}`,
              subject_id: allocation.subject_id,
              paper_id: allocation.paper_id ?? null,
              class_id: allocation.class_id ?? null,
              stream_id: allocation.stream_id ?? null,
              label: [subjectName, allocation.paper_id ? (subjectPaperRows.find((paper) => paper.id === allocation.paper_id)?.name ?? "Paper") : null, className, allocation.stream_id ? streamName : null]
                .filter(Boolean)
                .join(" - "),
            };
          })
        : [];

      return {
        assessments: assessmentRows,
        formativeMarks: formativeMarkRows.filter((mark) => mark.term_id === currentTermId),
        students: studentRows,
        subjects: subjectRows,
        subjectPapers: subjectPaperRows,
        terms: termRows,
        classes: classRows,
        streams: streamRows,
        coCurricular: coCurricularRows,
        allocations: allocationOptions,
        gradingScales: gradingScaleRows,
        currentTermId,
        activeAssessmentPeriods: assessmentPeriods
          .filter((period) => period.term_id === currentTermId && period.is_active)
          .map((period) => period.exam_type),
        openAssessmentPeriods: assessmentPeriods
          .filter((period) => period.term_id === currentTermId && period.is_active && !period.is_locked)
          .map((period) => period.exam_type),
        teacherInitials,
        staffProfileMap,
      };
    },
  });
  const { data: tableData } = useQuery<{
    assessments: AssessmentRow[];
    formativeMarks: FormativeMarkRow[];
    students: StudentRow[];
    subjects: SubjectRow[];
    subjectPapers: SubjectPaperRow[];
    terms: TermRow[];
    classes: ClassRow[];
    gradingScales: GradingScaleRow[];
    staffProfileMap: Map<string, string>;
  }>({
    queryKey: ["assessment-table", schoolId],
    queryFn: async () => {
      const schoolQuery = (query: any) => (schoolId ? query.eq("school_id", schoolId) : query);
      let [
        assessmentsResult,
        formativeMarksResult,
        studentsResult,
        subjectsResult,
        subjectPapersResult,
        termsResult,
        classesResult,
        gradingScalesResult,
        profilesResult,
      ] = (await Promise.all([
        schoolQuery(supabase.from("assessments").select("*").order("created_at")),
        schoolQuery(
          (supabase as any)
            .from("formative_marks")
            .select("id, student_id, subject_id, paper_id, term_id, mark, is_missing, status, locked"),
        ),
        schoolQuery(
          supabase
            .from("students")
            .select("id, full_name, class_id, stream_id, status")
            .eq("status", "active")
            .order("full_name"),
        ),
        schoolQuery(supabase.from("subjects").select("id, name, education_level").order("position")),
        schoolQuery((supabase as any).from("subject_papers").select("id, subject_id, name, position").order("position")),
        schoolQuery(
          supabase
            .from("terms")
            .select("id, name, is_current")
            .order("start_date", { ascending: false }),
        ),
        schoolQuery(
          supabase
            .from("classes")
            .select("id, name, class_teacher_id, education_level")
            .order("name"),
        ),
        schoolQuery(
          supabase
            .from("grading_scales")
            .select("grade, min_score, max_score, grade_descriptor, education_level, points")
            .order("min_score", { ascending: false }),
        ),
        schoolQuery(supabase.from("profiles").select("id, full_name")),
      ])) as any[];
      if (isMissingRelationError(subjectPapersResult)) {
        subjectPapersResult = { data: [], error: null };
      }
      const failedResult = [
        assessmentsResult,
        formativeMarksResult,
        studentsResult,
        subjectsResult,
        subjectPapersResult,
        termsResult,
        classesResult,
        gradingScalesResult,
        profilesResult,
      ].find((result) => result.error);
      if (failedResult?.error) throw new Error(`Unable to load assessment records: ${failedResult.error.message}`);
      const staffProfiles = (profilesResult.data ?? []) as StaffProfileRow[];
      const staffProfileMap = new Map(
        staffProfiles.map((profile) => [profile.id, profile.full_name]),
      );

      return {
        assessments: (assessmentsResult.data ?? []) as AssessmentRow[],
        formativeMarks: (formativeMarksResult.data ?? []) as FormativeMarkRow[],
        students: (studentsResult.data ?? []) as StudentRow[],
        subjects: (subjectsResult.data ?? []) as SubjectRow[],
        subjectPapers: (subjectPapersResult.data ?? []) as SubjectPaperRow[],
        terms: (termsResult.data ?? []) as TermRow[],
        classes: (classesResult.data ?? []) as ClassRow[],
        gradingScales: ((gradingScalesResult.data ?? []) as Array<
          Omit<GradingScaleRow, "descriptor"> & { grade_descriptor: string }
        >).map((scale) => ({
          ...scale,
          descriptor: scale.grade_descriptor,
        })),
        staffProfileMap,
      };
    },
  });

  const selectedAllocation = useMemo(
    () =>
      data?.allocations.find((allocation) => allocation.key === allocationKey) ??
      data?.allocations[0] ??
      null,
    [allocationKey, data?.allocations],
  );
  const selectedAllocationPaper = (data?.subjectPapers ?? []).find(
    (paper) => paper.id === selectedAllocation?.paper_id,
  );
  const selectedAllocationUsesPaper = Boolean(selectedAllocation?.paper_id);
  const assignedClass = useMemo(() => {
    if (!isClassTeacher || !data || !me?.userId) return null;
    return data.classes.find((item) => item.class_teacher_id === me.userId) ?? null;
  }, [data, isClassTeacher, me?.userId]);

  const className = (id: string | null) => {
    const item = data?.classes.find((row) => row.id === id);
    if (!item) return "-";
    return `${item.name}${item.education_level === "advanced" ? " (A-Level)" : " (O-Level)"}`;
  };
  const streamName = (id: string | null) =>
    data?.streams.find((item) => item.id === id)?.name ?? "-";

  const assessmentLookup = useMemo(
    () => new Map(tableData?.assessments.map((assessment) => [assessment.id, assessment]) ?? []),
    [tableData?.assessments],
  );

  const teacherAssessmentRows = useMemo(() => {
    if (!isTeacher || !tableData) return tableData?.assessments ?? [];
    if (canViewAllAssessments) return tableData.assessments;

    const studentById = new Map(tableData.students.map((student) => [student.id, student]));
    const currentTeacherId = me?.userId ?? "";

    return tableData.assessments.filter((assessment) => {
      const student = studentById.get(assessment.student_id);
      if (!student) return false;
      if (assessment.status === "rejected" && assessment.submitted_by === currentTeacherId) {
        return true;
      }
      if (!data?.allocations.length) return false;
      return data.allocations.some((allocation) => {
        if (allocation.subject_id !== assessment.subject_id) return false;
        if ((allocation.paper_id ?? null) !== (assessment.paper_id ?? null)) return false;
        if (allocation.class_id && student.class_id !== allocation.class_id) return false;
        if (allocation.stream_id && student.stream_id !== allocation.stream_id) return false;
        return true;
      });
    });
  }, [canViewAllAssessments, data?.allocations, isTeacher, me?.userId, tableData]);

  const loadAssessmentIntoForm = (assessmentId: string) => {
    const assessment = assessmentLookup.get(assessmentId);
    if (!assessment) return;
    const assessmentStudent = data?.students.find((student) => student.id === assessment.student_id);
    const matchingAllocation = data?.allocations.find(
      (allocation) =>
        allocation.subject_id === assessment.subject_id &&
        (allocation.paper_id ?? null) === (assessment.paper_id ?? null) &&
        (!allocation.class_id || allocation.class_id === assessmentStudent?.class_id) &&
        (!allocation.stream_id || allocation.stream_id === assessmentStudent?.stream_id),
    );
    const assessmentGroup = (tableData?.assessments ?? []).filter(
      (row) =>
        row.student_id === assessment.student_id &&
        row.subject_id === assessment.subject_id &&
        row.term_id === assessment.term_id &&
        (row.paper_id ?? null) === (assessment.paper_id ?? null),
    );
    const summativeMark = (examType: string) =>
      assessmentGroup.find((row) => row.exam_type === examType)?.summative?.toString() ?? "";
    const formativeMark = data?.formativeMarks.find(
      (mark) =>
        mark.student_id === assessment.student_id &&
        mark.subject_id === assessment.subject_id &&
        mark.term_id === assessment.term_id &&
        (mark.paper_id ?? null) === (assessment.paper_id ?? null),
    );

    // A teacher's learner list is scoped by allocation. Select the allocation
    // for the row before loading it, so its learner, subject, and paper remain
    // visible and selected in the form.
    if (isTeacher && matchingAllocation) {
      setAllocationKey(matchingAllocation.key);
    }
    setEditingAssessmentId(assessment.id);
    setEntryForm({
      studentId: assessment.student_id,
      subjectId: assessment.subject_id,
      paperId: assessment.paper_id ?? "",
      termId: assessment.term_id,
      examType: assessment.exam_type ?? "end_of_term",
      formative: formativeMark?.mark?.toString() ?? assessment.formative?.toString() ?? "",
      summative: assessment.summative?.toString() ?? "",
      summativeBot: summativeMark("beginning_of_term"),
      summativeMot: summativeMark("mid_term"),
      summativeEot: summativeMark("end_of_term"),
      isMissing: Boolean(assessment.is_missing || formativeMark?.is_missing),
      teacherInitials: assessment.teacher_initials ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetEntryForm = () => {
    setEntryForm((current) => ({
      ...current,
      studentId: "",
      subjectId: isTeacher && selectedAllocation ? selectedAllocation.subject_id : "",
      termId: data?.currentTermId || "",
      formative: "",
      summative: "",
      summativeBot: "",
      summativeMot: "",
      summativeEot: "",
      isMissing: false,
      examType: "end_of_term",
      teacherInitials: "",
      paperId: "",
    }));
  };

  useEffect(() => {
    if (!data) return;
    setEntryForm((current) => ({
      ...current,
      termId: current.termId || data.currentTermId || "",
      teacherInitials: current.teacherInitials || data.teacherInitials || "",
    }));
    if (isTeacher && !allocationKey && data.allocations.length > 0) {
      setAllocationKey(data.allocations[0].key);
    }
    if (!termFilter && data.currentTermId) {
      setTermFilter(data.currentTermId);
    }
  }, [allocationKey, data, isTeacher, termFilter, selectedAllocation]);

  useEffect(() => {
    if (!isTeacher || !selectedAllocation || editingAssessmentId) return;
    setEntryForm((current) => ({
      ...current,
      subjectId: selectedAllocation.subject_id,
      paperId: selectedAllocation.paper_id ?? "",
      studentId: "",
    }));
  }, [editingAssessmentId, isTeacher, selectedAllocation?.key]);

  const teacherStudents = useMemo(() => {
    if (!data) return [];
    if (!isTeacher) return data.students;
    if (!selectedAllocation) return [];
    return data.students.filter(
      (student: StudentRow) =>
        (!selectedAllocation.class_id || selectedAllocation.class_id === student.class_id) &&
        (!selectedAllocation.stream_id || selectedAllocation.stream_id === student.stream_id),
    );
  }, [data, isTeacher, selectedAllocation]);

  const sortedTeacherStudents = useMemo(() => {
    const direction = learnerSortDirection === "asc" ? 1 : -1;
    const term = learnerSearch.trim().toLowerCase();
    const scopedStudents = term
      ? teacherStudents.filter((student) => {
          const fullName = student.full_name.toLowerCase();
          const classLabel = className(student.class_id).toLowerCase();
          const streamLabel = streamName(student.stream_id).toLowerCase();
          return fullName.includes(term) || classLabel.includes(term) || streamLabel.includes(term);
        })
      : teacherStudents;

    const sortValue = (student: StudentRow) =>
      learnerSortKey === "stream"
        ? `${streamName(student.stream_id)}|${className(student.class_id)}|${student.full_name}`
        : `${className(student.class_id)}|${streamName(student.stream_id)}|${student.full_name}`;

    return [...scopedStudents].sort((a, b) => {
      const left = sortValue(a).toLowerCase();
      const right = sortValue(b).toLowerCase();
      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [className, learnerSearch, learnerSortDirection, learnerSortKey, streamName, teacherStudents]);

  const teacherSubjects = useMemo(() => {
    if (!data) return [];
    const restrictToAllocation = hasAny(me?.roles, ["subject_teacher", "class_teacher", "hod", "dos"]);
    if (!restrictToAllocation) return data.subjects;
    if (!selectedAllocation) return [];
    return data.subjects.filter(
      (subject: SubjectRow) =>
        subject.id === selectedAllocation.subject_id &&
        (!me?.profile?.department_id || subject.department_id === me.profile.department_id),
    );
  }, [data, entryForm.studentId, isTeacher, me?.profile?.department_id, me?.roles, selectedAllocation]);

  const assessmentSubjectId = entryForm.subjectId || (isTeacher ? selectedAllocation?.subject_id : "") || "";
  const selectedSubject = data?.subjects.find((subject) => subject.id === assessmentSubjectId);
  const selectedPaperId = entryForm.paperId || null;
  const selectedPaper = (data?.subjectPapers ?? []).find((paper) => paper.id === selectedPaperId);
  const availablePapers = (data?.subjectPapers ?? [])
    .filter((paper) => paper.subject_id === assessmentSubjectId)
    .filter((paper) => !isTeacher || !selectedAllocation?.paper_id || paper.id === selectedAllocation.paper_id)
    .sort((a, b) => a.position - b.position);
  const isALevelSubject = selectedSubject?.education_level === "advanced";
  const selectedSubjectRequiresPaper = isALevelSubject && availablePapers.length > 0;

  useEffect(() => {
    if (!isTeacher || editingAssessmentId || !assessmentSubjectId) return;
    if (!teacherSubjects.some((subject) => subject.id === assessmentSubjectId)) {
      setEntryForm((current) => ({ ...current, subjectId: "" }));
    }
  }, [assessmentSubjectId, editingAssessmentId, isTeacher, teacherSubjects]);

  useEffect(() => {
    if (editingAssessmentId) return;
    if (selectedSubject?.education_level !== "advanced" || availablePapers.length === 0) {
      if (entryForm.paperId) setEntryForm((current) => ({ ...current, paperId: "" }));
      return;
    }
    if (selectedAllocation?.paper_id) {
      if (entryForm.paperId !== selectedAllocation.paper_id) {
        setEntryForm((current) => ({ ...current, paperId: selectedAllocation.paper_id ?? "" }));
      }
      return;
    }
    if (!availablePapers.some((paper) => paper.id === entryForm.paperId)) {
      if (entryForm.paperId) setEntryForm((current) => ({ ...current, paperId: "" }));
    }
  }, [
    availablePapers,
    editingAssessmentId,
    entryForm.paperId,
    selectedAllocation?.paper_id,
    selectedSubject?.education_level,
  ]);

  useEffect(() => {
    if (editingAssessmentId || !data || !entryForm.studentId || !entryForm.subjectId) return;
    const saved = data.formativeMarks.find(
      (mark) =>
        mark.student_id === entryForm.studentId &&
        mark.subject_id === entryForm.subjectId &&
        (mark.paper_id ?? null) === selectedPaperId,
    );
    if (saved && entryForm.formative === "") {
      setEntryForm((current) => ({
        ...current,
        formative: saved.mark == null ? "" : String(saved.mark),
        isMissing: Boolean(saved.is_missing),
      }));
    }
  }, [data, editingAssessmentId, entryForm.formative, entryForm.studentId, entryForm.subjectId, selectedPaperId]);

  const commentStudents = useMemo(() => {
    if (!data) return [];
    if (!isTeacher) return data.students;
    if (isClassTeacher) {
      if (!assignedClass) return [];
      return data.students.filter((student: StudentRow) => student.class_id === assignedClass.id);
    }
    if (!selectedAllocation) return [];
    return data.students.filter(
      (student: StudentRow) =>
        (!selectedAllocation.class_id || selectedAllocation.class_id === student.class_id) &&
        (!selectedAllocation.stream_id || selectedAllocation.stream_id === student.stream_id),
    );
  }, [assignedClass, data, isClassTeacher, isTeacher, selectedAllocation]);

  const coCurricularByStudent = useMemo(
    () =>
      new Map(
        (data?.coCurricular ?? []).map((item) => [
          item.student_id,
          {
            games: item.games ?? "",
            clubs: item.clubs ?? "",
            projects: item.projects ?? "",
          },
        ]),
      ),
    [data?.coCurricular],
  );

  const { data: comments } = useQuery<CommentRow[]>({
    queryKey: [
      "assessment-comments",
      termFilter || data?.currentTermId || "",
      commentStudents.map((student) => student.id).join(","),
    ],
    enabled: commentStudents.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("report_comments")
          .select("student_id, class_teacher_comment, head_teacher_comment")
          .eq("term_id", termFilter || data?.currentTermId || "")
          .in(
            "student_id",
            commentStudents.map((student) => student.id),
          )
      ).data ?? [],
  });

  const commentLookup = useMemo(
    () =>
      new Map(
        (comments ?? []).map((comment) => [
          comment.student_id,
          {
            classTeacherComment: comment.class_teacher_comment ?? "",
            headTeacherComment: comment.head_teacher_comment ?? "",
          },
        ]),
      ),
    [comments],
  );

  useEffect(() => {
    if (!comments) return;
    setCommentDrafts((current) => {
      const next = { ...current };
      for (const comment of comments) {
        next[comment.student_id] = {
          classTeacherComment:
            comment.class_teacher_comment ?? current[comment.student_id]?.classTeacherComment ?? "",
          headTeacherComment:
            comment.head_teacher_comment ?? current[comment.student_id]?.headTeacherComment ?? "",
        };
      }
      return next;
    });
  }, [comments]);

  useEffect(() => {
    if (!data) return;
    setCommentDrafts((current) => {
      const next = { ...current };
      for (const student of commentStudents) {
        const stored = coCurricularByStudent.get(student.id);
        if (!stored) continue;
        next[student.id] = {
          classTeacherComment: current[student.id]?.classTeacherComment ?? "",
          headTeacherComment: current[student.id]?.headTeacherComment ?? "",
          games: stored.games,
          clubs: stored.clubs,
          projects: stored.projects,
        };
      }
      return next;
    });
  }, [commentStudents, coCurricularByStudent, data]);

  useEffect(() => {
    if (!commentStudents.length) return;
    if (activeCommentStudentId) return;
    setActiveCommentStudentId(commentStudents[0].id);
  }, [activeCommentStudentId, commentStudents]);

  const rows = useMemo(() => {
    if (!tableData) return [];
    return teacherAssessmentRows
      .filter((assessment) =>
        tableSubjectFilter ? assessment.subject_id === tableSubjectFilter : true,
      )
      .filter((assessment) => (statusFilter ? assessment.status === statusFilter : true))
      .filter((assessment) => (termFilter ? assessment.term_id === termFilter : true))
      .map((assessment) => {
        const student = tableData.students.find(
          (item: StudentRow) => item.id === assessment.student_id,
        );
        const studentClass = tableData.classes.find(
          (item: ClassRow) => item.id === student?.class_id,
        );
        const studentLevel = studentClass?.education_level === "advanced" ? "advanced" : "ordinary";
        const total = Number(assessment.formative || 0) + Number(assessment.summative || 0);
        const hit = tableData.gradingScales.find(
          (scale) =>
            (scale.education_level ?? "ordinary") === studentLevel &&
            total >= Number(scale.min_score) &&
            total <= Number(scale.max_score),
        );
        return {
          ...assessment,
          studentName: student?.full_name ?? "Ã¢â‚¬â€",
          subjectName:
            tableData.subjects.find((subject: SubjectRow) => subject.id === assessment.subject_id)
              ?.name ?? "Ã¢â‚¬â€",
          paperName: assessment.paper_id
            ? tableData.subjectPapers.find((paper) => paper.id === assessment.paper_id)?.name ?? "Paper"
            : "",
          termName:
            tableData.terms.find((term: TermRow) => term.id === assessment.term_id)?.name ??
            "Ã¢â‚¬â€",
          gradeDescriptor:
            studentLevel === "advanced"
              ? hit?.points != null
                ? String(hit.points)
                : (assessment.grade_descriptor ?? "")
              : (hit?.descriptor ?? assessment.grade_descriptor ?? ""),
        };
      });
  }, [statusFilter, tableData, tableSubjectFilter, teacherAssessmentRows, termFilter]);

  const visibleRows = useMemo(() => {
    const normalizedSubjectFilter = tableSubjectFilter.trim();
    return rows.filter((row) =>
      normalizedSubjectFilter ? row.subject_id === normalizedSubjectFilter : true,
    );
  }, [rows, tableSubjectFilter]);

  const summativeGroups = useMemo(() => {
    const activePeriods = new Set(data?.activeAssessmentPeriods ?? []);
    const groups = new Map<
      string,
      {
        row: (typeof visibleRows)[number];
        periods: Partial<Record<"beginning_of_term" | "mid_term" | "end_of_term", number>>;
        rows: (typeof visibleRows)[number][];
        formativeMark: FormativeMarkRow | null;
      }
    >();
    for (const row of visibleRows) {
      const examType = row.exam_type as "beginning_of_term" | "mid_term" | "end_of_term";
      if (!activePeriods.has(examType)) continue;
      const key = `${row.student_id}:${row.subject_id}:${row.term_id}:${row.paper_id ?? "subject"}`;
      const group = groups.get(key) ?? { row, periods: {}, rows: [], formativeMark: null };
      const score = Number(row.summative);
      if (Number.isFinite(score)) group.periods[examType] = score;
      group.rows.push(row);
      groups.set(key, group);
    }
    return Array.from(groups.values()).map((group) => {
        const formativeMark = tableData?.formativeMarks.find(
          (mark) =>
            mark.student_id === group.row.student_id &&
            mark.subject_id === group.row.subject_id &&
            mark.term_id === group.row.term_id &&
            (mark.paper_id ?? null) === (group.row.paper_id ?? null),
        ) ?? null;
      return {
        ...group,
        formativeMark,
        formative: formativeMark?.mark ?? null,
        average: Object.values(group.periods).length
        ? Object.values(group.periods).reduce((sum, score) => sum + (score ?? 0), 0) /
          Object.values(group.periods).length
        : null,
      };
    });
  }, [data?.activeAssessmentPeriods, tableData?.formativeMarks, visibleRows]);

  const sortedSummativeGroups = useMemo(() => {
    const groups = [...summativeGroups];
    if (assessmentSort === "class") {
      return groups.sort((a, b) => {
        const aStudent = tableData?.students.find((item) => item.id === a.row.student_id);
        const bStudent = tableData?.students.find((item) => item.id === b.row.student_id);
        const aClass = tableData?.classes.find((item) => item.id === aStudent?.class_id)?.name ?? "";
        const bClass = tableData?.classes.find((item) => item.id === bStudent?.class_id)?.name ?? "";
        return aClass.localeCompare(bClass) || a.row.studentName.localeCompare(b.row.studentName);
      });
    }
    if (assessmentSort === "stream") {
      return groups.sort((a, b) => {
        const aStudent = tableData?.students.find((item) => item.id === a.row.student_id);
        const bStudent = tableData?.students.find((item) => item.id === b.row.student_id);
        const aStream = data?.streams.find((item) => item.id === aStudent?.stream_id)?.name ?? "";
        const bStream = data?.streams.find((item) => item.id === bStudent?.stream_id)?.name ?? "";
        return aStream.localeCompare(bStream) || a.row.studentName.localeCompare(b.row.studentName);
      });
    }
    if (assessmentSort === "subject") {
      return groups.sort((a, b) => a.row.subjectName.localeCompare(b.row.subjectName));
    }
    return groups.sort((a, b) => String(b.row.created_at ?? "").localeCompare(String(a.row.created_at ?? "")));
  }, [assessmentSort, data?.streams, summativeGroups, tableData?.classes, tableData?.students]);

  const submitGroupMutation = useMutation({
    mutationFn: async (group: (typeof summativeGroups)[number]) => {
      const assessmentIds = group.rows
        .filter((row) => row.status === "draft" || row.status === "rejected")
        .filter((row) => !row.locked)
        .map((row) => row.id);
      if (!assessmentIds.length) throw new Error("No editable summative drafts are available");
      if (!group.formativeMark) {
        throw new Error("Save the learner's formative mark before submitting this record");
      }
      if (!group.formativeMark.locked && ["draft", "rejected"].includes(group.formativeMark.status)) {
        const { error } = await (supabase as any)
          .from("formative_marks")
          .update({
            status: "submitted",
            submitted_by: me?.userId ?? null,
            submitted_at: new Date().toISOString(),
          })
          .eq("id", group.formativeMark.id)
          .eq("status", group.formativeMark.status);
        if (error) throw new Error(error.message);
      }
      await submitEntries({ data: { assessmentIds, teacherInitials: data?.teacherInitials ?? null } });
    },
    onSuccess: () => {
      toast.success("Formative and summative marks submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessment-table"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const edit = edits[id] ?? {};
      const existing = assessmentLookup.get(id);
      if (!existing) throw new Error("The selected assessment could not be found");
      const effectiveFormative =
        edit.formative !== undefined ? edit.formative : (existing?.formative?.toString() ?? "");
      const effectiveSummative =
        edit.summative !== undefined ? edit.summative : (existing?.summative?.toString() ?? "");
      const formative = readAssessmentMark(effectiveFormative, "formative", 20);
      const summative = readAssessmentMark(effectiveSummative, "summative", 80);
      const teacherInitials = data?.teacherInitials.trim() || existing.teacher_initials?.trim() || "";
      if (!teacherInitials) throw new Error("Add teacher initials before submitting the assessment");
      if (["draft", "rejected"].includes(existing?.status ?? "") && !existing?.locked) {
        await updateDraftEntry({
          data: {
            assessmentId: id,
            examType: existing.exam_type,
            formative,
            summative,
            teacherInitials,
          },
        });
        await submitEntry({
          data: {
            assessmentId: id,
            formative,
            summative,
            teacherInitials,
          },
        });
        return;
      }

      await submitEntry({
        data: {
          assessmentId: id,
          formative,
          summative,
          teacherInitials,
        },
      });
    },
    onSuccess: () => {
      toast.success("Scores submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const commentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const termId = termFilter || data?.currentTermId;
      if (!termId) throw new Error("Choose a term first");
      const draft = commentDrafts[studentId] ?? { classTeacherComment: "", headTeacherComment: "" };
      const coCurricularDraft = commentDrafts[studentId] ?? {
        classTeacherComment: "",
        headTeacherComment: "",
        games: "",
        clubs: "",
        projects: "",
      };
      await saveComment({
        data:
          isClassTeacher && !isHeadTeacher
            ? {
                studentId,
                termId,
                classTeacherComment: coCurricularDraft.classTeacherComment,
                games: coCurricularDraft.games,
                clubs: coCurricularDraft.clubs,
                projects: coCurricularDraft.projects,
              }
            : {
                studentId,
                termId,
                classTeacherComment: draft.classTeacherComment,
                headTeacherComment: draft.headTeacherComment,
              },
      });
    },
    onSuccess: () => {
      toast.success("Comment saved");
      queryClient.invalidateQueries({ queryKey: ["assessment-comments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-report-comments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-co-curricular"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (group: (typeof summativeGroups)[number]) =>
      deleteGroup({
        data: {
          studentId: group.row.student_id,
          subjectId: group.row.subject_id,
          paperId: group.row.paper_id ?? null,
          termId: group.row.term_id,
        },
      }),
    onSuccess: () => {
      toast.success("Formative, BOT, MOT, and EOT marks deleted");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessment-table"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (vars: {
      studentId: string;
      commentType: "class_teacher" | "head_teacher";
    }) => {
      const termId = termFilter || data?.currentTermId;
      if (!termId) throw new Error("Choose a term first");
      await removeComment({
        data: {
          studentId: vars.studentId,
          termId,
          commentType: vars.commentType,
        },
      });
    },
    onSuccess: () => {
      toast.success("Comment deleted");
      queryClient.invalidateQueries({ queryKey: ["assessment-comments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-report-comments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-co-curricular"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!entryForm.termId && !data?.currentTermId) throw new Error("Choose a term");
      if (!entryForm.studentId) throw new Error("Choose a learner");
      if (!assessmentSubjectId) throw new Error("Choose a subject");
      if (selectedSubjectRequiresPaper && !selectedPaperId) {
        throw new Error("Select the A-Level paper being assessed");
      }
      if (!selectedSubjectRequiresPaper && selectedPaperId) {
        throw new Error("O-Level subjects cannot be assessed against a paper");
      }
      if (isTeacher && !selectedAllocation)
        throw new Error("Choose an assigned class / stream / subject");
      if (isTeacher && selectedAllocation) {
        const allowed = teacherStudents.some((student) => student.id === entryForm.studentId);
        if (!allowed) throw new Error("This learner is not assigned to you for this subject");
        if (selectedSubjectRequiresPaper && selectedAllocation.paper_id !== selectedPaperId) {
          throw new Error("Select the paper assigned to you for this A-Level subject");
        }
      }
      // Formative is saved independently in formative_marks; legacy assessment
      // rows keep zero only to satisfy the existing database constraint.
      const formative = entryForm.formative
        ? readAssessmentMark(entryForm.formative, "formative", 20)
        : 0;
      const teacherInitials = entryForm.teacherInitials.trim();
      if (!teacherInitials) throw new Error("Add teacher initials before saving the assessment");
      const summativeEntries = [
        ["beginning_of_term", entryForm.summativeBot],
        ["mid_term", entryForm.summativeMot],
        ["end_of_term", entryForm.summativeEot],
      ].filter(([, value]) => value.trim());
      if (!summativeEntries.length) throw new Error("Enter at least one summative mark");

      if (editingAssessmentId) {
        const currentValue =
          entryForm.examType === "beginning_of_term"
            ? entryForm.summativeBot
            : entryForm.examType === "mid_term"
              ? entryForm.summativeMot
              : entryForm.summativeEot;
        await updateDraftEntry({
          data: {
            assessmentId: editingAssessmentId,
            examType: entryForm.examType,
            formative,
            summative: readAssessmentMark(currentValue, "summative", 80),
            teacherInitials,
          },
        });
        return;
      }

      for (const [examType, value] of summativeEntries) {
        const summative = readAssessmentMark(value, `${examType.replaceAll("_", " ")} summative`, 80);
        const existing = tableData?.assessments.find(
          (assessment) =>
            assessment.student_id === entryForm.studentId &&
            assessment.subject_id === assessmentSubjectId &&
            assessment.term_id === (entryForm.termId || data?.currentTermId || "") &&
            (assessment.paper_id ?? null) === selectedPaperId &&
            assessment.exam_type === examType,
        );
        if (existing) {
          if (existing.locked || !["draft", "rejected"].includes(existing.status)) {
            throw new Error(`${examType.replaceAll("_", " ")} already submitted or approved`);
          }
          await updateDraftEntry({
            data: { assessmentId: existing.id, examType, formative, summative, teacherInitials },
          });
        } else {
          await upsertEntry({
            data: {
              studentId: entryForm.studentId,
              subjectId: assessmentSubjectId,
              paperId: selectedPaperId,
              termId: entryForm.termId || data?.currentTermId || "",
              examType,
              gradeDescriptor: null,
              formative,
              summative,
              teacherInitials,
            },
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(editingAssessmentId ? "Assessment updated" : "Assessment saved as draft");
      queryClient.invalidateQueries({ queryKey: ["assessment-table"] });
      resetEntryForm();
      setEditingAssessmentId("");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const formativeDraftMutation = useMutation({
    mutationFn: async () => {
      const subjectId = entryForm.subjectId || (isTeacher ? selectedAllocation?.subject_id : "") || "";
      const termId = entryForm.termId || data?.currentTermId || "";
      if (!schoolId || !entryForm.studentId || !subjectId || !termId) {
        throw new Error("Choose a learner, subject, and current term first");
      }
      if (!entryForm.teacherInitials.trim()) {
        throw new Error("Add teacher initials before saving the formative mark");
      }
      if (isTeacher && !selectedAllocation) {
        throw new Error("Choose an assigned class, stream, and subject first");
      }
      if (isTeacher && selectedAllocation && !teacherStudents.some((student) => student.id === entryForm.studentId)) {
        throw new Error("This learner is not assigned to you for this subject");
      }
      if (isTeacher && !teacherSubjects.some((subject) => subject.id === subjectId)) {
        throw new Error("This subject is not assigned to you for the selected learner");
      }
      if (selectedSubjectRequiresPaper && !selectedPaperId) {
        throw new Error("Select the A-Level paper being assessed");
      }
      const existing = data.formativeMarks.find(
        (mark) =>
          mark.student_id === entryForm.studentId &&
          mark.subject_id === subjectId &&
          mark.term_id === termId &&
          (mark.paper_id ?? null) === selectedPaperId,
      );
      if (existing && (existing.locked || ["submitted", "approved"].includes(existing.status))) {
        throw new Error("This formative mark has already been submitted or approved");
      }
      const mark = Number(entryForm.formative);
      if (!Number.isFinite(mark) || mark < 0 || mark > 20) {
        throw new Error("Enter a formative mark between 0 and 20");
      }
      const { error } = await (supabase as any).from("formative_marks").upsert(
        {
          school_id: schoolId,
          student_id: entryForm.studentId,
          subject_id: subjectId,
          paper_id: selectedPaperId,
          term_id: termId,
          mark,
          teacher_initials: entryForm.teacherInitials.trim(),
          status: "draft",
          locked: false,
          submitted_by: me?.userId ?? null,
        },
        { onConflict: "student_id,subject_id,term_id,paper_id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Formative draft saved");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!entryForm.termId && !data?.currentTermId) throw new Error("Choose a term");
      if (!entryForm.studentId) throw new Error("Choose a learner");
      if (!assessmentSubjectId) throw new Error("Choose a subject");
      if (selectedSubjectRequiresPaper && !selectedPaperId) {
        throw new Error("Select the A-Level paper being assessed");
      }
      if (!selectedSubjectRequiresPaper && selectedPaperId) {
        throw new Error("O-Level subjects cannot be assessed against a paper");
      }
      if (isTeacher && !selectedAllocation)
        throw new Error("Choose an assigned class / stream / subject");
      if (isTeacher && selectedAllocation) {
        const allowed = teacherStudents.some((student) => student.id === entryForm.studentId);
        if (!allowed) throw new Error("This learner is not assigned to you for this subject");
        if (selectedSubjectRequiresPaper && selectedAllocation.paper_id !== selectedPaperId) {
          throw new Error("Select the paper assigned to you for this A-Level subject");
        }
      }
      const formative = entryForm.isMissing
        ? 0
        : readAssessmentMark(entryForm.formative, "formative", 20);
      // Formative is persisted once in formative_marks. Assessment rows hold
      // only their individual BOT, MOT, or EOT summative value.
      const assessmentFormative = 0;
      const teacherInitials = entryForm.teacherInitials.trim();
      if (!teacherInitials) throw new Error("Add teacher initials before saving the draft");

      const termId = entryForm.termId || data?.currentTermId || "";
      const summativeEntries: Array<[string, string]> = entryForm.isMissing
        ? (data?.openAssessmentPeriods ?? []).map((examType) => [examType, "0"] as [string, string])
        : [
            ["beginning_of_term", entryForm.summativeBot],
            ["mid_term", entryForm.summativeMot],
            ["end_of_term", entryForm.summativeEot],
          ].filter(([examType, value]) =>
            (data?.openAssessmentPeriods ?? []).includes(examType) && value.trim(),
          );
      if (!summativeEntries.length) {
        throw new Error(
          entryForm.isMissing
            ? "Open at least one assessment period before recording a missing mark"
            : "Enter at least one active BOT, MOT, or EOT summative mark",
        );
      }

      const existingFormative = data.formativeMarks.find(
        (mark) =>
          mark.student_id === entryForm.studentId &&
          mark.subject_id === assessmentSubjectId &&
          mark.term_id === termId &&
          (mark.paper_id ?? null) === selectedPaperId,
      );
      if (existingFormative && (existingFormative.locked || ["submitted", "approved"].includes(existingFormative.status))) {
        throw new Error("The formative mark has already been submitted or approved");
      }

      // Save every entered summative period as a draft for this learner,
      // subject, term, and (where applicable) A-Level paper.
      for (const [examType, value] of summativeEntries) {
        const summative = entryForm.isMissing
          ? 0
          : readAssessmentMark(value, `${examType.replaceAll("_", " ")} summative`, 80);
        const existing = tableData?.assessments.find(
          (assessment) =>
            assessment.student_id === entryForm.studentId &&
            assessment.subject_id === assessmentSubjectId &&
            assessment.term_id === termId &&
            (assessment.paper_id ?? null) === selectedPaperId &&
            (assessment.exam_type ?? "end_of_term") === examType,
        );
        if (existing) {
          if (existing.locked || !["draft", "rejected"].includes(existing.status)) {
            throw new Error(`${examType.replaceAll("_", " ")} is already submitted or approved`);
          }
          await updateDraftEntry({
            data: {
              assessmentId: existing.id,
              examType,
              formative: assessmentFormative,
              summative,
              isMissing: entryForm.isMissing,
              teacherInitials,
            },
          });
        } else {
          await upsertEntry({
            data: {
              studentId: entryForm.studentId,
              subjectId: assessmentSubjectId,
              paperId: selectedPaperId,
              termId,
              examType,
              gradeDescriptor: null,
              formative: assessmentFormative,
              summative,
              isMissing: entryForm.isMissing,
              teacherInitials,
            },
          });
        }
      }

      const { error: formativeError } = await (supabase as any).from("formative_marks").upsert(
        {
          school_id: schoolId,
          student_id: entryForm.studentId,
          subject_id: assessmentSubjectId,
          paper_id: selectedPaperId,
          term_id: termId,
          mark: formative,
          is_missing: entryForm.isMissing,
          teacher_initials: teacherInitials,
          status: "draft",
          locked: false,
          submitted_by: me?.userId ?? null,
          submitted_at: null,
          approved_by: null,
          approved_at: null,
        },
        { onConflict: "student_id,subject_id,term_id,paper_id" },
      );
      if (formativeError) throw new Error(formativeError.message);
    },
    onSuccess: () => {
      toast.success("Formative and summative drafts saved");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessment-table"] });
      setEditingAssessmentId("");
      setEntryForm((current) => ({
        ...current,
        studentId: "",
        formative: "",
        summative: "",
        summativeBot: "",
        summativeMot: "",
        summativeEot: "",
        isMissing: false,
        examType: "end_of_term",
        teacherInitials: "",
        paperId: "",
      }));
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: (vars: {
      ids: string[];
      action: "approve" | "reject";
      reason?: string;
      classId?: string | null;
      streamId?: string | null;
    }) => reviewAssessments({ data: vars }),
    onSuccess: () => {
      toast.success("Review recorded");
      queryClient.invalidateQueries({ queryKey: ["assessment-table"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const pendingIds = visibleRows
    .filter(
      (
        row: AssessmentRow & {
          studentName: string;
          subjectName: string;
          termName: string;
          gradeDescriptor: string;
        },
      ) => row.status === "submitted",
    )
    .map((row) => row.id);

  const reviewClassOptions = data?.classes ?? [];
  const reviewStreamOptions = useMemo(
    () =>
      (data?.streams ?? []).filter((stream) => !reviewClassId || stream.class_id === reviewClassId),
    [data?.streams, reviewClassId],
  );
  const dosSubmittedRows = useMemo(() => {
    if (!tableData) return [];
    return tableData.assessments
      .filter((assessment) => assessment.status === "submitted")
      .map((assessment) => {
        const student = tableData.students.find((item) => item.id === assessment.student_id);
        const studentClass = tableData.classes.find((item) => item.id === student?.class_id);
        const studentLevel = studentClass?.education_level === "advanced" ? "advanced" : "ordinary";
        const total = Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0);
        const scale = tableData.gradingScales.find(
          (item) =>
            (item.education_level ?? "ordinary") === studentLevel &&
            total >= Number(item.min_score) &&
            total <= Number(item.max_score),
        );
        return {
          ...assessment,
        studentName:
          tableData.students.find((student: StudentRow) => student.id === assessment.student_id)
            ?.full_name ?? "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â",
        subjectName:
          tableData.subjects.find((subject: SubjectRow) => subject.id === assessment.subject_id)
            ?.name ?? "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â",
        termName:
          tableData.terms.find((term: TermRow) => term.id === assessment.term_id)?.name ??
          "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â",
          gradeDescriptor:
            studentLevel === "advanced"
              ? scale?.points != null
                ? String(scale.points)
                : assessment.grade_descriptor ?? ""
              : scale?.descriptor ?? "",
        submitted_by_name: assessment.submitted_by
          ? (tableData.staffProfileMap.get(assessment.submitted_by) ?? "Unknown teacher")
          : "Not submitted",
        };
      });
  }, [tableData]);
  const scopedPendingIds = useMemo(() => {
    if (!reviewClassId && !reviewStreamId) return pendingIds;
    return dosSubmittedRows
      .filter((row) => {
        const student = data?.students.find((item) => item.id === row.student_id);
        if (!student) return false;
        if (reviewClassId && student.class_id !== reviewClassId) return false;
        if (reviewStreamId && student.stream_id !== reviewStreamId) return false;
        return true;
      })
      .map((row) => row.id);
  }, [data?.students, dosSubmittedRows, pendingIds, reviewClassId, reviewStreamId]);
  const scopedPendingRows = useMemo(() => {
    return dosSubmittedRows.filter((row) => {
      const student = data?.students.find((item) => item.id === row.student_id);
      if (!student) return false;
      if (reviewClassId && student.class_id !== reviewClassId) return false;
      if (reviewStreamId && student.stream_id !== reviewStreamId) return false;
      return true;
    });
  }, [data?.students, dosSubmittedRows, reviewClassId, reviewStreamId]);

  const teacherBulkSubmitIds = useMemo(() => {
    if (!isTeacher || !selectedAllocation || !data) return [];
    return tableData.assessments
      .filter((assessment) => assessment.term_id === (entryForm.termId || data.currentTermId))
      .filter((assessment) => assessment.subject_id === selectedAllocation.subject_id)
      .filter((assessment) => (assessment.paper_id ?? null) === (selectedAllocation.paper_id ?? null))
      .filter((assessment) => assessment.status === "draft" || assessment.status === "rejected")
      .filter((assessment) => {
        const student = data.students.find((item) => item.id === assessment.student_id);
        if (!student) return false;
        if (selectedAllocation.class_id && student.class_id !== selectedAllocation.class_id)
          return false;
        if (selectedAllocation.stream_id && student.stream_id !== selectedAllocation.stream_id)
          return false;
        return true;
      })
      .map((assessment) => assessment.id);
  }, [data, entryForm.termId, isTeacher, selectedAllocation]);

  const bulkSubmitMutation = useMutation({
    mutationFn: async () => {
      if (!teacherBulkSubmitIds.length) {
        throw new Error("No draft assessments found for the selected allocation");
      }
      await submitEntries({
        data: {
          assessmentIds: teacherBulkSubmitIds,
        },
      });
    },
    onSuccess: () => {
      toast.success("Selected allocation submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["assessment-table"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Formative counts 20%, summative 80%. Approved scores lock automatically."
      />

      {isAssessmentsLoading && (
        <Panel className="mb-4">
          <p className="text-sm text-muted-foreground">Loading assessment setup...</p>
        </Panel>
      )}
      {isAssessmentsError && (
        <Panel className="mb-4 border-red-200 bg-red-50">
          <p role="alert" className="text-sm text-red-700">
            Unable to load assessments: {friendlyAdminError(assessmentsError as Error)}
          </p>
        </Panel>
      )}

      {canEnter && data && !isAssessmentsLoading && !isAssessmentsError && (
        <Panel title="Enter assessment" className="mb-4">
          <form
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitMutation.mutate();
            }}
          >
            {isTeacher && (
              <Field label="Assigned class / stream / subject">
                {(() => {
                  const allocationCount = data?.allocations.length ?? 0;
                  return (
                    <select
                      required
                      className={inputClass}
                      value={allocationKey}
                      onChange={(event) => setAllocationKey(event.target.value)}
                      disabled={allocationCount === 0}
                    >
                      {allocationCount === 0 ? (
                        <option value="">No allocations found</option>
                      ) : (
                        data?.allocations.map((allocation: TeacherAllocationView) => (
                          <option key={allocation.key} value={allocation.key}>
                            {allocation.label}
                          </option>
                        ))
                      )}
                    </select>
                  );
                })()}
              </Field>
            )}
            <div className="md:col-span-2 xl:col-span-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <Field label="Search learners on this page" className="min-w-0 flex-1">
                  <input
                    className={inputClass}
                    value={learnerSearch}
                    onChange={(event) => setLearnerSearch(event.target.value)}
                    placeholder="Search by name, class or stream"
                  />
                </Field>
                <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                  Current allocation: {selectedAllocation?.label ?? "No allocation selected"}
                </div>
              </div>
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <Field label="Learners to assess">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Btn
                    type="button"
                    variant={learnerSortKey === "class" ? "accent" : "ghost"}
                    onClick={() => setLearnerSortKey("class")}
                  >
                    Sort by class
                  </Btn>
                  <Btn
                    type="button"
                    variant={learnerSortKey === "stream" ? "accent" : "ghost"}
                    onClick={() => setLearnerSortKey("stream")}
                  >
                    Sort by stream
                  </Btn>
                  <Btn
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setLearnerSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                    }
                  >
                    Direction: {learnerSortDirection === "asc" ? "A to Z" : "Z to A"}
                  </Btn>
                  <p className="text-xs text-muted-foreground">
                    Select a learner from the table to load them into the assessment form.
                  </p>
                  {(selectedSubjectRequiresPaper || selectedAllocationUsesPaper) && (
                    <p className="w-full text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      Paper being assessed: {selectedPaper?.name ?? selectedAllocationPaper?.name ?? "Select a paper"}
                    </p>
                  )}
                  {isTeacher && selectedAllocation ? (
                    <Btn
                      type="button"
                      variant="accent"
                      disabled={bulkSubmitMutation.isPending || teacherBulkSubmitIds.length === 0}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Submit all ${teacherBulkSubmitIds.length} assessment(s) for this allocation?`,
                          )
                        ) {
                          bulkSubmitMutation.mutate();
                        }
                      }}
                    >
                      {bulkSubmitMutation.isPending
                        ? "Submitting..."
                        : `Submit allocation (${teacherBulkSubmitIds.length})`}
                    </Btn>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Learner</th>
                        {(selectedSubjectRequiresPaper || selectedAllocationUsesPaper) && (
                          <th className="px-3 py-2">Paper / marks</th>
                        )}
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            className="font-semibold text-foreground"
                            onClick={() => {
                              setLearnerSortKey("class");
                              setLearnerSortDirection((current) =>
                                learnerSortKey === "class"
                                  ? current === "asc"
                                    ? "desc"
                                    : "asc"
                                  : "asc",
                              );
                            }}
                          >
                            Class
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            className="font-semibold text-foreground"
                            onClick={() => {
                              setLearnerSortKey("stream");
                              setLearnerSortDirection((current) =>
                                learnerSortKey === "stream"
                                  ? current === "asc"
                                    ? "desc"
                                    : "asc"
                                  : "asc",
                              );
                            }}
                          >
                            Stream
                          </button>
                        </th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeacherStudents.map((student) => {
                        const selected = entryForm.studentId === student.id;
                        const paperAssessments = (selectedSubjectRequiresPaper || selectedAllocationUsesPaper) && selectedPaperId
                          ? (tableData?.assessments ?? []).filter(
                              (assessment) =>
                                assessment.student_id === student.id &&
                                assessment.subject_id === entryForm.subjectId &&
                                (assessment.paper_id ?? null) === selectedPaperId &&
                                assessment.term_id === (entryForm.termId || data?.currentTermId),
                            )
                          : [];
                        return (
                          <tr
                            key={student.id}
                            className={`border-t border-border transition-colors ${
                              selected ? "bg-accent/10" : "hover:bg-muted/40"
                            }`}
                          >
                            <td className="px-3 py-2 font-medium">{student.full_name}</td>
                            {(selectedSubjectRequiresPaper || selectedAllocationUsesPaper) && (
                              <td className="px-3 py-2">
                                {selectedPaper?.name ?? selectedAllocationPaper?.name ?? "Select a paper"}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({paperAssessments.length
                                    ? ["beginning_of_term", "mid_term", "end_of_term"]
                                        .map((examType) => {
                                          const mark = paperAssessments.find(
                                            (assessment) => assessment.exam_type === examType,
                                          )?.summative;
                                          return `${examType === "beginning_of_term" ? "BOT" : examType === "mid_term" ? "MID" : "EOT"}: ${mark ?? "-"}`;
                                        })
                                        .join(" | ")
                                    : "No marks yet"})
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-2">{className(student.class_id)}</td>
                            <td className="px-3 py-2">{streamName(student.stream_id)}</td>
                            <td className="px-3 py-2 capitalize">{student.status}</td>
                            <td className="px-3 py-2 text-right">
                              <Btn
                                type="button"
                                variant={selected ? "accent" : "ghost"}
                                onClick={() =>
                                  setEntryForm((current) => ({
                                    ...current,
                                    studentId: student.id,
                                    subjectId: isTeacher
                                      ? selectedAllocation?.subject_id ?? current.subjectId
                                      : current.subjectId,
                                    paperId: isTeacher
                                      ? selectedAllocation?.paper_id ?? current.paperId
                                      : current.paperId,
                                  }))
                                }
                              >
                                {selected ? "Selected" : "Select"}
                              </Btn>
                            </td>
                          </tr>
                        );
                      })}
                      {sortedTeacherStudents.length === 0 && (
                        <tr>
                          <td colSpan={selectedSubjectRequiresPaper || selectedAllocationUsesPaper ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground">
                            No learners match the current allocation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Field>
            </div>
            <Field label="Subject">
              {isTeacher && teacherSubjects.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                  {!selectedAllocation
                    ? "No subject allocation is selected."
                    : !entryForm.studentId
                      ? "Select a learner to load the assigned subject."
                      : "This learner has no matching subject allocation."}
                </p>
              ) : (
                <select
                  required
                  className={inputClass}
                  value={entryForm.subjectId}
                  onChange={(event) => setEntryForm({
                    ...entryForm,
                    subjectId: event.target.value,
                    paperId: "",
                  })}
                  disabled={isTeacher}
                >
                  {!isTeacher && <option value="">Select subject</option>}
                  {teacherSubjects.map((subject: SubjectRow) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Term">
              <select
                required={!data?.currentTermId}
                className={inputClass}
                value={entryForm.termId}
                disabled
              >
                <option value={data?.currentTermId ?? ""}>
                  {data?.currentTermId
                    ? data.terms.find((term) => term.id === data.currentTermId)?.name + " (Current)"
                    : "Set a current term first"}
                </option>
              </select>
            </Field>
            {selectedSubject?.education_level === "advanced" && availablePapers.length > 0 && (
              <Field label="A-Level paper">
                <select
                  required
                  className={inputClass}
                  value={entryForm.paperId}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, paperId: event.target.value }))
                  }
                >
                  <option value="">Select paper</option>
                  {availablePapers.map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save each paper separately. You can assess one paper or every paper for the learner.
                </p>
              </Field>
            )}
            {isALevelSubject && availablePapers.length === 0 && (
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-800">
                No papers are configured. This A-Level subject will be assessed at subject level.
              </p>
            )}
            <Field label="Teacher initials">
              <input
                required
                className={inputClass}
                value={entryForm.teacherInitials}
                onChange={(event) =>
                  setEntryForm((current) => ({ ...current, teacherInitials: event.target.value }))
                }
                placeholder="e.g. JK"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used on both formative and summative records.
              </p>
            </Field>
            <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
              <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-amber-950 dark:text-amber-100">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={entryForm.isMissing}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, isMissing: event.target.checked }))
                  }
                />
                <span>Record this subject or paper as a missing mark</span>
              </label>
              <p className="mt-1 pl-7 text-xs text-amber-900/80 dark:text-amber-200">
                The score inputs are not required. After approval, the report shows MISSING MARK and
                counts this subject as zero rather than omitting it.
              </p>
            </div>
            <fieldset className="md:col-span-1 xl:col-span-2 rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/20">
              <legend className="rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-sm font-semibold text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
                Formative form — {selectedSubjectRequiresPaper ? "selected paper" : "whole term"}
              </legend>
              <Field
                label={
                  selectedSubjectRequiresPaper
                    ? "Formative / 20 (selected paper)"
                    : "Formative / 20 (whole term)"
                }
              >
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={20}
                  disabled={entryForm.isMissing}
                  className={inputClass}
                  value={entryForm.formative}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  onChange={(event) =>
                    setEntryForm({ ...entryForm, formative: event.target.value })
                  }
                />
              </Field>
              <p className="mt-1 text-xs text-muted-foreground">
                {entryForm.isMissing
                  ? "This formative score is recorded as missing."
                  : selectedSubjectRequiresPaper
                  ? "Enter this separately for each A-Level paper."
                  : "Enter this once for the learner and subject for the whole term."}
              </p>
              <p className="mt-2 text-xs font-medium text-blue-800 dark:text-blue-200">
                This formative mark will be saved as a draft together with the summative marks below.
              </p>
            </fieldset>
            <fieldset className="md:col-span-1 xl:col-span-2 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
              <legend className="rounded-md border border-emerald-200 bg-emerald-100 px-2 py-1 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                Summative form — BOT / MOT / EOT
              </legend>
              <p className="mb-3 text-xs text-muted-foreground">
                {entryForm.isMissing
                  ? "Every open period will be saved as a missing mark."
                  : "Enter any active periods available for this term. Empty periods are skipped."}
              </p>
              <Field label="BOT summative / 80">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={80}
                  disabled={entryForm.isMissing || !data?.openAssessmentPeriods.includes("beginning_of_term")}
                  className={inputClass}
                  value={entryForm.summativeBot}
                  onChange={(event) =>
                    setEntryForm({ ...entryForm, summativeBot: event.target.value })
                  }
                />
              </Field>
              <Field label="MOT summative / 80">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={80}
                  disabled={entryForm.isMissing || !data?.openAssessmentPeriods.includes("mid_term")}
                  className={inputClass}
                  value={entryForm.summativeMot}
                  onChange={(event) =>
                    setEntryForm({ ...entryForm, summativeMot: event.target.value })
                  }
                />
              </Field>
              <Field label="EOT summative / 80">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={80}
                  disabled={entryForm.isMissing || !data?.openAssessmentPeriods.includes("end_of_term")}
                  className={inputClass}
                  value={entryForm.summativeEot}
                  onChange={(event) =>
                    setEntryForm({ ...entryForm, summativeEot: event.target.value })
                  }
                />
              </Field>
              <p className="mt-1 text-xs text-muted-foreground">
                {entryForm.isMissing
                  ? "Missing marks are shown as MISSING MARK on the report and count as zero."
                  : "Approved active-period marks are averaged on the report."}
              </p>
              <Btn type="submit" variant="accent" disabled={submitMutation.isPending || (isTeacher && !selectedAllocation) || !entryForm.studentId}>
                {submitMutation.isPending
                  ? "Saving draft..."
                  : entryForm.isMissing
                    ? "Save missing-mark draft"
                    : "Save Draft formative + summative."}
              </Btn>
              {submitMutation.isError && (
                <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Marks were not saved as a draft: {friendlyAdminError(submitMutation.error as Error)}
                </p>
              )}
              {editingAssessmentId && (
                <Btn
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingAssessmentId("");
                    resetEntryForm();
                  }}
                >
                  Cancel edit
                </Btn>
              )}
            </fieldset>
            <Field label="Marks status">
              <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                {entryForm.isMissing
                  ? "This draft records a missing mark for the selected subject or paper."
                  : "Formative and summative marks are saved together as drafts. Enter at least one active BOT, MOT, or EOT mark."}
              </p>
            </Field>
            <Field label="Grade descriptor">
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Generated on the report after the approved formative mark and active period
                summative marks are available.
              </p>
            </Field>
          </form>
        </Panel>
      )}

      {canEditComments && (
        <Panel title="Learner comments" className="mb-4">
          {isClassTeacher ? (
            assignedClass ? (
              commentStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No learners were found in your assigned class.
                </p>
              ) : (
                <div className="space-y-4">
                  <form
                    className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (activeCommentStudentId) commentMutation.mutate(activeCommentStudentId);
                    }}
                  >
                    <Field label="Learner">
                      <select
                        className={inputClass}
                        value={activeCommentStudentId}
                        onChange={(event) => setActiveCommentStudentId(event.target.value)}
                      >
                        {commentStudents.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.full_name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Games">
                      <textarea
                        className={`${inputClass} min-h-24`}
                        value={commentDrafts[activeCommentStudentId]?.games ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [activeCommentStudentId]: {
                              classTeacherComment:
                                current[activeCommentStudentId]?.classTeacherComment ?? "",
                              headTeacherComment:
                                current[activeCommentStudentId]?.headTeacherComment ?? "",
                              games: event.target.value,
                              clubs: current[activeCommentStudentId]?.clubs ?? "",
                              projects: current[activeCommentStudentId]?.projects ?? "",
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Clubs">
                      <textarea
                        className={`${inputClass} min-h-24`}
                        value={commentDrafts[activeCommentStudentId]?.clubs ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [activeCommentStudentId]: {
                              classTeacherComment:
                                current[activeCommentStudentId]?.classTeacherComment ?? "",
                              headTeacherComment:
                                current[activeCommentStudentId]?.headTeacherComment ?? "",
                              games: current[activeCommentStudentId]?.games ?? "",
                              clubs: event.target.value,
                              projects: current[activeCommentStudentId]?.projects ?? "",
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Projects">
                      <textarea
                        className={`${inputClass} min-h-24`}
                        value={commentDrafts[activeCommentStudentId]?.projects ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [activeCommentStudentId]: {
                              classTeacherComment:
                                current[activeCommentStudentId]?.classTeacherComment ?? "",
                              headTeacherComment:
                                current[activeCommentStudentId]?.headTeacherComment ?? "",
                              games: current[activeCommentStudentId]?.games ?? "",
                              clubs: current[activeCommentStudentId]?.clubs ?? "",
                              projects: event.target.value,
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Comment">
                      <textarea
                        className={`${inputClass} min-h-24`}
                        value={commentDrafts[activeCommentStudentId]?.classTeacherComment ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [activeCommentStudentId]: {
                              classTeacherComment: event.target.value,
                              headTeacherComment:
                                current[activeCommentStudentId]?.headTeacherComment ?? "",
                              games: current[activeCommentStudentId]?.games ?? "",
                              clubs: current[activeCommentStudentId]?.clubs ?? "",
                              projects: current[activeCommentStudentId]?.projects ?? "",
                            },
                          }))
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Btn type="submit" variant="accent" disabled={commentMutation.isPending}>
                        Save learner
                      </Btn>
                    </div>
                  </form>

                  <div className="md:hidden space-y-4">
                    {commentStudents.map((student) => {
                      const draft = commentDrafts[student.id] ?? {
                        classTeacherComment: "",
                        headTeacherComment: "",
                        games: "",
                        clubs: "",
                        projects: "",
                      };
                      return (
                        <div key={student.id} className="rounded-lg border border-border p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold">{student.full_name}</h3>
                            <button
                              type="button"
                              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
                              onClick={() => commentMutation.mutate(student.id)}
                              disabled={commentMutation.isPending}
                            >
                              Save
                            </button>
                          </div>
                          <div className="grid gap-3">
                            <Field label="Games">
                              <textarea
                                className={`${inputClass} min-h-24`}
                                value={draft.games}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [student.id]: { ...draft, games: event.target.value },
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Clubs">
                              <textarea
                                className={`${inputClass} min-h-24`}
                                value={draft.clubs}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [student.id]: { ...draft, clubs: event.target.value },
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Projects">
                              <textarea
                                className={`${inputClass} min-h-24`}
                                value={draft.projects}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [student.id]: { ...draft, projects: event.target.value },
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Comment">
                              <textarea
                                className={`${inputClass} min-h-28`}
                                value={draft.classTeacherComment}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [student.id]: {
                                      ...draft,
                                      classTeacherComment: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </Field>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="pb-2">Learner</th>
                          <th className="pb-2">Games</th>
                          <th className="pb-2">Clubs</th>
                          <th className="pb-2">Projects</th>
                          <th className="pb-2">Comment</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {commentStudents.map((student) => {
                          const savedComment = commentLookup.get(student.id) ?? {
                            classTeacherComment: "",
                            headTeacherComment: "",
                          };
                          const savedCoCurricular = coCurricularByStudent.get(student.id) ?? {
                            games: "",
                            clubs: "",
                            projects: "",
                          };
                          return (
                            <tr key={student.id} className="border-t border-border align-top">
                              <td className="py-3 pr-4 font-medium">{student.full_name}</td>
                              <td className="py-3 pr-4">
                                {savedCoCurricular.games || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
                              </td>
                              <td className="py-3 pr-4">
                                {savedCoCurricular.clubs || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
                              </td>
                              <td className="py-3 pr-4">
                                {savedCoCurricular.projects || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
                              </td>
                              <td className="py-3 pr-4">
                                <div className="space-y-2">
                                  <p>{savedComment.classTeacherComment || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}</p>
                                  {savedComment.classTeacherComment && (
                                    <div className="flex flex-wrap gap-2">
                                      <Btn
                                        variant="ghost"
                                        onClick={() => {
                                          setActiveCommentStudentId(student.id);
                                          setCommentDrafts((current) => {
                                            const next = { ...current };
                                            const currentDraft = next[student.id] ?? {
                                              classTeacherComment: "",
                                              headTeacherComment: "",
                                              games: "",
                                              clubs: "",
                                              projects: "",
                                            };
                                            next[student.id] = {
                                              ...currentDraft,
                                              classTeacherComment: savedComment.classTeacherComment,
                                              games: savedCoCurricular.games,
                                              clubs: savedCoCurricular.clubs,
                                              projects: savedCoCurricular.projects,
                                            };
                                            return next;
                                          });
                                        }}
                                      >
                                        Edit
                                      </Btn>
                                      <Btn
                                        variant="ghost"
                                        onClick={() =>
                                          deleteCommentMutation.mutate({
                                            studentId: student.id,
                                            commentType: "class_teacher",
                                          })
                                        }
                                        disabled={deleteCommentMutation.isPending}
                                      >
                                        Delete
                                      </Btn>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 text-right" />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                No class is assigned to your account yet.
              </p>
            )
          ) : commentStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Choose an allocation and term first, then add each learner&apos;s{" "}
              {isClassTeacher ? "class teacher" : "head teacher"} comment.
            </p>
          ) : (
            <div className="space-y-4">
              {commentStudents.map((student) => {
                const storedCoCurricular = coCurricularByStudent.get(student.id) ?? {
                  games: "",
                  clubs: "",
                  projects: "",
                };
                const draft = commentDrafts[student.id] ?? {
                  classTeacherComment: "",
                  headTeacherComment: "",
                  games: storedCoCurricular.games,
                  clubs: storedCoCurricular.clubs,
                  projects: storedCoCurricular.projects,
                };
                return (
                  <div key={student.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">{student.full_name}</h3>
                      <Btn
                        variant="accent"
                        onClick={() => commentMutation.mutate(student.id)}
                        disabled={commentMutation.isPending}
                      >
                        Save comment
                      </Btn>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {isClassTeacher && (
                        <>
                          <Field label="Class Teacher's Comment">
                            <textarea
                              className={`${inputClass} min-h-28`}
                              value={draft.classTeacherComment}
                              onChange={(event) =>
                                setCommentDrafts((current) => ({
                                  ...current,
                                  [student.id]: {
                                    ...draft,
                                    classTeacherComment: event.target.value,
                                  },
                                }))
                              }
                            />
                          </Field>
                          <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Games">
                              <textarea
                                className={`${inputClass} min-h-24`}
                                value={draft.games}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [student.id]: { ...draft, games: event.target.value },
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Clubs">
                              <textarea
                                className={`${inputClass} min-h-24`}
                                value={draft.clubs}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [student.id]: { ...draft, clubs: event.target.value },
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Projects">
                              <textarea
                                className={`${inputClass} min-h-24`}
                                value={draft.projects}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [student.id]: { ...draft, projects: event.target.value },
                                  }))
                                }
                              />
                            </Field>
                          </div>
                        </>
                      )}
                      {isHeadTeacher && (
                        <Field label="Head Teacher's Comment">
                          <textarea
                            className={`${inputClass} min-h-28`}
                            value={draft.headTeacherComment}
                            onChange={(event) =>
                              setCommentDrafts((current) => ({
                                ...current,
                                [student.id]: { ...draft, headTeacherComment: event.target.value },
                              }))
                            }
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      <Panel title="All assessments">
        <p className="mb-3 text-sm text-muted-foreground">
          This table shows every assessment record for the school, grouped by learner, subject, paper, and term.
        </p>
        {!tableData && (
          <p className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            Loading saved assessment records...
          </p>
        )}
        {saveMutation.isError && (
          <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Draft submission failed: {friendlyAdminError(saveMutation.error as Error)}
          </p>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className={`${inputClass} max-w-xs`}
            value={assessmentSort}
            onChange={(event) => setAssessmentSort(event.target.value as typeof assessmentSort)}
          >
            <option value="created_at">Sort by newest</option>
            <option value="class">Sort by class</option>
            <option value="stream">Sort by stream</option>
            <option value="subject">Sort by subject</option>
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={tableSubjectFilter}
            onChange={(event) => setTableSubjectFilter(event.target.value)}
          >
            <option value="">All subjects</option>
            {(data?.subjects ?? []).map((subject: SubjectRow) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={termFilter}
            onChange={(event) => setTermFilter(event.target.value)}
          >
            <option value="">All terms</option>
            {(data?.terms ?? []).map((term: TermRow) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Learner</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Paper</th>
                <th className="pb-2">Stream</th>
                <th className="pb-2">Term</th>
                <th className="pb-2">Formative</th>
                <th className="pb-2">BOT</th>
                <th className="pb-2">MOT</th>
                <th className="pb-2">EOT</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {sortedSummativeGroups.map(
                (
                  group,
                ) => {
                  const row = group.row;
                  const student = tableData.students.find((item) => item.id === row.student_id);
                  const studentClass = tableData.classes.find((item) => item.id === student?.class_id);
                  const stream = data?.streams.find((item) => item.id === student?.stream_id);
                  const formative = group.formative;
                  const canDeleteGroup =
                    group.rows.every(
                      (assessment) =>
                        !assessment.locked && ["draft", "rejected"].includes(assessment.status),
                    ) &&
                    (!group.formativeMark ||
                      (!group.formativeMark.locked &&
                        ["draft", "rejected"].includes(group.formativeMark.status)));
                  const total = formative == null || group.average == null
                    ? null
                    : Number(formative) + group.average;
                  return (
                    <tr key={`${row.student_id}-${row.subject_id}-${row.paper_id ?? "subject"}-${row.term_id}`} className="border-t border-border">
                      <td className="py-2 font-medium">{row.studentName}</td>
                      <td>{studentClass?.name ?? "—"}</td>
                      <td>{row.subjectName}</td>
                      <td>{row.paperName || "—"}</td>
                      <td>{stream?.name ?? "—"}</td>
                      <td>{row.termName}</td>
                      <td>{formative == null ? "—" : formative}</td>
                      <td>{group.periods.beginning_of_term ?? "—"}</td>
                      <td>{group.periods.mid_term ?? "—"}</td>
                      <td>{group.periods.end_of_term ?? "—"}</td>
                      <td className="font-semibold">
                        {total == null ? "—" : total.toFixed(1)}
                      </td>
                      <td>
                        <Pill
                          tone={
                            row.status === "approved"
                              ? "success"
                              : row.status === "rejected"
                                ? "danger"
                                : row.status === "submitted"
                                  ? "warning"
                                  : "muted"
                          }
                        >
                          {row.status}
                        </Pill>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {!row.locked && (row.status === "draft" || row.status === "rejected") ? (
                            <Btn variant="ghost" onClick={() => loadAssessmentIntoForm(row.id)}>
                              Edit
                            </Btn>
                          ) : null}
                          {!row.locked && (row.status === "draft" || row.status === "rejected") ? (
                            <Btn
                              variant="ghost"
                              disabled={submitGroupMutation.isPending}
                              onClick={() => submitGroupMutation.mutate(group)}
                            >
                              {submitGroupMutation.isPending
                                ? "Submitting..."
                                : row.status === "rejected"
                                  ? "Submit all again"
                                  : "Submit all drafts"}
                            </Btn>
                          ) : null}
                          {canDeleteGroup ? (
                            <Btn
                              variant="ghost"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Delete the formative mark and every BOT, MOT, and EOT mark for this subject paper?",
                                  )
                                ) {
                                  deleteMutation.mutate(group);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              Delete
                            </Btn>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
              {summativeGroups.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-6 text-center text-muted-foreground">
                    No assessment records match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
