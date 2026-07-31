import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ACADEMIC_MANAGERS, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/academics")({
  head: () => ({
    meta: [
      { title: "Academic setup · EduTrack" },
      { name: "description", content: "Create classes, streams and subjects, then allocate teachers to each stream." },
      { property: "og:title", content: "Academic setup · EduTrack" },
      { property: "og:description", content: "Director of Studies control over classes, streams, subjects and teaching loads." },
    ],
  }),
  component: AcademicsPage,
});

function AcademicsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const allowed = hasAny(me?.roles, ACADEMIC_MANAGERS);

  const [classForm, setClassForm] = useState({ name: "", level: "" });
  const [streamForm, setStreamForm] = useState({ name: "", class_id: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", category: "", position: "" });
  const [allocForm, setAllocForm] = useState({ teacher_id: "", subject_id: "", class_id: "", stream_id: "" });

  const { data } = useQuery({
    queryKey: ["academics", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [classes, streams, subjects, allocations, teachers, roles] = await Promise.all([
        supabase.from("classes").select("*").order("level", { ascending: true }).order("name"),
        supabase.from("streams").select("*").order("name"),
        supabase.from("subjects").select("*").order("position"),
        supabase.from("teacher_allocations").select("*"),
        supabase.from("profiles").select("id, full_name, initials").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const teachingRoles = new Set(
        (roles.data ?? [])
          .filter((r) => ["class_teacher", "subject_teacher", "dos", "head_teacher", "deputy_head_teacher"].includes(r.role))
          .map((r) => r.user_id),
      );
      return {
        classes: classes.data ?? [],
        streams: streams.data ?? [],
        subjects: subjects.data ?? [],
        allocations: allocations.data ?? [],
        teachers: (teachers.data ?? []).filter((t) => teachingRoles.has(t.id)),
      };
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["academics", schoolId] });
  }

  const addClass = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const { error } = await supabase.from("classes").insert({
        school_id: schoolId,
        name: classForm.name,
        level: classForm.level ? Number(classForm.level) : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setClassForm({ name: "", level: "" });
      toast.success("Class added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStream = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!streamForm.class_id) throw new Error("Choose the class this stream belongs to");
      const { error } = await supabase
        .from("streams")
        .insert({ school_id: schoolId, class_id: streamForm.class_id, name: streamForm.name });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setStreamForm({ name: "", class_id: "" });
      toast.success("Stream added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const { error } = await supabase.from("subjects").insert({
        school_id: schoolId,
        name: subjectForm.name,
        code: subjectForm.code || null,
        category: subjectForm.category || undefined,
        position: subjectForm.position ? Number(subjectForm.position) : (data?.subjects.length ?? 0) + 1,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSubjectForm({ name: "", code: "", category: "", position: "" });
      toast.success("Subject added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAllocation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!allocForm.teacher_id || !allocForm.subject_id) throw new Error("Pick a teacher and a subject");
      const payload = {
        school_id: schoolId,
        teacher_id: allocForm.teacher_id,
        subject_id: allocForm.subject_id,
        class_id: allocForm.class_id || null,
        stream_id: allocForm.stream_id || null,
      };
      const { error } = await supabase.from("teacher_allocations").insert(payload);
      if (error) throw new Error(error.message);
      await supabase
        .from("teacher_allocation_history")
        .insert({ ...payload, action: "assigned", performed_by: me?.userId ?? null });
    },
    onSuccess: () => {
      setAllocForm({ teacher_id: "", subject_id: "", class_id: "", stream_id: "" });
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
          class_id: alloc.class_id,
          stream_id: alloc.stream_id,
          action: "removed",
          performed_by: me?.userId ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Allocation removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">Only the Director of Studies and school leadership can manage academic setup.</p>;
  }

  const className = (id: string | null) => data?.classes.find((c) => c.id === id)?.name ?? "All classes";
  const streamName = (id: string | null) => data?.streams.find((s) => s.id === id)?.name ?? "All streams";
  const subjectName = (id: string) => data?.subjects.find((s) => s.id === id)?.name ?? "—";
  const teacherName = (id: string) => data?.teachers.find((t) => t.id === id)?.full_name ?? "—";

  return (
    <div>
      <PageHeader
        title="Academic setup"
        description="Classes, streams, subjects and teaching allocations for the current academic year."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Classes">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addClass.mutate();
            }}
          >
            <Field label="Class name">
              <input required className={inputClass} value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
            </Field>
            <Field label="Level (order)">
              <input type="number" className={inputClass} value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })} />
            </Field>
            <Btn type="submit" variant="accent" disabled={addClass.isPending}>Add class</Btn>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.classes ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{item.name}</span>
                <Pill tone="muted">{data?.streams.filter((s) => s.class_id === item.id).length ?? 0} streams</Pill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Streams">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addStream.mutate();
            }}
          >
            <Field label="Class">
              <select className={inputClass} value={streamForm.class_id} onChange={(e) => setStreamForm({ ...streamForm, class_id: e.target.value })}>
                <option value="">Select class</option>
                {(data?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Stream name">
              <input required className={inputClass} value={streamForm.name} onChange={(e) => setStreamForm({ ...streamForm, name: e.target.value })} />
            </Field>
            <Btn type="submit" variant="accent" disabled={addStream.isPending}>Add stream</Btn>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.streams ?? []).map((item) => (
              <li key={item.id} className="rounded-md border border-border px-3 py-2">
                {className(item.class_id)} · <span className="font-medium">{item.name}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Subjects">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addSubject.mutate();
            }}
          >
            <Field label="Subject name">
              <input required className={inputClass} value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Code">
                <input className={inputClass} value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} />
              </Field>
              <Field label="Position">
                <input type="number" className={inputClass} value={subjectForm.position} onChange={(e) => setSubjectForm({ ...subjectForm, position: e.target.value })} />
              </Field>
            </div>
            <Field label="Category">
              <input placeholder="Core / Elective" className={inputClass} value={subjectForm.category} onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })} />
            </Field>
            <Btn type="submit" variant="accent" disabled={addSubject.isPending}>Add subject</Btn>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.subjects ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{item.name}</span>
                {item.category && <Pill tone="muted">{item.category}</Pill>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Teacher allocations" className="mt-4">
        <form
          className="mb-4 grid gap-3 md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            addAllocation.mutate();
          }}
        >
          <Field label="Teacher">
            <select className={inputClass} value={allocForm.teacher_id} onChange={(e) => setAllocForm({ ...allocForm, teacher_id: e.target.value })}>
              <option value="">Select</option>
              {(data?.teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select className={inputClass} value={allocForm.subject_id} onChange={(e) => setAllocForm({ ...allocForm, subject_id: e.target.value })}>
              <option value="">Select</option>
              {(data?.subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select className={inputClass} value={allocForm.class_id} onChange={(e) => setAllocForm({ ...allocForm, class_id: e.target.value, stream_id: "" })}>
              <option value="">All classes</option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Stream">
            <select className={inputClass} value={allocForm.stream_id} onChange={(e) => setAllocForm({ ...allocForm, stream_id: e.target.value })}>
              <option value="">All streams</option>
              {(data?.streams ?? []).filter((s) => !allocForm.class_id || s.class_id === allocForm.class_id).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Btn type="submit" variant="accent" disabled={addAllocation.isPending}>Allocate</Btn>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Teacher</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">Stream</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {(data?.allocations ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-2 font-medium">{teacherName(a.teacher_id)}</td>
                  <td>{subjectName(a.subject_id)}</td>
                  <td>{className(a.class_id)}</td>
                  <td>{streamName(a.stream_id)}</td>
                  <td className="text-right">
                    <Btn variant="ghost" onClick={() => removeAllocation.mutate(a.id)}>Remove</Btn>
                  </td>
                </tr>
              ))}
              {(data?.allocations ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">No allocations yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}