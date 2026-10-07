import { createFileRoute } from "@tanstack/react-router";

import { AssessmentsPage } from "@/components/assessments-page";

export const Route = createFileRoute("/_authenticated/assestment")({
  component: AssessmentsPage,
});
