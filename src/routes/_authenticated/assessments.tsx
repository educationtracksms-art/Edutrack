import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { reviewAssessments } from "@/lib/admin.functions";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/assessments")({
  head: () => ({
    meta: [
      { title: "Assessments · EduTrack" },
      { name: "description", content: "Capture formative and summative scores, submit for approval and lock results." },
      { property: "og:title", content: "Assessments · EduTrack" },
      { property: "og:description", content: "Teacher score entry with Director of Studies approval workflow." },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const canReview = hasAny(me?.roles, ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"]);
  const review = useServerFn(reviewAssessments);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [edits, setEdits] = useState<Record<string, { formative?: string; summative?: string }>>({});

  const { data } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const [assessments, students, subjects] = await Promise.all([
        supabase.from("assessments").select("*").order("created_at"),
        supabase.from("students").select("id, full_name"),
        supabase.from("subjects").select("id, name").order("position"),
      ]);
      return {
        assessments: assessments.data ?? [],
        students: students.data ?? [],
        subjects: subjects.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.assessments
      .filter((a) => (subjectFilter ? a.subject_id === subjectFilter : true))
      .filter((a) => (statusFilter ? a.status === statusFilter : true))
      .map((a) => ({
        ...a,
        studentName: data.students.find((s) => s.id === a.student_id)?.full_name ?? "—",
        subjectName: data.subjects.find((s) => s.id === a.subject_id)?.name ?? "—",
      }));
  }, [data, subjectFilter, statusFilter]);

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const edit = edits[id] ?? {};
      const patch = {
        status: "submitted" as const,
        submitted_by: me?.userId,
        submitted_at: new Date().toISOString(),
        ...(edit.formative !== undefined ? { formative: edit.formative === "" ? null : Number(edit.formative) } : {}),
        ...(edit.summative !== undefined ? { summative: edit.summative === "" ? null : Number(edit.summative) } : {}),
      };
      const { error } = await supabase.from("assessments").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Scores submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewMutation = useMutation({
    mutationFn: (vars: { ids: string[]; action: "approve" | "reject" }) => review({ data: vars }),
    onSuccess: () => {
      toast.success("Review recorded");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pendingIds = rows.filter((r) => r.status === "submitted").map((r) => r.id);

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Formative counts 20%, summative 80%. Approved scores lock automatically."
        actions={
          canReview && pendingIds.length > 0 ? (
            <>
              <Btn variant="accent" onClick={() => reviewMutation.mutate({ ids: pendingIds, action: "approve" })}>
                Approve {pendingIds.length} submitted
              </Btn>
              <Btn variant="ghost" onClick={() => reviewMutation.mutate({ ids: pendingIds, action: "reject" })}>
                Return for correction
              </Btn>
            </>
          ) : undefined
        }
      />

      <Panel>
        <div className="mb-3 flex flex-wrap gap-2">
          <select className={`${inputClass} max-w-xs`} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">All subjects</option>
            {(data?.subjects ?? []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select className={`${inputClass} max-w-xs`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Learner</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Formative (20)</th>
                <th className="pb-2">Summative (80)</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const edit = edits[row.id] ?? {};
                const formative = edit.formative ?? (row.formative ?? "").toString();
                const summative = edit.summative ?? (row.summative ?? "").toString();
                const total = (Number(formative || 0) + Number(summative || 0)).toFixed(1);
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2 font-medium">{row.studentName}</td>
                    <td>{row.subjectName}</td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        max={20}
                        min={0}
                        disabled={row.locked}
                        className={`${inputClass} w-24`}
                        value={formative}
                        onChange={(e) => setEdits({ ...edits, [row.id]: { ...edit, formative: e.target.value } })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        max={80}
                        min={0}
                        disabled={row.locked}
                        className={`${inputClass} w-24`}
                        value={summative}
                        onChange={(e) => setEdits({ ...edits, [row.id]: { ...edit, summative: e.target.value } })}
                      />
                    </td>
                    <td className="font-semibold">{total}</td>
                    <td>
                      <Pill
                        tone={
                          row.status === "approved"
                            ? "success"
                            : row.status === "rejected"
                              ? "danger"
                              : row.status === "submitted"
                                ? "warning"
                                : "muted"
                        }
                      >
                        {row.status}
                      </Pill>
                    </td>
                    <td className="text-right">
                      {!row.locked && (
                        <Btn variant="ghost" onClick={() => saveMutation.mutate(row.id)}>
                          Submit
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    No assessment records match these filters.
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