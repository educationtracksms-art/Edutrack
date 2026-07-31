import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance · EduTrack" },
      { name: "description", content: "Mark daily attendance per class and feed report card attendance totals." },
      { property: "og:title", content: "Attendance · EduTrack" },
      { property: "og:description", content: "Daily register with present, absent and late tracking." },
    ],
  }),
  component: AttendancePage,
});

const STATUSES = ["present", "absent", "late", "excused"] as const;

function AttendancePage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classFilter, setClassFilter] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["attendance", schoolId, date],
    enabled: !!schoolId,
    queryFn: async () => {
      const [students, classes, records, terms] = await Promise.all([
        supabase.from("students").select("id, full_name, class_id, stream_id").is("deleted_at", null).order("full_name"),
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("attendance_records").select("*").eq("attendance_date", date),
        supabase.from("terms").select("id, is_current"),
      ]);
      return {
        students: students.data ?? [],
        classes: classes.data ?? [],
        records: records.data ?? [],
        term: (terms.data ?? []).find((t) => t.is_current) ?? (terms.data ?? [])[0] ?? null,
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!data?.term) throw new Error("Create a term before recording attendance");
      const rows = Object.entries(marks).map(([studentId, status]) => ({
        school_id: schoolId,
        student_id: studentId,
        term_id: data.term!.id,
        attendance_date: date,
        status,
        recorded_by: me?.userId ?? null,
      }));
      if (rows.length === 0) throw new Error("Nothing to save");
      const { error } = await supabase
        .from("attendance_records")
        .upsert(rows, { onConflict: "student_id,attendance_date" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      setMarks({});
      queryClient.invalidateQueries({ queryKey: ["attendance", schoolId, date] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const students = (data?.students ?? []).filter((s) => (classFilter ? s.class_id === classFilter : true));

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Daily register per class. Totals roll up into each learner's report card."
        actions={<Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending}>Save register</Btn>}
      />

      <Panel>
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Class">
            <select className={inputClass} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All classes</option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Learner</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const saved = data?.records.find((r) => r.student_id === student.id)?.status ?? "";
                const value = marks[student.id] ?? saved;
                return (
                  <tr key={student.id} className="border-t border-border">
                    <td className="py-2 font-medium">{student.full_name}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {STATUSES.map((status) => (
                          <label key={status} className="flex items-center gap-1 text-xs capitalize">
                            <input
                              type="radio"
                              name={`att-${student.id}`}
                              checked={value === status}
                              onChange={() => setMarks({ ...marks, [student.id]: status })}
                            />
                            {status}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-muted-foreground">No learners in this class.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}