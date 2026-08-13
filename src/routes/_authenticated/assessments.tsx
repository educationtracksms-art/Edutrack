import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import {
  deleteReportComment,
  deleteAssessmentEntry,
  reviewAssessments,
  updateAssessmentDraftEntry,
  submitAssessmentEntry,
  submitAssessmentEntries,
  upsertAssessmentEntry,
  upsertReportComment,
} from "@/lib/admin.functions";
import { descriptorFromAssessmentScore } from "@/lib/descriptor";
import { supabase } from "@/integrations/supabase/client";
import { isModuleEnabled } from "@/lib/modules";

type TeacherAllocationView = {
  key: string;
  subject_id: string;
  class_id: string | null;
  stream_id: string | null;
  label: string;
};

type AssessmentRow = {
  id: string;
  student_id: string;
  subject_id: string;
  term_id: string;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  formative: number | null;
  summative: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  grade_descriptor: string | null;
};

type StudentRow = {
  id: string;
  full_name: string;
  class_id: string | null;
  stream_id: string | null;
  status: string;
};

type SubjectRow = { id: string; name: string };
type GradingScaleRow = {
  grade: string;
  min_score: number;
  max_score: number;
  descriptor: string;
  education_level: string | null;
  points: number | null;
};
type TermRow = { id: string; name: string; is_current: boolean };
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

type AssessmentsData = {
  assessments: AssessmentRow[];
  students: StudentRow[];
  subjects: SubjectRow[];
  terms: TermRow[];
  classes: ClassRow[];
  streams: StreamRow[];
  coCurricular: CoCurricularRow[];
  allocations: TeacherAllocationView[];
  gradingScales: GradingScaleRow[];
  currentTermId: string;
  teacherInitials: string;
  staffProfileMap: Map<string, string>;
};

type LearnerSortKey = "class" | "stream";

export const Route = createFileRoute("/_authenticated/assessments")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "academics"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Assessments - EduTrack" },
      {
        name: "description",
        content: "Capture formative and summative scores, submit for approval and lock results.",
      },
      { property: "og:title", content: "Assessments - EduTrack" },
      {
        property: "og:description",
        content: "Teacher score entry with Director of Studies approval workflow.",
      },
    ],
  }),
  errorComponent: AssessmentsError,
  component: AssessmentsPage,
});

function AssessmentsError({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reset();
    window.location.replace("/dashboard");
  }, [reset]);
  return null;
}

function AssessmentsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const isAssignedTeacher = hasAny(me?.roles, ["subject_teacher", "class_teacher", "dos"]);
  const isTeacher = isAssignedTeacher;
  const canViewAllAssessments = hasAny(me?.roles, [
    "dos",
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
  ]);
  const canEnter =
    !!schoolId &&
    hasAny(me?.roles, [
      "subject_teacher",
      "class_teacher",
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
  const deleteEntry = useServerFn(deleteAssessmentEntry);
  const saveComment = useServerFn(upsertReportComment);
  const removeComment = useServerFn(deleteReportComment);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [tableSubjectFilter, setTableSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
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
    teacherInitials: "",
    missingMarks: false,
  });
  const [edits, setEdits] = useState<
    Record<string, { formative?: string; summative?: string; gradeDescriptor?: string }>
  >({});

  const { data } = useQuery<AssessmentsData>({
    queryKey: ["assessments", schoolId, me?.userId],
    queryFn: async () => {
      const schoolQuery = (query: any) => (schoolId ? query.eq("school_id", schoolId) : query);
      const [
        assessmentsResult,
        studentsResult,
        subjectsResult,
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
          supabase
            .from("students")
            .select("id, full_name, class_id, stream_id, status")
            .eq("status", "active")
            .order("full_name"),
        ),
        schoolQuery(supabase.from("subjects").select("id, name").order("position")),
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
              .select("subject_id, class_id, stream_id")
              .eq("school_id", schoolId)
              .eq("teacher_id", me.userId)
          : Promise.resolve({ data: [] as any[] }),
        schoolQuery(
          supabase
            .from("grading_scales")
            .select("grade, min_score, max_score, descriptor, education_level, points")
            .order("min_score", { ascending: false }),
        ),
        schoolQuery(supabase.from("profiles").select("id, full_name")),
        me?.userId
          ? supabase.from("profiles").select("initials").eq("id", me.userId).maybeSingle()
          : Promise.resolve({ data: null as ProfileRow | null }),
      ])) as any[];

      const assessmentRows = (assessmentsResult.data ?? []) as AssessmentRow[];
      const studentRows = (studentsResult.data ?? []) as StudentRow[];
      const subjectRows = (subjectsResult.data ?? []) as SubjectRow[];
      const termRows = (termsResult.data ?? []) as TermRow[];
      const classRows = (classesResult.data ?? []) as ClassRow[];
      const streamRows = (streamsResult.data ?? []) as StreamRow[];
      const allocationRows = (allocationsResult.data ?? []) as Array<{
        subject_id: string;
        class_id: string | null;
        stream_id: string | null;
      }>;
      const gradingScaleRows = (gradingScalesResult.data ?? []) as GradingScaleRow[];
      const staffProfiles = (profilesResult.data ?? []) as StaffProfileRow[];
      const staffProfileMap = new Map(
        staffProfiles.map((profile) => [profile.id, profile.full_name]),
      );
      const teacherInitials = (profileResult.data?.initials ?? "") as string;
      const currentTermId = termRows.find((term) => term.is_current)?.id ?? termRows[0]?.id ?? "";
      const { data: coCurricularData } = currentTermId
        ? await supabase
            .from("co_curricular")
            .select("student_id, games, clubs, projects")
            .eq("term_id", currentTermId)
            .in(
              "student_id",
              studentRows.map((student) => student.id),
            )
        : { data: [] as CoCurricularRow[] };
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
              key: `${allocation.subject_id}:${allocation.class_id ?? ""}:${allocation.stream_id ?? ""}`,
              subject_id: allocation.subject_id,
              class_id: allocation.class_id ?? null,
              stream_id: allocation.stream_id ?? null,
              label: `${subjectName} Ãƒâ€šÃ‚Â· ${className}${allocation.stream_id ? ` Ãƒâ€šÃ‚Â· ${streamName}` : ""}`,
            };
          })
        : [];

      return {
        assessments: assessmentRows,
        students: studentRows,
        subjects: subjectRows,
        terms: termRows,
        classes: classRows,
        streams: streamRows,
        coCurricular: coCurricularRows,
        allocations: allocationOptions,
        gradingScales: gradingScaleRows,
        currentTermId,
        teacherInitials,
        staffProfileMap,
      };
    },
  });
  const { data: tableData } = useQuery<{
    assessments: AssessmentRow[];
    students: StudentRow[];
    subjects: SubjectRow[];
    terms: TermRow[];
    gradingScales: GradingScaleRow[];
    staffProfileMap: Map<string, string>;
  }>({
    queryKey: ["assessment-table", schoolId],
    queryFn: async () => {
      const schoolQuery = (query: any) => (schoolId ? query.eq("school_id", schoolId) : query);
      const [
        assessmentsResult,
        studentsResult,
        subjectsResult,
        termsResult,
        gradingScalesResult,
        profilesResult,
      ] = (await Promise.all([
        schoolQuery(supabase.from("assessments").select("*").order("created_at")),
        schoolQuery(
          supabase
            .from("students")
            .select("id, full_name, class_id, stream_id, status")
            .eq("status", "active")
            .order("full_name"),
        ),
        schoolQuery(supabase.from("subjects").select("id, name").order("position")),
        schoolQuery(
          supabase
            .from("terms")
            .select("id, name, is_current")
            .order("start_date", { ascending: false }),
        ),
        schoolQuery(
          supabase
            .from("grading_scales")
            .select("grade, min_score, max_score, descriptor")
            .order("min_score", { ascending: false }),
        ),
        schoolQuery(supabase.from("profiles").select("id, full_name")),
      ])) as any[];
      const staffProfiles = (profilesResult.data ?? []) as StaffProfileRow[];
      const staffProfileMap = new Map(
        staffProfiles.map((profile) => [profile.id, profile.full_name]),
      );

      return {
        assessments: (assessmentsResult.data ?? []) as AssessmentRow[],
        students: (studentsResult.data ?? []) as StudentRow[],
        subjects: (subjectsResult.data ?? []) as SubjectRow[],
        terms: (termsResult.data ?? []) as TermRow[],
        gradingScales: (gradingScalesResult.data ?? []) as GradingScaleRow[],
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
  const assignedClass = useMemo(() => {
    if (!isClassTeacher || !data || !me?.userId) return null;
    return data.classes.find((item) => item.class_teacher_id === me.userId) ?? null;
  }, [data, isClassTeacher, me?.userId]);

  const className = (id: string | null) => {
    const item = data?.classes.find((row) => row.id === id);
    if (!item) return "Ã¢â‚¬â€";
    return `${item.name}${item.education_level === "advanced" ? " (A-Level)" : " (O-Level)"}`;
  };
  const streamName = (id: string | null) =>
    data?.streams.find((item) => item.id === id)?.name ?? "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â";

  const selectedStudentLevel = useMemo<"ordinary" | "advanced">(() => {
    if (!entryForm.studentId) return "ordinary";
    const student = data?.students.find((item) => item.id === entryForm.studentId);
    const studentClass = data?.classes.find((item) => item.id === student?.class_id);
    return studentClass?.education_level === "advanced" ? "advanced" : "ordinary";
  }, [data?.classes, data?.students, entryForm.studentId]);

  const autoDescriptor = useMemo(() => {
    if (entryForm.missingMarks) return "Missing marks";
    const total = Number(entryForm.formative || 0) + Number(entryForm.summative || 0);
    const hit = data?.gradingScales.find(
      (scale) =>
        (scale.education_level ?? "ordinary") === selectedStudentLevel &&
        total >= Number(scale.min_score) &&
        total <= Number(scale.max_score),
    );
    if (selectedStudentLevel === "advanced") {
      return hit?.points != null ? String(hit.points) : (hit?.descriptor ?? "");
    }
    return hit?.descriptor ?? "";
  }, [data?.gradingScales, entryForm.formative, entryForm.summative, selectedStudentLevel]);

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
        if (allocation.class_id && student.class_id !== allocation.class_id) return false;
        if (allocation.stream_id && student.stream_id !== allocation.stream_id) return false;
        return true;
      });
    });
  }, [canViewAllAssessments, data?.allocations, isTeacher, me?.userId, tableData]);

  const loadAssessmentIntoForm = (assessmentId: string) => {
    const assessment = assessmentLookup.get(assessmentId);
    if (!assessment) return;
    setEditingAssessmentId(assessment.id);
    setEntryForm({
      studentId: assessment.student_id,
      subjectId: assessment.subject_id,
      termId: assessment.term_id,
      examType: assessment.exam_type ?? "end_of_term",
      formative: assessment.formative?.toString() ?? "",
      summative: assessment.summative?.toString() ?? "",
      teacherInitials: assessment.teacher_initials ?? "",
      missingMarks: assessment.formative === null && assessment.summative === null,
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
      examType: "end_of_term",
      teacherInitials: "",
      missingMarks: false,
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
    if (!isTeacher || !selectedAllocation) return;
    setEntryForm((current) => ({
      ...current,
      subjectId: selectedAllocation.subject_id,
      studentId: "",
    }));
  }, [isTeacher, selectedAllocation?.key]);

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
    if (!isTeacher) return data.subjects;
    if (!selectedAllocation) return [];
    return data.subjects.filter(
      (subject: SubjectRow) => subject.id === selectedAllocation.subject_id,
    );
  }, [data, isTeacher, selectedAllocation]);

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

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const edit = edits[id] ?? {};
      const existing = assessmentLookup.get(id);
      const effectiveFormative =
        edit.formative !== undefined ? edit.formative : (existing?.formative?.toString() ?? "");
      const effectiveSummative =
        edit.summative !== undefined ? edit.summative : (existing?.summative?.toString() ?? "");
      if (["draft", "rejected"].includes(existing?.status ?? "") && !existing?.locked) {
        await updateDraftEntry({
          data: {
            assessmentId: id,
            examType: existing.exam_type,
            formative:
              edit.formative !== undefined
                ? edit.formative === ""
                  ? null
                  : Number(edit.formative)
                : existing.formative,
            summative:
              edit.summative !== undefined
                ? edit.summative === ""
                  ? null
                  : Number(edit.summative)
                : existing.summative,
            teacherInitials: existing.teacher_initials ?? null,
          },
        });
        await submitEntry({
          data: {
            assessmentId: id,
            formative:
              edit.formative !== undefined
                ? edit.formative === ""
                  ? null
                  : Number(edit.formative)
                : existing.formative,
            summative:
              edit.summative !== undefined
                ? edit.summative === ""
                  ? null
                  : Number(edit.summative)
                : existing.summative,
            teacherInitials: existing.teacher_initials ?? null,
          },
        });
        return;
      }

      await submitEntry({
        data: {
          assessmentId: id,
          formative:
            edit.formative !== undefined
              ? edit.formative === ""
                ? null
                : Number(edit.formative)
              : (existing?.formative ?? null),
          summative:
            edit.summative !== undefined
              ? edit.summative === ""
                ? null
                : Number(edit.summative)
              : (existing?.summative ?? null),
          teacherInitials: existing?.teacher_initials ?? null,
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
    mutationFn: (assessmentId: string) => deleteEntry({ data: { assessmentId } }),
    onSuccess: () => {
      toast.success("Assessment deleted");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
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
      if (!entryForm.subjectId) throw new Error("Choose a subject");
      if (isTeacher && !selectedAllocation)
        throw new Error("Choose an assigned class / stream / subject");
      if (isTeacher && selectedAllocation) {
        const allowed = teacherStudents.some((student) => student.id === entryForm.studentId);
        if (!allowed) throw new Error("This learner is not assigned to you for this subject");
      }

      const payload = {
        studentId: entryForm.studentId,
        subjectId: entryForm.subjectId,
        termId: entryForm.termId || data?.currentTermId || "",
        examType: entryForm.examType,
        gradeDescriptor: autoDescriptor || null,
        formative:
          entryForm.missingMarks || entryForm.formative === "" ? null : Number(entryForm.formative),
        summative:
          entryForm.missingMarks || entryForm.summative === "" ? null : Number(entryForm.summative),
        teacherInitials: entryForm.teacherInitials || null,
      };
      if (editingAssessmentId) {
        await updateDraftEntry({
          data: {
            assessmentId: editingAssessmentId,
            examType: payload.examType,
            formative: payload.formative,
            summative: payload.summative,
            teacherInitials: payload.teacherInitials,
          },
        });
      } else {
        await upsertEntry({ data: payload });
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!entryForm.termId && !data?.currentTermId) throw new Error("Choose a term");
      if (!entryForm.studentId) throw new Error("Choose a learner");
      if (!entryForm.subjectId) throw new Error("Choose a subject");
      if (isTeacher && !selectedAllocation)
        throw new Error("Choose an assigned class / stream / subject");
      if (isTeacher && selectedAllocation) {
        const allowed = teacherStudents.some((student) => student.id === entryForm.studentId);
        if (!allowed) throw new Error("This learner is not assigned to you for this subject");
      }

      const termId = entryForm.termId || data?.currentTermId || "";
      const existing = tableData?.assessments.find(
        (assessment) =>
          assessment.student_id === entryForm.studentId &&
          assessment.subject_id === entryForm.subjectId &&
          assessment.term_id === termId,
      );

      if (!existing) {
        await upsertEntry({
          data: {
            studentId: entryForm.studentId,
            subjectId: entryForm.subjectId,
            termId,
            examType: entryForm.examType,
            gradeDescriptor: autoDescriptor || null,
            formative:
              entryForm.missingMarks || entryForm.formative === ""
                ? null
                : Number(entryForm.formative),
            summative:
              entryForm.missingMarks || entryForm.summative === ""
                ? null
                : Number(entryForm.summative),
            teacherInitials: entryForm.teacherInitials || null,
          },
        });
      }

      const assessmentId =
        existing?.id ??
        (
          await supabase
            .from("assessments")
            .select("id")
            .eq("student_id", entryForm.studentId)
            .eq("subject_id", entryForm.subjectId)
            .eq("term_id", termId)
            .maybeSingle()
        ).data?.id;
      if (!assessmentId) throw new Error("Unable to locate the saved assessment");

      await submitEntry({
        data: {
          assessmentId,
          formative:
            entryForm.missingMarks || entryForm.formative === ""
              ? null
              : Number(entryForm.formative),
          summative:
            entryForm.missingMarks || entryForm.summative === ""
              ? null
              : Number(entryForm.summative),
          teacherInitials: entryForm.teacherInitials || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Marks submitted for DOS approval");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      setEntryForm((current) => ({
        ...current,
        studentId: "",
        formative: "",
        summative: "",
        examType: "end_of_term",
        teacherInitials: "",
        missingMarks: false,
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
      .map((assessment) => ({
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
        gradeDescriptor: assessment.grade_descriptor ?? "",
        submitted_by_name: assessment.submitted_by
          ? (tableData.staffProfileMap.get(assessment.submitted_by) ?? "Unknown teacher")
          : "Not submitted",
      }));
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

      {canEnter && (
        <Panel title="Enter assessment" className="mb-4">
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            {isTeacher && (
              <Field label="Assigned class / stream / subject">
                {(() => {
                  const allocationCount = data?.allocations.length ?? 0;
                  return (
                    <select
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
                <Field label="Search learners" className="min-w-0 flex-1">
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
                        return (
                          <tr
                            key={student.id}
                            className={`border-t border-border transition-colors ${
                              selected ? "bg-accent/10" : "hover:bg-muted/40"
                            }`}
                          >
                            <td className="px-3 py-2 font-medium">{student.full_name}</td>
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
                          <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
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
              <select
                className={inputClass}
                value={entryForm.subjectId}
                onChange={(event) => setEntryForm({ ...entryForm, subjectId: event.target.value })}
                disabled={isTeacher}
              >
                {!isTeacher && <option value="">Select subject</option>}
                {teacherSubjects.map((subject: SubjectRow) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Term">
              <select
                className={inputClass}
                value={entryForm.termId}
                onChange={(event) => setEntryForm({ ...entryForm, termId: event.target.value })}
              >
                <option value="">Select term</option>
                {(data?.terms ?? []).map((term: TermRow) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                    {term.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Exam type">
              <select
                className={inputClass}
                value={entryForm.examType}
                onChange={(event) => setEntryForm({ ...entryForm, examType: event.target.value })}
              >
                <option value="end_of_term">End of term</option>
                <option value="mid_term">Mid term</option>
                <option value="class_test">Class test</option>
                <option value="assignment">Assignment</option>
              </select>
            </Field>
            <Field label="Formative / 20">
              <input
                type="number"
                step="0.1"
                min={0}
                max={20}
                className={inputClass}
                value={entryForm.formative}
                onChange={(event) =>
                  setEntryForm({ ...entryForm, formative: event.target.value, missingMarks: false })
                }
              />
            </Field>
            <Field label="Summative / 80">
              <input
                type="number"
                step="0.1"
                min={0}
                max={80}
                className={inputClass}
                value={entryForm.summative}
                onChange={(event) =>
                  setEntryForm({ ...entryForm, summative: event.target.value, missingMarks: false })
                }
              />
            </Field>
            <Field label="Marks status">
              <label className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={entryForm.missingMarks}
                  onChange={(event) =>
                    setEntryForm((current) => ({
                      ...current,
                      missingMarks: event.target.checked,
                      formative: event.target.checked ? "" : current.formative,
                      summative: event.target.checked ? "" : current.summative,
                    }))
                  }
                />
                <span className="text-sm">
                  Mark as missing marks
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Use this when the learner was selected but no score was available yet.
                  </span>
                </span>
              </label>
            </Field>
            <Field label="Grade descriptor">
              <input className={inputClass} value={autoDescriptor} readOnly />
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-generated from the current score total, or set to missing marks.
              </p>
            </Field>
            <Field label="Teacher initials">
              <input
                className={inputClass}
                value={entryForm.teacherInitials}
                onChange={(event) =>
                  setEntryForm({ ...entryForm, teacherInitials: event.target.value })
                }
                placeholder="e.g. JK"
              />
            </Field>
            <div className="flex items-end">
              <div className="flex gap-2">
                <Btn
                  type="submit"
                  variant="ghost"
                  disabled={
                    createMutation.isPending ||
                    submitMutation.isPending ||
                    (isTeacher && !selectedAllocation) ||
                    !entryForm.studentId
                  }
                >
                  {createMutation.isPending
                    ? "Saving..."
                    : editingAssessmentId
                      ? "Update draft"
                      : "Save draft"}
                </Btn>
                {editingAssessmentId ? (
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
                ) : null}
              </div>
            </div>
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

      <Panel>
        <div className="mb-3 flex flex-wrap gap-2">
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
                <th className="pb-2">Subject</th>
                <th className="pb-2">Term</th>
                <th className="pb-2">Grade descriptor</th>
                <th className="pb-2">Submitted by</th>
                <th className="pb-2">Formative (20)</th>
                <th className="pb-2">Summative (80)</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(
                (
                  row: AssessmentRow & {
                    studentName: string;
                    subjectName: string;
                    termName: string;
                    gradeDescriptor: string;
                    submitted_by_name: string;
                  },
                ) => {
                  const edit = edits[row.id] ?? {};
                  const formative = edit.formative ?? (row.formative ?? "").toString();
                  const summative = edit.summative ?? (row.summative ?? "").toString();
                  const student = data?.students.find((item) => item.id === row.student_id);
                  const studentClass = data?.classes.find((item) => item.id === student?.class_id);
                  const studentLevel =
                    studentClass?.education_level === "advanced" ? "advanced" : "ordinary";
                  const total = Number(formative || 0) + Number(summative || 0);
                  const gradeDescriptor =
                    data?.gradingScales.find((scale) => {
                      return (
                        (scale.education_level ?? "ordinary") === studentLevel &&
                        total >= Number(scale.min_score) &&
                        total <= Number(scale.max_score)
                      );
                    })?.[studentLevel === "advanced" ? "points" : "descriptor"] ||
                    row.gradeDescriptor ||
                    "";
                  const totalDisplay = total.toFixed(1);
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2 font-medium">{row.studentName}</td>
                      <td>{row.subjectName}</td>
                      <td>{row.termName}</td>
                      <td>
                        <Pill tone={!row.formative && !row.summative ? "warning" : "muted"}>
                          {!row.formative && !row.summative
                            ? "Missing marks"
                            : gradeDescriptor || "â€”"}
                        </Pill>
                      </td>
                      <td>{row.submitted_by_name ?? "Not submitted"}</td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          max={20}
                          min={0}
                          disabled={row.locked}
                          className={`${inputClass} w-24`}
                          value={formative}
                          onChange={(event) =>
                            setEdits({
                              ...edits,
                              [row.id]: { ...edit, formative: event.target.value },
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          max={80}
                          min={0}
                          disabled={row.locked}
                          className={`${inputClass} w-24`}
                          value={summative}
                          onChange={(event) =>
                            setEdits({
                              ...edits,
                              [row.id]: { ...edit, summative: event.target.value },
                            })
                          }
                        />
                      </td>
                      <td className="font-semibold">{totalDisplay}</td>
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
                            <Btn variant="ghost" onClick={() => saveMutation.mutate(row.id)}>
                              {row.status === "rejected" ? "Resubmit draft" : "Submit draft"}
                            </Btn>
                          ) : null}
                          {row.status !== "submitted" && row.status !== "approved" ? (
                            <Btn
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm("Delete this assessment record?")) {
                                  deleteMutation.mutate(row.id);
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
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-muted-foreground">
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
