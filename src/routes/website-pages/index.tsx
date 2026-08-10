import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/website-pages/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
