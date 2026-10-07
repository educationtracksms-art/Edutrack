import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

import { currentUserQueryOptions } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: async ({ context }) => {
    // Reuse the cached session query so this guard costs no extra network call.
    const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
    if (!currentUser) throw redirect({ to: "/auth" });
    const allowed = currentUser.roles.some(
      (role) => role === "super_admin" || role === "school_admin",
    );
    if (!allowed) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Staff & roles | EduTrack" },
      {
        name: "description",
        content: "Create staff accounts, assign roles and organise teaching departments.",
      },
    ],
  }),
  component: UsersLayout,
});

const SECTIONS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/users", label: "Accounts", exact: true },
  { to: "/users/departments", label: "Departments" },
];

function UsersLayout() {
  return (
    <div className="min-w-0">
      <nav aria-label="Staff & roles sections" className="mb-3 sm:mb-4">
        <ol className="no-print flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <li>
            <Link to="/dashboard" className="rounded hover:text-foreground">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-foreground">Staff &amp; roles</li>
        </ol>
      </nav>

      <nav
        aria-label="Staff & roles pages"
        className="no-print mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-card)] sm:mb-5"
      >
        {SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            activeOptions={section.exact ? { exact: true } : undefined}
            activeProps={{ className: "bg-primary-soft text-primary shadow-sm" }}
            className="whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {section.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
