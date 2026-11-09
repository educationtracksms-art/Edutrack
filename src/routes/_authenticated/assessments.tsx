import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { isModuleEnabled } from "@/lib/modules";

const AssessmentsPage = lazy(() =>
  import("@/components/assessments-page").then(({ AssessmentsPage }) => ({
    default: AssessmentsPage,
  })),
);

export const Route = createFileRoute("/_authenticated/assessments")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "academics"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Assessments - EduTrack" },
      {
        name: "description",
        content: "Capture formative and summative scores, submit for approval and lock results.",
      },
      { property: "og:title", content: "Assessments - EduTrack" },
      {
        property: "og:description",
        content: "Teacher score entry with Director of Studies approval workflow.",
      },
    ],
  }),
  errorComponent: AssessmentsError,
  component: AssessmentsRoutePage,
});

function AssessmentsRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading assessments…
          </div>
        </div>
      }
    >
      <AssessmentsPage />
    </Suspense>
  );
}

function AssessmentsError({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reset();
    window.location.replace("/dashboard");
  }, [reset]);
  return null;
}