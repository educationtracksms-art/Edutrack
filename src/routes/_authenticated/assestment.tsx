import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy typo URL — keep old bookmarks working by redirecting to the real page.
export const Route = createFileRoute("/_authenticated/assestment")({
  beforeLoad: () => {
    throw redirect({ to: "/assessments", replace: true });
  },
});
