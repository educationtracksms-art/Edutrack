import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { hasAny } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import { updateAssessmentPeriod } from "@/lib/admin.functions";
import { useAcademicsPage } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/calendar")({
  head: () => ({
    meta: [{ title: "Years & terms | EduTrack" }],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const queryClient = useQueryClient();
  const { me, schoolId, allowed, data, refresh } = useAcademicsPage();
  const updatePeriod = useServerFn(updateAssessmentPeriod);
  const periodsQuery = useQuery({
    queryKey: ["assessment-periods", schoolId],
    enabled: !!schoolId && hasAny(me?.roles, ["dos"]),
    queryFn: async () => {
      const { data: periods } = await (supabase as any)
        .from("assessment_periods")
        .select("term_id, exam_type, is_active, is_locked")
        .eq("school_id", schoolId!);
      const [{ data: currentYear }, { data: currentTerm }] = await Promise.all([
        supabase
          .from("academic_years")
          .select("id")
          .eq("school_id", schoolId!)
          .eq("is_current", true)
          .maybeSingle(),
        supabase
          .from("terms")
          .select("id, academic_year_id")
          .eq("school_id", schoolId!)
          .eq("is_current", true)
          .maybeSingle(),
      ]);
      return (periods ?? []).filter((period: any) => period.term_id === currentTerm?.id);
    },
  });
  const periodMutation = useMutation({
    mutationFn: (values: any) => updatePeriod({ data: values }),
    onSuccess: () => {
      toast.success("Assessment period updated and staff notified");
      queryClient.invalidateQueries({ queryKey: ["assessment-periods"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });
  const canEditNextTermDate = hasAny(me?.roles, ["dos", "head_teacher", "deputy_head_teacher"]);
  const [yearForm, setYearForm] = useState({ name: "" });
  const [termForm, setTermForm] = useState({
    name: "",
    academic_year_id: "",
    start_date: "",
    end_date: "",
  });
  const [nextTermBeginsOn, setNextTermBeginsOn] = useState("");
  useEffect(() => {
    setNextTermBeginsOn(data?.school?.report_next_term_begins_on ?? "");
  }, [data?.school?.report_next_term_begins_on]);
  const saveNextTermDate = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!canEditNextTermDate) throw new Error("You are not allowed to update this date");
      const { error: updateError } = await supabase
        .from("schools")
        .update({ report_next_term_begins_on: nextTermBeginsOn || null })
        .eq("id", schoolId);
      if (updateError) throw new Error(updateError.message);

      const { data: savedRow, error: readError } = await supabase
        .from("schools")
        .select("report_next_term_begins_on")
        .eq("id", schoolId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if ((savedRow?.report_next_term_begins_on ?? null) !== (nextTermBeginsOn || null)) {
        throw new Error("The next term date was not saved");
      }
    },
    onSuccess: () => {
      toast.success("Next term date updated");
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  async function setYearAsCurrent(yearId: string) {
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { error: clearError } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("school_id", schoolId);
    if (clearError) throw new Error(clearError.message);
    const { error: selectError } = await supabase
      .from("academic_years")
      .update({ is_current: true })
      .eq("id", yearId)
      .eq("school_id", schoolId);
    if (selectError) throw new Error(selectError.message);
  }

  async function setTermAsCurrent(termId: string) {
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { data: term, error: termLookupError } = await supabase
      .from("terms")
      .select("academic_year_id")
      .eq("id", termId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (termLookupError) throw new Error(termLookupError.message);
    if (!term?.academic_year_id) throw new Error("The selected term is missing an academic year");

    const { error: clearTermsError } = await supabase
      .from("terms")
      .update({ is_current: false })
      .eq("school_id", schoolId);
    if (clearTermsError) throw new Error(clearTermsError.message);
    const { error: selectTermError } = await supabase
      .from("terms")
      .update({ is_current: true })
      .eq("id", termId)
      .eq("school_id", schoolId);
    if (selectTermError) throw new Error(selectTermError.message);

    const { error: clearYearsError } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("school_id", schoolId);
    if (clearYearsError) throw new Error(clearYearsError.message);
    const { error: selectYearError } = await supabase
      .from("academic_years")
      .update({ is_current: true })
      .eq("id", term.academic_year_id)
      .eq("school_id", schoolId);
    if (selectYearError) throw new Error(selectYearError.message);
  }
  const addYear = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const name = yearForm.name.trim();
      if (!name) throw new Error("Enter an academic year name");
      const { data: created, error } = await supabase
        .from("academic_years")
        .insert({ school_id: schoolId, name })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await setYearAsCurrent(created.id);
      return created.id;
    },
    onSuccess: () => {
      setYearForm({ name: "" });
      toast.success("Academic year created and set as current");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTerm = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const name = termForm.name.trim();
      if (!name) throw new Error("Enter a term name");
      if (!termForm.academic_year_id) throw new Error("Choose an academic year for this term");
      if (!data?.academicYears.some((year) => year.id === termForm.academic_year_id)) {
        throw new Error("The selected academic year is no longer available. Choose a year again");
      }
      if (!termForm.start_date || !termForm.end_date) {
        throw new Error("Add both the term start date and end date first");
      }
      if (termForm.end_date < termForm.start_date) {
        throw new Error("Term end date must be on or after the start date");
      }
      const { data: created, error } = await supabase
        .from("terms")
        .insert({
          school_id: schoolId,
          academic_year_id: termForm.academic_year_id,
          name,
          start_date: termForm.start_date,
          end_date: termForm.end_date,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await setTermAsCurrent(created.id);
      return created.id;
    },
    onSuccess: () => {
      setTermForm({ name: "", academic_year_id: "", start_date: "", end_date: "" });
      toast.success("Term created and set as current");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeYearCurrent = useMutation({
    mutationFn: (yearId: string) => setYearAsCurrent(yearId),
    onSuccess: () => {
      toast.success("Academic year set as current");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeTermCurrent = useMutation({
    mutationFn: (termId: string) => setTermAsCurrent(termId),
    onSuccess: () => {
      toast.success("Term set as current");
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
        title="Years & terms"
        description="Set the academic calendar, control assessment periods and keep the next term date current."
      />
      {hasAny(me?.roles, ["dos"]) && (
        <Panel title="Assessment periods" className="mb-4">
          <p className="mb-3 text-sm text-muted-foreground">Activate a period for reports and open or lock mark entry.</p>
          <div className="space-y-2">
            {(periodsQuery.data ?? []).map((period: any) => {
              const term = (data?.terms ?? []).find((item: any) => item.id === period.term_id)?.name ?? period.term_id;
              const label = period.exam_type.replaceAll("_", " ");
              return <div key={`${period.term_id}-${period.exam_type}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><span className="capitalize font-medium">{term} · {label}</span><div className="flex gap-2"><button className={`rounded-md border px-3 py-1 text-sm font-medium ${period.is_active ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`} onClick={() => periodMutation.mutate({ termId: period.term_id, examType: period.exam_type, isActive: !period.is_active, isLocked: false })}>{period.is_active ? "Deactivate" : "Activate"}</button>{period.is_active && <button className={`rounded-md border px-3 py-1 text-sm font-medium ${period.is_locked ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`} onClick={() => periodMutation.mutate({ termId: period.term_id, examType: period.exam_type, isActive: true, isLocked: !period.is_locked })}>{period.is_locked ? "Open entry" : "Lock entry"}</button>}</div></div>;
            })}
          </div>
        </Panel>
      )}

      <Panel title="Next term date" className="mb-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            saveNextTermDate.mutate();
          }}
        >
          <Field label="Next term begins on">
            <input
              type="date"
              className={inputClass}
              value={nextTermBeginsOn}
              disabled={!canEditNextTermDate}
              onChange={(e) => setNextTermBeginsOn(e.target.value)}
            />
          </Field>
          <Btn
            type="submit"
            variant="accent"
            disabled={!canEditNextTermDate || saveNextTermDate.isPending}
          >
            Save date
          </Btn>
        </form>
        {!canEditNextTermDate && (
          <p className="mt-2 text-xs text-muted-foreground">
            Only the Director of Studies, Head Teacher, or Deputy Head Teacher can edit this date.
          </p>
        )}
      </Panel>
        <Panel title="Academic years">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addYear.mutate();
            }}
          >
            <Field label="Year name">
              <input
                required
                className={inputClass}
                value={yearForm.name}
                onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
              />
            </Field>
            <Btn type="submit" variant="accent" disabled={addYear.isPending}>
              Create year
            </Btn>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.academicYears ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <span>{item.name}</span>
                  {item.is_current && <Pill tone="success">Current</Pill>}
                </span>
                <Btn
                  variant="ghost"
                  onClick={() => makeYearCurrent.mutate(item.id)}
                  disabled={makeYearCurrent.isPending || item.is_current}
                >
                  Use this year
                </Btn>
              </li>
            ))}
            {(data?.academicYears ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No academic years yet.</p>
            )}
          </ul>
        </Panel>

        <Panel title="Terms">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTerm.mutate();
            }}
          >
            <Field label="Academic year">
              <select
                required
                className={inputClass}
                value={termForm.academic_year_id}
                onChange={(e) => setTermForm({ ...termForm, academic_year_id: e.target.value })}
              >
                <option value="">Select year</option>
                {(data?.academicYears ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Term name">
              <select
                required
                className={inputClass}
                value={termForm.name}
                onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
              >
                <option value="">Select term</option>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </Field>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Start date">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={termForm.start_date}
                  onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                />
              </Field>
              <Field label="End date">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={termForm.end_date}
                  onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                />
              </Field>
            </div>
            <Btn type="submit" variant="accent" disabled={addTerm.isPending}>
              Create term
            </Btn>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.terms ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <span>{item.name}</span>
                  {item.is_current && <Pill tone="success">Current</Pill>}
                </span>
                <Btn
                  variant="ghost"
                  onClick={() => makeTermCurrent.mutate(item.id)}
                  disabled={makeTermCurrent.isPending || item.is_current}
                >
                  Use this term
                </Btn>
              </li>
            ))}
            {(data?.terms ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No terms yet.</p>
            )}
          </ul>
        </Panel>
    </div>
  );
}
