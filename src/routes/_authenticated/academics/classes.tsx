import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { deleteClass, deleteStream } from "@/lib/admin.functions";
import { useAcademicsPage, type AcademicClass, type AcademicStream } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/classes")({
  head: () => ({
    meta: [{ title: "Classes & streams | EduTrack" }],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const { me, schoolId, allowed, data, refresh } = useAcademicsPage();
  const deleteClassFn = useServerFn(deleteClass);
  const deleteStreamFn = useServerFn(deleteStream);
  const [classForm, setClassForm] = useState({
    name: "",
    level: "",
    education_level: "ordinary",
    class_teacher_id: "",
  });
  const educationLevelForClassName = (name: string) => {
    const normalized = name.trim().toUpperCase().replace(/\s+/g, "");
    if (/^S\.?[56](\b|-|\()/.test(normalized)) return "advanced";
    if (/^S\.?[1-4](\b|-|\()/.test(normalized)) return "ordinary";
    return null;
  };
  const [streamForm, setStreamForm] = useState({ name: "", class_id: "", stream_teacher_id: "" });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  function resetClassForm() {
    setClassForm({ name: "", level: "", education_level: "ordinary", class_teacher_id: "" });
    setEditingClassId(null);
  }

  function resetStreamForm() {
    setStreamForm({ name: "", class_id: "", stream_teacher_id: "" });
    setEditingStreamId(null);
  }
  const addClass = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const name = classForm.name.trim();
      if (!name) throw new Error("Enter a class name first");
      if (!classForm.class_teacher_id) throw new Error("Choose a class teacher first");
      if (!data?.teachers.some((teacher) => teacher.id === classForm.class_teacher_id)) {
        throw new Error("Choose a class teacher from this school");
      }
      if (
        classForm.level &&
        (!Number.isInteger(Number(classForm.level)) || Number(classForm.level) < 1)
      ) {
        throw new Error("Class order must be a whole number greater than zero");
      }
      const { error } = await supabase.from("classes").insert({
        school_id: schoolId,
        name,
        level: classForm.level ? Number(classForm.level) : null,
        education_level: classForm.education_level,
        class_teacher_id: classForm.class_teacher_id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetClassForm();
      toast.success("Class added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateClass = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!editingClassId) throw new Error("No class selected for update");
      const name = classForm.name.trim();
      if (!name) throw new Error("Enter a class name first");
      if (!classForm.class_teacher_id) throw new Error("Choose a class teacher first");
      if (!data?.teachers.some((teacher) => teacher.id === classForm.class_teacher_id)) {
        throw new Error("Choose a class teacher from this school");
      }
      if (
        classForm.level &&
        (!Number.isInteger(Number(classForm.level)) || Number(classForm.level) < 1)
      ) {
        throw new Error("Class order must be a whole number greater than zero");
      }
      const { error } = await supabase
        .from("classes")
        .update({
          name,
          level: classForm.level ? Number(classForm.level) : null,
          education_level: classForm.education_level,
          class_teacher_id: classForm.class_teacher_id,
        })
        .eq("id", editingClassId)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetClassForm();
      toast.success("Class updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStream = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!streamForm.class_id) throw new Error("Choose the class this stream belongs to");
      if (!data?.classes.some((item) => item.id === streamForm.class_id)) {
        throw new Error("The selected class is no longer available. Choose a class again");
      }
      const name = streamForm.name.trim();
      if (!name) throw new Error("Enter a stream name first");
      if (!streamForm.stream_teacher_id) throw new Error("Choose a stream teacher first");
      if (!data?.teachers.some((teacher) => teacher.id === streamForm.stream_teacher_id)) {
        throw new Error("Choose a stream teacher from this school");
      }
      const { error } = await supabase.from("streams").insert({
        school_id: schoolId,
        class_id: streamForm.class_id,
        name,
        stream_teacher_id: streamForm.stream_teacher_id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetStreamForm();
      toast.success("Stream added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStream = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!editingStreamId) throw new Error("No stream selected for update");
      if (!streamForm.class_id) throw new Error("Choose the class this stream belongs to");
      if (!data?.classes.some((item) => item.id === streamForm.class_id)) {
        throw new Error("The selected class is no longer available. Choose a class again");
      }
      const name = streamForm.name.trim();
      if (!name) throw new Error("Enter a stream name first");
      if (!streamForm.stream_teacher_id) throw new Error("Choose a stream teacher first");
      if (!data?.teachers.some((teacher) => teacher.id === streamForm.stream_teacher_id)) {
        throw new Error("Choose a stream teacher from this school");
      }
      const { error } = await supabase
        .from("streams")
        .update({
          class_id: streamForm.class_id,
          name,
          stream_teacher_id: streamForm.stream_teacher_id,
        })
        .eq("id", editingStreamId)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetStreamForm();
      toast.success("Stream updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeClass = useMutation({
    mutationFn: (classId: string) => deleteClassFn({ data: { classId } }),
    onSuccess: () => {
      toast.success("Class deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeStream = useMutation({
    mutationFn: (streamId: string) => deleteStreamFn({ data: { streamId } }),
    onSuccess: () => {
      toast.success("Stream deleted");
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

  function startEditingClass(item: AcademicClass) {
    setEditingClassId(item.id);
    setClassForm({
      name: item.name ?? "",
      level: item.level?.toString() ?? "",
      education_level: item.education_level ?? "ordinary",
      class_teacher_id: item.class_teacher_id ?? "",
    });
  }

  const levelLabel = (value: string | null | undefined) =>
    value === "advanced" ? "Advanced Level" : "Ordinary Level";

  const classLabel = (item: AcademicClass) => {
    const parts = [item.name, levelLabel(item.education_level)];
    if (item.level !== null && item.level !== undefined && item.level !== "") {
      parts.push(`Order ${item.level}`);
    }
    return parts.join(" · ");
  };

  function startEditingStream(item: AcademicStream) {
    setEditingStreamId(item.id);
    setStreamForm({
      name: item.name ?? "",
      class_id: item.class_id ?? "",
      stream_teacher_id: item.stream_teacher_id ?? "",
    });
  }

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
        title="Classes & streams"
        description="Create classes and their streams, and assign a class teacher and stream teachers."
      />
        <Panel title="Classes">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingClassId) updateClass.mutate();
              else addClass.mutate();
            }}
          >
            <Field label="Class name">
              <input
                required
                className={inputClass}
                value={classForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const inferredLevel = educationLevelForClassName(name);
                  setClassForm({
                    ...classForm,
                    name,
                    ...(inferredLevel ? { education_level: inferredLevel } : {}),
                  });
                }}
              />
            </Field>
            <Field label="Level type">
              <select
                className={inputClass}
                value={classForm.education_level}
                onChange={(e) => setClassForm({ ...classForm, education_level: e.target.value })}
              >
                <option value="ordinary">Ordinary Level</option>
                <option value="advanced">Advanced Level</option>
              </select>
            </Field>
            <Field label="Class order">
              <input
                type="number"
                className={inputClass}
                value={classForm.level}
                onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}
              />
            </Field>
            <Field label="Class teacher">
              <select
                required
                className={inputClass}
                value={classForm.class_teacher_id}
                onChange={(e) => setClassForm({ ...classForm, class_teacher_id: e.target.value })}
              >
                <option value="">Select class teacher</option>
                {(data?.teachers ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name} · {departmentName(teacher.department_id)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Btn
                type="submit"
                variant="accent"
                disabled={addClass.isPending || updateClass.isPending}
              >
                {editingClassId ? "Save changes" : "Add class"}
              </Btn>
              {editingClassId && (
                <Btn variant="ghost" onClick={resetClassForm}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.classes ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>
                  <span className="font-medium">{classLabel(item)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Class teacher: {classTeacherName(item.class_teacher_id)}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Pill tone="muted">
                    {data?.streams.filter((s) => s.class_id === item.id).length ?? 0} streams
                  </Pill>
                  <Btn variant="ghost" onClick={() => startEditingClass(item)}>
                    Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete class "${item.name}"? This will also remove related streams.`,
                        )
                      ) {
                        removeClass.mutate(item.id);
                      }
                    }}
                  >
                    Delete
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Streams">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingStreamId) updateStream.mutate();
              else addStream.mutate();
            }}
          >
            <Field label="Class">
              <select
                required
                className={inputClass}
                value={streamForm.class_id}
                onChange={(e) => setStreamForm({ ...streamForm, class_id: e.target.value })}
              >
                <option value="">Select class</option>
                {(data?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stream name">
              <input
                required
                className={inputClass}
                value={streamForm.name}
                onChange={(e) => setStreamForm({ ...streamForm, name: e.target.value })}
              />
            </Field>
            <Field label="Stream teacher">
              <select
                required
                className={inputClass}
                value={streamForm.stream_teacher_id}
                onChange={(e) =>
                  setStreamForm({ ...streamForm, stream_teacher_id: e.target.value })
                }
              >
                <option value="">Select stream teacher</option>
                {(data?.teachers ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name} · {departmentName(teacher.department_id)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Btn
                type="submit"
                variant="accent"
                disabled={addStream.isPending || updateStream.isPending}
              >
                {editingStreamId ? "Save changes" : "Add stream"}
              </Btn>
              {editingStreamId && (
                <Btn variant="ghost" onClick={resetStreamForm}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.streams ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>
                  {className(item.class_id)} Â· <span className="font-medium">{item.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Btn variant="ghost" onClick={() => startEditingStream(item)}>
                    Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete stream "${item.name}"?`)) {
                        removeStream.mutate(item.id);
                      }
                    }}
                  >
                    Delete
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
    </div>
  );
}
