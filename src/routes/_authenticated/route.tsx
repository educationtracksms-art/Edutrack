import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { currentUserQueryOptions } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: NavigationPending,
  beforeLoad: async ({ location, context }) => {
    // Resolve the same cached user query used by AppShell so authentication and
    // profile loading happen once per session instead of twice on first load.
    const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
    if (!currentUser) throw redirect({ to: "/auth" });
    if (currentUser.mustChangePassword && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
    return { user: { id: currentUser.userId, email: currentUser.email } };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

function NavigationPending() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading page…
      </div>
    </div>
  );
}
