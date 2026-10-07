import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { currentUserQueryOptions, type AppRole } from "@/hooks/useCurrentUser";
import { NO_ACCESS_MESSAGE, setAccessNotice } from "@/lib/access-notice";
import { getSchoolSubscriptionStatus } from "@/lib/subscription.functions";

type GuardContext = { queryClient: QueryClient };

/**
 * Subscription expiry guard values.
 *
 * When a school's subscription is expired:
 *  - super_admin           → full unrestricted access
 *  - school_admin          → only the Subscription page
 *  - all other school roles → full-screen blocking message
 */

export type SubscriptionStatus = "active" | "trial" | "past_due" | "pending" | "confirmed" | "expired" | "no_school" | "not_configured";

export async function requireSubscriptionAccess(
  context: GuardContext,
  allowedRoles: AppRole[],
  subscriptionPageUrl = "/subscription",
  dashboardUrl = "/dashboard",
): Promise<SubscriptionStatus> {
  const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
  if (!currentUser) throw redirect({ to: "/auth" });

  // Super Admin is never blocked by subscription status.
  if (currentUser.isSuperAdmin) return "active";

  // Only school-scoped roles are subject to subscription locking.
  const isSchoolScoped = (currentUser.roles ?? []).some((r: AppRole) =>
    ["school_admin", "head_teacher", "deputy_head_teacher", "dos", "hod", "class_teacher", "subject_teacher", "librarian", "bursar"].includes(r)
  );

  if (!isSchoolScoped) return "active";

  // School users must have a school.
  const schoolId = currentUser.school?.id;
  if (!schoolId) return "active";

  const { status } = await context.queryClient.fetchQuery({
    queryKey: ["subscription-status", schoolId],
    staleTime: 60_000, // 1 minute TTL cache
    gcTime: 5 * 60_000,
    queryFn: () => getSchoolSubscriptionStatus(),
  });

  const subStatus = status as SubscriptionStatus;

  if (subStatus === "expired") {
    // School Admin can only access the Subscription page.
    if (currentUser.roles.includes("school_admin")) {
      const currentPath = (context as any).routerState?.pathname ?? "";
      if (currentPath.startsWith("/subscription")) {
        return "expired";
      }
      // Redirect all other routes to the subscription page.
      throw redirect({ to: subscriptionPageUrl });
    }

    // Non-admin school users: show blocking message + redirect.
    const schoolName = currentUser.school?.name ?? "your school";
    const userName = (currentUser.profile as any)?.full_name ?? currentUser.email ?? "there";
    const blockingMessage = `Hello, ${userName};\nThe ${schoolName} subscription has expired.\nPlease contact your school administrator for subscription.`;

    setAccessNotice(blockingMessage);
    throw redirect({ to: dashboardUrl });
  }

  // Check role-based access for non-expired subscriptions.
  if (!currentUser.roles.some((role: AppRole) => allowedRoles.includes(role))) {
    setAccessNotice(NO_ACCESS_MESSAGE);
    throw redirect({ to: dashboardUrl });
  }

  return subStatus;
}

/**
 * Check if the subscription is expired without redirecting.
 * Used by components to decide whether to render the blocking screen.
 */
export async function checkSubscriptionExpired(context: GuardContext): Promise<boolean> {
  const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
  if (!currentUser || currentUser.isSuperAdmin) return false;

  const schoolId = currentUser.school?.id;
  if (!schoolId) return false;

  const { status } = await context.queryClient.fetchQuery({
    queryKey: ["subscription-status-check", schoolId],
    staleTime: 60_000,
    queryFn: () => getSchoolSubscriptionStatus(),
  });

  return status === "expired";
}

/**
 * Check if the current user is a school admin whose subscription is expired.
 * They should be able to access ONLY the subscription page.
 */
export async function isExpiredSchoolAdmin(context: GuardContext): Promise<boolean> {
  const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
  if (!currentUser || !currentUser.roles.includes("school_admin")) return false;

  const schoolId = currentUser.school?.id;
  if (!schoolId) return false;

  const { status } = await context.queryClient.fetchQuery({
    queryKey: ["subscription-status-admin", schoolId],
    staleTime: 60_000,
    queryFn: () => getSchoolSubscriptionStatus(),
  });

  return status === "expired";
}
