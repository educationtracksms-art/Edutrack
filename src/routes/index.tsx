import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, FileBadge, Layers, ShieldCheck } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Education Track SMS | Uganda School Management System" },
      {
        name: "description",
        content:
          "A Uganda-based education management system that helps schools improve efficiency, simplify administration, and give staff, learners and parents a better experience.",
      },
      { property: "og:title", content: "Education Track SMS | Uganda School Management System" },
      {
        property: "og:description",
        content:
          "Give your school a better way to manage learners, assessments, report cards and daily operations with one platform built for growth.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Layers, title: "Streamline daily work", body: "Reduce paperwork and move common school processes into one simple system." },
  { icon: ShieldCheck, title: "Improve trust and control", body: "Keep records organized, secure and easy to review by the right staff members." },
  { icon: FileBadge, title: "Better reporting", body: "Create clear report cards and academic summaries faster with less manual work." },
  { icon: BarChart3, title: "See progress faster", body: "Track learner performance, attendance and school activity in one place." },
];

function Landing() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 text-center md:pt-20">
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          Give your school a smarter way to work, grow, and serve learners better.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
          Education Track SMS helps schools reduce administrative stress, improve visibility, and focus more
          on teaching, learning, and parent engagement.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/signup"
            className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Join your school
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Staff sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-xl border border-border bg-card p-5">
            <feature.icon className="h-5 w-5 text-accent" />
            <h2 className="mt-3 text-sm font-semibold">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>

    </PublicShell>
  );
}
