import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { ACADEMIC_MANAGERS, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { deleteClass, deleteStream } from "@/lib/admin.functions";

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
  const deleteClassFn = useServerFn(deleteClass);
  const deleteStreamFn = useServerFn(deleteStream);

  const [classForm, setClassForm] = useState({ name: "", level: "" });
  const [streamForm, setStreamForm] = useState({ name: "", class_id: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", category: "", position: "" });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [allocForm, setAllocForm] = useState({ teacher_id: "", subject_id: "", class_id: "", stream_id: "" });
  const [yearForm, setYearForm] = useState({ name: "" });
  const [termForm, setTermForm] = useState({ name: "", academic_year_id: "", start_date: "", end_date: "" });

  const { data } = useQuery({
    queryKey: ["academics", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [classes, streams, subjects, allocations, teachers, roles, academicYears, terms] = await Promise.all([
        supabase.from("classes").select("*").order("level", { ascending: true }).order("name"),
        supabase.from("streams").select("*").order("name"),
        supabase.from("subjects").select("*").order("position"),
        supabase.from("teacher_allocations").select("*"),
        supabase.from("profiles").select("id, full_name, initials").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("academic_years").select("*").eq("school_id", schoolId!).order("name"),
        supabase.from("terms").select("*").eq("school_id", schoolId!).order("start_date", { ascending: true }).order("name"),
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
        academicYears: academicYears.data ?? [],
        terms: terms.data ?? [],
      };
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["academics", schoolId] });
  }

  function resetClassForm() {
    setClassForm({ name: "", level: "" });
    setEditingClassId(null);
  }

  function resetStreamForm() {
    setStreamForm({ name: "", class_id: "" });
    setEditingStreamId(null);
  }

  function resetSubjectForm() {
    setSubjectForm({ name: "", code: "", category: "", position: "" });
    setEditingSubjectId(null);
  }

  async function setYearAsCurrent(yearId: string) {
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { error: clearError } = await supabase.from("academic_years").update({ is_current: false }).eq("school_id", schoolId);
    if (clearError) throw new Error(clearError.message);
    const { error: selectError } = await supabase.from("academic_years").update({ is_current: true }).eq("id", yearId).eq("school_id", schoolId);
    if (selectError) throw new Error(selectError.message);
  }

  async function setTermAsCurrent(termId: string) {
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { data: term, error: termLookupError } = await supabase
      .from("terms")
      .select("academic_year_id")
      .eq("id", termId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (termLookupError) throw new Error(termLookupError.message);
    if (!term?.academic_year_id) throw new Error("The selected term is missing an academic year");

    const { error: clearTermsError } = await supabase.from("terms").update({ is_current: false }).eq("school_id", schoolId);
    if (clearTermsError) throw new Error(clearTermsError.message);
    const { error: selectTermError } = await supabase.from("terms").update({ is_current: true }).eq("id", termId).eq("school_id", schoolId);
    if (selectTermError) throw new Error(selectTermError.message);

    const { error: clearYearsError } = await supabase.from("academic_years").update({ is_current: false }).eq("school_id", schoolId);
    if (clearYearsError) throw new Error(clearYearsError.message);
    const { error: selectYearError } = await supabase
      .from("academic_years")
      .update({ is_current: true })
      .eq("id", term.academic_year_id)
      .eq("school_id", schoolId);
    if (selectYearError) throw new Error(selectYearError.message);
  }

  const addClass = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const { error } = await supabase.from("classes").insert({
        school_id: schoolId,
        name: classForm.name.trim(),
        level: classForm.level ? Number(classForm.level) : null,
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
      const { error } = await supabase
        .from("classes")
        .update({
          name: classForm.name.trim(),
          level: classForm.level ? Number(classForm.level) : null,
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
      const { error } = await supabase.from("streams").insert({
        school_id: schoolId,
        class_id: streamForm.class_id,
        name: streamForm.name.trim(),
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
      const { error } = await supabase
        .from("streams")
        .update({
          class_id: streamForm.class_id,
          name: streamForm.name.trim(),
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

  const addSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const { error } = await supabase.from("subjects").insert({
        school_id: schoolId,
        name: subjectForm.name.trim(),
        code: subjectForm.code || null,
        category: subjectForm.category || undefined,
        position: subjectForm.position ? Number(subjectForm.position) : (data?.subjects.length ?? 0) + 1,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetSubjectForm();
      toast.success("Subject added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!editingSubjectId) throw new Error("No subject selected for update");
      const { error } = await supabase
        .from("subjects")
        .update({
          name: subjectForm.name.trim(),
          code: subjectForm.code || null,
          category: subjectForm.category || undefined,
          position: subjectForm.position ? Number(subjectForm.position) : (data?.subjects.length ?? 0) + 1,
        })
        .eq("id", editingSubjectId)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetSubjectForm();
      toast.success("Subject updated");
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
      await supabase.from("teacher_allocation_history").insert({ ...payload, action: "assigned", performed_by: me?.userId ?? null });
    },
    onSuccess: () => {
      setAllocForm({ teacher_id: "", subject_id: "", class_id: "", stream_id: "" });
      toast.success("Teacher allocated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addYear = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const name = yearForm.name.trim();
      if (!name) throw new Error("Enter an academic year name");
      const { data: created, error } = await supabase.from("academic_years").insert({ school_id: schoolId, name }).select("id").single();
      if (error) throw new Error(error.message);
      await setYearAsCurrent(created.id);
      return created.id;
    },
    onSuccess: () => {
      setYearForm({ name: "" });
      toast.success("Academic year created and set as current");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTerm = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const name = termForm.name.trim();
      if (!name) throw new Error("Enter a term name");
      if (!termForm.academic_year_id) throw new Error("Choose an academic year for this term");
      const { data: created, error } = await supabase
        .from("terms")
        .insert({
          school_id: schoolId,
          academic_year_id: termForm.academic_year_id,
          name,
          start_date: termForm.start_date || null,
          end_date: termForm.end_date || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await setTermAsCurrent(created.id);
      return created.id;
    },
    onSuccess: () => {
      setTermForm({ name: "", academic_year_id: "", start_date: "", end_date: "" });
      toast.success("Term created and set as current");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeYearCurrent = useMutation({
    mutationFn: (yearId: string) => setYearAsCurrent(yearId),
    onSuccess: () => {
      toast.success("Academic year set as current");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeTermCurrent = useMutation({
    mutationFn: (termId: string) => setTermAsCurrent(termId),
    onSuccess: () => {
      toast.success("Term set as current");
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

  function startEditingClass(item: any) {
    setEditingClassId(item.id);
    setClassForm({ name: item.name ?? "", level: item.level?.toString() ?? "" });
  }

  function startEditingStream(item: any) {
    setEditingStreamId(item.id);
    setStreamForm({ name: item.name ?? "", class_id: item.class_id ?? "" });
  }

  function startEditingSubject(item: any) {
    setEditingSubjectId(item.id);
    setSubjectForm({
      name: item.name ?? "",
      code: item.code ?? "",
      category: item.category ?? "",
      position: item.position?.toString() ?? "",
    });
  }

  return (
    <div>
      <PageHeader title="Academic setup" description="Classes, streams, subjects and teaching allocations for the current academic year." />

      <div className="grid gap-4 lg:grid-cols-3">
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
              <input required className={inputClass} value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
            </Field>
            <Field label="Level (order)">
              <input type="number" className={inputClass} value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Btn type="submit" variant="accent" disabled={addClass.isPending || updateClass.isPending}>
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
              <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{item.name}</span>
                <div className="flex items-center gap-2">
                  <Pill tone="muted">{data?.streams.filter((s) => s.class_id === item.id).length ?? 0} streams</Pill>
                  <Btn variant="ghost" onClick={() => startEditingClass(item)}>
                    Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete class "${item.name}"? This will also remove related streams.`)) {
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
            <div className="flex flex-wrap gap-2">
              <Btn type="submit" variant="accent" disabled={addStream.isPending || updateStream.isPending}>
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
              <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>
                  {className(item.class_id)} · <span className="font-medium">{item.name}</span>
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

        <Panel title="Subjects">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingSubjectId) updateSubject.mutate();
              else addSubject.mutate();
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
            <div className="flex flex-wrap gap-2">
              <Btn type="submit" variant="accent" disabled={addSubject.isPending || updateSubject.isPending}>
                {editingSubjectId ? "Save changes" : "Add subject"}
              </Btn>
              {editingSubjectId && (
                <Btn variant="ghost" onClick={resetSubjectForm}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.subjects ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{item.name}</span>
                <div className="flex items-center gap-2">
                  {item.category && <Pill tone="muted">{item.category}</Pill>}
                  <Btn variant="ghost" onClick={() => startEditingSubject(item)}>
                    Edit
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Academic years">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addYear.mutate();
            }}
          >
            <Field label="Year name">
              <input required className={inputClass} value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} />
            </Field>
            <Btn type="submit" variant="accent" disabled={addYear.isPending}>Create year</Btn>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.academicYears ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="flex items-center gap-2">
                  <span>{item.name}</span>
                  {item.is_current && <Pill tone="success">Current</Pill>}
                </span>
                <Btn variant="ghost" onClick={() => makeYearCurrent.mutate(item.id)} disabled={makeYearCurrent.isPending || item.is_current}>
                  Use this year
                </Btn>
              </li>
            ))}
            {(data?.academicYears ?? []).length === 0 && <p className="text-sm text-muted-foreground">No academic years yet.</p>}
          </ul>
        </Panel>

        <Panel title="Terms">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTerm.mutate();
            }}
          >
            <Field label="Academic year">
              <select className={inputClass} value={termForm.academic_year_id} onChange={(e) => setTermForm({ ...termForm, academic_year_id: e.target.value })}>
                <option value="">Select year</option>
                {(data?.academicYears ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Term name">
              <input required className={inputClass} value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} />
            </Field>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Start date">
                <input type="date" className={inputClass} value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} />
              </Field>
              <Field label="End date">
                <input type="date" className={inputClass} value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} />
              </Field>
            </div>
            <Btn type="submit" variant="accent" disabled={addTerm.isPending}>Create term</Btn>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.terms ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="flex items-center gap-2">
                  <span>{item.name}</span>
                  {item.is_current && <Pill tone="success">Current</Pill>}
                </span>
                <Btn variant="ghost" onClick={() => makeTermCurrent.mutate(item.id)} disabled={makeTermCurrent.isPending || item.is_current}>
                  Use this term
                </Btn>
              </li>
            ))}
            {(data?.terms ?? []).length === 0 && <p className="text-sm text-muted-foreground">No terms yet.</p>}
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
