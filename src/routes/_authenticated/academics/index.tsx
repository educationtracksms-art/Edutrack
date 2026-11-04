import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  ListChecks,
  School,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/ui-kit";
import { useAcademicsPage } from "./-shared";

export const Route = createFileRoute("/_authenticated/academics/")({
  head: () => ({
    meta: [{ title: "Academic setup overview | EduTrack" }],
  }),
  component: AcademicsOverview,
});

function AcademicsOverview() {
  const { allowed, data } = useAcademicsPage();

  if (!allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the Director of Studies and school leadership can manage academic setup.
      </p>
    );
  }

  const cards = [
    {
      to: "/academics/classes" as const,
      icon: School,
      title: "Classes & streams",
      description: "Set up classes, streams and class teachers.",
      stat: `${data?.classes.length ?? 0} classes`,
      detail: `${data?.streams.length ?? 0} streams`,
    },
    {
      to: "/academics/subjects" as const,
      icon: BookOpen,
      title: "Subjects",
      description: "Manage subjects, departments and papers.",
      stat: `${data?.subjects.length ?? 0} subjects`,
      detail: `${data?.departments.length ?? 0} departments`,
    },
    {
      to: "/academics/calendar" as const,
      icon: CalendarRange,
      title: "Years & terms",
      description: "Set academic years, terms and key dates.",
      stat: `${data?.academicYears.length ?? 0} years`,
      detail: `${data?.terms.length ?? 0} terms`,
    },
    {
      to: "/academics/grading" as const,
      icon: ListChecks,
      title: "Grading",
      description: "Configure grade bands and identifiers.",
      stat: `${data?.gradingScales.length ?? 0} grade bands`,
      detail: `${data?.identifierScales.length ?? 0} identifier bands`,
    },
    {
      to: "/academics/allocations" as const,
      icon: Users,
      title: "Allocations",
      description: "Assign teachers to subjects and classes.",
      stat: `${data?.allocations.length ?? 0} allocations`,
      detail: `${data?.teachers.length ?? 0} teachers`,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Academic setup"
        description="Manage classes, subjects, the calendar, grading and teacher assignments."
      />

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Classes", value: data?.classes.length ?? 0, styles: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300" },
          { label: "Subjects", value: data?.subjects.length ?? 0, styles: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300" },
          { label: "Allocations", value: data?.allocations.length ?? 0, styles: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
        ].map((stat) => (
          <div key={stat.label} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center shadow-sm sm:flex-row sm:justify-between sm:gap-2 sm:px-4 sm:py-3 ${stat.styles}`}>
            <span className="truncate text-[10px] font-semibold leading-tight sm:text-sm">{stat.label}</span>
            <span className="text-lg font-bold tabular-nums leading-tight sm:text-xl">{stat.value}</span>
          </div>
        ))}
      </div>

      <section aria-labelledby="academic-areas-heading">
      <div className="mb-3">
        <h2 id="academic-areas-heading" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Setup areas</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose an area to view or update its details.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group flex min-h-44 flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform duration-150 group-hover:scale-105">
                <card.icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-foreground">{card.title}</span>
            </span>
            <span className="mt-3 text-sm leading-6 text-muted-foreground">{card.description}</span>
            <span className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                {card.stat}
                {" \u00B7 "}
                {card.detail}
              </span>
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </div>
      </section>
    </div>
  );
}
