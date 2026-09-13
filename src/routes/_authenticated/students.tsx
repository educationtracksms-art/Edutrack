import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import ExcelJS from "exceljs";

import { supabase } from "@/integrations/supabase/client";
import {
  deleteStudent,
  updateStudentFeesBalance,
  updateStudentStatus,
  verifyStudent,
} from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { hasAny, SCHOOL_ROLES, useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";
import { uploadImage } from "@/lib/storage";
import { getEnabledModuleMap } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students · EduTrack" },
      {
        name: "description",
        content: "Register learners, verify admissions and manage class placement.",
      },
      { property: "og:title", content: "Students · EduTrack" },
      {
        property: "og:description",
        content: "Learner records with verification workflow and soft delete.",
      },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canAccessStudents = hasAny(me?.roles, ["super_admin", ...SCHOOL_ROLES]);
  const isClassTeacher = hasAny(me?.roles, ["class_teacher"]);
  const canManageStudents = hasAny(me?.roles, [
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "dos",
    "super_admin",
  ]);
  const canRegisterOrEditStudents = canManageStudents || isClassTeacher;
  const canChangeStatus = hasAny(me?.roles, [
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "super_admin",
  ]);
  const canVerify = canManageStudents || isClassTeacher;
  const verify = useServerFn(verifyStudent);
  const updateStatus = useServerFn(updateStudentStatus);
  const updateFeesBalance = useServerFn(updateStudentFeesBalance);
  const deleteStudentFn = useServerFn(deleteStudent);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [importingStudents, setImportingStudents] = useState(false);
  const [feesDrafts, setFeesDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    full_name: "",
    lin: "",
    gender: "Female",
    class_id: "",
    stream_id: "",
    house: "",
    schpay_code: "",
    parent_name: "",
    parent_phone: "",
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name, class_teacher_id").order("name")).data ??
      [],
  });
  const { data: streams } = useQuery({
    queryKey: ["streams"],
    queryFn: async () =>
      (await supabase.from("streams").select("id, name, class_id, stream_teacher_id")).data ?? [],
  });
  const { data: modules } = useQuery({
    queryKey: ["enabled-modules", schoolId],
    enabled: !!schoolId,
    queryFn: async () => getEnabledModuleMap(supabase, schoolId),
  });
  const feesEnabled = modules?.get("fees") ?? true;
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () =>
      (await supabase.from("students").select("*").is("deleted_at", null).order("full_name"))
        .data ?? [],
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students ?? [];
    return (students ?? []).filter(
      (student) =>
        student.full_name.toLowerCase().includes(term) ||
        (student.lin ?? "").toLowerCase().includes(term) ||
        (student.schpay_code ?? "").toLowerCase().includes(term),
    );
  }, [students, search]);

  const assignedClass = useMemo(() => {
    if (!isClassTeacher || !me?.userId) return null;
    return classes?.find((item) => item.class_teacher_id === me.userId) ?? null;
  }, [classes, isClassTeacher, me?.userId]);

  const assignedStreamIds = useMemo(
    () =>
      new Set(
        (streams ?? [])
          .filter((item) => item.stream_teacher_id === me?.userId)
          .map((item) => item.id),
      ),
    [me?.userId, streams],
  );

  const visibleStudents = useMemo(() => {
    if (isClassTeacher) {
      return filtered.filter((student) => {
        const inAssignedClass = assignedClass ? student.class_id === assignedClass.id : false;
        const inAssignedStream = student.stream_id
          ? assignedStreamIds.has(student.stream_id)
          : false;
        return inAssignedClass || inAssignedStream;
      });
    }
    return filtered;
  }, [assignedClass?.id, assignedStreamIds, filtered, isClassTeacher]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!me?.profile?.school_id) throw new Error("Your account is not linked to a school");
      const fullName = form.full_name.trim();
      if (!fullName) throw new Error("Enter the learner's full name first");
      if (!form.class_id) throw new Error("Assign the learner to a class first");
      const selectedClass = classes?.find((item) => item.id === form.class_id);
      if (!selectedClass) throw new Error("The selected class is no longer available. Choose a class again");
      const classStreams = (streams ?? []).filter((stream) => stream.class_id === form.class_id);
      if (classStreams.length > 0 && !form.stream_id) {
        throw new Error("Choose a stream for this class before saving the learner");
      }
      if (form.stream_id && !classStreams.some((stream) => stream.id === form.stream_id)) {
        throw new Error("Choose a stream that belongs to the selected class");
      }
      const photoUrl = photoFile
        ? await uploadImage(photoFile, `students/${me.profile.school_id}/photos`)
        : null;
      const { error } = await supabase.from("students").insert({
        school_id: me.profile.school_id,
        full_name: fullName,
        lin: form.lin || null,
        gender: form.gender,
        class_id: form.class_id,
        stream_id: form.stream_id || null,
        house: form.house || null,
        schpay_code: form.schpay_code || null,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
        photo_url: photoUrl,
        created_by: me.userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Learner registered - awaiting verification");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!me?.profile?.school_id || !editingStudentId) throw new Error("Select a learner to edit");
      const fullName = form.full_name.trim();
      if (!fullName) throw new Error("Enter the learner's full name first");
      if (!form.class_id) throw new Error("Assign the learner to a class first");
      const selectedClass = classes?.find((item) => item.id === form.class_id);
      if (!selectedClass) throw new Error("The selected class is no longer available. Choose a class again");
      const classStreams = (streams ?? []).filter((stream) => stream.class_id === form.class_id);
      if (classStreams.length > 0 && !form.stream_id) {
        throw new Error("Choose a stream for this class before saving the learner");
      }
      if (form.stream_id && !classStreams.some((stream) => stream.id === form.stream_id)) {
        throw new Error("Choose a stream that belongs to the selected class");
      }
      const photoUrl = photoFile
        ? await uploadImage(photoFile, `students/${me.profile.school_id}/photos`)
        : currentPhotoUrl === null
          ? null
          : undefined;
      const payload: Record<string, unknown> = {
        full_name: fullName,
        lin: form.lin || null,
        gender: form.gender,
        class_id: form.class_id,
        stream_id: form.stream_id || null,
        house: form.house || null,
        schpay_code: form.schpay_code || null,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
      };
      if (photoUrl !== undefined) payload.photo_url = photoUrl;
      const { error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", editingStudentId)
        .eq("school_id", me.profile.school_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Learner updated");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const verifyMutation = useMutation({
    mutationFn: (studentId: string) => verify({ data: { studentId } }),
    onSuccess: () => {
      toast.success("Learner verified");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { studentId: string; status: "pending" | "active" | "inactive" }) =>
      updateStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Student status updated");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const removeStudent = useMutation({
    mutationFn: (studentId: string) => deleteStudentFn({ data: { studentId } }),
    onSuccess: () => {
      toast.success("Learner deleted");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const feesMutation = useMutation({
    mutationFn: (vars: { studentId: string; feesBalance: number }) =>
      updateFeesBalance({ data: vars }),
    onSuccess: () => {
      toast.success("Fees balance updated");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  function resetForm() {
    setForm({
      full_name: "",
      lin: "",
      gender: "Female",
      class_id: "",
      stream_id: "",
      house: "",
      schpay_code: "",
      parent_name: "",
      parent_phone: "",
    });
    setPhotoFile(null);
    setCurrentPhotoUrl(null);
    setEditingStudentId(null);
    setShowForm(false);
  }

  function startEditing(student: any) {
    setEditingStudentId(student.id);
    setShowForm(true);
    setCurrentPhotoUrl(student.photo_url ?? null);
    setForm({
      full_name: student.full_name ?? "",
      lin: student.lin ?? "",
      gender: student.gender ?? "Female",
      class_id: student.class_id ?? "",
      stream_id: student.stream_id ?? "",
      house: student.house ?? "",
      schpay_code: student.schpay_code ?? "",
      parent_name: student.parent_name ?? "",
      parent_phone: student.parent_phone ?? "",
    });
    setPhotoFile(null);
  }

  const className = (id: string | null) => classes?.find((c) => c.id === id)?.name ?? "—";
  const streamName = (id: string | null) => streams?.find((stream) => stream.id === id)?.name ?? "";

  async function downloadStudentList() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EduTrack";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Students");
    sheet.columns = [
      { header: "Full name", key: "full_name", width: 30 },
      { header: "LIN", key: "lin", width: 18 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Class", key: "class", width: 14 },
      { header: "Stream", key: "stream", width: 14 },
      { header: "House", key: "house", width: 18 },
      { header: "SchPay code", key: "schpay_code", width: 18 },
      { header: "Parent name", key: "parent_name", width: 24 },
      { header: "Parent phone", key: "parent_phone", width: 18 },
      { header: "Fees balance", key: "fees_balance", width: 16 },
      { header: "Status", key: "status", width: 14 },
    ];
    for (const student of visibleStudents) {
      sheet.addRow({
        full_name: student.full_name,
        lin: student.lin ?? "",
        gender: student.gender ?? "",
        class: className(student.class_id),
        stream: streamName(student.stream_id),
        house: student.house ?? "",
        schpay_code: student.schpay_code ?? "",
        parent_name: student.parent_name ?? "",
        parent_phone: student.parent_phone ?? "",
        fees_balance: Number(student.fees_balance ?? 0),
        status: student.status ?? "pending",
      });
    }
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123A63" } };
    sheet.autoFilter = { from: "A1", to: `K${Math.max(1, sheet.rowCount)}` };
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `EduTrack_Students_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importStudentList(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !schoolId || !me?.userId) return;

    setImportingStudents(true);
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("The workbook does not contain a worksheet");

      const rows = sheet.getRows(1, sheet.rowCount) ?? [];
      const cellText = (value: unknown) => {
        if (value == null) return "";
        if (typeof value === "object" && value !== null && "text" in value) {
          return String((value as { text?: unknown }).text ?? "").trim();
        }
        return String(value).trim();
      };
      const normalizeHeader = (value: unknown) =>
        cellText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
      const headers = (rows[0]?.values as unknown[] | undefined)?.slice(1).map(normalizeHeader) ?? [];
      const aliases: Record<string, string[]> = {
        full_name: ["fullname", "name", "studentname", "learnername"],
        lin: ["lin", "learneridentificationnumber"],
        gender: ["gender", "sex"],
        class_name: ["class", "classname", "level"],
        stream_name: ["stream", "streamname"],
        house: ["house"],
        schpay_code: ["schpaycode", "paymentcode"],
        parent_name: ["parentname", "guardianname"],
        parent_phone: ["parentphone", "guardianphone", "phone"],
      };
      const columnIndex = (names: string[]) => headers.findIndex((header) => names.includes(header));
      const indexes = Object.fromEntries(
        Object.entries(aliases).map(([key, names]) => [key, columnIndex(names)]),
      );
      if (indexes.full_name < 0) {
        throw new Error("The spreadsheet must include a Full name or Name column");
      }

      const imported = [];
      const skipped: string[] = [];
      for (let rowNumber = 1; rowNumber < rows.length; rowNumber += 1) {
        const values = (rows[rowNumber]?.values as unknown[] | undefined)?.slice(1) ?? [];
        const valueFor = (key: string) => {
          const index = indexes[key];
          return index >= 0 ? cellText(values[index]) : "";
        };
        const fullName = valueFor("full_name");
        if (!fullName) continue;

        const classValue = valueFor("class_name").toLowerCase();
        const streamValue = valueFor("stream_name").toLowerCase();
        if (!classValue) {
          skipped.push(`Row ${rowNumber + 1}: add the learner's class`);
          continue;
        }
        const classMatch = classes?.find((item) => item.name.trim().toLowerCase() === classValue);
        const streamMatch = streams?.find((item) => {
          if (item.name.trim().toLowerCase() !== streamValue) return false;
          return !classMatch || item.class_id === classMatch.id;
        });
        if (classValue && !classMatch) {
          skipped.push(`Row ${rowNumber + 1}: class "${valueFor("class_name")}" was not found`);
          continue;
        }
        const classStreams = (streams ?? []).filter((stream) => stream.class_id === classMatch?.id);
        if (classStreams.length > 0 && !streamValue) {
          skipped.push(`Row ${rowNumber + 1}: add the stream for class "${valueFor("class_name")}"`);
          continue;
        }
        if (streamValue && !streamMatch) {
          skipped.push(`Row ${rowNumber + 1}: stream "${valueFor("stream_name")}" was not found`);
          continue;
        }
        imported.push({
          school_id: schoolId,
          full_name: fullName,
          lin: valueFor("lin") || null,
          gender: valueFor("gender") || "Female",
          class_id: classMatch.id,
          stream_id: streamMatch?.id ?? null,
          house: valueFor("house") || null,
          schpay_code: valueFor("schpay_code") || null,
          parent_name: valueFor("parent_name") || null,
          parent_phone: valueFor("parent_phone") || null,
          status: "pending",
          created_by: me.userId,
        });
      }

      if (!imported.length) {
        throw new Error(skipped[0] ?? "No student rows were found in the spreadsheet");
      }
      const { error } = await supabase.from("students").insert(imported);
      if (error) throw new Error(error.message);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${imported.length} student${imported.length === 1 ? "" : "s"} imported`);
      if (skipped.length) toast.warning(`${skipped.length} row${skipped.length === 1 ? "" : "s"} skipped`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import students");
    } finally {
      setImportingStudents(false);
    }
  }

  if (!canAccessStudents) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          You do not have access to the learner records area yet.
        </p>
      </Panel>
    );
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description="Registered learners stay pending until an administrator verifies the admission."
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" onClick={downloadStudentList} disabled={!visibleStudents.length}>
              Download Excel
            </Btn>
            {canRegisterOrEditStudents && (
              <>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-secondary px-3.5 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                  {importingStudents ? "Importing..." : "Import Excel"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={importStudentList}
                    disabled={importingStudents}
                  />
                </label>
                <Btn variant="accent" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
                  {showForm ? "Close" : "Register learner"}
                </Btn>
              </>
            )}
          </div>
        }
      />

      {showForm && (
        <Panel title={editingStudentId ? "Edit learner" : "Register a learner"} className="mb-4">
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (editingStudentId) updateMutation.mutate();
              else addMutation.mutate();
            }}
          >
            <Field label="Full name">
              <input
                required
                className={inputClass}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
            <Field label="LIN">
              <input
                className={inputClass}
                value={form.lin}
                onChange={(e) => setForm({ ...form, lin: e.target.value })}
              />
            </Field>
            <Field label="Gender">
              <select
                className={inputClass}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option>Female</option>
                <option>Male</option>
              </select>
            </Field>
            <Field label="Class">
              <select
                required
                className={inputClass}
                value={form.class_id}
                disabled={isClassTeacher && !!assignedClass}
                onChange={(e) => setForm({ ...form, class_id: e.target.value, stream_id: "" })}
              >
                {isClassTeacher && assignedClass ? (
                  <option value={assignedClass.id}>{assignedClass.name}</option>
                ) : (
                  <option value="">Select class</option>
                )}
                {(classes ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stream">
              <select
                required={Boolean((streams ?? []).some((stream) => stream.class_id === form.class_id))}
                className={inputClass}
                value={form.stream_id}
                onChange={(e) => setForm({ ...form, stream_id: e.target.value })}
              >
                <option value="">Select stream</option>
                {(streams ?? [])
                  .filter((s) => !form.class_id || s.class_id === form.class_id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="House">
              <input
                className={inputClass}
                value={form.house}
                onChange={(e) => setForm({ ...form, house: e.target.value })}
              />
            </Field>
            <Field label="SCHPAY code">
              <input
                className={inputClass}
                value={form.schpay_code}
                onChange={(e) => setForm({ ...form, schpay_code: e.target.value })}
              />
            </Field>
            <Field label="Parent / guardian">
              <input
                className={inputClass}
                value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
              />
            </Field>
            <Field label="Parent phone">
              <input
                className={inputClass}
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
              />
            </Field>
            <Field label="Learner image">
              {editingStudentId && currentPhotoUrl && !photoFile && (
                <div className="mb-2 flex items-center gap-3">
                  <img
                    src={currentPhotoUrl}
                    alt="Current learner"
                    className="h-16 w-16 rounded-full border border-border object-cover"
                  />
                  <div className="text-xs text-muted-foreground">
                    This is the current photo. Choose a new file to replace it.
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className={inputClass}
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
              {editingStudentId && (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-muted-foreground underline underline-offset-4"
                  onClick={() => {
                    setPhotoFile(null);
                    setCurrentPhotoUrl(null);
                  }}
                >
                  Remove current photo
                </button>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Upload an image up to 1 MB. New uploads replace the current learner photo.
              </p>
            </Field>
            <div className="md:col-span-3">
              <div className="flex flex-wrap gap-2">
                <Btn
                  type="submit"
                  variant="accent"
                  disabled={addMutation.isPending || updateMutation.isPending}
                >
                  {editingStudentId
                    ? updateMutation.isPending
                      ? "Saving..."
                      : "Save changes"
                    : addMutation.isPending
                      ? "Saving..."
                      : "Save learner"}
                </Btn>
                {editingStudentId && (
                  <Btn type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Btn>
                )}
              </div>
            </div>
          </form>
        </Panel>
      )}

      <Panel>
        <input
          placeholder="Search by name, LIN or SCHPAY code"
          className={`${inputClass} mb-3 max-w-sm`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Photo</th>
                <th className="pb-2">Learner</th>
                <th className="pb-2">LIN</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">House</th>
                {feesEnabled && <th className="pb-2">Fees balance</th>}
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id} className="border-t border-border">
                  <td className="py-2.5">
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={student.full_name}
                        className="h-10 w-10 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                        ...
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 font-medium">{student.full_name}</td>
                  <td>{student.lin ?? "—"}</td>
                  <td>
                    {className(student.class_id)}
                    {streamName(student.stream_id) ? ` ${streamName(student.stream_id)}` : ""}
                  </td>
                  <td>{student.house ?? "—"}</td>
                  {feesEnabled && (
                    <td>
                      {canManageStudents ||
                      (isClassTeacher &&
                        (student.class_id === assignedClass?.id ||
                          (student.stream_id
                            ? assignedStreamIds.has(student.stream_id)
                            : false))) ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className={`${inputClass} w-28`}
                            value={feesDrafts[student.id] ?? String(student.fees_balance ?? 0)}
                            onChange={(event) =>
                              setFeesDrafts((current) => ({
                                ...current,
                                [student.id]: event.target.value,
                              }))
                            }
                          />
                          <Btn
                            variant="ghost"
                            onClick={() =>
                              feesMutation.mutate({
                                studentId: student.id,
                                feesBalance: Number(
                                  feesDrafts[student.id] ?? student.fees_balance ?? 0,
                                ),
                              })
                            }
                            disabled={feesMutation.isPending}
                          >
                            Save
                          </Btn>
                        </div>
                      ) : (
                        String(student.fees_balance ?? 0)
                      )}
                    </td>
                  )}
                  <td>
                    {canChangeStatus ? (
                      <select
                        className={`${inputClass} max-w-[120px]`}
                        value={student.status ?? "pending"}
                        onChange={(event) =>
                          statusMutation.mutate({
                            studentId: student.id,
                            status: event.target.value as "pending" | "active" | "inactive",
                          })
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    ) : (
                      <Pill
                        tone={
                          student.status === "active"
                            ? "success"
                            : student.status === "pending"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {student.status}
                      </Pill>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {canManageStudents && (
                        <Btn variant="ghost" onClick={() => startEditing(student)}>
                          Edit
                        </Btn>
                      )}
                      {canVerify && student.status === "pending" && (
                        <Btn variant="accent" onClick={() => verifyMutation.mutate(student.id)}>
                          Approve
                        </Btn>
                      )}
                      {canManageStudents && (
                        <Btn
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Delete learner "${student.full_name}"?`)) {
                              removeStudent.mutate(student.id);
                            }
                          }}
                        >
                          Delete
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={feesEnabled ? 8 : 7}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No learners found.
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
