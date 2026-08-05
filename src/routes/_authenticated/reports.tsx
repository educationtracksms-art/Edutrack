import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ReportCard } from "@/components/report/ReportCard";
import { Btn, PageHeader, Panel, inputClass } from "@/components/ui-kit";
import { friendlyAdminError } from "@/lib/admin-errors";
import { logReportPrint } from "@/lib/admin.functions";
import { getReportCards } from "@/lib/report.functions";
import { isModuleEnabled } from "@/lib/modules";
import type { ReportCardData } from "@/lib/report-types";
import { supabase } from "@/integrations/supabase/client";

type ClassRow = { id: string; name: string };
type StreamRow = { id: string; name: string; class_id: string | null };
type StudentRow = { id: string; full_name: string; class_id: string | null; stream_id: string | null };
type TermRow = { id: string; name: string; is_current: boolean; academic_year_id: string | null };
type AcademicYearRow = { id: string; name: string; is_current: boolean };

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "report_cards"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Report Cards · EduTrack" },
      {
        name: "description",
        content: "Generate and print A4 learner report cards built from approved assessment data.",
      },
      { property: "og:title", content: "Report Cards · EduTrack" },
      {
        property: "og:description",
        content: "Dynamic, print-ready report cards for individual learners or whole classes.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const build = useServerFn(getReportCards);
  const logPrint = useServerFn(logReportPrint);
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cards, setCards] = useState<ReportCardData[]>([]);

  const { data: classes } = useQuery<ClassRow[]>({
    queryKey: ["classes"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: streams } = useQuery<StreamRow[]>({
    queryKey: ["report-streams"],
    queryFn: async () =>
      (await supabase.from("streams").select("id, name, class_id").order("name")).data ?? [],
  });
  const { data: students } = useQuery<StudentRow[]>({
    queryKey: ["students-active"],
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id, full_name, class_id, stream_id")
          .eq("status", "active")
          .order("full_name")
      ).data ?? [],
  });
  const { data: terms } = useQuery<TermRow[]>({
    queryKey: ["report-terms"],
    queryFn: async () =>
      (
        await supabase
          .from("terms")
          .select("id, name, is_current, academic_year_id")
          .order("start_date", { ascending: false })
      ).data ?? [],
  });
  const { data: academicYears } = useQuery<AcademicYearRow[]>({
    queryKey: ["report-academic-years"],
    queryFn: async () =>
      (
        await supabase
          .from("academic_years")
          .select("id, name, is_current")
          .order("name", { ascending: false })
      ).data ?? [],
  });

  const currentTermId = useMemo(
    () => terms?.find((term) => term.is_current)?.id ?? terms?.[0]?.id ?? "",
    [terms],
  );

  useEffect(() => {
    if (!termId && currentTermId) setTermId(currentTermId);
  }, [currentTermId, termId]);

  const visible = useMemo(() => {
    return (students ?? [])
      .filter((student) => (classId ? student.class_id === classId : true))
      .filter((student) => (streamId ? student.stream_id === streamId : true))
      .sort((a, b) => {
        const classA = classes?.find((item) => item.id === a.class_id)?.name ?? "";
        const classB = classes?.find((item) => item.id === b.class_id)?.name ?? "";
        const streamA = streams?.find((item) => item.id === a.stream_id)?.name ?? "";
        const streamB = streams?.find((item) => item.id === b.stream_id)?.name ?? "";
        return (
          classA.localeCompare(classB) ||
          streamA.localeCompare(streamB) ||
          a.full_name.localeCompare(b.full_name)
        );
      });
    }, [classId, classes, streamId, students, streams]);

  const visibleStudentIds = useMemo(() => visible.map((student) => student.id), [visible]);

  const activeAcademicYears = academicYears ?? [];
  const filteredTerms = useMemo(() => {
    return (terms ?? []).filter((term) =>
      academicYearId ? term.academic_year_id === academicYearId : true,
    );
  }, [academicYearId, terms]);

  useEffect(() => {
    if (!academicYearId && currentTermId) {
      const currentTerm = terms?.find((term) => term.id === currentTermId);
      if (currentTerm?.academic_year_id) setAcademicYearId(currentTerm.academic_year_id);
    }
  }, [academicYearId, currentTermId, terms]);

  const generate = useMutation({
    mutationFn: async () => {
      const ids = selected.length ? selected : visible.map((student) => student.id);
      if (!ids.length) throw new Error("Select at least one learner");
      return build({ data: { studentIds: ids, termId: termId || undefined } });
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            className={`${inputClass} max-w-xs`}
            value={academicYearId}
            onChange={(event) => {
              setAcademicYearId(event.target.value);
              setTermId("");
              setSelected([]);
            }}
          >
            <option value="">All years</option>
            {activeAcademicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.is_current ? " (Current)" : ""}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
          >
            <option value="">Select term</option>
            {filteredTerms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
                {term.is_current ? " (Current)" : ""}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setStreamId("");
              setSelected([]);
            }}
          >
            <option value="">All classes</option>
            {(classes ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} max-w-xs`}
            value={streamId}
            onChange={(event) => {
              setStreamId(event.target.value);
              setSelected([]);
            }}
          >
            <option value="">All streams</option>
            {(streams ?? [])
              .filter((stream) => !classId || stream.class_id === classId)
              .map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.name}
                </option>
              ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="ghost"
              onClick={() => setSelected(visibleStudentIds)}
              disabled={visibleStudentIds.length === 0}
            >
              Select all
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              Clear
            </Btn>
          </div>
          <span className="text-sm text-muted-foreground">
            {selected.length
              ? `${selected.length} selected`
              : `${visible.length} learner(s) in scope`}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((student) => (
            <label
              key={student.id}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(student.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, student.id]
                      : selected.filter((id) => id !== student.id),
                  )
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

