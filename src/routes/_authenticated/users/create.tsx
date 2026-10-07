import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Btn, PageHeader, Panel } from "@/components/ui-kit";
import { useUsersData, useStaffUserMutations, type StaffUserFormValues } from "./-data";
import { StaffUserForm } from "./-staff-user-form";

export const Route = createFileRoute("/_authenticated/users/create")({
  meta: [
    { title: "Create a staff account | EduTrack" },
    { name: "description", content: "Create a staff account and issue a one-time password for first sign in." },
  ],
  component: CreateUserPage,
});

function CreateUserPage() {
  const navigate = createFileRoute.useNavigate();
  const { isSuper, schools, departments } = useUsersData();
  const { createMutation } = useStaffUserMutations();
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const handleSubmit = async (form: StaffUserFormValues) => {
    const result: any = await createMutation.mutateAsync(form);
    setIssued({ email: form.email.trim(), password: result?.oneTimePassword ?? "" });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Staff & roles"
        title="Create a staff account"
        description="The account is created immediately with a one-time password, shown once on this screen."
        actions={
          <Link
            to="/users"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
          >
            Back to accounts
          </Link>
        }
      />

      <div className="max-w-[720px]">
        <Panel>
          {issued ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
                <p className="text-sm font-semibold text-success">Account created</p>
                <p className="mt-2 break-all text-sm text-muted-foreground">{issued.email}</p>
                <p className="mt-1 font-mono text-lg">{issued.password}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Copy this password now — it is not shown again.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Btn variant="ghost" onClick={() => setIssued(null)}>
                  Create another account
                </Btn>
                <Btn variant="primary" onClick={() => navigate({ to: "/users" })}>
                  Done
                </Btn>
              </div>
            </div>
          ) : (
            <StaffUserForm
              isSuper={isSuper}
              schools={schools}
              departments={departments}
              mode="create"
              submitting={createMutation.isPending}
              onSubmit={handleSubmit}
              onCancel={() => navigate({ to: "/users" })}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}