import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { currentUserQueryOptions } from "@/hooks/useCurrentUser";
import { getSchoolSubscriptionStatus } from "@/lib/subscription.functions";
import { setAccessNotice } from "@/lib/access-notice";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: NavigationPending,
  beforeLoad: async ({ location, context }) => {
    // Resolve the same cached user query used by AppShell so authentication and
    // profile loading happen once per session instead of twice on first load.
    const cachedUser = context.queryClient.getQueryData(["current-user"]);
    const currentUser = cachedUser ?? await context.queryClient.fetchQuery(currentUserQueryOptions());
    if (!currentUser) throw redirect({ to: "/auth" });
    if (currentUser.mustChangePassword && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
    // Password changes must remain available even when subscription state
    // cannot be loaded or the school's subscription has expired.
    if (location.pathname === "/change-password") {
      return { user: { id: currentUser.userId, email: currentUser.email } };
    }
    // Subscription expiry check on every authenticated route using a short-TTL cache.
    const isSuperAdmin = currentUser.isSuperAdmin;
    const schoolId = currentUser.school?.id ?? null;
    const isSchoolScoped = !!schoolId && !isSuperAdmin;

    if (isSchoolScoped) {
      let status: string | undefined;
      try {
        ({ status } = await context.queryClient.fetchQuery({
          queryKey: ["subscription-status", schoolId],
          staleTime: 60_000,
          gcTime: 5 * 60_000,
          queryFn: () => getSchoolSubscriptionStatus(),
        }));
      } catch (error) {
        // A subscription lookup outage must not crash every authenticated route.
        // AppShell still applies the expired-subscription screen when a status is available.
        console.error("Could not check school subscription status", error);
      }

      if (status === "expired") {
        const isSchoolAdmin = currentUser.roles.includes("school_admin");
        const onSubscriptionPage = location.pathname.startsWith("/subscription");

        if (isSchoolAdmin) {
          // School Admin: allowed ONLY on the Subscription page.
          if (!onSubscriptionPage) {
            setAccessNotice(
              "Your school's subscription has expired. Renew on the Subscription page to restore access.",
            );
            throw redirect({ to: "/subscription" });
          }
        } else {
          const schoolName = currentUser.school?.name ?? "your school";
          const userName = (currentUser.profile as { full_name?: string } | null)?.full_name ?? currentUser.email ?? "there";
          setAccessNotice(
            "Hello, " + userName + "; The " + schoolName + " subscription has expired. Please contact your school administrator for subscription.",
          );
        }
      }
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
