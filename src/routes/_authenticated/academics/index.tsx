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
      description: "Create classes and streams, then assign class and stream teachers.",
      stat: `${data?.classes.length ?? 0} classes`,
      detail: `${data?.streams.length ?? 0} streams`,
    },
    {
      to: "/academics/subjects" as const,
      icon: BookOpen,
      title: "Subjects",
      description: "O-Level and A-Level subjects with departments, codes and papers.",
      stat: `${data?.subjects.length ?? 0} subjects`,
      detail: `${data?.departments.length ?? 0} departments`,
    },
    {
      to: "/academics/calendar" as const,
      icon: CalendarRange,
      title: "Years & terms",
      description: "Academic years, terms and the current term date settings.",
      stat: `${data?.academicYears.length ?? 0} years`,
      detail: `${data?.terms.length ?? 0} terms`,
    },
    {
      to: "/academics/grading" as const,
      icon: ListChecks,
      title: "Grading",
      description: "O-Level and A-Level grading criteria and identifier descriptors.",
      stat: `${data?.gradingScales.length ?? 0} grade bands`,
      detail: `${data?.identifierScales.length ?? 0} identifier bands`,
    },
    {
      to: "/academics/allocations" as const,
      icon: Users,
      title: "Allocations",
      description: "Allocate teachers to subjects, papers, classes and streams.",
      stat: `${data?.allocations.length ?? 0} allocations`,
      detail: `${data?.teachers.length ?? 0} teachers`,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Academic setup"
        description="Everything that defines how your school runs day to day. Start with classes, then subjects, then the calendar, grading and teacher allocations."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors duration-150 hover:border-primary/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
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
    </div>
  );
}
