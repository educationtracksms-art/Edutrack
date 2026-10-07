import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { currentUserQueryOptions, type AppRole } from "@/hooks/useCurrentUser";
import { NO_ACCESS_MESSAGE, setAccessNotice } from "@/lib/access-notice";

type GuardContext = { queryClient: QueryClient };

/**
 * Shared authorisation guard for route `beforeLoad`.
 *
 * The sidebar already hides what a role cannot use, but that is presentation
 * only — bookmarks, stale links and typed URLs bypass it. Every protected route
 * therefore resolves the cached session before rendering and redirects anyone
 * outside the allow-list to their own dashboard with an explanation.
 */
async function requireRoles(context: GuardContext, allowed: AppRole[], deniedMessage?: string) {
  const currentUser = await context.queryClient.fetchQuery(currentUserQueryOptions());
  if (!currentUser) throw redirect({ to: "/auth" });
  if (!currentUser.roles.some((role) => allowed.includes(role))) {
    setAccessNotice(deniedMessage ?? NO_ACCESS_MESSAGE);
    throw redirect({ to: "/dashboard" });
  }
  return currentUser;
}

/**
 * The finance module is a Bursar-only area. `super_admin` deliberately has no
 * finance route access: platform administration lives under /schools and
 * /subscriptions, and finance is scoped to a school.
 */
export const FINANCE_ROUTE_ROLES: AppRole[] = ["bursar"];

export function requireFinanceAccess(context: GuardContext) {
  return requireRoles(context, FINANCE_ROUTE_ROLES);
}

/** Head of department workspace — departmental requests to finance. */
export const HOD_ROUTE_ROLES: AppRole[] = ["hod"];

export function requireHodAccess(context: GuardContext) {
  return requireRoles(
    context,
    HOD_ROUTE_ROLES,
    "Only heads of department can open the finance requests workspace.",
  );
}
