import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";

import { AccountsTable } from "./users/-accounts-table";
import {
  DEFAULT_STAFF_FORM,
  StaffUserForm,
} from "./users/-staff-user-form";
import {
  useStaffUserMutations,
  useUsersData,
  type StaffUserFormValues,
} from "./users/-data";
import { currentUserQueryOptions } from "@/hooks/useCurrentUser";
import { Btn, PageHeader, Panel, Stat } from "@/components/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/system-users")({
  beforeLoad: async ({ context }) => {
    const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
    if (!currentUser) throw redirect({ to: "/auth" });
    if (!currentUser.isSuperAdmin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "System users | EduTrack" },
      { name: "description", content: "Manage user accounts across all schools." },
    ],
  }),
  component: SystemUsersPage,
});

type IssuedCredential = { email: string; password: string };
type Person = {
  id: string;
  full_name: string;
  email: string;
  initials: string | null;
  is_active: boolean;
  must_change_password: boolean;
  school_id: string | null;
  department_id: string | null;
  roles: StaffUserFormValues["role"][];
};

function SystemUsersPage() {
  const { people, peopleLoading, peopleError, schools, schoolNameFor } = useUsersData();
  const { createMutation, editMutation, resetMutation, deleteMutation } = useStaffUserMutations();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [issued, setIssued] = useState<IssuedCredential | null>(null);

  async function createAccount(form: StaffUserFormValues) {
    try {
      const result = await createMutation.mutateAsync(form);
      setIssued({ email: form.email.trim(), password: result.oneTimePassword });
      setCreateOpen(false);
    } catch {
      // The mutation reports the actionable error through the shared toast.
    }
  }

  async function resetPassword(person: Person) {
    try {
      const result = await resetMutation.mutateAsync(person.id);
      setIssued({ email: person.email, password: result.oneTimePassword });
    } catch {
      // The mutation reports the actionable error through the shared toast.
    }
  }

  async function saveEdit(form: StaffUserFormValues) {
    if (!editing) return;
    try {
      await editMutation.mutateAsync({ ...form, userId: editing.id });
      setEditing(null);
    } catch {
      // The mutation reports the actionable error through the shared toast.
    }
  }

  async function copyCredential() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(`Email: ${issued.email}\nOne-time password: ${issued.password}`);
      toast.success("Sign-in details copied");
    } catch {
      toast.error("Could not copy sign-in details");
    }
  }

  const accounts = (people ?? []) as Person[];

  return (
    <div className="min-w-0 space-y-4">
      {issued && (
        <section
          className="sticky top-0 z-30 rounded-2xl border border-success/40 bg-background/95 p-4 shadow-lg backdrop-blur sm:p-5"
          aria-live="polite"
          aria-label="New one-time sign-in details"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-success">One-time sign-in details</p>
              <p className="mt-1 break-all text-sm">{issued.email}</p>
              <p className="mt-1 break-all font-mono text-lg font-semibold">{issued.password}</p>
              <p className="mt-1 text-xs text-muted-foreground">This stays here until dismissed. The user must change the password at first sign-in.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Btn variant="ghost" onClick={copyCredential}>Copy details</Btn>
              <Btn variant="ghost" onClick={() => setIssued(null)}>Dismiss</Btn>
            </div>
          </div>
        </section>
      )}

      <PageHeader
        eyebrow="Platform administration"
        title="System users"
        description="Create and manage user accounts across all schools from one place."
        actions={<Btn variant="accent" onClick={() => setCreateOpen(true)}>Create user</Btn>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="User accounts" value={accounts.length} />
        <Stat label="Schools represented" value={new Set(accounts.map((person) => person.school_id).filter(Boolean)).size} />
        <Stat label="Password change required" value={accounts.filter((person) => person.must_change_password).length} />
      </div>

      <Panel title="All user accounts">
        {peopleLoading ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">Loading accounts…</p>
        ) : peopleError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            Could not load user accounts: {peopleError.message}
          </p>
        ) : (
          <AccountsTable
            people={accounts}
            isSuper
            schoolNameFor={schoolNameFor}
            onReset={(person) => void resetPassword(person)}
            onEdit={(person) => setEditing(person)}
            onDelete={(person) => {
              if (window.confirm(`Delete the account for “${person.full_name || person.email}”?`)) {
                deleteMutation.mutate(person.id);
              }
            }}
          />
        )}
      </Panel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a system user</DialogTitle>
            <DialogDescription>Choose the school and role. A one-time password will appear in the pinned panel.</DialogDescription>
          </DialogHeader>
          <StaffUserForm
            isSuper
            schools={schools}
            mode="create"
            submitting={createMutation.isPending}
            onSubmit={createAccount}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit system user</DialogTitle>
            <DialogDescription>Update account details, school, department, or role.</DialogDescription>
          </DialogHeader>
          {editing && (
            <StaffUserForm
              key={editing.id}
              isSuper
              schools={schools}
              mode="edit"
              initial={{
                fullName: editing.full_name ?? "",
                email: editing.email,
                role: editing.roles[0] ?? DEFAULT_STAFF_FORM.role,
                initials: editing.initials ?? "",
                schoolId: editing.school_id ?? "",
                departmentId: editing.department_id ?? "",
              }}
              submitting={editMutation.isPending}
              onSubmit={saveEdit}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
