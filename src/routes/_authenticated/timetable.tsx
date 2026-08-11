import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, Stat, inputClass } from "@/components/ui-kit";
import { ACADEMIC_MANAGERS, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { isModuleEnabled } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/timetable")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "timetable"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [{ title: "Timetable · EduTrack" }],
  }),
  component: TimetablePage,
});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SLOTS = [
  { label: "8:00", period: 1, start_time: "08:00", end_time: "08:40" },
  { label: "8:40", period: 2, start_time: "08:40", end_time: "09:20" },
  { label: "9:20", period: 3, start_time: "09:20", end_time: "10:00" },
  { label: "10:00", separator: "BREAK" },
  { label: "10:30", period: 4, start_time: "10:30", end_time: "11:10" },
  { label: "11:10", period: 5, start_time: "11:10", end_time: "11:50" },
  { label: "11:50", period: 6, start_time: "11:50", end_time: "12:30" },
  { label: "12:30", separator: "LUNCH" },
  { label: "2:00", period: 7, start_time: "14:00", end_time: "14:40" },
  { label: "2:40", period: 8, start_time: "14:40", end_time: "15:20" },
  { label: "3:20", period: 9, start_time: "15:20", end_time: "16:00" },
];

function TimetablePage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canEdit = hasAny(me?.roles, ACADEMIC_MANAGERS) || hasAny(me?.roles, ["dos"]);
  const [dayFilter, setDayFilter] = useState("1");
  const [classFilter, setClassFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    class_id: "",
    stream_id: "",
    subject_id: "",
    teacher_id: "",
    day_of_week: "1",
    period: "1",
    start_time: "08:00",
    end_time: "08:40",
    classroom: "",
  });

  const { data } = useQuery({
    queryKey: ["timetable", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [entries, classes, streams, subjects, teachers, terms, allocations, years] =
        await Promise.all([
          supabase.from("timetable_entries").select("*").eq("school_id", schoolId!).order("day_of_week").order("period"),
          supabase.from("classes").select("id, name, school_id").eq("school_id", schoolId!),
          supabase.from("streams").select("id, name, class_id, school_id").eq("school_id", schoolId!),
          supabase.from("subjects").select("id, name, school_id").eq("school_id", schoolId!),
          supabase.from("profiles").select("id, full_name, initials, school_id").eq("school_id", schoolId!),
          supabase.from("terms").select("id, name, academic_year_id, is_current, school_id").eq("school_id", schoolId!),
          supabase.from("teacher_allocations").select("id, teacher_id, subject_id, class_id, stream_id, school_id").eq("school_id", schoolId!),
          supabase.from("academic_years").select("id, name, is_current, school_id").eq("school_id", schoolId!),
        ]);
      return {
        entries: entries.data ?? [],
        classes: classes.data ?? [],
        streams: streams.data ?? [],
        subjects: subjects.data ?? [],
        teachers: teachers.data ?? [],
        terms: terms.data ?? [],
        allocations: allocations.data ?? [],
        years: years.data ?? [],
      };
    },
  });

  const currentTerm = data?.terms.find((term) => term.is_current) ?? data?.terms[0] ?? null;
  const currentYear = useMemo(() => {
    if (!data) return null;
    return data.years.find((year) => year.is_current) ?? (currentTerm ? data.years.find((year) => year.id === currentTerm.academic_year_id) ?? null : null);
  }, [data, currentTerm]);

  const classColumns = useMemo(() => {
    const base = (data?.classes ?? []).map((item) => ({ id: item.id, label: item.name, kind: "class" as const }));
    const streams = (data?.streams ?? [])
      .filter((stream) => !classFilter || stream.class_id === classFilter)
      .map((stream) => ({
        id: stream.id,
        label: `${data?.classes.find((c) => c.id === stream.class_id)?.name ?? "Class"} ${stream.name}`,
        kind: "stream" as const,
        class_id: stream.class_id,
      }));
    return classFilter ? streams : [...base, ...streams];
  }, [data?.classes, data?.streams, classFilter]);

  const dayEntries = useMemo(
    () =>
      (data?.entries ?? []).filter((entry) => {
        if (String(entry.day_of_week) !== dayFilter) return false;
        if (classFilter && entry.class_id !== classFilter) return false;
        if (streamFilter && entry.stream_id !== streamFilter) return false;
        return true;
      }),
    [data?.entries, dayFilter, classFilter, streamFilter],
  );

  const selectedEntry = useMemo(
    () => (selectedEntryId ? (data?.entries ?? []).find((entry) => entry.id === selectedEntryId) ?? null : null),
    [data?.entries, selectedEntryId],
  );

  const entriesByPeriod = useMemo(() => {
    const map = new Map<number, typeof dayEntries>();
    for (const entry of dayEntries) {
      const list = map.get(entry.period) ?? [];
      list.push(entry);
      map.set(entry.period, list);
    }
    return map;
  }, [dayEntries]);

  const byId = {
    className: new Map((data?.classes ?? []).map((item) => [item.id, item.name])),
    subjectName: new Map((data?.subjects ?? []).map((item) => [item.id, item.name])),
    teacher: new Map(
      (data?.teachers ?? []).map((item) => [
        item.id,
        { name: item.full_name, initials: item.initials?.trim() || initialsFromName(item.full_name) },
      ]),
    ),
  };

  const autoGenerate = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!currentTerm || !currentYear) throw new Error("Create an academic year and term first");

      const existing = data?.entries ?? [];
      const allocations = data?.allocations ?? [];
      const streams = data?.streams ?? [];
      const allocationTargets = allocations
        .map((allocation) => {
          const resolvedClassId =
            allocation.class_id ?? streams.find((stream) => stream.id === allocation.stream_id)?.class_id ?? null;
          return resolvedClassId
            ? {
                ...allocation,
                resolvedClassId,
              }
            : null;
        })
        .filter(Boolean) as Array<
        (typeof allocations)[number] & {
          resolvedClassId: string;
        }
      >;
      const slots = DAY_SLOTS.filter((slot) => "period" in slot) as Array<{
        label: string;
        period: number;
        start_time: string;
        end_time: string;
      }>;
      const generated: any[] = [];
      const teacherOccupied = new Set<string>(
        existing.map((entry) => JSON.stringify({ day: entry.day_of_week, period: entry.period, teacher: entry.teacher_id })),
      );
      const classOccupied = new Set<string>(
        existing.map((entry) => JSON.stringify({ day: entry.day_of_week, period: entry.period, class_id: entry.class_id })),
      );
      const streamOccupied = new Set<string>(
        (data?.entries ?? [])
          .filter((entry) => entry.stream_id)
          .map((entry) => JSON.stringify({ day: entry.day_of_week, period: entry.period, stream_id: entry.stream_id })),
      );

      const clearQuery = supabase
        .from("timetable_entries")
        .delete()
        .eq("school_id", schoolId)
        .eq("term_id", currentTerm.id);
      if (currentYear) {
        clearQuery.eq("academic_year_id", currentYear.id);
      }
      const { error: deleteError } = await clearQuery;
      if (deleteError) throw new Error(deleteError.message);

      let cursor = 0;
      for (const allocation of allocationTargets) {
        const lessonsToCreate = 1;
        for (let lessonIndex = 0; lessonIndex < lessonsToCreate; lessonIndex += 1) {
          const slot = findNextSlot({
            cursor,
            teacherOccupied,
            classOccupied,
            streamOccupied,
            teacherId: allocation.teacher_id,
            classId: allocation.resolvedClassId,
            streamId: allocation.stream_id,
            slots,
          });
          if (!slot) break;

          const targetDay = slot.day;
          const teacherKey = JSON.stringify({ day: targetDay, period: slot.period.period, teacher: allocation.teacher_id });
          const classKey = JSON.stringify({ day: targetDay, period: slot.period.period, class_id: allocation.resolvedClassId });
          const streamKey = allocation.stream_id
            ? JSON.stringify({ day: targetDay, period: slot.period.period, stream_id: allocation.stream_id })
            : null;
          generated.push({
            id: crypto.randomUUID(),
            school_id: schoolId,
            academic_year_id: currentYear.id,
            term_id: currentTerm.id,
            class_id: allocation.resolvedClassId,
            stream_id: allocation.stream_id,
            subject_id: allocation.subject_id,
            teacher_id: allocation.teacher_id,
            day_of_week: targetDay,
            period: slot.period.period,
            start_time: slot.period.start_time,
            end_time: slot.period.end_time,
            classroom: null,
          });
          teacherOccupied.add(teacherKey);
          classOccupied.add(classKey);
          if (streamKey) streamOccupied.add(streamKey);
          cursor = slot.nextCursor;
        }
      }

      if (!generated.length) throw new Error("No timetable slots could be generated from the current allocations");
      const { error } = await supabase.from("timetable_entries").insert(generated);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Timetable generated from allocations");
      queryClient.invalidateQueries({ queryKey: ["timetable", schoolId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runAutoGenerate = () => {
    autoGenerate.mutate();
  };

  const saveEntry = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!currentTerm || !currentYear) throw new Error("Create an academic year and term first");
      if (!form.class_id || !form.subject_id || !form.teacher_id) throw new Error("Class, subject and teacher are required");

      const payload = {
        school_id: schoolId,
        academic_year_id: currentYear.id,
        term_id: currentTerm.id,
        class_id: form.class_id,
        stream_id: form.stream_id || null,
        subject_id: form.subject_id,
        teacher_id: form.teacher_id,
        day_of_week: Number(form.day_of_week),
        period: Number(form.period),
        start_time: form.start_time,
        end_time: form.end_time,
        classroom: form.classroom || null,
      };

      const { error } = form.id
        ? await supabase.from("timetable_entries").update(payload).eq("id", form.id)
        : await supabase.from("timetable_entries").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Timetable saved");
      queryClient.invalidateQueries({ queryKey: ["timetable", schoolId] });
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timetable", schoolId] }),
  });

  const stats = {
    required: data?.allocations.length ?? 0,
    scheduled: dayEntries.length,
    conflicts: countConflicts(dayEntries),
  };

  function resetForm() {
    setSelectedEntryId(null);
    setForm({
      id: "",
      class_id: "",
      stream_id: "",
      subject_id: "",
      teacher_id: "",
      day_of_week: "1",
      period: "1",
      start_time: "08:00",
      end_time: "08:40",
      classroom: "",
    });
  }

  function startEditing(entry: any) {
    setSelectedEntryId(entry.id);
    setForm({
      id: entry.id,
      class_id: entry.class_id,
      stream_id: entry.stream_id ?? "",
      subject_id: entry.subject_id,
      teacher_id: entry.teacher_id,
      day_of_week: String(entry.day_of_week),
      period: String(entry.period),
      start_time: entry.start_time,
      end_time: entry.end_time,
      classroom: entry.classroom ?? "",
    });
  }

  return (
    <div>
      <PageHeader
        title="Timetable"
        description="Screenshot-style timetable with classes across the top and time down the left."
        actions={
          canEdit ? (
            <>
              <Btn variant="ghost" onClick={runAutoGenerate} disabled={autoGenerate.isPending}>
                Auto-generate from allocations
              </Btn>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Allocations" value={stats.required} />
        <Stat label="Lessons on day" value={stats.scheduled} />
        <Stat label="Conflicts" value={stats.conflicts} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Panel title="Daily timetable">
          <div className="mb-3 grid gap-3 md:grid-cols-4">
            <Field label="Class">
              <select className={inputClass} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="">All classes</option>
                {(data?.classes ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stream">
              <select className={inputClass} value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)}>
                <option value="">All streams</option>
                {(data?.streams ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Day">
              <select className={inputClass} value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
                {DAYS.map((day, index) => (
                  <option key={day} value={String(index + 1)}>
                    {day}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Btn variant="ghost" onClick={runAutoGenerate} disabled={autoGenerate.isPending}>
                Auto-generate from allocations
              </Btn>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-border text-[11px] sm:text-sm">
              <thead>
                <tr>
                  <th className="border border-border px-2 py-2 text-center font-semibold">Time</th>
                  <th className="border border-border px-2 py-2 text-center font-semibold" colSpan={Math.max(classColumns.length, 1)}>
                    {DAYS[Number(dayFilter) - 1]}
                  </th>
                </tr>
                <tr>
                  <th className="border border-border px-2 py-2 text-center font-semibold">Time</th>
                  {classColumns.map((column) => (
                    <th key={column.id} className="border border-border px-2 py-2 text-center font-semibold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_SLOTS.map((slot, index) => {
                  if ("separator" in slot) {
                    return (
                      <tr key={`${slot.separator}-${index}`} className="bg-muted/20">
                        <td className="border border-border px-2 py-2 text-center font-semibold">{slot.label}</td>
                        <td className="border border-border px-2 py-2 text-center font-semibold" colSpan={Math.max(classColumns.length, 1)}>
                          {slot.separator}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={slot.period}>
                      <td className="border border-border px-2 py-2 text-center font-semibold leading-tight">
                        {slot.label}
                      </td>
                      {classColumns.map((column) => {
                        const entry = (entriesByPeriod.get(slot.period) ?? []).find((item) =>
                          column.kind === "stream"
                            ? item.stream_id === column.id
                            : item.class_id === column.id && !item.stream_id,
                        );
                        return (
                          <td key={column.id} className="border border-border p-0 align-top">
                            {entry ? (
                              <button
                                type="button"
                                onClick={() => startEditing(entry)}
                                className="flex min-h-[46px] w-full flex-col justify-center px-2 py-1 text-left hover:bg-muted/40"
                              >
                                <span className="font-semibold leading-tight">{byId.subjectName.get(entry.subject_id) ?? "Subject"}</span>
                                <span className="text-[10px] leading-tight text-muted-foreground">
                                  {teacherInitials(byId, entry.teacher_id)}
                                  {entry.classroom ? ` ${entry.classroom}` : ""}
                                </span>
                              </button>
                            ) : (
                              <div className="flex min-h-[46px] items-center justify-center px-2 py-1 text-center text-muted-foreground" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title={form.id ? "Edit lesson" : "Create lesson"}>
            {!canEdit ? (
              <p className="text-sm text-muted-foreground">You can view the timetable here, but editing is reserved for DOS and academic managers.</p>
            ) : (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEntry.mutate();
                }}
              >
                <Field label="Class">
                  <select className={inputClass} value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, stream_id: "" })}>
                    <option value="">Select</option>
                    {(data?.classes ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Stream">
                  <select className={inputClass} value={form.stream_id} onChange={(e) => setForm({ ...form, stream_id: e.target.value })}>
                    <option value="">Whole class</option>
                    {(data?.streams ?? []).filter((stream) => !form.class_id || stream.class_id === form.class_id).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subject">
                  <select className={inputClass} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                    <option value="">Select</option>
                    {(data?.subjects ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Teacher">
                  <select className={inputClass} value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
                    <option value="">Select</option>
                    {(data?.teachers ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name} ({teacherInitials(byId, item.id)})
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Day">
                    <select className={inputClass} value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
                      {DAYS.map((day, index) => (
                        <option key={day} value={String(index + 1)}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Period">
                    <select className={inputClass} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                      {DAY_SLOTS.filter((slot) => "period" in slot).map((slot) => (
                        <option key={slot.period} value={String(slot.period)}>
                          P{slot.period}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Start time">
                    <input className={inputClass} type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </Field>
                  <Field label="End time">
                    <input className={inputClass} type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </Field>
                </div>
                <Field label="Room / classroom">
                  <input className={inputClass} value={form.classroom} onChange={(e) => setForm({ ...form, classroom: e.target.value })} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Btn type="submit" variant="accent">
                    Save lesson
                  </Btn>
                  {form.id && (
                    <Btn type="button" variant="ghost" onClick={resetForm}>
                      Cancel
                    </Btn>
                  )}
                </div>
              </form>
            )}
          </Panel>

          <Panel title="Selected lesson">
            {!selectedEntry ? (
              <p className="text-sm text-muted-foreground">Click a timetable cell to edit it.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-semibold">{byId.subjectName.get(selectedEntry.subject_id) ?? "Subject"}</p>
                <p className="text-xs text-muted-foreground">{teacherInitials(byId, selectedEntry.teacher_id)}</p>
                <p className="text-xs text-muted-foreground">
                  {DAYS[selectedEntry.day_of_week - 1]} · P{selectedEntry.period} · {selectedEntry.start_time} - {selectedEntry.end_time}
                </p>
                <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => startEditing(selectedEntry)}>
                    Edit
                  </Btn>
                  <Btn variant="ghost" onClick={() => deleteEntry.mutate(selectedEntry.id)}>
                    Delete
                  </Btn>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}


function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function teacherInitials(byId: { teacher: Map<string, { name: string; initials: string }> }, teacherId: string) {
  return byId.teacher.get(teacherId)?.initials ?? "??";
}

function findNextSlot({
  cursor,
  teacherOccupied,
  classOccupied,
  streamOccupied,
  teacherId,
  classId,
  streamId,
  slots,
}: {
  cursor: number;
  teacherOccupied: Set<string>;
  classOccupied: Set<string>;
  streamOccupied: Set<string>;
  teacherId: string;
  classId: string;
  streamId: string | null;
  slots: Array<{ label: string; period: number; start_time: string; end_time: string }>;
}) {
  for (let offset = 0; offset < slots.length; offset += 1) {
    const index = (cursor + offset) % slots.length;
    const period = slots[index];
    for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex += 1) {
      const day = dayIndex + 1;
      const teacherKey = JSON.stringify({ day, period: period.period, teacher: teacherId });
      const classKey = JSON.stringify({ day, period: period.period, class_id: classId });
      const streamKey = streamId ? JSON.stringify({ day, period: period.period, stream_id: streamId }) : null;
      if (teacherOccupied.has(teacherKey) || classOccupied.has(classKey) || (streamKey ? streamOccupied.has(streamKey) : false)) {
        continue;
      }
      return { period, day, nextCursor: index + 1 };
    }
  }
  return null;
}

function countConflicts(entries: any[]) {
  const seen = new Set<string>();
  let conflicts = 0;
  for (const entry of entries) {
    const key = JSON.stringify({ day: entry.day_of_week, period: entry.period, teacher: entry.teacher_id, class: entry.class_id, stream: entry.stream_id ?? "" });
    if (seen.has(key)) conflicts += 1;
    seen.add(key);
  }
  return conflicts;
}
