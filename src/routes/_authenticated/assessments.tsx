import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import { reviewAssessments, upsertAssessmentEntry, upsertReportComment } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

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
type TermRow = { id: string; name: string; is_current: boolean };
type ClassRow = { id: string; name: string };
type StreamRow = { id: string; name: string; class_id: string | null };
type ProfileRow = { initials: string | null };
type CommentRow = {
  student_id: string;
  class_teacher_comment: string | null;
  head_teacher_comment: string | null;
};

type AssessmentsData = {
  assessments: AssessmentRow[];
  students: StudentRow[];
  subjects: SubjectRow[];
  terms: TermRow[];
  classes: ClassRow[];
  streams: StreamRow[];
  allocations: TeacherAllocationView[];
  currentTermId: string;
  teacherInitials: string;
};

export const Route = createFileRoute("/_authenticated/assessments")({
  head: () => ({
    meta: [
      { title: "Assessments · EduTrack" },
      { name: "description", content: "Capture formative and summative scores, submit for approval and lock results." },
      { property: "og:title", content: "Assessments · EduTrack" },
      { property: "og:description", content: "Teacher score entry with Director of Studies approval workflow." },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const isTeacher = hasAny(me?.roles, ["subject_teacher", "class_teacher"]);
  const canReview = hasAny(me?.roles, ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"]);
  const canEnter = !!schoolId && hasAny(me?.roles, ["subject_teacher", "class_teacher", "dos", "school_admin", "head_teacher", "deputy_head_teacher"]);
  const isClassTeacher = hasAny(me?.roles, ["class_teacher"]);
  const isHeadTeacher = hasAny(me?.roles, ["head_teacher", "deputy_head_teacher"]);
  const canEditComments = isClassTeacher || isHeadTeacher;
  const review = useServerFn(reviewAssessments);
  const upsertEntry = useServerFn(upsertAssessmentEntry);
  const saveComment = useServerFn(upsertReportComment);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [allocationKey, setAllocationKey] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, { classTeacherComment: string; headTeacherComment: string }>>({});
  const [entryForm, setEntryForm] = useState({
    studentId: "",
    subjectId: "",
    termId: "",
    examType: "end_of_term",
    gradeDescriptor: "",
    formative: "",
    summative: "",
    teacherInitials: "",
  });
  const [edits, setEdits] = useState<Record<string, { formative?: string; summative?: string; gradeDescriptor?: string }>>({});

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
        profileResult,
      ] = (await Promise.all([
        schoolQuery(supabase.from("assessments").select("*").order("created_at")),
        schoolQuery(supabase.from("students").select("id, full_name, class_id, stream_id, status").eq("status", "active").order("full_name")),
        schoolQuery(supabase.from("subjects").select("id, name").order("position")),
        schoolQuery(supabase.from("terms").select("id, name, is_current").order("start_date", { ascending: false })),
        schoolQuery(supabase.from("classes").select("id, name").order("name")),
        schoolQuery(supabase.from("streams").select("id, name, class_id").order("name")),
        schoolId && me?.userId
          ? supabase
              .from("teacher_allocations")
              .select("subject_id, class_id, stream_id")
              .eq("school_id", schoolId)
              .eq("teacher_id", me.userId)
          : Promise.resolve({ data: [] as any[] }),
        me?.userId ? supabase.from("profiles").select("initials").eq("id", me.userId).maybeSingle() : Promise.resolve({ data: null as ProfileRow | null }),
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
      const teacherInitials = (profileResult.data?.initials ?? "") as string;

      const allocationOptions: TeacherAllocationView[] = isTeacher
        ? allocationRows.map((allocation) => {
            const subjectName = subjectRows.find((subject) => subject.id === allocation.subject_id)?.name ?? "Subject";
            const className = classRows.find((item) => item.id === allocation.class_id)?.name ?? "Any class";
            const streamName = streamRows.find((item) => item.id === allocation.stream_id)?.name ?? "Any stream";
            return {
              key: `${allocation.subject_id}:${allocation.class_id ?? ""}:${allocation.stream_id ?? ""}`,
              subject_id: allocation.subject_id,
              class_id: allocation.class_id ?? null,
              stream_id: allocation.stream_id ?? null,
              label: `${subjectName} · ${className}${allocation.stream_id ? ` · ${streamName}` : ""}`,
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
        allocations: allocationOptions,
        currentTermId: termRows.find((term) => term.is_current)?.id ?? termRows[0]?.id ?? "",
        teacherInitials,
      };
    },
  });

  const selectedAllocation = useMemo(
    () => data?.allocations.find((allocation) => allocation.key === allocationKey) ?? data?.allocations[0] ?? null,
    [allocationKey, data?.allocations],
  );

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
  }, [allocationKey, data, isTeacher, termFilter]);

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

  const teacherSubjects = useMemo(() => {
    if (!data) return [];
    if (!isTeacher) return data.subjects;
    if (!selectedAllocation) return [];
    return data.subjects.filter((subject: SubjectRow) => subject.id === selectedAllocation.subject_id);
  }, [data, isTeacher, selectedAllocation]);

  const commentStudents = useMemo(() => {
    if (!data) return [];
    if (!isTeacher) return data.students;
    if (!selectedAllocation) return [];
    return data.students.filter(
      (student: StudentRow) =>
        (!selectedAllocation.class_id || selectedAllocation.class_id === student.class_id) &&
        (!selectedAllocation.stream_id || selectedAllocation.stream_id === student.stream_id),
    );
  }, [data, isTeacher, selectedAllocation]);

  const { data: comments } = useQuery<CommentRow[]>({
    queryKey: ["assessment-comments", termFilter || data?.currentTermId || "", commentStudents.map((student) => student.id).join(",")],
    enabled: commentStudents.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("report_comments")
          .select("student_id, class_teacher_comment, head_teacher_comment")
          .eq("term_id", termFilter || data?.currentTermId || "")
          .in("student_id", commentStudents.map((student) => student.id))
      ).data ?? [],
  });

  useEffect(() => {
    if (!comments) return;
    setCommentDrafts((current) => {
      const next = { ...current };
      for (const comment of comments) {
        next[comment.student_id] = {
          classTeacherComment: comment.class_teacher_comment ?? current[comment.student_id]?.classTeacherComment ?? "",
          headTeacherComment: comment.head_teacher_comment ?? current[comment.student_id]?.headTeacherComment ?? "",
        };
      }
      return next;
    });
  }, [comments]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.assessments
      .filter((assessment) => {
        if (!isTeacher) return true;
        if (!selectedAllocation) return false;
        const student = data.students.find((item: StudentRow) => item.id === assessment.student_id);
        if (!student) return false;
        return (
          assessment.subject_id === selectedAllocation.subject_id &&
          (!selectedAllocation.class_id || selectedAllocation.class_id === student.class_id) &&
          (!selectedAllocation.stream_id || selectedAllocation.stream_id === student.stream_id)
        );
      })
      .filter((assessment) => (subjectFilter ? assessment.subject_id === subjectFilter : true))
      .filter((assessment) => (statusFilter ? assessment.status === statusFilter : true))
      .filter((assessment) => (termFilter ? assessment.term_id === termFilter : true))
      .map((assessment) => ({
        ...assessment,
        studentName: data.students.find((student: StudentRow) => student.id === assessment.student_id)?.full_name ?? "—",
        subjectName: data.subjects.find((subject: SubjectRow) => subject.id === assessment.subject_id)?.name ?? "—",
        termName: data.terms.find((term: TermRow) => term.id === assessment.term_id)?.name ?? "—",
        gradeDescriptor: assessment.grade_descriptor ?? "",
      }));
  }, [data, isTeacher, selectedAllocation, subjectFilter, statusFilter, termFilter]);

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const edit = edits[id] ?? {};
      const patch = {
        status: "submitted" as const,
        submitted_by: me?.userId,
        submitted_at: new Date().toISOString(),
        ...(edit.formative !== undefined ? { formative: edit.formative === "" ? null : Number(edit.formative) } : {}),
        ...(edit.summative !== undefined ? { summative: edit.summative === "" ? null : Number(edit.summative) } : {}),
        ...(edit.gradeDescriptor !== undefined ? { grade_descriptor: edit.gradeDescriptor === "" ? null : edit.gradeDescriptor } : {}),
      };
      const { error } = await supabase.from("assessments").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
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
      await saveComment({
        data: {
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
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!entryForm.termId && !data?.currentTermId) throw new Error("Choose a term");
      if (!entryForm.studentId) throw new Error("Choose a learner");
      if (!entryForm.subjectId) throw new Error("Choose a subject");
      if (isTeacher && !selectedAllocation) throw new Error("Choose an assigned class / stream / subject");

      await upsertEntry({
        data: {
          studentId: entryForm.studentId,
          subjectId: entryForm.subjectId,
          termId: entryForm.termId || data?.currentTermId || "",
          examType: entryForm.examType,
          gradeDescriptor: entryForm.gradeDescriptor || null,
          formative: entryForm.formative === "" ? null : Number(entryForm.formative),
          summative: entryForm.summative === "" ? null : Number(entryForm.summative),
          teacherInitials: entryForm.teacherInitials || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Assessment saved as draft");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      setEntryForm((current) => ({
        ...current,
        studentId: "",
        gradeDescriptor: "",
        formative: "",
        summative: "",
        examType: "end_of_term",
      }));
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: (vars: { ids: string[]; action: "approve" | "reject" }) => review({ data: vars }),
    onSuccess: () => {
      toast.success("Review recorded");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const pendingIds = rows.filter((row: AssessmentRow & { studentName: string; subjectName: string; termName: string; gradeDescriptor: string }) => row.status === "submitted").map((row) => row.id);

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Formative counts 20%, summative 80%. Approved scores lock automatically."
        actions={
          canReview && pendingIds.length > 0 ? (
            <>
              <Btn variant="accent" onClick={() => reviewMutation.mutate({ ids: pendingIds, action: "approve" })}>
                Approve {pendingIds.length} submitted
              </Btn>
              <Btn variant="ghost" onClick={() => reviewMutation.mutate({ ids: pendingIds, action: "reject" })}>
                Return for correction
              </Btn>
            </>
          ) : undefined
        }
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
            <Field label="Learner">
              <select
                className={inputClass}
                value={entryForm.studentId}
                onChange={(event) => setEntryForm({ ...entryForm, studentId: event.target.value })}
                disabled={teacherStudents.length === 0}
              >
                <option value="">Select learner</option>
                {teacherStudents.map((student: StudentRow) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </Field>
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
              <select className={inputClass} value={entryForm.termId} onChange={(event) => setEntryForm({ ...entryForm, termId: event.target.value })}>
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
              <select className={inputClass} value={entryForm.examType} onChange={(event) => setEntryForm({ ...entryForm, examType: event.target.value })}>
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
                onChange={(event) => setEntryForm({ ...entryForm, formative: event.target.value })}
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
                onChange={(event) => setEntryForm({ ...entryForm, summative: event.target.value })}
              />
            </Field>
            <Field label="Grade descriptor">
              <input
                className={inputClass}
                value={entryForm.gradeDescriptor}
                onChange={(event) => setEntryForm({ ...entryForm, gradeDescriptor: event.target.value })}
                placeholder="e.g. Excellent, Good, Fair"
              />
            </Field>
            <Field label="Teacher initials">
              <input
                className={inputClass}
                value={entryForm.teacherInitials}
                onChange={(event) => setEntryForm({ ...entryForm, teacherInitials: event.target.value })}
                placeholder="e.g. JK"
              />
            </Field>
            <div className="flex items-end">
              <Btn type="submit" variant="accent" disabled={createMutation.isPending || (isTeacher && !selectedAllocation)}>
                {createMutation.isPending ? "Saving…" : "Save draft"}
              </Btn>
            </div>
          </form>
        </Panel>
      )}

      {canEditComments && (
        <Panel title="Learner comments" className="mb-4">
          {commentStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Choose an allocation and term first, then add each learner&apos;s {isClassTeacher ? "class teacher" : "head teacher"} comment.
            </p>
          ) : (
            <div className="space-y-4">
              {commentStudents.map((student) => {
                const draft = commentDrafts[student.id] ?? { classTeacherComment: "", headTeacherComment: "" };
                return (
                  <div key={student.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">{student.full_name}</h3>
                      <Btn variant="accent" onClick={() => commentMutation.mutate(student.id)} disabled={commentMutation.isPending}>
                        Save comment
                      </Btn>
                    </div>
                    <div>
                      {isClassTeacher && (
                        <Field label="Class Teacher's Comment">
                          <textarea
                            className={`${inputClass} min-h-28`}
                            value={draft.classTeacherComment}
                            onChange={(event) =>
                              setCommentDrafts((current) => ({
                                ...current,
                                [student.id]: { ...draft, classTeacherComment: event.target.value },
                              }))
                            }
                          />
                        </Field>
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
          <select className={`${inputClass} max-w-xs`} value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="">All subjects</option>
            {(data?.subjects ?? []).map((subject: SubjectRow) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select className={`${inputClass} max-w-xs`} value={termFilter} onChange={(event) => setTermFilter(event.target.value)}>
            <option value="">All terms</option>
            {(data?.terms ?? []).map((term: TermRow) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
          <select className={`${inputClass} max-w-xs`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
                <th className="pb-2">Formative (20)</th>
                <th className="pb-2">Summative (80)</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row: AssessmentRow & { studentName: string; subjectName: string; termName: string; gradeDescriptor: string }) => {
                const edit = edits[row.id] ?? {};
                const formative = edit.formative ?? (row.formative ?? "").toString();
                const summative = edit.summative ?? (row.summative ?? "").toString();
                const gradeDescriptor = edit.gradeDescriptor ?? row.gradeDescriptor ?? "";
                const total = (Number(formative || 0) + Number(summative || 0)).toFixed(1);
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2 font-medium">{row.studentName}</td>
                    <td>{row.subjectName}</td>
                    <td>{row.termName}</td>
                    <td>
                      <input
                        className={`${inputClass} w-40`}
                        value={gradeDescriptor}
                        disabled={row.locked}
                        onChange={(event) => setEdits({ ...edits, [row.id]: { ...edit, gradeDescriptor: event.target.value } })}
                        placeholder="Descriptor"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        max={20}
                        min={0}
                        disabled={row.locked}
                        className={`${inputClass} w-24`}
                        value={formative}
                        onChange={(event) => setEdits({ ...edits, [row.id]: { ...edit, formative: event.target.value } })}
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
                        onChange={(event) => setEdits({ ...edits, [row.id]: { ...edit, summative: event.target.value } })}
                      />
                    </td>
                    <td className="font-semibold">{total}</td>
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
                      {!row.locked && (
                        <Btn variant="ghost" onClick={() => saveMutation.mutate(row.id)}>
                          Submit
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-muted-foreground">
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
