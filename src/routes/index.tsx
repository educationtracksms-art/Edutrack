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
          "A Uganda-based education management system for schools, administrators and teachers. Track learners, assessments, report cards and operations in one place.",
      },
      { property: "og:title", content: "Education Track SMS | Uganda School Management System" },
      {
        property: "og:description",
        content:
          "Manage schools, staff, learners, assessments and dynamic report cards from a single multi-school platform.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Layers, title: "True multi-tenancy", body: "Every record is scoped to a school. Staff never see another school's data." },
  { icon: ShieldCheck, title: "Role-based control", body: "Seven roles, one-time passwords, forced password change and full audit trails." },
  { icon: FileBadge, title: "Dynamic report cards", body: "A4-optimised report cards rendered entirely from live school data." },
  { icon: BarChart3, title: "Live analytics", body: "Performance, grades, attendance and approval dashboards for every leader." },
];

function Landing() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 text-center md:pt-20">
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          Run every school on one platform, keep every school's data apart.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
          Schools, staff, learners, assessments and print-ready report cards are governed by roles,
          approvals and audit logs from the first sign-in.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/signup"
            className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Request access
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Sign in
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
