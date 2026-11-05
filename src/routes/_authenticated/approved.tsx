import { createFileRoute, redirect } from "@tanstack/react-router";

import { ApprovalsPage } from "./approval";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/approved")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const roleNames = (roles ?? []).map((item) => item.role);
    if (
      !roleNames.some((role) =>
        ["dos", "head_teacher", "deputy_head_teacher", "school_admin"].includes(role),
      ) ||
      !profile?.school_id
    ) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [{ title: "Approved results · EduTrack" }],
  }),
  component: () => <ApprovalsPage view="approved" />,
});
