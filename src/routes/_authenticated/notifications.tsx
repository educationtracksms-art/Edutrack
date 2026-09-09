import { createFileRoute } from "@tanstack/react-router";

import { NotificationPanel } from "@/components/notifications/NotificationPanel";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <div>
      <NotificationPanel page />
    </div>
  );
}
