import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Increased defaults for better caching during navigation.
        // Most school data (classes, streams, departments) changes infrequently.
        // Stable data (Tier 1) uses 30 min stale time; user data (Tier 2) uses 10 min.
        // Route-level queries override for specific data tiers.
        staleTime: 10 * 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start loading the next route as soon as a user points at a navigation
    // item. The shell links opt into intent preloading below.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
