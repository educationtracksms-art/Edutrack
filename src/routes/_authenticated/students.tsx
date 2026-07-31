import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { deleteStudent, verifyStudent } from "@/lib/admin.functions";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, Pill, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students · EduTrack" },
      { name: "description", content: "Register learners, verify admissions and manage class placement." },
      { property: "og:title", content: "Students · EduTrack" },
      { property: "og:description", content: "Learner records with verification workflow and soft delete." },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const canVerify = hasAny(me?.roles, ["school_admin", "head_teacher", "deputy_head_teacher", "super_admin"]);
  const verify = useServerFn(verifyStudent);
  const deleteStudentFn = useServerFn(deleteStudent);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
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
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: streams } = useQuery({
    queryKey: ["streams"],
    queryFn: async () => (await supabase.from("streams").select("id, name, class_id")).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("*")
          .is("deleted_at", null)
          .order("full_name")
      ).data ?? [],
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

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!me?.profile?.school_id) throw new Error("Your account is not linked to a school");
      const { error } = await supabase.from("students").insert({
        school_id: me.profile.school_id,
        full_name: form.full_name,
        lin: form.lin || null,
        gender: form.gender,
        class_id: form.class_id || null,
        stream_id: form.stream_id || null,
        house: form.house || null,
        schpay_code: form.schpay_code || null,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
        created_by: me.userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Learner registered — awaiting verification");
      setForm({ ...form, full_name: "", lin: "", house: "", schpay_code: "", parent_name: "", parent_phone: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const verifyMutation = useMutation({
    mutationFn: (studentId: string) => verify({ data: { studentId } }),
    onSuccess: () => {
      toast.success("Learner verified");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeStudent = useMutation({
    mutationFn: (studentId: string) => deleteStudentFn({ data: { studentId } }),
    onSuccess: () => {
      toast.success("Learner deleted");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const className = (id: string | null) => classes?.find((c) => c.id === id)?.name ?? "—";
  const streamName = (id: string | null) => streams?.find((s) => s.id === id)?.name ?? "";

  return (
    <div>
      <PageHeader
        title="Students"
        description="Registered learners stay pending until an administrator verifies the admission."
        actions={<Btn variant="accent" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close" : "Register learner"}</Btn>}
      />

      {showForm && (
        <Panel title="Register a learner" className="mb-4">
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              addMutation.mutate();
            }}
          >
            <Field label="Full name">
              <input required className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="LIN">
              <input className={inputClass} value={form.lin} onChange={(e) => setForm({ ...form, lin: e.target.value })} />
            </Field>
            <Field label="Gender">
              <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option>Female</option>
                <option>Male</option>
              </select>
            </Field>
            <Field label="Class">
              <select className={inputClass} value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, stream_id: "" })}>
                <option value="">Select class</option>
                {(classes ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stream">
              <select className={inputClass} value={form.stream_id} onChange={(e) => setForm({ ...form, stream_id: e.target.value })}>
                <option value="">Select stream</option>
                {(streams ?? []).filter((s) => !form.class_id || s.class_id === form.class_id).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="House">
              <input className={inputClass} value={form.house} onChange={(e) => setForm({ ...form, house: e.target.value })} />
            </Field>
            <Field label="SCHPAY code">
              <input className={inputClass} value={form.schpay_code} onChange={(e) => setForm({ ...form, schpay_code: e.target.value })} />
            </Field>
            <Field label="Parent / guardian">
              <input className={inputClass} value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </Field>
            <Field label="Parent phone">
              <input className={inputClass} value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
            </Field>
            <div className="md:col-span-3">
              <Btn type="submit" variant="accent" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Saving…" : "Save learner"}
              </Btn>
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
                <th className="pb-2">Learner</th>
                <th className="pb-2">LIN</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">House</th>
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="border-t border-border">
                  <td className="py-2.5 font-medium">{student.full_name}</td>
                  <td>{student.lin ?? "—"}</td>
                  <td>
                    {className(student.class_id)} {streamName(student.stream_id)}
                  </td>
                  <td>{student.house ?? "—"}</td>
                  <td>
                    <Pill tone={student.status === "active" ? "success" : student.status === "pending" ? "warning" : "muted"}>
                      {student.status}
                    </Pill>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {canVerify && student.status === "pending" && (
                        <Btn onClick={() => verifyMutation.mutate(student.id)}>Verify</Btn>
                      )}
                      {canVerify && (
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
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
