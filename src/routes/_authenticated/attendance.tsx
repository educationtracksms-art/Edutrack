import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, ResponsiveTable, inputClass } from "@/components/ui-kit";
import { isModuleEnabled } from "@/lib/modules";
import { deleteAttendanceSummary } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();

    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "attendance"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Attendance - EduTrack" },
      {
        name: "description",
        content: "Edit learner attendance totals and feed report card attendance summaries.",
      },
      { property: "og:title", content: "Attendance - EduTrack" },
      {
        property: "og:description",
        content: "Attendance summary editor with class-based access controls.",
      },
    ],
  }),
  component: AttendancePage,
});

type SummaryDraft = { daysPresent: string; daysAbsent: string; totalDays: string };
type RollCallStatus = "present" | "absent";

function attendanceCount(label: string, value: string) {
  if (!value.trim()) throw new Error(`Enter ${label} before saving the attendance summary`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a whole number of zero or more`);
  }
  return parsed;
}

function AttendancePage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const isClassTeacher = hasAny(me?.roles, ["class_teacher"]);
  const canSeeAllStudents = hasAny(me?.roles, [
    "dos",
    "head_teacher",
    "deputy_head_teacher",
    "school_admin",
    "super_admin",
  ]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classFilter, setClassFilter] = useState("");
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, SummaryDraft>>({});
  const [rollCall, setRollCall] = useState<Record<string, RollCallStatus>>({});
  const deleteSummaryFn = useServerFn(deleteAttendanceSummary);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", schoolId, date],
    enabled: !!schoolId,
    queryFn: async () => {
      const [students, classes, streams, terms] = await Promise.all([
        supabase
          .from("students")
          .select("id, full_name, class_id, stream_id")
          .is("deleted_at", null)
          .order("full_name"),
        supabase.from("classes").select("id, name, class_teacher_id").order("name"),
        supabase.from("streams").select("id, name, class_id, stream_teacher_id").order("name"),
        supabase.from("terms").select("id, is_current"),
      ]);

      return {
        students: students.data ?? [],
        classes: classes.data ?? [],
        streams: streams.data ?? [],
        // The system administrator controls the active term. Never fall back to an arbitrary term.
        term: (terms.data ?? []).find((t) => t.is_current) ?? null,
      };
    },
  });

  const { data: summaries } = useQuery({
    queryKey: ["attendance-summaries", schoolId, data?.term?.id, classFilter],
    enabled: !!schoolId && !!data?.term?.id,
    queryFn: async () => {
      const { data: summaryRows } = await supabase
        .from("attendance_summaries")
        .select("student_id, days_present, days_absent, total_days, term_id")
        .eq("term_id", data!.term!.id);
      return summaryRows ?? [];
    },
  });

  const { data: dailyRecords } = useQuery({
    queryKey: ["attendance-roll-call", schoolId, data?.term?.id, date],
    enabled: !!schoolId && !!data?.term?.id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("term_id", data!.term!.id)
        .eq("attendance_date", date);
      if (error) throw new Error(error.message);
      return rows ?? [];
    },
  });

  const { data: termRecords } = useQuery({
    queryKey: ["attendance-roll-call-term", schoolId, data?.term?.id],
    enabled: !!schoolId && !!data?.term?.id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("term_id", data!.term!.id);
      if (error) throw new Error(error.message);
      return rows ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, RollCallStatus> = {};
    for (const row of dailyRecords ?? []) {
      next[row.student_id] = row.status === "absent" ? "absent" : "present";
    }
    setRollCall(next);
  }, [dailyRecords]);

  const attendanceSummaryByStudent = useMemo(
    () =>
      new Map(
        (summaries ?? []).map((row) => [
          row.student_id,
          {
            daysPresent: row.days_present ?? 0,
            daysAbsent: row.days_absent ?? 0,
            total: row.total_days ?? (row.days_present ?? 0) + (row.days_absent ?? 0),
          },
        ]),
      ),
    [summaries],
  );

  useEffect(() => {
    setSummaryDrafts((current) => {
      const next = { ...current };
      for (const row of summaries ?? []) {
        next[row.student_id] = {
          daysPresent: row.days_present?.toString() ?? "0",
          daysAbsent: row.days_absent?.toString() ?? "0",
          totalDays: row.total_days?.toString() ?? "0",
        };
      }
      return next;
    });
  }, [summaries]);

  const assignedClass = useMemo(() => {
    if (!isClassTeacher || canSeeAllStudents || !data || !me?.userId) return null;
    return data.classes.find((item) => item.class_teacher_id === me.userId) ?? null;
  }, [canSeeAllStudents, data, isClassTeacher, me?.userId]);

  const assignedStreamIds = useMemo(
    () =>
      new Set(
        (data?.streams ?? [])
          .filter((item: any) => item.stream_teacher_id === me?.userId)
          .map((item: any) => item.id),
      ),
    [data?.streams, me?.userId],
  );

  const students = (data?.students ?? []).filter((student) => {
    if (isClassTeacher && !canSeeAllStudents) {
      return assignedClass
        ? student.class_id === assignedClass.id || assignedStreamIds.has(student.stream_id)
        : assignedStreamIds.has(student.stream_id);
    }
    return classFilter ? student.class_id === classFilter : true;
  });

  const saveSummary = useMutation({
    mutationFn: async (studentId: string) => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!data?.term) throw new Error("Create a term before recording attendance");
      if (isClassTeacher && !canSeeAllStudents && !assignedClass) {
        throw new Error("No class is assigned to your account");
      }

      const draft = summaryDrafts[studentId] ?? {
        daysPresent: "0",
        daysAbsent: "0",
        totalDays: "0",
      };
      if (!data.students.some((student) => student.id === studentId)) {
        throw new Error("The selected learner is no longer available. Refresh and choose a learner again");
      }
      const daysPresent = attendanceCount("days present", draft.daysPresent);
      const daysAbsent = attendanceCount("days absent", draft.daysAbsent);
      const totalDays = attendanceCount("total days", draft.totalDays);
      if (totalDays < 1) throw new Error("Total days must be at least 1 before saving");
      if (daysPresent + daysAbsent > totalDays) {
        throw new Error("Days present plus days absent cannot exceed total days");
      }

      const { error } = await supabase.from("attendance_summaries").upsert(
        [
          {
            school_id: schoolId,
            student_id: studentId,
            term_id: data.term!.id,
            days_present: daysPresent,
            days_absent: daysAbsent,
            total_days: totalDays,
          },
        ],
        { onConflict: "student_id,term_id" },
      );

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Attendance summary saved");
      queryClient.invalidateQueries({
        queryKey: ["attendance-summaries", schoolId, data?.term?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRollCall = useMutation({
    mutationFn: async () => {
      if (!schoolId || !data?.term) throw new Error("Create a term before recording attendance");
      if (!date) throw new Error("Choose the attendance date first");
      if (Number.isNaN(Date.parse(date))) throw new Error("Choose a valid attendance date");
      const rows = students.map((student) => ({
        school_id: schoolId,
        student_id: student.id,
        term_id: data.term!.id,
        attendance_date: date,
        status: rollCall[student.id] ?? "present",
        recorded_by: me?.userId ?? null,
      }));
      if (!rows.length) throw new Error("There are no learners to record");
      const { error } = await supabase
        .from("attendance_records")
        .upsert(rows, { onConflict: "student_id,attendance_date" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Roll call saved");
      queryClient.invalidateQueries({
        queryKey: ["attendance-roll-call", schoolId, data?.term?.id, date],
      });
      queryClient.invalidateQueries({
        queryKey: ["attendance-roll-call-term", schoolId, data?.term?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const calculateFromRollCall = (studentId: string) => {
    const records = (termRecords ?? []).filter((row) => row.student_id === studentId);
    const daysPresent = records.filter((row) => row.status !== "absent").length;
    const daysAbsent = records.filter((row) => row.status === "absent").length;
    setSummaryDrafts((current) => ({
      ...current,
      [studentId]: {
        daysPresent: daysPresent.toString(),
        daysAbsent: daysAbsent.toString(),
        totalDays: records.length.toString(),
      },
    }));
  };

  const removeSummary = useMutation({
    mutationFn: (studentId: string) =>
      deleteSummaryFn({ data: { studentId, termId: data?.term?.id ?? "" } }),
    onSuccess: () => {
      toast.success("Attendance summary deleted");
      queryClient.invalidateQueries({
        queryKey: ["attendance-summaries", schoolId, data?.term?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`Daily roll call and term attendance totals${data?.term ? ` for the current term` : ""}. The current term is set by the system administrator.`}
      />

      {!data?.term && !isLoading && (
        <Panel>
          <p className="text-sm text-muted-foreground">
            No current term has been set by the system administrator. Attendance cannot be recorded
            until an active term is selected.
          </p>
        </Panel>
      )}

      {data?.term && (
        <Panel>
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Class">
              <select
                className={inputClass}
                value={
                  isClassTeacher && !canSeeAllStudents ? (assignedClass?.id ?? "") : classFilter
                }
                onChange={(e) => setClassFilter(e.target.value)}
                disabled={isClassTeacher && !canSeeAllStudents}
              >
                {isClassTeacher && !canSeeAllStudents ? (
                  <option value={assignedClass?.id ?? ""}>
                    {assignedClass?.name ?? "Assigned class"}
                  </option>
                ) : (
                  <option value="">All classes</option>
                )}
                {(data?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {isLoading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading attendance data...
            </div>
          )}

          {!isLoading && (
            <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Daily roll call</h2>
                  <p className="text-xs text-muted-foreground">
                    Choose whether each learner is present or absent for the selected date.
                  </p>
                </div>
                <Btn
                  variant="accent"
                  onClick={() => saveRollCall.mutate()}
                  disabled={saveRollCall.isPending}
                >
                  Save roll call
                </Btn>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="truncate">{student.full_name}</span>
                    <select
                      className={`${inputClass} w-28`}
                      value={rollCall[student.id] ?? "present"}
                      onChange={(event) =>
                        setRollCall((current) => ({
                          ...current,
                          [student.id]: event.target.value as RollCallStatus,
                        }))
                      }
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!isLoading && (
            <ResponsiveTable
              desktop={
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">Learner</th>
                        <th className="pb-2">Days Present</th>
                        <th className="pb-2">Days Absent</th>
                        <th className="pb-2">Total days</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => {
                        const summary = attendanceSummaryByStudent.get(student.id) ?? {
                          daysPresent: 0,
                          daysAbsent: 0,
                          total: 0,
                        };
                        const draft = summaryDrafts[student.id] ?? {
                          daysPresent: summary.daysPresent.toString(),
                          daysAbsent: summary.daysAbsent.toString(),
                          totalDays: summary.total.toString(),
                        };
                        const total = Number(draft.totalDays || 0);
                        return (
                          <tr key={student.id} className="border-t border-border">
                            <td className="py-2 font-medium">{student.full_name}</td>
                            <td className="py-2">
                              <input
                                type="number"
                                min={0}
                                className={`${inputClass} w-24`}
                                value={draft.daysPresent}
                                onChange={(event) =>
                                  setSummaryDrafts((current) => ({
                                    ...current,
                                    [student.id]: {
                                      ...draft,
                                      daysPresent: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                min={0}
                                className={`${inputClass} w-24`}
                                value={draft.daysAbsent}
                                onChange={(event) =>
                                  setSummaryDrafts((current) => ({
                                    ...current,
                                    [student.id]: { ...draft, daysAbsent: event.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                min={0}
                                className={`${inputClass} w-24`}
                                value={draft.totalDays}
                                onChange={(event) =>
                                  setSummaryDrafts((current) => ({
                                    ...current,
                                    [student.id]: {
                                      ...draft,
                                      totalDays: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2">{total}</td>
                            <td className="py-2 text-right">
                              <div className="flex justify-end gap-2">
                                <Btn
                                  variant="ghost"
                                  onClick={() => calculateFromRollCall(student.id)}
                                >
                                  Calculate
                                </Btn>
                                <Btn
                                  variant="accent"
                                  onClick={() => saveSummary.mutate(student.id)}
                                  disabled={saveSummary.isPending}
                                >
                                  Save
                                </Btn>
                                <Btn
                                  variant="ghost"
                                  onClick={() => removeSummary.mutate(student.id)}
                                  disabled={removeSummary.isPending}
                                >
                                  Delete
                                </Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-muted-foreground">
                            No learners in this class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              }
              mobile={
                <>
                  {students.map((student) => {
                    const summary = attendanceSummaryByStudent.get(student.id) ?? {
                      daysPresent: 0,
                      daysAbsent: 0,
                      total: 0,
                    };
                    const draft = summaryDrafts[student.id] ?? {
                      daysPresent: summary.daysPresent.toString(),
                      daysAbsent: summary.daysAbsent.toString(),
                      totalDays: summary.total.toString(),
                    };
                    const total = Number(draft.totalDays || 0);
                    return (
                      <div
                        key={student.id}
                        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{student.full_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Edit the counts, then save.
                            </p>
                          </div>
                          <Btn
                            variant="accent"
                            onClick={() => saveSummary.mutate(student.id)}
                            disabled={saveSummary.isPending}
                          >
                            Save
                          </Btn>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3 text-center text-xs">
                          <div>
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded-md border border-border bg-background px-2 py-1 text-center text-sm"
                              value={draft.daysPresent}
                              onChange={(event) =>
                                setSummaryDrafts((current) => ({
                                  ...current,
                                  [student.id]: {
                                    ...draft,
                                    daysPresent: event.target.value,
                                  },
                                }))
                              }
                            />
                            <div className="text-muted-foreground">Present</div>
                          </div>
                          <div>
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded-md border border-border bg-background px-2 py-1 text-center text-sm"
                              value={draft.daysAbsent}
                              onChange={(event) =>
                                setSummaryDrafts((current) => ({
                                  ...current,
                                  [student.id]: {
                                    ...draft,
                                    daysAbsent: event.target.value,
                                  },
                                }))
                              }
                            />
                            <div className="text-muted-foreground">Absent</div>
                          </div>
                          <div>
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded-md border border-border bg-background px-2 py-1 text-center text-sm"
                              value={draft.totalDays}
                              onChange={(event) =>
                                setSummaryDrafts((current) => ({
                                  ...current,
                                  [student.id]: { ...draft, totalDays: event.target.value },
                                }))
                              }
                            />
                            <div className="text-muted-foreground">Total days</div>
                          </div>
                          <div>
                            <div className="font-semibold">{total}</div>
                            <div className="text-muted-foreground">Calculated view</div>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <div className="flex gap-2">
                            <Btn variant="ghost" onClick={() => calculateFromRollCall(student.id)}>
                              Calculate
                            </Btn>
                            <Btn
                              variant="ghost"
                              onClick={() => removeSummary.mutate(student.id)}
                              disabled={removeSummary.isPending}
                            >
                              Delete
                            </Btn>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                      No learners in this class.
                    </div>
                  )}
                </>
              }
            />
          )}
        </Panel>
      )}
    </div>
  );
}
