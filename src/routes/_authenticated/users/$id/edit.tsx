import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { PageHeader, Panel } from "@/components/ui-kit";
import { useStaffUserMutations, useUsersData, type StaffUserFormValues } from "../-data";
import { StaffUserForm } from "../-staff-user-form";

export const Route = createFileRoute("/_authenticated/users/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit staff account | EduTrack" },
      { name: "description", content: "Change a staff member's details, role or department." },
    ],
  }),
  component: EditUserPage,
});

const backLink = (
  <Link
    to="/users"
    className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
  >
    Back to accounts
  </Link>
);

function EditUserPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isSuper, schools, people, peopleLoading } = useUsersData();
  const { editMutation } = useStaffUserMutations();

  const person = (people ?? []).find((candidate: any) => candidate.id === id);

  if (peopleLoading) {
    return (
      <div className="min-w-0">
        <PageHeader eyebrow="Staff & roles" title="Edit account" actions={backLink} />
        <div className="max-w-[720px]">
          <Panel>
            <div className="space-y-4" aria-busy="true" aria-live="polite">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                </div>
              ))}
              <span className="sr-only">Loading account details…</span>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-w-0">
        <PageHeader
          eyebrow="Staff & roles"
          title="Account not found"
          description="This account may have been deleted, or you no longer have access to it."
          actions={backLink}
        />
        <div className="max-w-[720px]">
          <Panel>
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <p className="text-sm font-semibold">Nothing to edit here</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Return to the accounts list and choose a staff member from the table.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const initial: StaffUserFormValues = {
    fullName: person.full_name ?? "",
    email: person.email ?? "",
    role: person.roles?.[0] ?? "subject_teacher",
    initials: person.initials ?? "",
    schoolId: person.school_id ?? "",
    departmentId: person.department_id ?? "",
  };

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Staff & roles"
        title="Edit account"
        description={`Updating ${person.full_name || person.email}`}
        actions={backLink}
      />

      <div className="max-w-[720px]">
        <Panel>
          <StaffUserForm
            isSuper={isSuper}
            schools={schools}
            mode="edit"
            initial={initial}
            submitting={editMutation.isPending}
            onSubmit={(form) =>
              editMutation.mutate(
                { userId: id, ...form },
                { onSuccess: () => navigate({ to: "/users" }) },
              )
            }
            onCancel={() => navigate({ to: "/users" })}
          />
        </Panel>
      </div>
    </div>
  );
}
