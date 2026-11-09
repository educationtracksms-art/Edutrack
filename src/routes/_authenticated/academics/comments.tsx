import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { deleteReportCommentRule, upsertReportCommentRule } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAcademicsPage } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/comments")({
  head: () => ({
    meta: [{ title: "Comments | EduTrack" }],
  }),
  component: CommentsPage,
});

type ReportCommentRule = {
  id: string;
  comment_role: "class_teacher" | "head_teacher";
  descriptor: string;
  points: number | null;
  comment: string;
};

function CommentsPage() {
  const { schoolId } = useAcademicsPage();
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const saveReportCommentRuleFn = useServerFn(upsertReportCommentRule);
  const deleteReportCommentRuleFn = useServerFn(deleteReportCommentRule);
  const canManageReportComments = hasAny(me?.roles, [
    "dos",
    "head_teacher",
    "deputy_head_teacher",
  ]);
  const [commentRuleForm, setCommentRuleForm] = useState({
    id: "",
    commentRole: "class_teacher" as "class_teacher" | "head_teacher",
    descriptor: "Outstanding",
    points: "",
    comment: "",
  });

  const {
    data: reportCommentRules = [],
    isLoading: isLoadingCommentRules,
    isError: isCommentRulesError,
    error: commentRulesError,
  } = useQuery({
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
      return (rules ?? []) as ReportCommentRule[];
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
    onError: (error: Error) => toast.error(error.message),
  });

  const removeReportCommentRule = useMutation({
    mutationFn: async (rule: ReportCommentRule) =>
      deleteReportCommentRuleFn({ data: { id: rule.id, commentRole: rule.comment_role } }),
    onSuccess: async () => {
      toast.success("Report comment criterion deleted");
      await queryClient.invalidateQueries({ queryKey: ["academics-report-comment-rules", schoolId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!canManageReportComments) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the Director of Studies and school leadership can manage report comment criteria.
      </p>
    );
  }
  if (!schoolId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Your account is not linked to a school, so report comment criteria cannot be loaded.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic setup"
        title="Comments"
        description="Set the criteria and report remarks used for class-teacher and head-teacher comments."
      />
      <Panel title="Report comment criteria">
        {isCommentRulesError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            Could not load report comment criteria: {commentRulesError.message}
          </p>
        )}
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
              {!isLoadingCommentRules && !isCommentRulesError && reportCommentRules.length === 0 && (
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
    </div>
  );
}
