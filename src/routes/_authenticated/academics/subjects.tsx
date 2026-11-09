import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAcademicsPage, type AcademicSubject } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/subjects")({
  head: () => ({
    meta: [{ title: "Subjects | EduTrack" }],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const { me, schoolId, allowed, data, refresh } = useAcademicsPage();
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    code: "",
    department_id: "",
    category: "",
    position: "",
    points: "1",
  });
  const [aLevelSubjectForm, setALevelSubjectForm] = useState<{
    name: string;
    code: string;
    department_id: string;
    category: string;
    position: string;
    points: string;
    is_subsidiary: boolean;
    papers: string[];
  }>({
    name: "",
    code: "",
    department_id: "",
    category: "",
    position: "",
    points: "1",
    is_subsidiary: false,
    papers: [],
  });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [editingOLevelSubjectId, setEditingOLevelSubjectId] = useState<string | null>(null);
  const [editingALevelSubjectId, setEditingALevelSubjectId] = useState<string | null>(null);
  function resetSubjectForm() {
    setSubjectForm({
      name: "",
      code: "",
      department_id: "",
      category: "",
      position: "",
      points: "1",
    });
    setEditingOLevelSubjectId(null);
  }

  function resetALevelSubjectForm() {
    setALevelSubjectForm({
      name: "",
      code: "",
      department_id: "",
      category: "",
      position: "",
      points: "1",
      is_subsidiary: false,
      papers: [],
    });
    setEditingALevelSubjectId(null);
  }
  const addSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const name = subjectForm.name.trim();
      if (!name) throw new Error("Enter a subject name first");
      if (!subjectForm.department_id) throw new Error("Choose the subject department first");
      if (!data?.departments.some((department) => department.id === subjectForm.department_id)) {
        throw new Error("The selected department is no longer available. Choose it again");
      }
      const points = Number(subjectForm.points);
      if (Number.isNaN(points) || points < 1 || points > 5)
        throw new Error("Subject points must be between 1 and 5");
      if (
        subjectForm.position &&
        (!Number.isInteger(Number(subjectForm.position)) || Number(subjectForm.position) < 1)
      ) {
        throw new Error("Subject position must be a whole number greater than zero");
      }
      const { error } = await supabase.from("subjects").insert({
        school_id: schoolId,
        name,
        code: subjectForm.code || null,
        department_id: subjectForm.department_id,
        category: subjectForm.category || undefined,
        points,
        position: subjectForm.position
          ? Number(subjectForm.position)
          : (data?.subjects.length ?? 0) + 1,
        education_level: "ordinary",
        is_subsidiary: false,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetSubjectForm();
      toast.success("Subject added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!editingOLevelSubjectId) throw new Error("No O-Level subject selected for update");
      const name = subjectForm.name.trim();
      if (!name) throw new Error("Enter a subject name first");
      if (!subjectForm.department_id) throw new Error("Choose the subject department first");
      if (!data?.departments.some((department) => department.id === subjectForm.department_id)) {
        throw new Error("The selected department is no longer available. Choose it again");
      }
      const points = Number(subjectForm.points);
      if (Number.isNaN(points) || points < 1 || points > 5)
        throw new Error("Subject points must be between 1 and 5");
      if (
        subjectForm.position &&
        (!Number.isInteger(Number(subjectForm.position)) || Number(subjectForm.position) < 1)
      ) {
        throw new Error("Subject position must be a whole number greater than zero");
      }
      const { error } = await supabase
        .from("subjects")
        .update({
          name,
          code: subjectForm.code || null,
          department_id: subjectForm.department_id,
          category: subjectForm.category || undefined,
          points,
          position: subjectForm.position
            ? Number(subjectForm.position)
            : (data?.subjects.length ?? 0) + 1,
          education_level: "ordinary",
          is_subsidiary: false,
        })
        .eq("id", editingOLevelSubjectId)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetSubjectForm();
      toast.success("Subject updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSubject = useMutation({
    mutationFn: async (subject: AcademicSubject) => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", subject.id)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
      return subject.education_level;
    },
    onSuccess: (educationLevel) => {
      if (educationLevel === "advanced") resetALevelSubjectForm();
      else resetSubjectForm();
      toast.success("Subject deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addALevelSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const name = aLevelSubjectForm.name.trim();
      if (!name) throw new Error("Enter an A-Level subject name first");
      if (!aLevelSubjectForm.department_id) throw new Error("Choose the subject department first");
      if (!data?.departments.some((department) => department.id === aLevelSubjectForm.department_id)) {
        throw new Error("The selected department is no longer available. Choose it again");
      }
      const points = Number(aLevelSubjectForm.points);
      if (Number.isNaN(points) || points < 1 || points > 5) throw new Error("Subject points must be between 1 and 5");
      if (aLevelSubjectForm.position && (!Number.isInteger(Number(aLevelSubjectForm.position)) || Number(aLevelSubjectForm.position) < 1)) {
        throw new Error("Subject position must be a whole number greater than zero");
      }
      const paperNames = aLevelSubjectForm.papers.map((paper) => paper.trim()).filter(Boolean);
      if (new Set(paperNames.map((paper) => paper.toLowerCase())).size !== paperNames.length) {
        throw new Error("Paper names must be unique");
      }
      const { data: createdSubject, error } = await supabase.from("subjects").insert({
        school_id: schoolId,
        name,
        code: aLevelSubjectForm.code || null,
        department_id: aLevelSubjectForm.department_id,
        category: aLevelSubjectForm.category || undefined,
        points,
        position: aLevelSubjectForm.position ? Number(aLevelSubjectForm.position) : (data?.subjects.length ?? 0) + 1,
        education_level: "advanced",
        is_subsidiary: aLevelSubjectForm.is_subsidiary,
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (!createdSubject) throw new Error("The A-Level subject was created without an id");
      if (paperNames.length) {
        const { error: papersError } = await (supabase as any).from("subject_papers").insert(
          paperNames.map((paper, index) => ({
            school_id: schoolId,
            subject_id: createdSubject.id,
            name: paper,
            position: index + 1,
          })),
        );
        if (papersError) {
          await supabase.from("subjects").delete().eq("id", createdSubject.id).eq("school_id", schoolId);
          throw new Error(`The subject was not saved because its papers could not be saved: ${papersError.message}`);
        }
      }
    },
    onSuccess: () => {
      resetALevelSubjectForm();
      toast.success("A-Level subject added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateALevelSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!editingALevelSubjectId) throw new Error("No A-Level subject selected for update");
      const name = aLevelSubjectForm.name.trim();
      if (!name) throw new Error("Enter an A-Level subject name first");
      if (!aLevelSubjectForm.department_id) throw new Error("Choose the subject department first");
      if (!data?.departments.some((department) => department.id === aLevelSubjectForm.department_id)) {
        throw new Error("The selected department is no longer available. Choose it again");
      }
      const points = Number(aLevelSubjectForm.points);
      if (Number.isNaN(points) || points < 1 || points > 5) throw new Error("Subject points must be between 1 and 5");
      if (aLevelSubjectForm.position && (!Number.isInteger(Number(aLevelSubjectForm.position)) || Number(aLevelSubjectForm.position) < 1)) {
        throw new Error("Subject position must be a whole number greater than zero");
      }
      const paperNames = aLevelSubjectForm.papers.map((paper) => paper.trim()).filter(Boolean);
      if (new Set(paperNames.map((paper) => paper.toLowerCase())).size !== paperNames.length) {
        throw new Error("Paper names must be unique");
      }
      const { error } = await supabase
        .from("subjects")
        .update({
          name,
          code: aLevelSubjectForm.code || null,
          department_id: aLevelSubjectForm.department_id,
          category: aLevelSubjectForm.category || undefined,
          points,
          position: aLevelSubjectForm.position ? Number(aLevelSubjectForm.position) : (data?.subjects.length ?? 0) + 1,
          education_level: "advanced",
          is_subsidiary: aLevelSubjectForm.is_subsidiary,
        })
        .eq("id", editingALevelSubjectId)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);

      const existingPapers = (data?.subjectPapers ?? [])
        .filter((paper) => paper.subject_id === editingALevelSubjectId)
        .sort((a, b) => a.position - b.position);
      // Free the unique paper names first so renaming/reordering Paper 1 and
      // Paper 2 cannot fail because the old names temporarily collide.
      for (const existingPaper of existingPapers) {
        const { error: stagingError } = await (supabase as any)
          .from("subject_papers")
          .update({ name: `__pending_${existingPaper.id}` })
          .eq("id", existingPaper.id)
          .eq("school_id", schoolId);
        if (stagingError) throw new Error(`Unable to prepare the existing papers for update: ${stagingError.message}`);
      }
      for (const [index, paperName] of paperNames.entries()) {
        const existingPaper = existingPapers[index];
        const result = existingPaper
          ? await (supabase as any)
              .from("subject_papers")
              .update({ name: paperName, position: index + 1 })
              .eq("id", existingPaper.id)
              .eq("school_id", schoolId)
          : await (supabase as any).from("subject_papers").insert({
              school_id: schoolId,
              subject_id: editingALevelSubjectId,
              name: paperName,
              position: index + 1,
            });
        if (result.error) throw new Error(`The subject was updated but paper ${index + 1} was not saved: ${result.error.message}`);
      }
      const removedPapers = existingPapers.slice(paperNames.length);
      if (removedPapers.length) {
        const { error: removePapersError } = await (supabase as any)
          .from("subject_papers")
          .delete()
          .in("id", removedPapers.map((paper) => paper.id))
          .eq("school_id", schoolId);
        if (removePapersError) throw new Error(`The subject was updated but removed papers could not be synchronized: ${removePapersError.message}`);
      }
    },
    onSuccess: () => {
      resetALevelSubjectForm();
      toast.success("A-Level subject updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const departmentName = (id: string | null | undefined) =>
    data?.departments.find((department) => department.id === id)?.name ?? "Not assigned";
  function startEditingSubject(item: AcademicSubject) {
    if (item.education_level === "advanced") {
      setEditingALevelSubjectId(item.id);
      const papers = (data?.subjectPapers ?? [])
        .filter((paper) => paper.subject_id === item.id)
        .sort((a, b) => a.position - b.position)
        .map((paper) => paper.name);
      setALevelSubjectForm({
        name: item.name ?? "",
        code: item.code ?? "",
        department_id: item.department_id ?? "",
        category: item.category ?? "",
        position: item.position?.toString() ?? "",
        points: item.points?.toString() ?? "1",
        is_subsidiary: Boolean(item.is_subsidiary),
        papers,
      });
      return;
    }
    setEditingOLevelSubjectId(item.id);
    setSubjectForm({
      name: item.name ?? "",
      code: item.code ?? "",
      department_id: item.department_id ?? "",
      category: item.category ?? "",
      position: item.position?.toString() ?? "",
      points: item.points?.toString() ?? "1",
    });
  }

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
        title="Subjects"
        description="Manage O-Level and A-Level subjects, departments and papers."
      />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "O-Level", value: data?.subjects.filter((item) => item.education_level !== "advanced").length ?? 0, styles: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300" },
          { label: "A-Level", value: data?.subjects.filter((item) => item.education_level === "advanced").length ?? 0, styles: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300" },
          { label: "Departments", value: data?.departments.length ?? 0, styles: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
        ].map((stat) => (
          <div key={stat.label} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center shadow-sm sm:flex-row sm:justify-between sm:gap-2 sm:px-4 sm:py-3 ${stat.styles}`}>
            <span className="truncate text-[10px] font-semibold leading-tight sm:text-sm">{stat.label}</span>
            <span className="text-lg font-bold tabular-nums leading-tight sm:text-xl">{stat.value}</span>
          </div>
        ))}
      </div>
      <section aria-labelledby="subject-forms-heading">
        <div className="mb-3">
          <h2 id="subject-forms-heading" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Forms · Add or edit</h2>
          <p className="mt-1 text-xs text-muted-foreground">Use the matching form for each subject level.</p>
        </div>
        <div>
          <div className="grid items-start gap-4 xl:grid-cols-2">
          <form
            className="mb-4 grid gap-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/20 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingOLevelSubjectId) updateSubject.mutate();
              else addSubject.mutate();
            }}
          >
            <div className="sm:col-span-2 lg:col-span-3">
              <h3 className="text-sm font-semibold text-foreground">{editingOLevelSubjectId ? "Update O-Level subject" : "Create an O-Level subject"}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Set the subject name, department and assessment details.</p>
            </div>
            <Field label="O-Level subject name">
              <input
                required
                className={inputClass}
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              />
            </Field>
            <Field label="Department">
              <select
                required
                className={inputClass}
                value={subjectForm.department_id}
                onChange={(e) => setSubjectForm({ ...subjectForm, department_id: e.target.value })}
              >
                <option value="">Select department</option>
                {(data?.departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="contents">
              <Field label="Code">
                <input
                  className={inputClass}
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                />
              </Field>
              <Field label="Position">
                <input
                  type="number"
                  className={inputClass}
                  value={subjectForm.position}
                  onChange={(e) => setSubjectForm({ ...subjectForm, position: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Points">
              <input
                required
                type="number"
                min={1}
                max={5}
                className={inputClass}
                value={subjectForm.points}
                onChange={(e) => setSubjectForm({ ...subjectForm, points: e.target.value })}
                placeholder="5"
              />
            </Field>
            <Field label="Category">
              <input
                placeholder="Core / Elective"
                className={inputClass}
                value={subjectForm.category}
                onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              <Btn
                type="submit"
                variant="accent"
                disabled={addSubject.isPending || updateSubject.isPending}
              >
                {editingOLevelSubjectId ? "Save O-Level changes" : "Add O-Level subject"}
              </Btn>
              {editingOLevelSubjectId && (
                <Btn variant="ghost" onClick={resetSubjectForm}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <form
            className="mb-5 grid gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900 dark:bg-violet-950/20 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (editingALevelSubjectId) updateALevelSubject.mutate();
              else addALevelSubject.mutate();
            }}
          >
            <div className="sm:col-span-2 lg:col-span-3">
              <h3 className="text-sm font-semibold">{editingALevelSubjectId ? "Update A-Level subject" : "Create an A-Level subject"}</h3>
              <p className="text-xs text-muted-foreground">
                Create A-Level subjects with optional paper breakdowns.
              </p>
            </div>
            <Field label="A-Level subject name">
              <input
                required
                className={inputClass}
                value={aLevelSubjectForm.name}
                onChange={(event) => setALevelSubjectForm({ ...aLevelSubjectForm, name: event.target.value })}
              />
            </Field>
            <Field label="Department">
              <select
                required
                className={inputClass}
                value={aLevelSubjectForm.department_id}
                onChange={(event) => setALevelSubjectForm({ ...aLevelSubjectForm, department_id: event.target.value })}
              >
                <option value="">Select department</option>
                {(data?.departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </Field>
            <div className="contents">
              <Field label="Code">
                <input className={inputClass} value={aLevelSubjectForm.code} onChange={(event) => setALevelSubjectForm({ ...aLevelSubjectForm, code: event.target.value })} />
              </Field>
              <Field label="Position">
                <input type="number" min={1} className={inputClass} value={aLevelSubjectForm.position} onChange={(event) => setALevelSubjectForm({ ...aLevelSubjectForm, position: event.target.value })} />
              </Field>
            </div>
            <div className="contents">
              <Field label="Points">
                <input required type="number" min={1} max={5} className={inputClass} value={aLevelSubjectForm.points} onChange={(event) => setALevelSubjectForm({ ...aLevelSubjectForm, points: event.target.value })} />
              </Field>
              <Field label="Category">
                <input placeholder="Core / Elective" className={inputClass} value={aLevelSubjectForm.category} onChange={(event) => setALevelSubjectForm({ ...aLevelSubjectForm, category: event.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
              <input id="subject-is-subsidiary" name="subject-is-subsidiary" type="checkbox" checked={aLevelSubjectForm.is_subsidiary} onChange={(event) => setALevelSubjectForm({ ...aLevelSubjectForm, is_subsidiary: event.target.checked })} />
              Subsidiary subject (50+ = 1 point, below 50 = 0)
            </label>
            <div className="rounded-lg border border-violet-200 bg-background/70 p-3 dark:border-violet-800 sm:col-span-2 lg:col-span-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold">Subject papers (optional)</h4>
                  <p className="text-xs text-muted-foreground">Add one paper, multiple papers, or leave this empty for subject-level assessment.</p>
                </div>
                <Btn
                  type="button"
                  variant="ghost"
                  onClick={() => setALevelSubjectForm((current) => ({ ...current, papers: [...current.papers, ""] }))}
                >
                  Add paper
                </Btn>
              </div>
              <div className="space-y-2">
                {aLevelSubjectForm.papers.map((paper, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder={`Paper ${index + 1}`}
                      value={paper}
                      onChange={(event) => setALevelSubjectForm((current) => ({
                        ...current,
                        papers: current.papers.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                      }))}
                    />
                    {aLevelSubjectForm.papers.length > 0 && (
                      <Btn
                        type="button"
                        variant="ghost"
                        onClick={() => setALevelSubjectForm((current) => ({
                          ...current,
                          papers: current.papers.filter((_, itemIndex) => itemIndex !== index),
                        }))}
                      >
                        Remove
                      </Btn>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              <Btn type="submit" variant="accent" disabled={addALevelSubject.isPending || updateALevelSubject.isPending}>
                {editingALevelSubjectId ? "Save A-Level changes" : "Add A-Level subject"}
              </Btn>
              {editingALevelSubjectId && <Btn type="button" variant="ghost" onClick={resetALevelSubjectForm}>Cancel</Btn>}
            </div>
          </form>
          </div>
        </div>
        <Panel title="Output · Saved subjects">
          <div className="mb-3 flex items-center justify-between border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">All subjects</h3>
              <p className="mt-1 text-xs text-muted-foreground">All O-Level and A-Level subjects for this school.</p>
            </div>
            <span className="text-xs text-muted-foreground">{data?.subjects.length ?? 0} total</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Level</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 text-center font-semibold">Points</th>
                    <th className="px-4 py-3 text-center font-semibold">Position</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.subjects ?? []).map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.is_subsidiary && <Pill tone="muted">SUB</Pill>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {departmentName(item.department_id)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {item.code || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone="muted">
                          {item.education_level === "advanced" ? "A-Level" : "O-Level"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.category || "—"}</td>
                      <td className="px-4 py-3 text-center font-medium">{item.points ?? 1}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {item.position ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Btn variant="ghost" onClick={() => startEditingSubject(item)}>
                            Edit
                          </Btn>
                          <Btn
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete subject "${item.name}"?`)) {
                                deleteSubject.mutate(item);
                              }
                            }}
                            disabled={deleteSubject.isPending}
                          >
                            Delete
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data?.subjects?.length && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No subjects added yet.
              </p>
            )}
          </div>
          {false && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
            <div className="mb-3">
              <h3 className="font-semibold">A-Level subject papers</h3>
              <p className="text-xs text-muted-foreground">
                Create Paper 1, Paper 2, or any other papers for A-Level subjects. O-Level subjects do not use papers.
              </p>
            </div>
            <form
              className="grid gap-2 md:grid-cols-[1fr_1fr_8rem_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                return;
              }}
            >
              <select
                required
                className={inputClass}
                value=""
                onChange={() => undefined}
              >
                <option value="">Select A-Level subject</option>
                {(data?.subjects ?? [])
                  .filter((subject) => subject.education_level === "advanced")
                  .map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
              <input
                required
                className={inputClass}
                placeholder="Paper name, e.g. Paper 1"
                value=""
                onChange={() => undefined}
              />
              <input
                type="number"
                min={1}
                className={inputClass}
                placeholder="Position"
                value=""
                onChange={() => undefined}
              />
              <Btn type="submit" variant="accent" disabled>Add paper</Btn>
            </form>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([] as Array<{ id: string; subject_id: string; name: string }>).map((paper) => (
                <div key={paper.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <span>
                    {data?.subjects.find((subject) => subject.id === paper.subject_id)?.name ?? "Subject"} — {paper.name}
                  </span>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete paper "${paper.name}"?`)) return;
                    }}
                    disabled
                  >
                    Delete
                  </Btn>
                </div>
              ))}
            </div>
          </div>}
        </Panel>
      </section>
    </div>
  );
}
