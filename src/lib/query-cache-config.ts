/**
 * Shared query cache configuration tiers for consistent, performant data management.
 * These factories ensure that data with similar staleness requirements uses uniform cache times.
 */

/**
 * Tier 1: Stable metadata (classes, streams, departments, academic years, terms)
 * These rarely change and should persist for a full session.
 * Stale: 30 min | GC: 60 min
 */
export function stableDataQueryOptions<T = unknown>(queryKey: readonly unknown[]) {
  return {
    queryKey,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  };
}

/**
 * Tier 2: User data (current user, profiles, subscription status)
 * User profiles can change; check every 10 minutes silently.
 * Stale: 10 min | GC: 30 min
 */
export function userDataQueryOptions<T = unknown>(queryKey: readonly unknown[]) {
  return {
    queryKey,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  };
}

/**
 * Tier 3: Volatile data (real-time metrics, session data, current activity)
 * Stale: 1 min | GC: 5 min
 * Only use this for data that genuinely changes frequently.
 */
export function volatileDataQueryOptions<T = unknown>(queryKey: readonly unknown[]) {
  return {
    queryKey,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  };
}

/**
 * Tier 4: Subscription status (school subscription, billing info)
 * Moved from 60s check → 5 min to reduce load while maintaining responsiveness.
 * Stale: 5 min | GC: 10 min
 */
export function subscriptionQueryOptions<T = unknown>(queryKey: readonly unknown[]) {
  return {
    queryKey,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  };
}
