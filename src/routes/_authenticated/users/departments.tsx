import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Btn, Field, Pill, inputClass } from "@/components/ui-kit";
import { hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { friendlyAdminError } from "@/lib/admin-errors";
import { assignDepartmentHod, createDepartment } from "@/lib/admin.functions";
import { useUsersData, useSchoolDepartments } from "./-data";

export const Route = createFileRoute("/_authenticated/users/departments")({
  head: () => ({
    meta: [
      { title: "Departments | EduTrack" },
      { name: "description", content: "Create teaching departments and assign heads of department." },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { me, isSuper, schools, people } = useUsersData();
  const queryClient = useQueryClient();
  const [superSchoolId, setSuperSchoolId] = useState("");
  const activeSchoolId = isSuper ? superSchoolId || null : (me?.profile?.school_id ?? null);
  const { data: departments, isLoading } = useSchoolDepartments(activeSchoolId);
  const canManage = hasAny(me?.roles, ["super_admin", "school_admin", "head_teacher"]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hodChoices, setHodChoices] = useState<Record<string, string>>({});

  const createFn = useServerFn(createDepartment);
  const assignFn = useServerFn(assignDepartmentHod);

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string | null }) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success("Department created");
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error) => toast.error(friendlyAdminError(error)),
  });

  const hodMutation = useMutation({
    mutationFn: (payload: { departmentId: string; hodUserId: string | null }) =>
      assignFn({ data: payload }),
    onSuccess: () => {
      toast.success("Head of department updated");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error) => toast.error(friendlyAdminError(error)),
  });

  // Staff who can lead a department: leadership + HOD-capable roles.
  const staffOptions = (people ?? []).filter((person: any) =>
    hasAny(person.roles, ["head_teacher", "deputy_head_teacher", "dos", "hod", "subject_teacher"]),
  );

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Staff & roles"
        title="Departments"
        description="Organise subjects into departments and assign a head of department."
      />

      {isSuper && (
        <Panel title="School" className="mb-4">
          <Field label="School">
            <select
              className={inputClass}
              value={superSchoolId}
              onChange={(event) => setSuperSchoolId(event.target.value)}
            >
              <option value="">Select a school…</option>
              {(schools ?? []).map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </Field>
        </Panel>
      )}

      {canManage && (
        <Panel title="Create a department" className="mb-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return toast.error("Enter the department name first");
              if (!activeSchoolId) {
                toast.error(isSuper ? "Select a school first" : "Your account is not linked to a school");
                return;
              }
              createMutation.mutate({ name: trimmed, description: description.trim() || null });
            }}
          >
            <div className="flex-1">
              <Field label="Department name">
                <input
                  className={inputClass}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Sciences"
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Description (optional)">
                <input
                  className={inputClass}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
            </div>
            <Btn type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Btn>
          </form>
        </Panel>
      )}

      <Panel title="Departments">
        {!activeSchoolId && !isLoading ? (
          <p className="text-sm text-muted-foreground">
            {isSuper ? "Select a school above to view its departments." : "Your account is not linked to a school."}
          </p>
        ) : isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-live="polite">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-12 w-full animate-pulse rounded-xl bg-muted" />
            ))}
            <span className="sr-only">Loading departments…</span>
          </div>
        ) : (departments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No departments yet. Create the first one above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(departments ?? []).map((department) => (
              <li
                key={department.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{department.name}</p>
                  <Pill tone={department.hod_user_id ? "success" : "muted"}>
                    {department.hod_user_id ? "HOD set" : "No HOD"}
                  </Pill>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <select
                      className={`${inputClass} w-auto min-w-40`}
                      value={hodChoices[department.id] ?? ""}
                      onChange={(event) =>
                        setHodChoices((current) => ({
                          ...current,
                          [department.id]: event.target.value,
                        }))
                      }
                      aria-label={`Assign head of department for ${department.name}`}
                    >
                      <option value="">Keep current…</option>
                      {staffOptions.map((person: any) => (
                        <option key={person.id} value={person.id}>
                          {person.full_name}
                        </option>
                      ))}
                    </select>
                    <Btn
                      variant="ghost"
                      disabled={!hodChoices[department.id] || hodMutation.isPending}
                      onClick={() =>
                        hodMutation.mutate({
                          departmentId: department.id,
                          hodUserId: hodChoices[department.id] || null,
                        })
                      }
                    >
                      Assign HOD
                    </Btn>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
