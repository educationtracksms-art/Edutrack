import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import {
  deleteGradingScale,
  deleteIdentifierScale,
  upsertGradingScale,
  upsertIdentifierScale,
} from "@/lib/admin.functions";
import { useAcademicsPage } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/grading")({
  head: () => ({
    meta: [{ title: "Grading | EduTrack" }],
  }),
  component: GradingPage,
});

function GradingPage() {
  const { schoolId, allowed, data, refresh } = useAcademicsPage();
  const saveGradingScaleFn = useServerFn(upsertGradingScale);
  const deleteGradingScaleFn = useServerFn(deleteGradingScale);
  const saveIdentifierScaleFn = useServerFn(upsertIdentifierScale);
  const deleteIdentifierScaleFn = useServerFn(deleteIdentifierScale);
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

  if (!allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the Director of Studies and school leadership can manage academic setup.
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Academic setup"
        title="Grading"
        description="Grade bands for O-Level and A-Level results, plus identifier descriptors for report cards."
      />
      <Panel title="O-level grading criteria" className="mt-4">
        <form
          className="mb-4 grid gap-3 lg:grid-cols-4"
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
          <div className="lg:col-span-2">
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
          <div className="flex items-end gap-2 lg:col-span-4">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Grade</th>
                <th className="pb-2">Score range</th>
                <th className="pb-2">Grade descriptor</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {(
                (data?.gradingScales ?? []).filter((item) => item.education_level !== "advanced") ??
                []
              ).map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="py-2 font-medium">{item.grade}</td>
                  <td>
                    {item.min_score} - {item.max_score}
                  </td>
                  <td>{item.grade_descriptor}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Btn
                        variant="ghost"
                        onClick={() =>
                          setOLevelGradingForm({
                            id: item.id,
                            grade: item.grade,
                            min_score: String(item.min_score),
                            max_score: String(item.max_score),
                            grade_descriptor: item.grade_descriptor,
                          })
                        }
                      >
                        Edit
                      </Btn>
                      <Btn variant="ghost" onClick={() => removeScale.mutate(item.id)}>
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {(
                (data?.gradingScales ?? []).filter((item) => item.education_level !== "advanced") ??
                []
              ).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No O-level grading criteria set yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="A-level grading criteria" className="mt-4">
        <form
          className="mb-4 grid gap-3 lg:grid-cols-4"
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
          <div className="flex items-end gap-2 lg:col-span-4">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Grade</th>
                <th className="pb-2">Score range</th>
                <th className="pb-2">Points</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {(
                (data?.gradingScales ?? []).filter((item) => item.education_level === "advanced") ??
                []
              ).map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="py-2 font-medium">{item.grade}</td>
                  <td>
                    {item.min_score} - {item.max_score}
                  </td>
                  <td>{item.points ?? "—"}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Btn
                        variant="ghost"
                        onClick={() =>
                          setALevelGradingForm({
                            id: item.id,
                            grade: item.grade,
                            min_score: String(item.min_score),
                            max_score: String(item.max_score),
                            points: String(item.points ?? ""),
                          })
                        }
                      >
                        Edit
                      </Btn>
                      <Btn variant="ghost" onClick={() => removeScale.mutate(item.id)}>
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {(
                (data?.gradingScales ?? []).filter((item) => item.education_level === "advanced") ??
                []
              ).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No A-level grading criteria set yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Identifier descriptor" className="mt-4">
        <form
          className="mb-4 grid gap-3 lg:grid-cols-4"
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
          <div className="lg:col-span-2">
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
          <div className="flex items-end gap-2 lg:col-span-4">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Identifier</th>
                <th className="pb-2">Score range</th>
                <th className="pb-2">Descriptor</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {(data?.identifierScales ?? []).map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-2 font-medium">{item.identifier}</td>
                  <td>
                    {item.min_score} - {item.max_score}
                  </td>
                  <td>{item.descriptor}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Btn
                        variant="ghost"
                        onClick={() =>
                          setIdentifierForm({
                            id: item.id,
                            identifier: String(item.identifier),
                            min_score: String(item.min_score),
                            max_score: String(item.max_score),
                            descriptor: item.descriptor,
                          })
                        }
                      >
                        Edit
                      </Btn>
                      <Btn variant="ghost" onClick={() => removeIdentifierScale.mutate(item.id)}>
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {(data?.identifierScales ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No identifier descriptor rows yet.
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
