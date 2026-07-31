import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getReportCards } from "@/lib/report.functions";
import { logReportPrint } from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { ReportCard } from "@/components/report/ReportCard";
import type { ReportCardData } from "@/lib/report-types";
import { Btn, PageHeader, Panel, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Report Cards · EduTrack" },
      { name: "description", content: "Generate and print A4 learner report cards built from approved assessment data." },
      { property: "og:title", content: "Report Cards · EduTrack" },
      { property: "og:description", content: "Dynamic, print-ready report cards for individual learners or whole classes." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const build = useServerFn(getReportCards);
  const logPrint = useServerFn(logReportPrint);
  const [classId, setClassId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cards, setCards] = useState<ReportCardData[]>([]);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["students-active"],
    queryFn: async () =>
      (await supabase.from("students").select("id, full_name, class_id").eq("status", "active").order("full_name")).data ?? [],
  });

  const visible = (students ?? []).filter((s) => (classId ? s.class_id === classId : true));

  const generate = useMutation({
    mutationFn: async () => {
      const ids = selected.length ? selected : visible.map((s) => s.id);
      if (!ids.length) throw new Error("Select at least one learner");
      return build({ data: { studentIds: ids } });
    },
    onSuccess: (result) => {
      setCards(result);
      toast.success(`${result.length} report card(s) ready`);
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  function print() {
    logPrint({ data: { count: cards.length, scope: classId || "all" } }).catch(() => undefined);
    window.print();
  }

  return (
    <div>
      <PageHeader
        title="Report cards"
        description="Only approved assessments appear on printed reports."
        actions={
          <>
            <Btn variant="accent" onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? "Generating…" : "Generate"}
            </Btn>
            {cards.length > 0 && <Btn onClick={print}>Print / Save PDF</Btn>}
          </>
        }
      />

      <Panel className="no-print mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <select className={`${inputClass} max-w-xs`} value={classId} onChange={(e) => { setClassId(e.target.value); setSelected([]); }}>
            <option value="">All classes</option>
            {(classes ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">
            {selected.length ? `${selected.length} selected` : `${visible.length} learner(s) in scope`}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((student) => (
            <label key={student.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(student.id)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, student.id] : selected.filter((id) => id !== student.id))
                }
              />
              {student.full_name}
            </label>
          ))}
        </div>
      </Panel>

      <div className="space-y-6">
        {cards.map((card) => (
          <ReportCard key={card.studentId} data={card} />
        ))}
      </div>
    </div>
  );
}
