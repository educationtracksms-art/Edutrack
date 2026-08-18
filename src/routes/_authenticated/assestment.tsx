import { createFileRoute } from "@tanstack/react-router";

import { AssessmentsPage } from "./-assessments-page";

export const Route = createFileRoute("/_authenticated/assestment")({
  component: AssessmentsPage,
});
