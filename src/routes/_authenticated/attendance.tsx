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

type SummaryDraft = { daysPresent: string; daysAbsent: string };

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
        term: (terms.data ?? []).find((t) => t.is_current) ?? (terms.data ?? [])[0] ?? null,
      };
    },
  });

  const { data: summaries } = useQuery({
    queryKey: ["attendance-summaries", schoolId, data?.term?.id, classFilter],
    enabled: !!schoolId && !!data?.term?.id,
    queryFn: async () => {
      const { data: summaryRows } = await supabase
        .from("attendance_summaries")
        .select("student_id, days_present, days_absent, term_id")
        .eq("term_id", data!.term!.id);
      return summaryRows ?? [];
    },
  });

  const attendanceSummaryByStudent = useMemo(
    () =>
      new Map(
        (summaries ?? []).map((row) => [
          row.student_id,
          {
            daysPresent: row.days_present ?? 0,
            daysAbsent: row.days_absent ?? 0,
            total: (row.days_present ?? 0) + (row.days_absent ?? 0),
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

      const draft = summaryDrafts[studentId] ?? { daysPresent: "0", daysAbsent: "0" };
      const daysPresent = Number(draft.daysPresent || 0);
      const daysAbsent = Number(draft.daysAbsent || 0);

      const { error } = await supabase.from("attendance_summaries").upsert(
        [
          {
            school_id: schoolId,
            student_id: studentId,
            term_id: data.term!.id,
            days_present: daysPresent,
            days_absent: daysAbsent,
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
        description="Edit days present and days absent per learner. Total updates automatically."
      />

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
              value={isClassTeacher && !canSeeAllStudents ? (assignedClass?.id ?? "") : classFilter}
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
          <ResponsiveTable
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Learner</th>
                      <th className="pb-2">Days Present</th>
                      <th className="pb-2">Days Absent</th>
                      <th className="pb-2">Total</th>
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
                      };
                      const total = Number(draft.daysPresent || 0) + Number(draft.daysAbsent || 0);
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
                                  [student.id]: {
                                    ...draft,
                                    daysAbsent: event.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="py-2">{total}</td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-2">
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
                  };
                  const total = Number(draft.daysPresent || 0) + Number(draft.daysAbsent || 0);
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
                          <div className="font-semibold">{total}</div>
                          <div className="text-muted-foreground">Total</div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Btn
                          variant="ghost"
                          onClick={() => removeSummary.mutate(student.id)}
                          disabled={removeSummary.isPending}
                        >
                          Delete
                        </Btn>
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
    </div>
  );
}
