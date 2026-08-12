import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  },
  head: () => ({
    meta: [{ title: "Timetable Â· EduTrack" }],
  }),
  component: TimetablePage,
});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type PeriodRow = {
  id: string;
  period_order: number;
  label: string;
  start_time: string | null;
  end_time: string | null;
  is_break: boolean;
  is_lunch: boolean;
};

type TimetableSettingsRow = {
  break_start: string | null;
  break_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
};

type PeriodDraft = PeriodRow & {
  id: string;
};

function TimetablePage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const { data: timetableEnabled = true, isLoading: isModuleLoading } = useQuery({
    queryKey: ["module-enabled", schoolId, "timetable"],
    enabled: !!schoolId,
    queryFn: async () => isModuleEnabled(supabase, schoolId, "timetable"),
  });
  const canEdit = hasAny(me?.roles, ACADEMIC_MANAGERS) || hasAny(me?.roles, ["dos"]);
  const [dayFilter, setDayFilter] = useState("1");
  const [visibleDays, setVisibleDays] = useState<string[]>(DAYS.map((_, index) => String(index + 1)));
  const [classFilter, setClassFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<TimetableSettingsRow>({
    break_start: null,
    break_end: null,
    lunch_start: null,
    lunch_end: null,
  });
  const [periodDrafts, setPeriodDrafts] = useState<PeriodDraft[]>([]);
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
      const [entries, classes, streams, subjects, teachers, terms, allocations, years, settings, periods] =
        await Promise.all([
          supabase.from("timetable_entries").select("*").eq("school_id", schoolId!).order("day_of_week").order("period"),
          supabase.from("classes").select("id, name, school_id").eq("school_id", schoolId!),
          supabase.from("streams").select("id, name, class_id, school_id").eq("school_id", schoolId!),
          supabase.from("subjects").select("id, name, school_id").eq("school_id", schoolId!),
          supabase.from("profiles").select("id, full_name, initials, school_id").eq("school_id", schoolId!),
          supabase.from("terms").select("id, name, academic_year_id, is_current, school_id").eq("school_id", schoolId!),
          supabase.from("teacher_allocations").select("id, teacher_id, subject_id, class_id, stream_id, school_id").eq("school_id", schoolId!),
          supabase.from("academic_years").select("id, name, is_current, school_id").eq("school_id", schoolId!),
          supabase
            .from("timetable_settings" as any)
            .select("break_start, break_end, lunch_start, lunch_end")
            .eq("school_id", schoolId!)
            .maybeSingle(),
          supabase
            .from("timetable_periods" as any)
            .select("id, period_order, label, start_time, end_time, is_break, is_lunch, is_active")
            .eq("school_id", schoolId!)
            .order("period_order"),
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
        settings: settings.data ?? null,
        periods: periods.data ?? [],
      };
    },
  });

  const currentTerm = data?.terms.find((term) => term.is_current) ?? data?.terms[0] ?? null;
  const currentYear = useMemo(() => {
    if (!data) return null;
    return data.years.find((year) => year.is_current) ?? (currentTerm ? data.years.find((year) => year.id === currentTerm.academic_year_id) ?? null : null);
  }, [data, currentTerm]);
  const periodRows = useMemo<PeriodRow[]>(() => {
    const rows = (data?.periods ?? []).filter((item: PeriodRow) => item.is_active !== false);
    if (rows.length) return rows;
    return [
      { id: "1", period_order: 1, label: "8:00", start_time: "08:00", end_time: "08:40", is_break: false, is_lunch: false },
      { id: "2", period_order: 2, label: "8:40", start_time: "08:40", end_time: "09:20", is_break: false, is_lunch: false },
      { id: "3", period_order: 3, label: "9:20", start_time: "09:20", end_time: "10:00", is_break: false, is_lunch: false },
      { id: "4", period_order: 4, label: "BREAK", start_time: null, end_time: null, is_break: true, is_lunch: false },
      { id: "5", period_order: 5, label: "10:30", start_time: "10:30", end_time: "11:10", is_break: false, is_lunch: false },
      { id: "6", period_order: 6, label: "11:10", start_time: "11:10", end_time: "11:50", is_break: false, is_lunch: false },
      { id: "7", period_order: 7, label: "11:50", start_time: "11:50", end_time: "12:30", is_break: false, is_lunch: false },
      { id: "8", period_order: 8, label: "LUNCH", start_time: null, end_time: null, is_break: false, is_lunch: true },
      { id: "9", period_order: 9, label: "2:00", start_time: "14:00", end_time: "14:40", is_break: false, is_lunch: false },
      { id: "10", period_order: 10, label: "2:40", start_time: "14:40", end_time: "15:20", is_break: false, is_lunch: false },
      { id: "11", period_order: 11, label: "3:20", start_time: "15:20", end_time: "16:00", is_break: false, is_lunch: false },
    ];
  }, [data?.periods]);

  const classStreamGroups = useMemo(() => {
    const classes = [...(data?.classes ?? [])].filter((item) => !classFilter || item.id === classFilter);
    return classes.map((item) => ({
      id: item.id,
      label: item.name,
      streams: [...(data?.streams ?? [])]
        .filter((stream) => stream.class_id === item.id)
        .filter((stream) => !streamFilter || stream.id === streamFilter)
        .map((stream) => ({
          id: stream.id,
          label: stream.name,
        })),
    }));
  }, [data?.classes, data?.streams, classFilter, streamFilter]);

  const streamColumns = useMemo(
    () =>
      classStreamGroups.flatMap((group) =>
        group.streams.map((stream) => ({
          key: `${group.id}:${stream.id}`,
          classId: group.id,
          classLabel: group.label,
          streamId: stream.id,
          streamLabel: stream.label,
        })),
      ),
    [classStreamGroups],
  );

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
  const visibleDayLabels = useMemo(
    () => visibleDays.map((day) => ({ day, label: DAYS[Number(day) - 1] ?? `Day ${day}` })),
    [visibleDays],
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
  const lessonPeriods = useMemo(() => periodRows.filter((row) => !row.is_break && !row.is_lunch), [periodRows]);
  const timetableColumnCount = streamColumns.length || classStreamGroups.length;

  useEffect(() => {
    if (!data) return;
    setSettingsDraft({
      break_start: data.settings?.break_start ?? null,
      break_end: data.settings?.break_end ?? null,
      lunch_start: data.settings?.lunch_start ?? null,
      lunch_end: data.settings?.lunch_end ?? null,
    });
    setPeriodDrafts(
      [...periodRows]
        .sort((a, b) => a.period_order - b.period_order)
        .map((row) => ({
          ...row,
          id: row.id,
        })),
    );
  }, [data, periodRows]);

  const saveEntry = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!currentTerm || !currentYear) throw new Error("Create an academic year and term first");
      if (!form.class_id || !form.subject_id || !form.teacher_id) throw new Error("Class, subject and teacher are required");
      const classStreams = (data?.streams ?? []).filter((stream) => stream.class_id === form.class_id);
      if (classStreams.length && !form.stream_id) {
        throw new Error("Select a stream for this class. Streams must be scheduled separately.");
      }
      const conflictingLesson = (data?.entries ?? []).find((entry) => {
        if (form.id && entry.id === form.id) return false;
        return (
          entry.day_of_week === Number(form.day_of_week) &&
          entry.period === Number(form.period) &&
          entry.teacher_id === form.teacher_id &&
          entry.stream_id !== form.stream_id
        );
      });
      if (conflictingLesson) {
        throw new Error("This teacher is already assigned to another stream in that period.");
      }

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

  const saveTimings = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const { error: settingsError } = await supabase.from("timetable_settings" as any).upsert(
        {
          school_id: schoolId,
          break_start: settingsDraft.break_start,
          break_end: settingsDraft.break_end,
          lunch_start: settingsDraft.lunch_start,
          lunch_end: settingsDraft.lunch_end,
        },
        { onConflict: "school_id" },
      );
      if (settingsError) throw new Error(settingsError.message);

      for (const row of periodDrafts) {
        const { error } = await supabase.from("timetable_periods" as any).upsert(
          {
            id: row.id,
            school_id: schoolId,
            period_order: Number(row.period_order),
            label: row.label,
            start_time: row.start_time,
            end_time: row.end_time,
            is_break: row.is_break,
            is_lunch: row.is_lunch,
            is_active: true,
          },
          { onConflict: "id" },
        );
        if (error) throw new Error(error.message);
      }

      const activeIds = new Set(periodDrafts.map((row) => row.id));
      const inactiveRows = (data?.periods ?? []).filter((row: any) => !activeIds.has(row.id));
      if (inactiveRows.length) {
        const { error } = await supabase
          .from("timetable_periods" as any)
          .update({ is_active: false })
          .eq("school_id", schoolId)
          .in(
            "id",
            inactiveRows.map((row: any) => row.id),
          );
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Timetable timings saved");
      queryClient.invalidateQueries({ queryKey: ["timetable", schoolId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = {
    required: data?.allocations.length ?? 0,
    scheduled: dayEntries.length,
    conflicts: countConflicts(dayEntries),
  };

  if (isModuleLoading) {
    return (
      <div>
        <PageHeader title="Timetable" description="Loading timetable access and schedule data." />
        <Panel title="Loading timetable">
          <p className="text-sm text-muted-foreground">
            Checking timetable access for your school.
          </p>
        </Panel>
      </div>
    );
  }

  if (!timetableEnabled) {
    return (
      <div>
        <PageHeader title="Timetable" description="Schedule lessons, periods, and room allocations." />
        <Panel title="Timetable module unavailable">
          <p className="text-sm text-muted-foreground">
            The timetable module is turned off for this school. Nothing is broken, but timetable
            tools are hidden until the module is enabled.
          </p>
        </Panel>
      </div>
    );
  }

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

  function addPeriodDraft() {
    const nextOrder = (periodDrafts[periodDrafts.length - 1]?.period_order ?? 0) + 1;
    setPeriodDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        period_order: nextOrder,
        label: `Period ${nextOrder}`,
        start_time: null,
        end_time: null,
        is_break: false,
        is_lunch: false,
      },
    ]);
  }

  function removePeriodDraft(id: string) {
    setPeriodDrafts((current) => current.filter((row) => row.id !== id));
  }

  function movePeriodDraft(id: string, direction: "up" | "down") {
    setPeriodDrafts((current) => {
      const index = current.findIndex((row) => row.id === id);
      if (index < 0) return current;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, rowIndex) => ({ ...row, period_order: rowIndex + 1 }));
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
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {DAYS.map((day, index) => {
              const value = String(index + 1);
              const checked = visibleDays.includes(value);
              return (
                <label key={day} className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setVisibleDays((current) =>
                        current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort((a, b) => Number(a) - Number(b)),
                      )
                    }
                  />
                  <span>{day}</span>
                </label>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <div className="space-y-6">
      {visibleDayLabels.map(({ day, label }) => {
                const dayNumber = Number(day);
                const entriesForDay = (data?.entries ?? []).filter((entry) => {
                  if (entry.day_of_week !== dayNumber) return false;
                  if (classFilter && entry.class_id !== classFilter) return false;
                  if (streamFilter && entry.stream_id !== streamFilter) return false;
                  return true;
                });
                const entriesByPeriodForDay = new Map<number, typeof entriesForDay>();
                for (const entry of entriesForDay) {
                  const list = entriesByPeriodForDay.get(entry.period) ?? [];
                  list.push(entry);
                  entriesByPeriodForDay.set(entry.period, list);
                }

                return (
                  <table key={day} className="min-w-full border border-border text-[11px] sm:text-sm">
                    <thead>
                      <tr>
                        <th className="border border-border px-2 py-2 text-center font-semibold">Time</th>
                        <th className="border border-border px-2 py-2 text-center font-semibold" colSpan={Math.max(timetableColumnCount, 1)}>
                          {label}
                        </th>
                      </tr>
                      <tr>
                        <th className="border border-border px-2 py-2 text-center font-semibold">Class</th>
                        <th className="border border-border px-2 py-2 text-center font-semibold" colSpan={Math.max(timetableColumnCount, 1)}>
                          Streams
                        </th>
                      </tr>
                      <tr>
                        <th className="border border-border px-2 py-2 text-center font-semibold">Class</th>
                        {classStreamGroups.length ? (
                          classStreamGroups.map((group) => (
                            <th key={group.id} className="border border-border px-2 py-2 text-center font-semibold" colSpan={Math.max(group.streams.length, 1)}>
                              {group.label}
                            </th>
                          ))
                        ) : (
                          <th className="border border-border px-2 py-2 text-center font-semibold">No classes</th>
                        )}
                      </tr>
                      <tr>
                        <th className="border border-border px-2 py-2 text-center font-semibold">Stream</th>
                        {streamColumns.length ? (
                          streamColumns.map((column) => (
                            <th key={column.key} className="border border-border px-2 py-2 text-center font-semibold">
                              {column.streamLabel}
                            </th>
                          ))
                        ) : (
                          <th className="border border-border px-2 py-2 text-center font-semibold">No streams</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {periodRows.map((slot, index) => {
                        if (slot.is_break || slot.is_lunch) {
                          return (
                            <tr key={`${day}-${slot.label}-${index}`} className="bg-muted/20">
                              <td className="border border-border px-2 py-2 text-center font-semibold">{slot.label}</td>
                              <td className="border border-border px-2 py-2 text-center font-semibold" colSpan={Math.max(timetableColumnCount, 1)}>
                                {slot.is_break ? "BREAK" : "LUNCH"}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={`${day}-${slot.period_order}`}>
                            <td className="border border-border px-2 py-2 text-center font-semibold leading-tight">
                              {slot.label}
                            </td>
                            {streamColumns.length ? (
                              streamColumns.map((column) => {
                                const entry =
                                  (entriesByPeriodForDay.get(slot.period_order) ?? []).find(
                                    (item) => item.class_id === column.classId && item.stream_id === column.streamId,
                                  ) ?? null;
                                return (
                                  <td key={column.key} className="border border-border p-0 align-top">
                                    {entry ? (
                                      <button
                                        type="button"
                                        onClick={() => startEditing(entry)}
                                        className="flex min-h-[46px] w-full flex-col justify-center px-2 py-1 text-left hover:bg-muted/40"
                                      >
                                        <span className="font-semibold leading-tight">
                                          {byId.subjectName.get(entry.subject_id) ?? "Subject"}
                                        </span>
                                        <span className="text-[10px] leading-tight text-muted-foreground">
                                          {column.classLabel} {column.streamLabel}
                                          {" · "}
                                          {teacherInitials(byId, entry.teacher_id)}
                                          {entry.classroom ? ` · ${entry.classroom}` : ""}
                                        </span>
                                      </button>
                                    ) : (
                                      <div className="flex min-h-[46px] items-center justify-center px-2 py-1 text-center text-muted-foreground" />
                                    )}
                                  </td>
                                );
                              })
                            ) : (
                              <td className="border border-border px-2 py-2 text-center text-muted-foreground" colSpan={1}>
                                No streams available
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })}
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Timetable timings">
            {!canEdit ? (
              <p className="text-sm text-muted-foreground">Only DOS and academic managers can adjust timetable periods.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Break start">
                    <input
                      className={inputClass}
                      type="time"
                      value={settingsDraft.break_start ?? ""}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, break_start: e.target.value || null }))}
                    />
                  </Field>
                  <Field label="Break end">
                    <input
                      className={inputClass}
                      type="time"
                      value={settingsDraft.break_end ?? ""}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, break_end: e.target.value || null }))}
                    />
                  </Field>
                  <Field label="Lunch start">
                    <input
                      className={inputClass}
                      type="time"
                      value={settingsDraft.lunch_start ?? ""}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, lunch_start: e.target.value || null }))}
                    />
                  </Field>
                  <Field label="Lunch end">
                    <input
                      className={inputClass}
                      type="time"
                      value={settingsDraft.lunch_end ?? ""}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, lunch_end: e.target.value || null }))}
                    />
                  </Field>
                </div>

                <div className="space-y-3">
                  {periodDrafts.map((row, index) => (
                    <div key={row.id} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {row.is_break ? "Break" : row.is_lunch ? "Lunch" : `Period ${row.period_order}`}
                        </p>
                        <Pill tone={row.is_break || row.is_lunch ? "warning" : "muted"}>
                          {row.is_break ? "Break" : row.is_lunch ? "Lunch" : "Lesson"}
                        </Pill>
                      </div>
                      <div className="mb-3 flex justify-end">
                        <div className="flex gap-2">
                          <Btn type="button" variant="ghost" onClick={() => movePeriodDraft(row.id, "up")} disabled={index === 0}>
                            Up
                          </Btn>
                          <Btn
                            type="button"
                            variant="ghost"
                            onClick={() => movePeriodDraft(row.id, "down")}
                            disabled={index === periodDrafts.length - 1}
                          >
                            Down
                          </Btn>
                          <Btn type="button" variant="ghost" onClick={() => removePeriodDraft(row.id)}>
                            Remove
                          </Btn>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Title">
                          <input
                            className={inputClass}
                            value={row.label}
                            onChange={(e) =>
                              setPeriodDrafts((current) =>
                                current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: e.target.value } : item)),
                              )
                            }
                          />
                        </Field>
                        <Field label="Order">
                          <input
                            className={inputClass}
                            type="number"
                            min={1}
                            value={row.period_order}
                            onChange={(e) =>
                              setPeriodDrafts((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, period_order: Number(e.target.value) || item.period_order } : item,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Start time">
                          <input
                            className={inputClass}
                            type="time"
                            value={row.start_time ?? ""}
                            onChange={(e) =>
                              setPeriodDrafts((current) =>
                                current.map((item, itemIndex) => (itemIndex === index ? { ...item, start_time: e.target.value || null } : item)),
                              )
                            }
                          />
                        </Field>
                        <Field label="End time">
                          <input
                            className={inputClass}
                            type="time"
                            value={row.end_time ?? ""}
                            onChange={(e) =>
                              setPeriodDrafts((current) =>
                                current.map((item, itemIndex) => (itemIndex === index ? { ...item, end_time: e.target.value || null } : item)),
                              )
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Btn type="button" variant="ghost" onClick={addPeriodDraft}>
                    Add period
                  </Btn>
                  <Btn type="button" variant="accent" onClick={() => saveTimings.mutate()} disabled={saveTimings.isPending}>
                    Save timings
                  </Btn>
                </div>
              </div>
            )}
          </Panel>

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
                      {lessonPeriods.map((slot) => (
                        <option key={slot.period_order} value={String(slot.period_order)}>
                          P{slot.period_order}
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
                  {DAYS[selectedEntry.day_of_week - 1]} Â· P{selectedEntry.period} Â· {selectedEntry.start_time} - {selectedEntry.end_time}
                </p>
                <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => startEditing(selectedEntry)}>
                    Edit
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
  preferredDay,
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
  preferredDay: number;
  slots: Array<{ label: string; period_order: number; start_time: string; end_time: string }>;
}) {
  const candidates = DAYS.flatMap((_, dayIndex) =>
    slots.map((period) => ({
      day: dayIndex + 1,
      period,
    })),
  );

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const index = (cursor + offset) % candidates.length;
    const candidate = candidates[index];
    if (candidate.day !== preferredDay) continue;
    const teacherKey = JSON.stringify({ day: candidate.day, period: candidate.period.period_order, teacher: teacherId });
    const classKey = JSON.stringify({ day: candidate.day, period: candidate.period.period_order, class_id: classId });
    const streamKey = streamId ? JSON.stringify({ day: candidate.day, period: candidate.period.period_order, stream_id: streamId }) : null;
    if (teacherOccupied.has(teacherKey) || classOccupied.has(classKey) || (streamKey ? streamOccupied.has(streamKey) : false)) {
      continue;
    }
    return { period: candidate.period, day: candidate.day, nextCursor: index + 1 };
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
