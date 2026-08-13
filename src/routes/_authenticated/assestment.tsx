import { createFileRoute } from "@tanstack/react-router";

import { AssessmentsPage } from "./assessments";

export const Route = createFileRoute("/_authenticated/assestment")({
  component: AssessmentsPage,
});
