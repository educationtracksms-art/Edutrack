import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ACADEMIC_MANAGERS, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions · EduTrack" },
      { name: "description", content: "Promote, repeat or transfer learners at the end of an academic year." },
      { property: "og:title", content: "Promotions · EduTrack" },
      { property: "og:description", content: "End-of-year learner progression with a permanent history trail." },
    ],
  }),
  component: PromotionsPage,
});

const OUTCOMES = ["promoted", "repeated", "transferred", "graduated"] as const;

function PromotionsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const allowed = hasAny(me?.roles, ACADEMIC_MANAGERS);
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [toStream, setToStream] = useState("");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("promoted");
  const [selected, setSelected] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["promotions", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [students, classes, streams, years, history] = await Promise.all([
        supabase.from("students").select("id, full_name, class_id, stream_id").is("deleted_at", null).order("full_name"),
        supabase.from("classes").select("id, name").order("level").order("name"),
        supabase.from("streams").select("id, name, class_id"),
        supabase.from("academic_years").select("id, name, is_current"),
        supabase.from("student_promotions").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      return {
        students: students.data ?? [],
        classes: classes.data ?? [],
        streams: streams.data ?? [],
        year: (years.data ?? []).find((y) => y.is_current) ?? (years.data ?? [])[0] ?? null,
        history: history.data ?? [],
      };
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!data?.year) throw new Error("Create an academic year first");
      if (selected.length === 0) throw new Error("Select at least one learner");
      if (outcome === "promoted" && !toClass) throw new Error("Choose the class learners move into");

      for (const studentId of selected) {
        const student = data.students.find((s) => s.id === studentId)!;
        const target = outcome === "promoted" ? toClass : student.class_id;
        const targetStream = outcome === "promoted" ? toStream || null : student.stream_id;

        const { error } = await supabase.from("student_promotions").insert({
          school_id: schoolId,
          student_id: studentId,
          academic_year_id: data.year.id,
          from_class_id: student.class_id,
          from_stream_id: student.stream_id,
          to_class_id: target,
          to_stream_id: targetStream,
          outcome,
          performed_by: me?.userId ?? null,
        });
        if (error) throw new Error(error.message);

        if (outcome === "promoted") {
          await supabase.from("students").update({ class_id: target, stream_id: targetStream }).eq("id", studentId);
        }
        if (outcome === "transferred" || outcome === "graduated") {
          await supabase.from("students").update({ status: "inactive" }).eq("id", studentId);
        }
        await supabase.from("student_history").insert({
          school_id: schoolId,
          student_id: studentId,
          event_type: outcome,
          details: { from_class_id: student.class_id, to_class_id: target },
          performed_by: me?.userId ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Progression recorded");
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["promotions", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">Only school leadership and the Director of Studies can run promotions.</p>;
  }

  const roster = (data?.students ?? []).filter((s) => (fromClass ? s.class_id === fromClass : true));
  const className = (id: string | null) => data?.classes.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Move learners to the next class, repeat a year, or record transfers and graduations."
      />

      <Panel title="Run a progression" className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="From class">
            <select className={inputClass} value={fromClass} onChange={(e) => { setFromClass(e.target.value); setSelected([]); }}>
              <option value="">All classes</option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Outcome">
            <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as (typeof OUTCOMES)[number])}>
              {OUTCOMES.map((o) => (
                <option key={o} value={o} className="capitalize">{o}</option>
              ))}
            </select>
          </Field>
          <Field label="To class">
            <select className={inputClass} value={toClass} onChange={(e) => { setToClass(e.target.value); setToStream(""); }} disabled={outcome !== "promoted"}>
              <option value="">Select</option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="To stream">
            <select className={inputClass} value={toStream} onChange={(e) => setToStream(e.target.value)} disabled={outcome !== "promoted"}>
              <option value="">Keep unassigned</option>
              {(data?.streams ?? []).filter((s) => !toClass || s.class_id === toClass).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <Btn variant="accent" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Processing…" : `Apply to ${selected.length} learner(s)`}
          </Btn>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="Learners">
          <ul className="space-y-1 text-sm">
            {roster.map((student) => (
              <li key={student.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(student.id)}
                    onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, student.id] : selected.filter((id) => id !== student.id))
                    }
                  />
                  {student.full_name}
                </label>
                <span className="text-xs text-muted-foreground">{className(student.class_id)}</span>
              </li>
            ))}
            {roster.length === 0 && <p className="text-muted-foreground">No learners found.</p>}
          </ul>
        </Panel>

        <Panel title="Recent progressions">
          <ul className="space-y-2 text-sm">
            {(data?.history ?? []).map((row) => (
              <li key={row.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {data?.students.find((s) => s.id === row.student_id)?.full_name ?? "Learner"}
                  </span>
                  <Pill tone={row.outcome === "promoted" ? "success" : "muted"}>{row.outcome}</Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                  {className(row.from_class_id)} → {className(row.to_class_id)}
                </p>
              </li>
            ))}
            {(data?.history ?? []).length === 0 && <p className="text-muted-foreground">Nothing recorded yet.</p>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}