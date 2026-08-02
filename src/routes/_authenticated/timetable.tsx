import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ACADEMIC_MANAGERS, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => ({
    meta: [
      { title: "Timetable · EduTrack" },
      {
        name: "description",
        content: "Build conflict-free class timetables and publish them to teachers.",
      },
      { property: "og:title", content: "Timetable · EduTrack" },
      {
        property: "og:description",
        content: "Weekly timetable builder with teacher and room clash protection.",
      },
    ],
  }),
  component: TimetablePage,
});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function TimetablePage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canEdit = hasAny(me?.roles, ACADEMIC_MANAGERS);
  const [classFilter, setClassFilter] = useState("");
  const [form, setForm] = useState({
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
      const [entries, classes, streams, subjects, teachers, terms] = await Promise.all([
        supabase.from("timetable_entries").select("*").order("day_of_week").order("period"),
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("streams").select("id, name, class_id"),
        supabase.from("subjects").select("id, name").order("position"),
        supabase.from("profiles").select("id, full_name").order("full_name"),
        supabase.from("terms").select("id, name, academic_year_id, is_current"),
      ]);
      return {
        entries: entries.data ?? [],
        classes: classes.data ?? [],
        streams: streams.data ?? [],
        subjects: subjects.data ?? [],
        teachers: teachers.data ?? [],
        terms: terms.data ?? [],
      };
    },
  });

  const currentTerm = data?.terms.find((t) => t.is_current) ?? data?.terms[0] ?? null;

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!currentTerm) throw new Error("Create an academic year and term first");
      if (!form.class_id || !form.subject_id || !form.teacher_id)
        throw new Error("Class, subject and teacher are required");
      const { error } = await supabase.from("timetable_entries").insert({
        school_id: schoolId,
        academic_year_id: currentTerm.academic_year_id,
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
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Lesson scheduled");
      queryClient.invalidateQueries({ queryKey: ["timetable", schoolId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Lesson removed");
      queryClient.invalidateQueries({ queryKey: ["timetable", schoolId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async (isPublished: boolean) => {
      const { error } = await supabase
        .from("timetable_entries")
        .update({ is_published: isPublished })
        .eq("school_id", schoolId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Timetable visibility updated");
      queryClient.invalidateQueries({ queryKey: ["timetable", schoolId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(
    () => (data?.entries ?? []).filter((e) => (classFilter ? e.class_id === classFilter : true)),
    [data, classFilter],
  );

  const label = (list: { id: string; name: string }[] | undefined, id: string | null) =>
    list?.find((x) => x.id === id)?.name ?? "—";
  const teacherName = (id: string | null) =>
    data?.teachers.find((t) => t.id === id)?.full_name ?? "—";

  const periods = Array.from(new Set(visible.map((e) => e.period))).sort((a, b) => a - b);

  return (
    <div>
      <PageHeader
        title="Timetable"
        description="A teacher, a stream and a room can each hold only one lesson per period — clashes are rejected."
        actions={
          canEdit ? (
            <>
              <Btn variant="accent" onClick={() => publish.mutate(true)}>
                Publish
              </Btn>
              <Btn variant="ghost" onClick={() => publish.mutate(false)}>
                Unpublish
              </Btn>
            </>
          ) : undefined
        }
      />

      {canEdit && (
        <Panel title="Schedule a lesson" className="mb-4">
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              addEntry.mutate();
            }}
          >
            <Field label="Class">
              <select
                className={inputClass}
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value, stream_id: "" })}
              >
                <option value="">Select</option>
                {(data?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stream">
              <select
                className={inputClass}
                value={form.stream_id}
                onChange={(e) => setForm({ ...form, stream_id: e.target.value })}
              >
                <option value="">Whole class</option>
                {(data?.streams ?? [])
                  .filter((s) => !form.class_id || s.class_id === form.class_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Subject">
              <select
                className={inputClass}
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              >
                <option value="">Select</option>
                {(data?.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Teacher">
              <select
                className={inputClass}
                value={form.teacher_id}
                onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
              >
                <option value="">Select</option>
                {(data?.teachers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Day">
              <select
                className={inputClass}
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Period">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </Field>
            <Field label="Start">
              <input
                type="time"
                className={inputClass}
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                className={inputClass}
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </Field>
            <Field label="Classroom">
              <input
                className={inputClass}
                value={form.classroom}
                onChange={(e) => setForm({ ...form, classroom: e.target.value })}
              />
            </Field>
            <div className="flex items-end">
              <Btn type="submit" variant="accent" disabled={addEntry.isPending}>
                Add lesson
              </Btn>
            </div>
          </form>
        </Panel>
      )}

      <Panel>
        <select
          className={`${inputClass} mb-3 max-w-xs`}
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All classes</option>
          {(data?.classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Period</th>
                {DAYS.map((day) => (
                  <th key={day} className="pb-2">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period} className="border-t border-border align-top">
                  <td className="py-2 font-semibold">{period}</td>
                  {DAYS.map((day, index) => {
                    const cell = visible.filter(
                      (e) => e.day_of_week === index + 1 && e.period === period,
                    );
                    return (
                      <td key={day} className="py-2 pr-2">
                        {cell.map((entry) => (
                          <div key={entry.id} className="mb-1 rounded-md border border-border p-2">
                            <p className="font-medium">{label(data?.subjects, entry.subject_id)}</p>
                            <p className="text-xs text-muted-foreground">
                              {teacherName(entry.teacher_id)} ·{" "}
                              {label(data?.classes, entry.class_id)}{" "}
                              {entry.stream_id ? label(data?.streams, entry.stream_id) : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.start_time}–{entry.end_time}{" "}
                              {entry.classroom ? `· ${entry.classroom}` : ""}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <Pill tone={entry.is_published ? "success" : "muted"}>
                                {entry.is_published ? "published" : "draft"}
                              </Pill>
                              {canEdit && (
                                <button
                                  onClick={() => removeEntry.mutate(entry.id)}
                                  className="text-xs text-destructive hover:underline"
                                >
                                  remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {periods.length === 0 && (
                <tr>
                  <td colSpan={DAYS.length + 1} className="py-6 text-center text-muted-foreground">
                    No lessons scheduled yet.
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
