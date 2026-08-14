import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { ACADEMIC_MANAGERS, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { isModuleEnabled } from "@/lib/modules";
import {
  deleteClass,
  deleteIdentifierScale,
  deleteGradingScale,
  deleteStream,
  upsertIdentifierScale,
  upsertGradingScale,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/academics")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "academics"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Academic setup Â· EduTrack" },
      {
        name: "description",
        content: "Create classes, streams and subjects, then allocate teachers to each stream.",
      },
      { property: "og:title", content: "Academic setup Â· EduTrack" },
      {
        property: "og:description",
        content: "Director of Studies control over classes, streams, subjects and teaching loads.",
      },
    ],
  }),
  component: AcademicsPage,
});

function AcademicsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const allowed = hasAny(me?.roles, ACADEMIC_MANAGERS);
  const deleteClassFn = useServerFn(deleteClass);
  const deleteStreamFn = useServerFn(deleteStream);
  const saveGradingScaleFn = useServerFn(upsertGradingScale);
  const deleteGradingScaleFn = useServerFn(deleteGradingScale);
  const saveIdentifierScaleFn = useServerFn(upsertIdentifierScale);
  const deleteIdentifierScaleFn = useServerFn(deleteIdentifierScale);
  const canEditNextTermDate = hasAny(me?.roles, ["dos", "head_teacher", "deputy_head_teacher"]);

  type AcademicClass = {
    id: string;
    name: string;
    level: number | null;
    education_level: string | null;
    class_teacher_id: string | null;
  };
  type AcademicStream = {
    id: string;
    name: string;
    class_id: string;
    stream_teacher_id: string | null;
  };
  type AcademicSubject = {
    id: string;
    name: string;
    code: string | null;
    category: string | null;
    position: number | null;
    points: number | null;
  };

  const [classForm, setClassForm] = useState({
    name: "",
    level: "",
    education_level: "ordinary",
    class_teacher_id: "",
  });
  const [streamForm, setStreamForm] = useState({ name: "", class_id: "", stream_teacher_id: "" });
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    code: "",
    category: "",
    position: "",
    points: "1",
  });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [allocForm, setAllocForm] = useState({
    teacher_id: "",
    subject_id: "",
    class_id: "",
    stream_id: "",
  });
  const [yearForm, setYearForm] = useState({ name: "" });
  const [termForm, setTermForm] = useState({
    name: "",
    academic_year_id: "",
    start_date: "",
    end_date: "",
  });
  const [nextTermBeginsOn, setNextTermBeginsOn] = useState("");

  type QueryResult<T> = {
    data: T | null;
    error: { message: string } | null;
  };

  const { data } = useQuery({
    queryKey: ["academics", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const schoolQuery = <T extends { eq(column: string, value: string): T }>(query: T) =>
        schoolId ? query.eq("school_id", schoolId) : query;
      const safeLoad = async <T,>(promise: Promise<QueryResult<T>>, fallback: T) => {
        const result = await promise;
        if (result.error) return fallback;
        return (result.data ?? fallback) as T;
      };
      const loadIdentifierScales = async () => {
        const primary = await schoolQuery(
          supabase
            .from("grading_identifier_scales")
            .select("*")
            .order("identifier", { ascending: false }),
        );
        if (!primary.error) return primary.data ?? [];

        const fallback = await schoolQuery(
          supabase.from("identifier_scales").select("*").order("identifier", { ascending: false }),
        );
        return fallback.error ? [] : (fallback.data ?? []);
      };

      const [
        classes,
        streams,
        subjects,
        allocations,
        teachers,
        roles,
        academicYears,
        terms,
        scales,
        identifierScales,
        school,
      ] = await Promise.all([
        safeLoad(
          schoolQuery(
            supabase
              .from("classes")
              .select("*")
              .order("education_level", { ascending: false })
              .order("level", { ascending: true })
              .order("name"),
          ),
          [],
        ),
        safeLoad(schoolQuery(supabase.from("streams").select("*").order("name")), []),
        safeLoad(schoolQuery(supabase.from("subjects").select("*").order("position")), []),
        safeLoad(schoolQuery(supabase.from("teacher_allocations").select("*")), []),
        safeLoad(
          schoolQuery(
            supabase.from("profiles").select("id, full_name, initials").order("full_name"),
          ),
          [],
        ),
        safeLoad(schoolQuery(supabase.from("user_roles").select("user_id, role")), []),
        safeLoad(schoolQuery(supabase.from("academic_years").select("*").order("name")), []),
        safeLoad(
          schoolQuery(
            supabase
              .from("terms")
              .select("*")
              .order("start_date", { ascending: true })
              .order("name"),
          ),
          [],
        ),
        safeLoad(
          schoolQuery(
            supabase.from("grading_scales").select("*").order("min_score", { ascending: false }),
          ),
          [],
        ),
        loadIdentifierScales(),
        safeLoad(
          supabase
            .from("schools")
            .select("report_next_term_begins_on")
            .eq("id", schoolId!)
            .maybeSingle(),
          null,
        ),
      ]);
      const teachingRoles = new Set(
        roles
          .filter((r) =>
            [
              "class_teacher",
              "subject_teacher",
              "dos",
              "head_teacher",
              "deputy_head_teacher",
            ].includes(r.role),
          )
          .map((r) => r.user_id),
      );
      return {
        classes,
        streams,
        subjects,
        allocations,
        teachers: teachers.filter((t) => teachingRoles.has(t.id)),
        academicYears,
        terms,
        gradingScales: scales,
        identifierScales,
        school,
      };
    },
  });

  useEffect(() => {
    setNextTermBeginsOn(data?.school?.report_next_term_begins_on ?? "");
  }, [data?.school?.report_next_term_begins_on]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["academics", schoolId] });
  }

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

  function resetClassForm() {
    setClassForm({ name: "", level: "", education_level: "ordinary", class_teacher_id: "" });
    setEditingClassId(null);
  }

  function resetStreamForm() {
    setStreamForm({ name: "", class_id: "", stream_teacher_id: "" });
    setEditingStreamId(null);
  }

  function resetSubjectForm() {
    setSubjectForm({ name: "", code: "", category: "", position: "", points: "1" });
    setEditingSubjectId(null);
  }

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

  const addClass = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const { error } = await supabase.from("classes").insert({
        school_id: schoolId,
        name: classForm.name.trim(),
        level: classForm.level ? Number(classForm.level) : null,
        education_level: classForm.education_level,
        class_teacher_id: classForm.class_teacher_id || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetClassForm();
      toast.success("Class added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateClass = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!editingClassId) throw new Error("No class selected for update");
      const { error } = await supabase
        .from("classes")
        .update({
          name: classForm.name.trim(),
          level: classForm.level ? Number(classForm.level) : null,
          education_level: classForm.education_level,
          class_teacher_id: classForm.class_teacher_id || null,
        })
        .eq("id", editingClassId)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetClassForm();
      toast.success("Class updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStream = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!streamForm.class_id) throw new Error("Choose the class this stream belongs to");
      const { error } = await supabase.from("streams").insert({
        school_id: schoolId,
        class_id: streamForm.class_id,
        name: streamForm.name.trim(),
        stream_teacher_id: streamForm.stream_teacher_id || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetStreamForm();
      toast.success("Stream added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStream = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!editingStreamId) throw new Error("No stream selected for update");
      if (!streamForm.class_id) throw new Error("Choose the class this stream belongs to");
      const { error } = await supabase
        .from("streams")
        .update({
          class_id: streamForm.class_id,
          name: streamForm.name.trim(),
          stream_teacher_id: streamForm.stream_teacher_id || null,
        })
        .eq("id", editingStreamId)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetStreamForm();
      toast.success("Stream updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSubject = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      const points = Number(subjectForm.points);
      if (Number.isNaN(points) || points < 1 || points > 5)
        throw new Error("Subject points must be between 1 and 5");
      const { error } = await supabase.from("subjects").insert({
        school_id: schoolId,
        name: subjectForm.name.trim(),
        code: subjectForm.code || null,
        category: subjectForm.category || undefined,
        points,
        position: subjectForm.position
          ? Number(subjectForm.position)
          : (data?.subjects.length ?? 0) + 1,
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
      if (!editingSubjectId) throw new Error("No subject selected for update");
      const points = Number(subjectForm.points);
      if (Number.isNaN(points) || points < 1 || points > 5)
        throw new Error("Subject points must be between 1 and 5");
      const { error } = await supabase
        .from("subjects")
        .update({
          name: subjectForm.name.trim(),
          code: subjectForm.code || null,
          category: subjectForm.category || undefined,
          points,
          position: subjectForm.position
            ? Number(subjectForm.position)
            : (data?.subjects.length ?? 0) + 1,
        })
        .eq("id", editingSubjectId)
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

  const addAllocation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Your account is not linked to a school");
      if (!allocForm.teacher_id || !allocForm.subject_id)
        throw new Error("Pick a teacher and a subject");
      const payload = {
        school_id: schoolId,
        teacher_id: allocForm.teacher_id,
        subject_id: allocForm.subject_id,
        class_id: allocForm.class_id || null,
        stream_id: allocForm.stream_id || null,
      };
      const { error } = await supabase.from("teacher_allocations").insert(payload);
      if (error) throw new Error(error.message);
      await supabase
        .from("teacher_allocation_history")
        .insert({ ...payload, action: "assigned", performed_by: me?.userId ?? null });
    },
    onSuccess: () => {
      setAllocForm({ teacher_id: "", subject_id: "", class_id: "", stream_id: "" });
      toast.success("Teacher allocated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      const { data: created, error } = await supabase
        .from("terms")
        .insert({
          school_id: schoolId,
          academic_year_id: termForm.academic_year_id,
          name,
          start_date: termForm.start_date || null,
          end_date: termForm.end_date || null,
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

  const removeClass = useMutation({
    mutationFn: (classId: string) => deleteClassFn({ data: { classId } }),
    onSuccess: () => {
      toast.success("Class deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeStream = useMutation({
    mutationFn: (streamId: string) => deleteStreamFn({ data: { streamId } }),
    onSuccess: () => {
      toast.success("Stream deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAllocation = useMutation({
    mutationFn: async (id: string) => {
      const alloc = data?.allocations.find((a) => a.id === id);
      const { error } = await supabase.from("teacher_allocations").delete().eq("id", id);
      if (error) throw new Error(error.message);
      if (alloc) {
        await supabase.from("teacher_allocation_history").insert({
          school_id: alloc.school_id,
          teacher_id: alloc.teacher_id,
          subject_id: alloc.subject_id,
          class_id: alloc.class_id,
          stream_id: alloc.stream_id,
          action: "removed",
          performed_by: me?.userId ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Allocation removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
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
      await saveIdentifierScaleFn({
        data: {
          id: identifierForm.id || null,
          schoolId,
          identifier: Number(identifierForm.identifier),
          minScore: Number(identifierForm.min_score),
          maxScore: Number(identifierForm.max_score),
          descriptor: (identifierForm.descriptor ?? "").trim(),
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

  const className = (id: string | null) => {
    const item = data?.classes.find((c) => c.id === id);
    return item ? classLabel(item) : "All classes";
  };
  const streamName = (id: string | null) =>
    data?.streams.find((s) => s.id === id)?.name ?? "All streams";
  const classTeacherName = (id: string | null) =>
    data?.teachers.find((t) => t.id === id)?.full_name ?? "Not assigned";
  const subjectName = (id: string) => data?.subjects.find((s) => s.id === id)?.name ?? "â€”";
  const teacherName = (id: string) => data?.teachers.find((t) => t.id === id)?.full_name ?? "â€”";

  function startEditingClass(item: AcademicClass) {
    setEditingClassId(item.id);
    setClassForm({
      name: item.name ?? "",
      level: item.level?.toString() ?? "",
      education_level: item.education_level ?? "ordinary",
      class_teacher_id: item.class_teacher_id ?? "",
    });
  }

  const levelLabel = (value: string | null | undefined) =>
    value === "advanced" ? "Advanced Level" : "Ordinary Level";

  const classLabel = (item: AcademicClass) => {
    const parts = [item.name, levelLabel(item.education_level)];
    if (item.level !== null && item.level !== undefined && item.level !== "") {
      parts.push(`Order ${item.level}`);
    }
    return parts.join(" · ");
  };

  function startEditingStream(item: AcademicStream) {
    setEditingStreamId(item.id);
    setStreamForm({
      name: item.name ?? "",
      class_id: item.class_id ?? "",
      stream_teacher_id: item.stream_teacher_id ?? "",
    });
  }

  function startEditingSubject(item: AcademicSubject) {
    setEditingSubjectId(item.id);
    setSubjectForm({
      name: item.name ?? "",
      code: item.code ?? "",
      category: item.category ?? "",
      position: item.position?.toString() ?? "",
      points: item.points?.toString() ?? "1",
    });
  }

  return (
    <div>
      <PageHeader
        title="Academic setup"
        description="Classes, streams, subjects and teaching allocations for the current academic year."
      />

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Classes">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingClassId) updateClass.mutate();
              else addClass.mutate();
            }}
          >
            <Field label="Class name">
              <input
                required
                className={inputClass}
                value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              />
            </Field>
            <Field label="Level type">
              <select
                className={inputClass}
                value={classForm.education_level}
                onChange={(e) => setClassForm({ ...classForm, education_level: e.target.value })}
              >
                <option value="ordinary">Ordinary Level</option>
                <option value="advanced">Advanced Level</option>
              </select>
            </Field>
            <Field label="Class order">
              <input
                type="number"
                className={inputClass}
                value={classForm.level}
                onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}
              />
            </Field>
            <Field label="Class teacher">
              <select
                className={inputClass}
                value={classForm.class_teacher_id}
                onChange={(e) => setClassForm({ ...classForm, class_teacher_id: e.target.value })}
              >
                <option value="">Not assigned</option>
                {(data?.teachers ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Btn
                type="submit"
                variant="accent"
                disabled={addClass.isPending || updateClass.isPending}
              >
                {editingClassId ? "Save changes" : "Add class"}
              </Btn>
              {editingClassId && (
                <Btn variant="ghost" onClick={resetClassForm}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.classes ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>
                  <span className="font-medium">{classLabel(item)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Class teacher: {classTeacherName(item.class_teacher_id)}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Pill tone="muted">
                    {data?.streams.filter((s) => s.class_id === item.id).length ?? 0} streams
                  </Pill>
                  <Btn variant="ghost" onClick={() => startEditingClass(item)}>
                    Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete class "${item.name}"? This will also remove related streams.`,
                        )
                      ) {
                        removeClass.mutate(item.id);
                      }
                    }}
                  >
                    Delete
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Streams">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingStreamId) updateStream.mutate();
              else addStream.mutate();
            }}
          >
            <Field label="Class">
              <select
                className={inputClass}
                value={streamForm.class_id}
                onChange={(e) => setStreamForm({ ...streamForm, class_id: e.target.value })}
              >
                <option value="">Select class</option>
                {(data?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stream name">
              <input
                required
                className={inputClass}
                value={streamForm.name}
                onChange={(e) => setStreamForm({ ...streamForm, name: e.target.value })}
              />
            </Field>
            <Field label="Stream teacher">
              <select
                className={inputClass}
                value={streamForm.stream_teacher_id}
                onChange={(e) =>
                  setStreamForm({ ...streamForm, stream_teacher_id: e.target.value })
                }
              >
                <option value="">Not assigned</option>
                {(data?.teachers ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Btn
                type="submit"
                variant="accent"
                disabled={addStream.isPending || updateStream.isPending}
              >
                {editingStreamId ? "Save changes" : "Add stream"}
              </Btn>
              {editingStreamId && (
                <Btn variant="ghost" onClick={resetStreamForm}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.streams ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>
                  {className(item.class_id)} Â· <span className="font-medium">{item.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Btn variant="ghost" onClick={() => startEditingStream(item)}>
                    Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete stream "${item.name}"?`)) {
                        removeStream.mutate(item.id);
                      }
                    }}
                  >
                    Delete
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Subjects">
          <form
            className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingSubjectId) updateSubject.mutate();
              else addSubject.mutate();
            }}
          >
            <Field label="Subject name">
              <input
                required
                className={inputClass}
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
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
            <div className="flex flex-wrap gap-2">
              <Btn
                type="submit"
                variant="accent"
                disabled={addSubject.isPending || updateSubject.isPending}
              >
                {editingSubjectId ? "Save changes" : "Add subject"}
              </Btn>
              {editingSubjectId && (
                <Btn variant="ghost" onClick={resetSubjectForm}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <ul className="space-y-1 text-sm">
            {(data?.subjects ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <span>{item.name}</span>
                  <Pill tone="info">{item.points ?? 1} pts</Pill>
                </span>
                <div className="flex items-center gap-2">
                  {item.category && <Pill tone="muted">{item.category}</Pill>}
                  <Btn variant="ghost" onClick={() => startEditingSubject(item)}>
                    Edit
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
              <input
                required
                className={inputClass}
                value={termForm.name}
                onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Start date">
                <input
                  type="date"
                  className={inputClass}
                  value={termForm.start_date}
                  onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                />
              </Field>
              <Field label="End date">
                <input
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

      <Panel title="Teacher allocations" className="mt-4">
        <form
          className="mb-4 grid gap-3 md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            addAllocation.mutate();
          }}
        >
          <Field label="Teacher">
            <select
              className={inputClass}
              value={allocForm.teacher_id}
              onChange={(e) => setAllocForm({ ...allocForm, teacher_id: e.target.value })}
            >
              <option value="">Select</option>
              {(data?.teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select
              className={inputClass}
              value={allocForm.subject_id}
              onChange={(e) => setAllocForm({ ...allocForm, subject_id: e.target.value })}
            >
              <option value="">Select</option>
              {(data?.subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select
              className={inputClass}
              value={allocForm.class_id}
              onChange={(e) =>
                setAllocForm({ ...allocForm, class_id: e.target.value, stream_id: "" })
              }
            >
              <option value="">All classes</option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stream">
            <select
              className={inputClass}
              value={allocForm.stream_id}
              onChange={(e) => setAllocForm({ ...allocForm, stream_id: e.target.value })}
            >
              <option value="">All streams</option>
              {(data?.streams ?? [])
                .filter((s) => !allocForm.class_id || s.class_id === allocForm.class_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Btn type="submit" variant="accent" disabled={addAllocation.isPending}>
              Allocate
            </Btn>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Teacher</th>
                <th className="pb-2">Subject</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">Stream</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {(data?.allocations ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-2 font-medium">{teacherName(a.teacher_id)}</td>
                  <td>{subjectName(a.subject_id)}</td>
                  <td>{className(a.class_id)}</td>
                  <td>{streamName(a.stream_id)}</td>
                  <td className="text-right">
                    <Btn variant="ghost" onClick={() => removeAllocation.mutate(a.id)}>
                      Remove
                    </Btn>
                  </td>
                </tr>
              ))}
              {(data?.allocations ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No allocations yet.
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
