import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { isModuleEnabled } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/academics")({
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
      { title: "Academic setup | EduTrack" },
      {
        name: "description",
        content: "Create classes, streams and subjects, then allocate teachers to each stream.",
      },
      { property: "og:title", content: "Academic setup | EduTrack" },
      {
        property: "og:description",
        content: "Director of Studies control over classes, streams, subjects and teaching loads.",
      },
    ],
  }),
  component: AcademicsLayout,
});

const SECTIONS: {
  to: string;
  label: string;
  exact?: boolean;
}[] = [
  { to: "/academics", label: "Overview", exact: true },
  { to: "/academics/classes", label: "Classes & streams" },
  { to: "/academics/subjects", label: "Subjects" },
  { to: "/academics/calendar", label: "Years & terms" },
  { to: "/academics/grading", label: "Grading" },
  { to: "/academics/allocations", label: "Allocations" },
];

function AcademicsLayout() {
  return (
    <div className="min-w-0">
      <nav
        aria-label="Academic setup sections"
        className="no-print mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-card)] sm:mb-5"
      >
        {SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            activeOptions={section.exact ? { exact: true } : undefined}
            activeProps={{
              className: "bg-primary-soft text-primary shadow-sm",
            }}
            className="whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
