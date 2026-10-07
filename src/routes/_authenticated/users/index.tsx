import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { PageHeader, Panel, Pill } from "@/components/ui-kit";
import { ROLE_HIERARCHY_LEVELS, ROLE_LABELS, type AppRole } from "@/hooks/useCurrentUser";
import { AccountsTable } from "./-accounts-table";
import { useStaffUserMutations, useUsersData } from "./-data";

export const Route = createFileRoute("/_authenticated/users/")({
  head: () => ({
    meta: [
      { title: "Staff accounts | EduTrack" },
      {
        name: "description",
        content: "Browse staff accounts and roles, then reset passwords or open one to edit.",
      },
    ],
  }),
  component: UsersPage,
});

const primaryLink =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90";
const secondaryLink =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted";

function UsersPage() {
  const navigate = useNavigate();
  const { isSuper, people, peopleLoading, schoolNameFor } = useUsersData();
  const { resetMutation, deleteMutation } = useStaffUserMutations();
  const count = (people ?? []).length;

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Staff & roles"
        title="Staff accounts"
        description="Accounts are created by administrators and never self-registered."
        actions={
          <>
            <Link to="/users/departments" className={secondaryLink}>
              Departments
            </Link>
            <Link to="/users/new" className={primaryLink}>
              Create account
            </Link>
          </>
        }
      />

      <Panel title="Accounts">
        <p className="mb-4 -mt-3 text-sm text-muted-foreground">
          {count} staff account{count === 1 ? "" : "s"} in this workspace.
        </p>
        {peopleLoading ? (
          <div className="space-y-2" aria-busy="true" aria-live="polite">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-12 w-full animate-pulse rounded-xl bg-muted" />
            ))}
            <span className="sr-only">Loading staff accounts…</span>
          </div>
        ) : count === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <p className="text-sm font-semibold">No staff accounts yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Create the first account to give a colleague access to EduTrack.
            </p>
            <Link to="/users/new" className={`mt-4 ${primaryLink}`}>
              Create account
            </Link>
          </div>
        ) : (
          <>
            <AccountsTable
              people={people}
              isSuper={isSuper}
              schoolNameFor={schoolNameFor}
              onReset={(person) => resetMutation.mutate(person.id)}
              onEdit={(person) => navigate({ to: "/users/$id/edit", params: { id: person.id } })}
              onDelete={(person) => deleteMutation.mutate(person.id)}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Resetting a password issues a one-time password in a toast. It is shown once.
            </p>
          </>
        )}
      </Panel>

      <Panel
        title="System hierarchy"
        className="mt-4"
      >
        <p className="mb-4 -mt-3 text-sm text-muted-foreground">
          Read-only reference for how responsibilities are layered across the school.
        </p>
        <div className="space-y-3">
          {ROLE_HIERARCHY_LEVELS.map((level, index) => (
            <div key={level.level} className="relative flex gap-3 sm:gap-4">
              {index < ROLE_HIERARCHY_LEVELS.length - 1 && (
                <div className="absolute left-4 top-9 h-[calc(100%+0.75rem)] w-px bg-border" />
              )}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {level.level}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background p-3 sm:p-4">
                <h3 className="text-sm font-semibold">{level.label}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{level.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {level.roles.map((role: AppRole) => (
                    <Pill key={role} tone="muted">
                      {ROLE_LABELS[role]}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-4">
        <Link to="/dashboard" className={secondaryLink}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
