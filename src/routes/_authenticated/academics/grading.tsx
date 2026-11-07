import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteGradingScale,
  deleteIdentifierScale,
  deleteReportCommentRule,
  upsertGradingScale,
  upsertIdentifierScale,
  upsertReportCommentRule,
} from "@/lib/admin.functions";
import { hasAny } from "@/hooks/useCurrentUser";
import { useAcademicsPage } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/grading")({
  head: () => ({
    meta: [{ title: "Grading | EduTrack" }],
  }),
  component: GradingPage,
});

function GradingPage() {
  const { me, schoolId, allowed, data, refresh } = useAcademicsPage();
  const queryClient = useQueryClient();
  const [activeOutput, setActiveOutput] = useState<"o_level" | "a_level" | "identifiers">("o_level");
  const saveGradingScaleFn = useServerFn(upsertGradingScale);
  const deleteGradingScaleFn = useServerFn(deleteGradingScale);
  const saveIdentifierScaleFn = useServerFn(upsertIdentifierScale);
  const deleteIdentifierScaleFn = useServerFn(deleteIdentifierScale);
  const saveReportCommentRuleFn = useServerFn(upsertReportCommentRule);
  const deleteReportCommentRuleFn = useServerFn(deleteReportCommentRule);
  const canManageReportComments = hasAny(me?.roles, ["dos", "head_teacher", "deputy_head_teacher"]);
  const [commentRuleForm, setCommentRuleForm] = useState({
    id: "",
    commentRole: "class_teacher" as "class_teacher" | "head_teacher",
    descriptor: "Outstanding",
    points: "",
    comment: "",
  });
  const [oLevelGradingForm, setOLevelGradingForm] = useState({
    id: "",
    grade: "",
    min_score: "",
    max_score: "",
    grade_descriptor: "",
  });
  const [aLevelGradingForm, setALevelGradingForm] = useState({
    id: "",
    grade: "",
    min_score: "",
    max_score: "",
    points: "",
  });
  const [identifierForm, setIdentifierForm] = useState({
    id: "",
    identifier: "3",
    min_score: "",
    max_score: "",
    descriptor: "",
  });
  const saveOLevelGradingScale = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const minScore = Number(oLevelGradingForm.min_score);
      const maxScore = Number(oLevelGradingForm.max_score);
      if (!oLevelGradingForm.grade.trim()) throw new Error("Enter a grade label");
      if (!oLevelGradingForm.grade_descriptor.trim()) throw new Error("Enter a grade descriptor");
      if (Number.isNaN(minScore) || Number.isNaN(maxScore))
        throw new Error("Enter valid score boundaries");
      if (maxScore < minScore) throw new Error("Maximum score must be greater than minimum score");
      await saveGradingScaleFn({
        data: {
          id: oLevelGradingForm.id || null,
          schoolId,
          educationLevel: "ordinary",
          grade: oLevelGradingForm.grade,
          minScore,
          maxScore,
          gradeDescriptor: oLevelGradingForm.grade_descriptor ?? "",
          points: null,
        },
      });
    },
    onSuccess: () => {
      setOLevelGradingForm({
        id: "",
        grade: "",
        min_score: "",
        max_score: "",
        grade_descriptor: "",
      });
      toast.success("O-level grading criteria saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveALevelGradingScale = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const minScore = Number(aLevelGradingForm.min_score);
      const maxScore = Number(aLevelGradingForm.max_score);
      const points = Number(aLevelGradingForm.points);
      if (!aLevelGradingForm.grade.trim()) throw new Error("Enter a grade label");
      if (Number.isNaN(minScore) || Number.isNaN(maxScore) || Number.isNaN(points))
        throw new Error("Enter valid score boundaries and points");
      if (points < 1 || points > 5) throw new Error("A-level points must be between 1 and 5");
      if (maxScore < minScore) throw new Error("Maximum score must be greater than minimum score");
      await saveGradingScaleFn({
        data: {
          id: aLevelGradingForm.id || null,
          schoolId,
          educationLevel: "advanced",
          grade: aLevelGradingForm.grade,
          minScore,
          maxScore,
          gradeDescriptor: "",
          points,
        },
      });
    },
    onSuccess: () => {
      setALevelGradingForm({
        id: "",
        grade: "",
        min_score: "",
        max_score: "",
        points: "",
      });
      toast.success("A-level grading criteria saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeScale = useMutation({
    mutationFn: (id: string) => deleteGradingScaleFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Grading criteria deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveIdentifierScale = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const identifier = Number(identifierForm.identifier);
      const minScore = Number(identifierForm.min_score);
      const maxScore = Number(identifierForm.max_score);
      const descriptor = identifierForm.descriptor.trim();
      if (!Number.isFinite(identifier) || !Number.isInteger(identifier) || identifier < 1) {
        throw new Error("Identifier must be a whole number greater than zero");
      }
      if (!Number.isFinite(minScore) || !Number.isFinite(maxScore)) {
        throw new Error("Enter valid minimum and maximum scores");
      }
      if (maxScore < minScore) throw new Error("Maximum score must be greater than minimum score");
      if (!descriptor) throw new Error("Enter an identifier descriptor");
      await saveIdentifierScaleFn({
        data: {
          id: identifierForm.id || null,
          schoolId,
          identifier,
          minScore,
          maxScore,
          descriptor,
        },
      });
    },
    onSuccess: () => {
      setIdentifierForm({ id: "", identifier: "3", min_score: "", max_score: "", descriptor: "" });
      toast.success("Identifier criteria saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeIdentifierScale = useMutation({
    mutationFn: (id: string) => deleteIdentifierScaleFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Identifier criteria deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: reportCommentRules = [], isLoading: isLoadingCommentRules } = useQuery({
    queryKey: ["academics-report-comment-rules", schoolId],
    enabled: !!schoolId && canManageReportComments,
    queryFn: async () => {
      const { data: rules, error } = await supabase
        .from("report_comment_rules")
        .select("id, comment_role, descriptor, points, comment")
        .eq("school_id", schoolId!)
        .order("comment_role")
        .order("points", { ascending: true, nullsFirst: false })
        .order("descriptor");
      if (error) throw new Error(error.message);
      return (rules ?? []) as {
        id: string;
        comment_role: "class_teacher" | "head_teacher";
        descriptor: string;
        points: number | null;
        comment: string;
      }[];
    },
  });

  const saveReportCommentRule = useMutation({
    mutationFn: async () => {
      const comment = commentRuleForm.comment.trim();
      if (!comment) throw new Error("Enter the comment text first");
      if (commentRuleForm.points) {
        const points = Number(commentRuleForm.points);
        if (!Number.isInteger(points) || points < 3 || points > 17) {
          throw new Error("Points must be a whole number between 3 and 17");
        }
        return saveReportCommentRuleFn({
          data: {
            id: commentRuleForm.id || null,
            commentRole: commentRuleForm.commentRole,
            descriptor: commentRuleForm.points,
            points,
            comment,
          },
        });
      }
      const descriptor = commentRuleForm.descriptor.trim();
      if (!descriptor) throw new Error("Enter a descriptor");
      return saveReportCommentRuleFn({
        data: {
          id: commentRuleForm.id || null,
          commentRole: commentRuleForm.commentRole,
          descriptor,
          points: null,
          comment,
        },
      });
    },
    onSuccess: async () => {
      setCommentRuleForm({
        id: "",
        commentRole: "class_teacher",
        descriptor: "Outstanding",
        points: "",
        comment: "",
      });
      toast.success("Report comment criterion saved");
      await queryClient.invalidateQueries({ queryKey: ["academics-report-comment-rules", schoolId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeReportCommentRule = useMutation({
    mutationFn: async (rule: { id: string; comment_role: "class_teacher" | "head_teacher" }) =>
      deleteReportCommentRuleFn({ data: { id: rule.id, commentRole: rule.comment_role } }),
    onSuccess: async () => {
      toast.success("Report comment criterion deleted");
      await queryClient.invalidateQueries({ queryKey: ["academics-report-comment-rules", schoolId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the Director of Studies and school leadership can manage academic setup.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic setup"
        title="Grading"
        description="Set score bands for O-Level and A-Level grades, and descriptors for report cards."
      />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "O-Level bands", value: data?.gradingScales.filter((item) => item.education_level !== "advanced").length ?? 0, styles: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300" },
          { label: "A-Level bands", value: data?.gradingScales.filter((item) => item.education_level === "advanced").length ?? 0, styles: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300" },
          { label: "Identifiers", value: data?.identifierScales.length ?? 0, styles: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
        ].map((stat) => (
          <div key={stat.label} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center shadow-sm sm:flex-row sm:justify-between sm:gap-2 sm:px-4 sm:py-3 ${stat.styles}`}>
            <span className="truncate text-[10px] font-semibold leading-tight sm:text-sm">{stat.label}</span>
            <span className="text-lg font-bold tabular-nums leading-tight sm:text-xl">{stat.value}</span>
          </div>
        ))}
      </div>
      <section aria-labelledby="grading-forms-heading" className="space-y-4">
        <div>
          <h2 id="grading-forms-heading" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Forms · Add or edit</h2>
          <p className="mt-1 text-xs text-muted-foreground">Configure O-Level grades, A-Level grades and report-card identifiers.</p>
        </div>
      <div className="grid items-start gap-4 xl:grid-cols-3">
      <Panel title="O-Level grading criteria" className="order-1 h-full">
        <form
          className="grid gap-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/20 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveOLevelGradingScale.mutate();
          }}
        >
          <Field label="Grade">
            <input
              required
              className={inputClass}
              value={oLevelGradingForm.grade}
              onChange={(e) =>
                setOLevelGradingForm({ ...oLevelGradingForm, grade: e.target.value })
              }
              placeholder="A"
            />
          </Field>
          <Field label="Min score">
            <input
              required
              type="number"
              className={inputClass}
              value={oLevelGradingForm.min_score}
              onChange={(e) =>
                setOLevelGradingForm({ ...oLevelGradingForm, min_score: e.target.value })
              }
              placeholder="80"
            />
          </Field>
          <Field label="Max score">
            <input
              required
              type="number"
              className={inputClass}
              value={oLevelGradingForm.max_score}
              onChange={(e) =>
                setOLevelGradingForm({ ...oLevelGradingForm, max_score: e.target.value })
              }
              placeholder="100"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Grade descriptor">
              <input
                required
                className={inputClass}
                value={oLevelGradingForm.grade_descriptor}
                onChange={(e) =>
                  setOLevelGradingForm({
                    ...oLevelGradingForm,
                    grade_descriptor: e.target.value,
                  })
                }
                placeholder="Achieved MOST or ALL competencies exceedingly well."
              />
            </Field>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Btn type="submit" variant="accent" disabled={saveOLevelGradingScale.isPending}>
              {oLevelGradingForm.id ? "Save changes" : "Add O-level grade"}
            </Btn>
            {oLevelGradingForm.id && (
              <Btn
                variant="ghost"
                onClick={() =>
                  setOLevelGradingForm({
                    id: "",
                    grade: "",
                    min_score: "",
                    max_score: "",
                    grade_descriptor: "",
                  })
                }
              >
                Cancel
              </Btn>
            )}
          </div>
        </form>
      </Panel>

      <Panel title="A-Level grading criteria" className="order-3 h-full">
        <form
          className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/20 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveALevelGradingScale.mutate();
          }}
        >
          <Field label="Grade">
            <input
              required
              className={inputClass}
              value={aLevelGradingForm.grade}
              onChange={(e) =>
                setALevelGradingForm({ ...aLevelGradingForm, grade: e.target.value })
              }
              placeholder="B"
            />
          </Field>
          <Field label="Min score">
            <input
              required
              type="number"
              className={inputClass}
              value={aLevelGradingForm.min_score}
              onChange={(e) =>
                setALevelGradingForm({ ...aLevelGradingForm, min_score: e.target.value })
              }
              placeholder="70"
            />
          </Field>
          <Field label="Max score">
            <input
              required
              type="number"
              className={inputClass}
              value={aLevelGradingForm.max_score}
              onChange={(e) =>
                setALevelGradingForm({ ...aLevelGradingForm, max_score: e.target.value })
              }
              placeholder="79"
            />
          </Field>
          <Field label="Points">
            <input
              required
              type="number"
              className={inputClass}
              value={aLevelGradingForm.points}
              onChange={(e) =>
                setALevelGradingForm({ ...aLevelGradingForm, points: e.target.value })
              }
              placeholder="4"
            />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Btn type="submit" variant="accent" disabled={saveALevelGradingScale.isPending}>
              {aLevelGradingForm.id ? "Save changes" : "Add A-level grade"}
            </Btn>
            {aLevelGradingForm.id && (
              <Btn
                variant="ghost"
                onClick={() =>
                  setALevelGradingForm({
                    id: "",
                    grade: "",
                    min_score: "",
                    max_score: "",
                    points: "",
                  })
                }
              >
                Cancel
              </Btn>
            )}
          </div>
        </form>
      </Panel>

      <Panel title="O-Level identifiers" className="order-2 h-full">
        <form
          className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveIdentifierScale.mutate();
          }}
        >
          <Field label="Identifier">
            <input
              required
              type="number"
              className={inputClass}
              value={identifierForm.identifier}
              onChange={(e) => setIdentifierForm({ ...identifierForm, identifier: e.target.value })}
              placeholder="3"
            />
          </Field>
          <Field label="Min score">
            <input
              required
              type="number"
              className={inputClass}
              value={identifierForm.min_score}
              onChange={(e) => setIdentifierForm({ ...identifierForm, min_score: e.target.value })}
              placeholder="2.5"
            />
          </Field>
          <Field label="Max score">
            <input
              required
              type="number"
              className={inputClass}
              value={identifierForm.max_score}
              onChange={(e) => setIdentifierForm({ ...identifierForm, max_score: e.target.value })}
              placeholder="3.0"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descriptor">
              <input
                required
                className={inputClass}
                value={identifierForm.descriptor}
                onChange={(e) =>
                  setIdentifierForm({ ...identifierForm, descriptor: e.target.value })
                }
                placeholder="Outstanding"
              />
            </Field>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Btn type="submit" variant="accent" disabled={saveIdentifierScale.isPending}>
              {identifierForm.id ? "Save changes" : "Add identifier"}
            </Btn>
            {identifierForm.id && (
              <Btn
                variant="ghost"
                onClick={() =>
                  setIdentifierForm({
                    id: "",
                    identifier: "3",
                    min_score: "",
                    max_score: "",
                    descriptor: "",
                  })
                }
              >
                Cancel
              </Btn>
            )}
          </div>
        </form>
      </Panel>
      </div>
      </section>

      <Panel title="Saved grading outputs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Grading scales and identifiers</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose a category to view, edit or remove its entries.</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {(data?.gradingScales.length ?? 0) + (data?.identifierScales.length ?? 0)} entries
          </span>
        </div>
        <div role="tablist" aria-label="Grading output category" className="mb-4 flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 sm:w-fit">
          {[
            { id: "o_level" as const, label: "O-Level", count: data?.gradingScales.filter((item) => item.education_level !== "advanced").length ?? 0, colors: "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-200" },
            { id: "identifiers" as const, label: "Identifiers", count: data?.identifierScales.length ?? 0, colors: "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-200" },
            { id: "a_level" as const, label: "A-Level", count: data?.gradingScales.filter((item) => item.education_level === "advanced").length ?? 0, colors: "border-violet-400 bg-violet-50 text-violet-800 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-200" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`grading-tab-${tab.id}`}
              aria-controls="grading-output-panel"
              aria-selected={activeOutput === tab.id}
              onClick={() => setActiveOutput(tab.id)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all sm:flex-none ${tab.colors} ${activeOutput === tab.id ? "ring-2 ring-current ring-offset-1 ring-offset-background shadow-sm" : "opacity-80 hover:opacity-100"}`}
            >
              {tab.label}
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs tabular-nums">{tab.count}</span>
            </button>
          ))}
        </div>
        <div
          id="grading-output-panel"
          role="tabpanel"
          aria-labelledby={`grading-tab-${activeOutput}`}
          className="overflow-x-auto rounded-xl border border-border"
        >
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Grade / identifier</th>
                <th className="px-3 py-3 font-semibold">Score range</th>
                <th className="px-3 py-3 font-semibold">
                  {activeOutput === "a_level" ? "Points" : "Descriptor"}
                </th>
                <th className="px-3 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeOutput === "o_level" && (data?.gradingScales ?? [])
                .filter((item) => item.education_level !== "advanced")
                .map((item) => (
                  <tr key={`o-${item.id}`} className="align-top transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3"><Pill tone="muted">O-Level</Pill></td>
                    <td className="px-3 py-3 font-semibold text-foreground">{item.grade}</td>
                    <td className="px-3 py-3 tabular-nums">{item.min_score}–{item.max_score}</td>
                    <td className="max-w-md px-3 py-3 text-muted-foreground">{item.grade_descriptor}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Btn variant="ghost" onClick={() => setOLevelGradingForm({ id: item.id, grade: item.grade, min_score: String(item.min_score), max_score: String(item.max_score), grade_descriptor: item.grade_descriptor })}>Edit</Btn>
                        <Btn variant="ghost" onClick={() => removeScale.mutate(item.id)}>Delete</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              {activeOutput === "identifiers" && (data?.identifierScales ?? []).map((item) => (
                <tr key={`identifier-${item.id}`} className="align-top transition-colors hover:bg-muted/30">
                  <td className="px-3 py-3"><Pill tone="muted">O-Level identifier</Pill></td>
                  <td className="px-3 py-3 font-semibold text-foreground">{item.identifier}</td>
                  <td className="px-3 py-3 tabular-nums">{item.min_score}–{item.max_score}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.descriptor}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" onClick={() => setIdentifierForm({ id: item.id, identifier: String(item.identifier), min_score: String(item.min_score), max_score: String(item.max_score), descriptor: item.descriptor })}>Edit</Btn>
                      <Btn variant="ghost" onClick={() => removeIdentifierScale.mutate(item.id)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {activeOutput === "a_level" && (data?.gradingScales ?? [])
                .filter((item) => item.education_level === "advanced")
                .map((item) => (
                  <tr key={`a-${item.id}`} className="align-top transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3"><Pill tone="muted">A-Level</Pill></td>
                    <td className="px-3 py-3 font-semibold text-foreground">{item.grade}</td>
                    <td className="px-3 py-3 tabular-nums">{item.min_score}–{item.max_score}</td>
                    <td className="px-3 py-3 text-center font-medium">{item.points ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Btn variant="ghost" onClick={() => setALevelGradingForm({ id: item.id, grade: item.grade, min_score: String(item.min_score), max_score: String(item.max_score), points: String(item.points ?? "") })}>Edit</Btn>
                        <Btn variant="ghost" onClick={() => removeScale.mutate(item.id)}>Delete</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              {((activeOutput === "o_level" && !(data?.gradingScales ?? []).some((item) => item.education_level !== "advanced")) ||
                (activeOutput === "a_level" && !(data?.gradingScales ?? []).some((item) => item.education_level === "advanced")) ||
                (activeOutput === "identifiers" && !(data?.identifierScales ?? []).length)) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No {activeOutput === "o_level" ? "O-Level grades" : activeOutput === "a_level" ? "A-Level grades" : "identifiers"} added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {canManageReportComments && (
        <Panel title="Report comment criteria">
          <p className="mb-4 text-sm text-muted-foreground">
            Set the comments used for class-teacher and head-teacher report remarks.
          </p>
          <form
            className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveReportCommentRule.mutate();
            }}
          >
            <Field label="Comment role">
              <select
                className={inputClass}
                value={commentRuleForm.commentRole}
                onChange={(event) =>
                  setCommentRuleForm({
                    ...commentRuleForm,
                    commentRole: event.target.value as "class_teacher" | "head_teacher",
                  })
                }
              >
                <option value="class_teacher">Class teacher</option>
                <option value="head_teacher">Head teacher</option>
              </select>
            </Field>
            <Field label="Criterion type">
              <select
                className={inputClass}
                value={commentRuleForm.points ? "points" : "descriptor"}
                onChange={(event) =>
                  setCommentRuleForm({
                    ...commentRuleForm,
                    points: event.target.value === "points" ? commentRuleForm.points || "3" : "",
                  })
                }
              >
                <option value="descriptor">Descriptor</option>
                <option value="points">A-Level points</option>
              </select>
            </Field>
            <Field label={commentRuleForm.points ? "Points (3-17)" : "Descriptor"}>
              {commentRuleForm.points ? (
                <select
                  className={inputClass}
                  value={commentRuleForm.points}
                  onChange={(event) =>
                    setCommentRuleForm({ ...commentRuleForm, points: event.target.value })
                  }
                >
                  {Array.from({ length: 15 }, (_, index) => index + 3).map((points) => (
                    <option key={points} value={points}>{points}</option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  className={inputClass}
                  value={commentRuleForm.descriptor}
                  onChange={(event) =>
                    setCommentRuleForm({ ...commentRuleForm, descriptor: event.target.value })
                  }
                  placeholder="Outstanding"
                />
              )}
            </Field>
            <Field label="Comment">
              <input
                required
                className={inputClass}
                value={commentRuleForm.comment}
                onChange={(event) =>
                  setCommentRuleForm({ ...commentRuleForm, comment: event.target.value })
                }
                placeholder="Enter report comment"
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Btn type="submit" variant="accent" disabled={saveReportCommentRule.isPending}>
                {commentRuleForm.id ? "Save changes" : "Add criterion"}
              </Btn>
              {commentRuleForm.id && (
                <Btn
                  variant="ghost"
                  onClick={() =>
                    setCommentRuleForm({
                      id: "",
                      commentRole: "class_teacher",
                      descriptor: "Outstanding",
                      points: "",
                      comment: "",
                    })
                  }
                >
                  Cancel
                </Btn>
              )}
            </div>
          </form>

          <div className="mt-5 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Criterion</th>
                  <th className="px-3 py-3">Comment</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportCommentRules.map((rule) => (
                  <tr key={rule.id} className="align-top hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <Pill tone="muted">
                        {rule.comment_role === "class_teacher" ? "Class teacher" : "Head teacher"}
                      </Pill>
                    </td>
                    <td className="px-3 py-3">
                      {rule.points != null ? `Points ${rule.points}` : rule.descriptor}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{rule.comment}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Btn
                          variant="ghost"
                          onClick={() =>
                            setCommentRuleForm({
                              id: rule.id,
                              commentRole: rule.comment_role,
                              descriptor: rule.descriptor,
                              points: rule.points == null ? "" : String(rule.points),
                              comment: rule.comment,
                            })
                          }
                        >
                          Edit
                        </Btn>
                        <Btn
                          variant="danger"
                          disabled={removeReportCommentRule.isPending}
                          onClick={() => {
                            if (window.confirm("Delete this report comment criterion?")) {
                              removeReportCommentRule.mutate(rule);
                            }
                          }}
                        >
                          Delete
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoadingCommentRules && reportCommentRules.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No report comment criteria added yet.
                    </td>
                  </tr>
                )}
                {isLoadingCommentRules && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      Loading criteria...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
