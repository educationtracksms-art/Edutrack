import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAcademicsPage, type AcademicClass } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/allocations")({
  head: () => ({
    meta: [{ title: "Teacher allocations | EduTrack" }],
  }),
  component: AllocationsPage,
});

function AllocationsPage() {
  const { me, schoolId, allowed, data, refresh } = useAcademicsPage();
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [allocForm, setAllocForm] = useState({
    teacher_id: "",
    subject_id: "",
    paper_id: "",
    class_id: "",
    stream_id: "",
    weekly_periods: "1",
  });
  const addAllocation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!allocForm.teacher_id) throw new Error("Select a teacher first");
      if (!allocForm.subject_id) throw new Error("Select a subject first");
      if (!allocForm.class_id) throw new Error("Select the class this teacher will handle");
      if (!data?.teachers.some((item) => item.id === allocForm.teacher_id)) {
        throw new Error("The selected teacher is no longer available. Choose a teacher again");
      }
      const teacher = data?.teachers.find((item) => item.id === allocForm.teacher_id);
      const subject = data?.subjects.find((item) => item.id === allocForm.subject_id);
      if (!subject) {
        throw new Error("The selected subject is no longer available. Choose a subject again");
      }
      if (!teacher?.department_id) {
        throw new Error("Assign the teacher to a department before creating an allocation");
      }
      if (teacher.department_id !== subject.department_id) {
        throw new Error("The teacher and subject must belong to the same department");
      }
      const subjectPapers = (data?.subjectPapers ?? [])
        .filter((paper) => paper.subject_id === subject.id)
        .sort((a, b) => a.position - b.position);
      if (subject.education_level === "advanced" && subjectPapers.length > 0 && !allocForm.paper_id) {
        throw new Error("Select the A-Level paper this teacher will handle");
      }
      if (subject.education_level !== "advanced" && allocForm.paper_id) {
        throw new Error("O-Level subjects cannot be allocated to papers");
      }
      if (allocForm.paper_id && !subjectPapers.some((paper) => paper.id === allocForm.paper_id)) {
        throw new Error("The selected paper does not belong to this subject");
      }
      if (!data?.classes.some((item) => item.id === allocForm.class_id)) {
        throw new Error("The selected class is no longer available. Choose a class again");
      }
      const classStreams = (data?.streams ?? []).filter(
        (stream) => stream.class_id === allocForm.class_id,
      );
      if (classStreams.length > 0 && !allocForm.stream_id) {
        throw new Error("Select the stream this teacher will handle");
      }
      if (allocForm.stream_id) {
        const stream = data?.streams.find((item) => item.id === allocForm.stream_id);
        if (!stream)
          throw new Error("The selected stream is no longer available. Choose a stream again");
        if (!allocForm.class_id || stream.class_id !== allocForm.class_id) {
          throw new Error("Choose the class that contains the selected stream first");
        }
      }
      const weeklyPeriods = Number(allocForm.weekly_periods);
      if (!Number.isInteger(weeklyPeriods) || weeklyPeriods < 1 || weeklyPeriods > 60) {
        throw new Error("Periods per week must be a whole number from 1 to 60");
      }
      const payload = {
        school_id: schoolId,
        teacher_id: allocForm.teacher_id,
        subject_id: allocForm.subject_id,
        paper_id: allocForm.paper_id || null,
        class_id: allocForm.class_id,
        stream_id: allocForm.stream_id || null,
        weekly_periods: weeklyPeriods,
      };
      const query = editingAllocationId
        ? supabase.from("teacher_allocations").update(payload).eq("id", editingAllocationId).eq("school_id", schoolId)
        : supabase.from("teacher_allocations").insert(payload);
      const { error } = await query;
      if (error) throw new Error(error.message);
      await supabase
        .from("teacher_allocation_history")
        .insert({ ...payload, action: editingAllocationId ? "updated" : "assigned", performed_by: me?.userId ?? null });
    },
    onSuccess: () => {
      setEditingAllocationId(null);
      setAllocForm({
        teacher_id: "",
        subject_id: "",
        paper_id: "",
        class_id: "",
        stream_id: "",
        weekly_periods: "1",
      });
      toast.success("Teacher allocated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeAllocation = useMutation({
    mutationFn: async (id: string) => {
      const alloc = data?.allocations.find((a) => a.id === id);
      const { error } = await supabase.from("teacher_allocations").delete().eq("id", id);
      if (error) throw new Error(error.message);
      if (alloc) {
        await supabase.from("teacher_allocation_history").insert({
          school_id: alloc.school_id,
          teacher_id: alloc.teacher_id,
          subject_id: alloc.subject_id,
          paper_id: alloc.paper_id ?? null,
          class_id: alloc.class_id,
          stream_id: alloc.stream_id,
          action: "removed",
          performed_by: me?.userId ?? null,
        });
      }
    },
    onSuccess: () => {
      setEditingAllocationId(null);
      toast.success("Allocation removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const className = (id: string | null) => {
    const item = data?.classes.find((c) => c.id === id);
    return item ? classLabel(item) : "All classes";
  };
  const streamName = (id: string | null) =>
    data?.streams.find((s) => s.id === id)?.name ?? "All streams";
  const departmentName = (id: string | null | undefined) =>
    data?.departments.find((department) => department.id === id)?.name ?? "Not assigned";
  const classTeacherName = (id: string | null) =>
    data?.teachers.find((t) => t.id === id)?.full_name ?? "Not assigned";
  const subjectName = (id: string) => data?.subjects.find((s) => s.id === id)?.name ?? "â€”";
  const teacherName = (id: string) => data?.teachers.find((t) => t.id === id)?.full_name ?? "â€”";

  const levelLabel = (value: string | null | undefined) =>
    value === "advanced" ? "Advanced Level" : "Ordinary Level";

  const classLabel = (item: AcademicClass) => {
    const parts = [item.name, levelLabel(item.education_level)];
    if (item.level !== null && item.level !== undefined && item.level !== "") {
      parts.push(`Order ${item.level}`);
    }
    return parts.join(" · ");
  };
  const selectedAllocationTeacher = data?.teachers.find(
    (teacher) => teacher.id === allocForm.teacher_id,
  );
  const selectedAllocationSubject = data?.subjects.find(
    (subject) => subject.id === allocForm.subject_id,
  );
  const allocationSubjects = (data?.subjects ?? []).filter(
    (subject) =>
      !selectedAllocationTeacher?.department_id ||
      subject.department_id === selectedAllocationTeacher.department_id,
  );
  const allocationTeachers = (data?.teachers ?? []).filter(
    (teacher) =>
      !selectedAllocationSubject?.department_id ||
      teacher.department_id === selectedAllocationSubject.department_id,
  );
  const allocationPapers = (data?.subjectPapers ?? [])
    .filter((paper) => paper.subject_id === allocForm.subject_id)
    .sort((a, b) => a.position - b.position);

  if (!allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the Director of Studies and school leadership can manage academic setup.
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Academic setup"
        title="Teacher allocations"
        description="Assign teachers to subjects, papers, classes and streams for the current term."
      />
      <Panel title="Teacher allocations" className="mt-4">
        <form
          className="mb-4 grid gap-3 md:grid-cols-7"
          onSubmit={(e) => {
            e.preventDefault();
            addAllocation.mutate();
          }}
        >
          <Field label="Teacher">
            <select
              required
              className={inputClass}
              value={allocForm.teacher_id}
              onChange={(e) => {
                const teacherId = e.target.value;
                const teacher = data?.teachers.find((item) => item.id === teacherId);
                const subject = data?.subjects.find((item) => item.id === allocForm.subject_id);
                setAllocForm((current) => ({
                  ...current,
                  teacher_id: teacherId,
                  paper_id: "",
                  subject_id:
                    teacher && subject && teacher.department_id === subject.department_id
                      ? current.subject_id
                      : "",
                }));
              }}
            >
              <option value="">Select</option>
              {allocationTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} · {departmentName(t.department_id)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select
              required
              className={inputClass}
              value={allocForm.subject_id}
              onChange={(e) => {
                const subjectId = e.target.value;
                const subject = data?.subjects.find((item) => item.id === subjectId);
                const teacher = data?.teachers.find((item) => item.id === allocForm.teacher_id);
                setAllocForm((current) => ({
                  ...current,
                  subject_id: subjectId,
                  paper_id: "",
                  teacher_id:
                    subject && teacher && subject.department_id === teacher.department_id
                      ? current.teacher_id
                      : "",
                }));
              }}
            >
              <option value="">Select</option>
              {allocationSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {departmentName(s.department_id)}
                </option>
              ))}
            </select>
          </Field>
          {selectedAllocationSubject?.education_level === "advanced" && allocationPapers.length > 0 && (
            <Field label="A-Level paper">
              <select
                required
                className={inputClass}
                value={allocForm.paper_id}
                onChange={(e) => setAllocForm({ ...allocForm, paper_id: e.target.value })}
              >
                <option value="">Select paper</option>
                {allocationPapers.map((paper) => (
                  <option key={paper.id} value={paper.id}>{paper.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Class">
            <select
              required
              className={inputClass}
              value={allocForm.class_id}
              onChange={(e) =>
                setAllocForm({ ...allocForm, class_id: e.target.value, stream_id: "" })
              }
            >
              <option value="">Select class</option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stream">
            <select
              required={Boolean(
                (data?.streams ?? []).some((stream) => stream.class_id === allocForm.class_id),
              )}
              className={inputClass}
              value={allocForm.stream_id}
              onChange={(e) => setAllocForm({ ...allocForm, stream_id: e.target.value })}
            >
              <option value="">Select stream</option>
              {(data?.streams ?? [])
                .filter((s) => !allocForm.class_id || s.class_id === allocForm.class_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Periods / week">
            <input
              className={inputClass}
              type="number"
              min="1"
              max="60"
              value={allocForm.weekly_periods}
              onChange={(e) => setAllocForm({ ...allocForm, weekly_periods: e.target.value })}
            />
          </Field>
          <div className="flex items-end">
            <Btn type="submit" variant="accent" disabled={addAllocation.isPending}>
              {editingAllocationId ? "Save allocation" : "Allocate"}
            </Btn>
            {editingAllocationId && (
              <Btn
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingAllocationId(null);
                  setAllocForm({ teacher_id: "", subject_id: "", paper_id: "", class_id: "", stream_id: "", weekly_periods: "1" });
                }}
              >
                Cancel
              </Btn>
            )}
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Teacher</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Paper</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">Stream</th>
                <th className="pb-2">Periods / week</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {(data?.allocations ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-2 font-medium">{teacherName(a.teacher_id)}</td>
                  <td>{subjectName(a.subject_id)}</td>
                  <td>{a.paper_id ? (data?.subjectPapers ?? []).find((paper) => paper.id === a.paper_id)?.name ?? "Unknown paper" : "—"}</td>
                  <td>
                    {departmentName(
                      data?.subjects.find((s) => s.id === a.subject_id)?.department_id,
                    )}
                  </td>
                  <td>{className(a.class_id)}</td>
                  <td>{streamName(a.stream_id)}</td>
                  <td>{a.weekly_periods}</td>
                  <td className="text-right">
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        setEditingAllocationId(a.id);
                        setAllocForm({
                          teacher_id: a.teacher_id,
                          subject_id: a.subject_id,
                          paper_id: a.paper_id ?? "",
                          class_id: a.class_id,
                          stream_id: a.stream_id ?? "",
                          weekly_periods: String(a.weekly_periods ?? 1),
                        });
                      }}
                    >
                      Edit
                    </Btn>
                    <Btn variant="ghost" onClick={() => removeAllocation.mutate(a.id)}>
                      Remove
                    </Btn>
                  </td>
                </tr>
              ))}
              {(data?.allocations ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No allocations yet.
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
