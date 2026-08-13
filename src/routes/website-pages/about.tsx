import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/layout/PublicShell";

export const Route = createFileRoute("/website-pages/about")({
  head: () => ({
    meta: [
      { title: "About Us | Education Track SMS" },
      {
        name: "description",
        content:
          "Learn about Education Track SMS and how it helps schools in Uganda manage administration, records, and communication more effectively.",
      },
      { property: "og:title", content: "About Us | Education Track SMS" },
      {
        property: "og:description",
        content:
          "Education Track SMS is built to help schools simplify administration and support better learning outcomes.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">About us</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          Built for schools that need clarity, control, and a better way to manage learning.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
          Education Track SMS is a school management system developed by K-Dev Technologies Ltd for
          the daily work of Ugandan schools. It brings admissions, student records, class
          organization, assessments, report writing, communication, and administration into one
          place so staff can work faster and with fewer errors.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          The platform is designed to help schools move away from scattered paperwork and
          disconnected spreadsheets. Instead, the people who manage the school can work from one
          system with clearer records, better visibility, and a more organized workflow from
          admission through reporting.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Admissions and records</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Capture learner details once and reuse them across the system for enrollment, class
              placement, and reporting. This reduces duplicate entry and helps staff keep records
              clean and consistent.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Academics and assessments</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Manage class groups, subjects, assessment records, and report preparation in a way
              that supports both day-to-day teaching and end-of-term reporting.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Administration and oversight</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Give school leaders a clearer view of what is happening across the institution so they
              can follow progress, review activity, and make decisions with better information.
            </p>
          </article>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">What the system helps schools do</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The platform helps heads, teachers, and administrators keep records organized, track
              learner progress, prepare reports, and reduce manual paperwork. It supports smoother
              day-to-day operations across academic and administrative teams.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Why it matters</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              When school information is centralized, it becomes easier to make decisions, monitor
              performance, and communicate clearly with staff and families. That creates more time
              for teaching and learner support.
            </p>
          </article>
        </div>

        <div className="mt-10 rounded-3xl border border-border bg-muted/40 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Secondary school curriculum support
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            Ready for the competency-based approach in lower secondary.
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
            Uganda&apos;s lower secondary curriculum has moved to a competency-based model, with
            greater emphasis on learner-centered teaching, continuous assessment, and tracking
            skills, knowledge, and attitudes over time. Education Track SMS is built to support that
            shift by helping schools record assessments, follow learner progress, and manage the
            information needed for more detailed reporting.
          </p>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
            That means schools can better support Senior One to Senior Four learners, keep
            assessment records more consistently, and stay aligned with modern teaching and
            reporting expectations.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-border bg-card p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Developed by
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">K-Dev Technologies Ltd</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
            K-Dev Technologies Ltd developed Education Track SMS with a focus on practical school
            administration needs, simple usability, and long-term reliability. The goal is to give
            schools a system that is easy to adopt, useful for daily operations, and ready to grow
            with the institution over time.
          </p>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
            The company&apos;s approach is to build tools that reduce repetitive work, support
            better decision-making, and help schools keep pace with modern education requirements.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-border bg-card p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              How schools use it
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              A workflow that fits the school year.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Schools can use the system from the start of the academic year to the end of term:
              admit learners, place them into classes, manage subjects, record assessments, review
              performance, and prepare reports. The idea is to reduce switching between paper files,
              spreadsheets, and disconnected tools.
            </p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              By keeping information in one platform, teachers spend less time repeating the same
              work and more time focusing on instruction and learner support.
            </p>
          </article>

          <article className="rounded-3xl border border-border bg-muted/40 p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Designed for growth
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Flexible enough for single schools and multi-school groups.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Whether a school wants to organize one campus or a group of schools, the system is
              meant to scale with it. That makes it useful for heads, administrators, and educators
              who need a reliable view of records, performance, and school operations.
            </p>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
