import { createFileRoute } from "@tanstack/react-router";

import { SchoolsPage } from "@/routes/_authenticated/schools";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions · EduTrack" },
      {
        name: "description",
        content: "Manage school subscription plans, billing and payments.",
      },
    ],
  }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <SchoolsPage
      title="Subscriptions"
      description="Manage every school subscription, payment record, billing plan and renewal from the Super Admin console."
    />
  );
}
