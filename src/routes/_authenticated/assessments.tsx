import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { AssessmentsPage } from "@/components/assessments-page";
import { supabase } from "@/integrations/supabase/client";
import { isModuleEnabled } from "@/lib/modules";

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
  component: AssessmentsPage,
});

function AssessmentsError({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reset();
    window.location.replace("/dashboard");
  }, [reset]);
  return null;
}