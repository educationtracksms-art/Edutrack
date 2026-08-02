import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  createStaffUser,
  deleteStaffUser,
  resetUserPassword,
  updateStaffUser,
} from "@/lib/admin.functions";
import { ROLE_LABELS, hasAny, useCurrentUser, type AppRole } from "@/hooks/useCurrentUser";
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
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "subject_teacher",
    initials: "",
    schoolId: "",
  });
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);

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
          .select("id, full_name, email, initials, is_active, must_change_password"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((profile) => ({
        ...profile,
        roles: (roles ?? []).filter((r) => r.user_id === profile.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        data: {
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          initials: form.initials || undefined,
          schoolId: form.schoolId || undefined,
        },
      }),
    onSuccess: (result) => {
      setIssued({ email: form.email, password: result.oneTimePassword });
      setForm({ ...form, fullName: "", email: "", initials: "" });
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
    }) => updateUser({ data: vars }),
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

  return (
    <div>
      <PageHeader
        title="Users & roles"
        description="Accounts are created by administrators — never self-registered."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel title="Accounts">
          <ResponsiveTable
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Email</th>
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
                                  schoolId: "",
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
                            schoolId: "",
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

        <Panel title={editingUser ? "Edit account" : "Create an account"}>
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
                });
              } else {
                createMutation.mutate();
              }
            }}
          >
            {isSuper && (
              <Field label="School">
                <select
                  className={inputClass}
                  value={form.schoolId}
                  onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
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
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ASSIGNABLE.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
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
