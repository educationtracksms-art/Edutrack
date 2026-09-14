import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  createStaffUser,
  createDepartment,
  assignDepartmentHod,
  deleteStaffUser,
  resetUserPassword,
  updateStaffUser,
} from "@/lib/admin.functions";
import {
  ROLE_HIERARCHY_LEVELS,
  ROLE_LABELS,
  hasAny,
  useCurrentUser,
  type AppRole,
} from "@/hooks/useCurrentUser";
import {
  Btn,
  Field,
  PageHeader,
  Panel,
  Pill,
  ResponsiveTable,
  inputClass,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & Roles · EduTrack" },
      {
        name: "description",
        content: "Create staff accounts, assign roles and issue one-time passwords.",
      },
      { property: "og:title", content: "Users & Roles · EduTrack" },
      { property: "og:description", content: "Role-based user administration for your school." },
    ],
  }),
  component: UsersPage,
});

const ASSIGNABLE: AppRole[] = [
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "hod",
  "class_teacher",
  "subject_teacher",
  "librarian",
];

function UsersPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const isSuper = hasAny(me?.roles, ["super_admin"]);
  const createUser = useServerFn(createStaffUser);
  const updateUser = useServerFn(updateStaffUser);
  const resetPassword = useServerFn(resetUserPassword);
  const deleteUserFn = useServerFn(deleteStaffUser);
  const createDepartmentFn = useServerFn(createDepartment);
  const assignDepartmentHodFn = useServerFn(assignDepartmentHod);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "subject_teacher",
    initials: "",
    schoolId: "",
    departmentId: "",
  });
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: "", description: "" });
  const [departmentAssign, setDepartmentAssign] = useState({ departmentId: "", hodUserId: "" });

  const { data: schools } = useQuery({
    queryKey: ["schools-list"],
    enabled: isSuper,
    queryFn: async () =>
      (await supabase.from("schools").select("id, name").order("name")).data ?? [],
  });

  const { data: people } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, initials, is_active, must_change_password, school_id, department_id",
          ),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((profile) => ({
        ...profile,
        roles: (roles ?? []).filter((r) => r.user_id === profile.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const schoolNameFor = (schoolId: string | null) =>
    (schools ?? []).find((school) => school.id === schoolId)?.name ?? null;

  const { data: departments } = useQuery({
    queryKey: ["departments", isSuper ? form.schoolId : (me?.profile?.school_id ?? null)],
    enabled: !isSuper || !!form.schoolId,
    queryFn: async () => {
      let query = supabase.from("departments").select("id, name, hod_user_id").order("name");
      const schoolId = isSuper ? form.schoolId : me?.profile?.school_id;
      if (schoolId) query = query.eq("school_id", schoolId);
      return (await query).data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const fullName = form.fullName.trim();
      const email = form.email.trim();
      if (!fullName) throw new Error("Enter the user's full name first");
      if (!email) throw new Error("Enter the user's email first");
      if (isSuper && !form.schoolId) throw new Error("Select a school before creating the account");
      return createUser({
        data: {
          fullName,
          email,
          role: form.role,
          initials: form.initials || undefined,
          schoolId: form.schoolId || undefined,
          departmentId: form.departmentId || undefined,
        },
      });
    },
    onSuccess: (result) => {
      setIssued({ email: form.email, password: result.oneTimePassword });
      setForm({ ...form, fullName: "", email: "", initials: "", departmentId: "" });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Account created");
    },
    onError: (error: Error) =>
      toast.error(
        error.message ===
          "Supabase admin client is unavailable because the committed .env file was not found at runtime."
          ? "Admin user creation is unavailable because the committed .env file is not being shipped with the deployment."
          : error.message,
      ),
  });

  const editMutation = useMutation({
    mutationFn: (vars: {
      userId: string;
      fullName: string;
      email: string;
      role: string;
      initials?: string;
      schoolId?: string;
      departmentId?: string | null;
    }) => {
      if (!vars.fullName.trim()) throw new Error("Enter the user's full name first");
      if (!vars.email.trim()) throw new Error("Enter the user's email first");
      if (isSuper && !vars.schoolId) throw new Error("Select a school before saving the account");
      return updateUser({
        data: {
          ...vars,
          fullName: vars.fullName.trim(),
          email: vars.email.trim(),
          initials: vars.initials?.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setEditingUser(null);
    },
    onError: (error: Error) =>
      toast.error(
        error.message ===
          "Supabase admin client is unavailable because the committed .env file was not found at runtime."
          ? "User editing is unavailable because the committed .env file is not being shipped with the deployment."
          : error.message,
      ),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) => resetPassword({ data: { userId } }),
    onSuccess: (result, userId) => {
      const person = people?.find((p) => p.id === userId);
      setIssued({ email: person?.email ?? "", password: result.oneTimePassword });
      toast.success("New one-time password issued");
    },
    onError: (error: Error) =>
      toast.error(
        error.message ===
          "Supabase admin client is unavailable because the committed .env file was not found at runtime."
          ? "Password reset is unavailable because the committed .env file is not being shipped with the deployment."
          : error.message,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUserFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) =>
      toast.error(
        error.message ===
          "Supabase admin client is unavailable because the committed .env file was not found at runtime."
          ? "User deletion is unavailable because the committed .env file is not being shipped with the deployment."
          : error.message,
      ),
  });

  const departmentMutation = useMutation({
    mutationFn: () => {
      const name = departmentForm.name.trim();
      if (!name) throw new Error("Enter a department name first");
      return createDepartmentFn({
        data: {
          name,
          description: departmentForm.description.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Department created");
      setDepartmentForm({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignHodMutation = useMutation({
    mutationFn: () => {
      if (!departmentAssign.departmentId) throw new Error("Select a department first");
      if (!departmentAssign.hodUserId) throw new Error("Select a teacher to assign as HOD first");
      if (
        !(departments ?? []).some(
          (department: any) => department.id === departmentAssign.departmentId,
        )
      ) {
        throw new Error("The selected department is no longer available. Choose it again");
      }
      if (!(people ?? []).some((person) => person.id === departmentAssign.hodUserId)) {
        throw new Error("The selected teacher is no longer available. Choose a teacher again");
      }
      return assignDepartmentHodFn({
        data: {
          departmentId: departmentAssign.departmentId,
          hodUserId: departmentAssign.hodUserId,
        },
      });
    },
    onSuccess: () => {
      toast.success("HOD assigned");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader
        title="Users & roles"
        description="Accounts are created by administrators — never self-registered."
      />

      <Panel title="System hierarchy" className="mb-4">
        <div className="rounded-2xl border border-primary/10 bg-primary-soft/40 p-4">
          <p className="text-sm font-semibold text-foreground">Suggested accountability flow</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Use this structure to understand who owns each area of the school. Roles remain
            module-specific, so one person can hold more than one role where the school needs it.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {ROLE_HIERARCHY_LEVELS.map((level, index) => (
            <div key={level.level} className="relative flex gap-3 sm:gap-4">
              {index < ROLE_HIERARCHY_LEVELS.length - 1 && (
                <div className="absolute left-4 top-9 h-[calc(100%+0.75rem)] w-px bg-border" />
              )}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {level.level}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background p-3 sm:p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold">{level.label}</h3>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Level {level.level}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{level.summary}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {level.roles.map((role) => (
                    <div key={role} className="rounded-xl bg-muted/60 px-3 py-2">
                      <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {role === "super_admin"
                          ? "Platform-wide access"
                          : "School-scoped responsibility"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Access is still enforced by role and module. This hierarchy provides a clear operating
          model without granting permissions that a role does not already have.
        </p>
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
        {!isSuper && (
          <Panel title="Departments" className="order-1">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Department name">
                <input
                  className={inputClass}
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <input
                  className={inputClass}
                  value={departmentForm.description}
                  onChange={(e) =>
                    setDepartmentForm({ ...departmentForm, description: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="mt-3">
              <Btn variant="accent" onClick={() => departmentMutation.mutate()}>
                Create department
              </Btn>
            </div>
            <div className="mt-4 space-y-2">
              {(departments ?? []).map((dept: any) => (
                <div key={dept.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{dept.name}</p>
                    <Pill tone={dept.hod_user_id ? "success" : "warning"}>
                      {dept.hod_user_id ? "HOD assigned" : "No HOD"}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Assign department">
                <select
                  className={inputClass}
                  value={departmentAssign.departmentId}
                  onChange={(e) =>
                    setDepartmentAssign({ ...departmentAssign, departmentId: e.target.value })
                  }
                >
                  <option value="">Select department</option>
                  {(departments ?? []).map((dept: any) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assign HOD">
                <select
                  required
                  className={inputClass}
                  value={departmentAssign.hodUserId}
                  onChange={(e) =>
                    setDepartmentAssign({ ...departmentAssign, hodUserId: e.target.value })
                  }
                >
                  <option value="">Select teacher</option>
                  {(people ?? [])
                    .filter(
                      (person) =>
                        person.department_id === departmentAssign.departmentId &&
                        (person.roles.includes("subject_teacher") ||
                          person.roles.includes("class_teacher") ||
                          person.roles.includes("hod") ||
                          person.roles.includes("dos")),
                    )
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name || person.email}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <div className="mt-3">
              <Btn variant="accent" onClick={() => assignHodMutation.mutate()}>
                Assign HOD
              </Btn>
            </div>
          </Panel>
        )}

        <Panel title="Accounts" className="order-3 lg:col-span-2">
          <ResponsiveTable
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Email</th>
                      {isSuper && <th className="pb-2">School</th>}
                      <th className="pb-2">Roles</th>
                      <th className="pb-2">State</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(people ?? []).map((person) => (
                      <tr key={person.id} className="border-t border-border align-top">
                        <td className="py-2.5 font-medium">
                          {person.full_name || "—"}
                          {person.initials && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({person.initials})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">{person.email}</td>
                        {isSuper && (
                          <td className="py-2.5">{schoolNameFor(person.school_id) || "—"}</td>
                        )}
                        <td className="py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {person.roles.map((role) => (
                              <Pill key={role} tone="muted">
                                {ROLE_LABELS[role]}
                              </Pill>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5">
                          {person.must_change_password ? (
                            <Pill tone="warning">Must reset</Pill>
                          ) : (
                            <Pill tone="success">Active</Pill>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Btn variant="ghost" onClick={() => resetMutation.mutate(person.id)}>
                              Reset password
                            </Btn>
                            <Btn
                              variant="ghost"
                              onClick={() => {
                                setEditingUser(person.id);
                                setForm({
                                  fullName: person.full_name ?? "",
                                  email: person.email ?? "",
                                  role: (person.roles[0] ?? "subject_teacher") as AppRole,
                                  initials: person.initials ?? "",
                                  schoolId: person.school_id ?? "",
                                  departmentId: person.department_id ?? "",
                                });
                              }}
                            >
                              Edit
                            </Btn>
                            <Btn
                              variant="ghost"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete user "${person.full_name || person.email}"?`,
                                  )
                                ) {
                                  deleteMutation.mutate(person.id);
                                }
                              }}
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
            }
            mobile={
              <>
                {(people ?? []).map((person) => (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {person.full_name || "—"}
                          {person.initials && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({person.initials})
                            </span>
                          )}
                        </p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {person.email}
                        </p>
                        {isSuper && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            School: {schoolNameFor(person.school_id) || "—"}
                          </p>
                        )}
                      </div>
                      {person.must_change_password ? (
                        <Pill tone="warning">Must reset</Pill>
                      ) : (
                        <Pill tone="success">Active</Pill>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {person.roles.map((role) => (
                        <Pill key={role} tone="muted">
                          {ROLE_LABELS[role]}
                        </Pill>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Btn variant="ghost" onClick={() => resetMutation.mutate(person.id)}>
                        Reset
                      </Btn>
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          setEditingUser(person.id);
                          setForm({
                            fullName: person.full_name ?? "",
                            email: person.email ?? "",
                            role: (person.roles[0] ?? "subject_teacher") as AppRole,
                            initials: person.initials ?? "",
                            schoolId: person.school_id ?? "",
                            departmentId: person.department_id ?? "",
                          });
                        }}
                      >
                        Edit
                      </Btn>
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          if (
                            window.confirm(`Delete user "${person.full_name || person.email}"?`)
                          ) {
                            deleteMutation.mutate(person.id);
                          }
                        }}
                      >
                        Delete
                      </Btn>
                    </div>
                  </div>
                ))}
              </>
            }
          />
        </Panel>

        <Panel
          title={editingUser ? "Edit account" : "Create an account"}
          className={`order-2 ${isSuper ? "lg:col-span-2 lg:max-w-2xl" : ""}`}
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (editingUser) {
                editMutation.mutate({
                  userId: editingUser,
                  fullName: form.fullName,
                  email: form.email,
                  role: form.role,
                  initials: form.initials || undefined,
                  schoolId: form.schoolId || undefined,
                  departmentId: form.departmentId || undefined,
                });
              } else {
                createMutation.mutate();
              }
            }}
          >
            {isSuper && (
              <Field label="School">
                <select
                  required
                  className={inputClass}
                  value={form.schoolId}
                  onChange={(e) => setForm({ ...form, schoolId: e.target.value, departmentId: "" })}
                >
                  <option value="">Select a school</option>
                  {(schools ?? []).map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Full name">
              <input
                required
                className={inputClass}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Initials (shown on report cards)">
              <input
                className={inputClass}
                value={form.initials}
                onChange={(e) => setForm({ ...form, initials: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                className={inputClass}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value, departmentId: "" })}
              >
                {ASSIGNABLE.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select
                className={inputClass}
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">Select department</option>
                {(departments ?? []).map((department: any) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
            <Btn type="submit" variant="accent" disabled={createMutation.isPending}>
              {editingUser
                ? editMutation.isPending
                  ? "Saving…"
                  : "Save changes"
                : createMutation.isPending
                  ? "Creating…"
                  : "Create account"}
            </Btn>
            {editingUser && (
              <Btn
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingUser(null);
                  setForm({
                    fullName: "",
                    email: "",
                    role: "subject_teacher",
                    initials: "",
                    schoolId: "",
                    departmentId: "",
                  });
                }}
              >
                Cancel edit
              </Btn>
            )}
          </form>

          {issued && (
            <div className="mt-4 rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm">
              <p className="font-semibold">One-time password</p>
              <p className="mt-1 break-all text-muted-foreground">{issued.email}</p>
              <p className="mt-1 font-mono text-base">{issued.password}</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
