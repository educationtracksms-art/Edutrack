import { createFileRoute } from "@tanstack/react-router";
import { SchoolsPage } from "@/components/schools-page";

export const Route = createFileRoute("/_authenticated/schools")({
  head: () => ({
    meta: [
      { title: "Schools & Billing | Education Track SMS" },
      {
        name: "description",
        content: "Create and monitor school tenants, subscription plans, payments and billing from the platform admin centre.",
      },
    ],
  }),
  component: SchoolsPage,
});