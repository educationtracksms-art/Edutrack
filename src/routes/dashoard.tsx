import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashoard")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
