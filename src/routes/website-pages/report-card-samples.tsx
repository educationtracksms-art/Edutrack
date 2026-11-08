import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicShell } from "@/components/layout/PublicShell";

export const Route = createFileRoute("/website-pages/report-card-samples")({
  head: () => ({
    meta: [
      {
        title:
          "School Management System Uganda | Login, Free Download, Offline, Report Card Samples",
      },
      {
        name: "description",
        content:
          "Education Track SMS is a Uganda school management system for login, report cards, assessments, attendance, and school administration. Explore sample report card guidance plus free download and offline-ready school software information.",
      },
      {
        name: "keywords",
        content:
          "school management system uganda, school management system uganda login, school management system uganda free download, school management system uganda download, free school management system uganda, free offline school management system, school management system login, report card samples, report cards in Uganda, sample report card pdf, report card software",
      },
      {
        property: "og:title",
        content:
          "School Management System Uganda | Login, Free Download, Offline, Report Card Samples",
      },
      {
        property: "og:description",
        content:
          "Find Uganda-focused school management system information, login and download wording, plus sample report card guidance for schools.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
  component: ReportCardSamplesPage,
});

function ReportCardSamplesPage() {
  return (
    <PublicShell>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <div className="rounded-[30px] border border-sky-200/70 bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.35fr_0.95fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-200">
                  Report card samples
                </p>
                <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
                  Clearer report cards for modern Ugandan schools.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">
                  This page is designed to help schools, parents, and administrators find the right
                  structure for report cards, assessment summaries, attendance records, and school
                  management report layouts that feel polished and easy to understand.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/signup"
                    className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Request access
                  </Link>
                  <Link
                    to="/"
                    className="inline-flex rounded-full border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Explore platform
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-sky-100">
                  {[
                    "New curriculum",
                    "Attendance summaries",
                    "Term reporting",
                    "Printable reports",
                  ].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/15 bg-white/8 p-4 shadow-inner shadow-sky-500/10 backdrop-blur-sm">
                <div className="rounded-[18px] bg-white p-5 text-slate-900 shadow-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-700">
                        Sample report
                      </p>
                      <h2 className="mt-2 text-xl font-bold">Term 2 Progress</h2>
                    </div>
                    <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Ready
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {[
                      ["English", "A"],
                      ["Mathematics", "B+"],
                      ["Biology", "A-"],
                      ["ICT", "B"],
                    ].map(([subject, grade]) => (
                      <div
                        key={subject}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-700">{subject}</span>
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                          {grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 pb-14">
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-border bg-card p-6 shadow-sm shadow-slate-200/70 transition-transform duration-200 hover:-translate-y-0.5">
              <h2 className="text-base font-semibold">New curriculum</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The lower secondary competency-based approach needs clear learner comments, subject
                breakdowns, and assessment summaries that make sense to teachers and families.
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-6 shadow-sm shadow-slate-200/70 transition-transform duration-200 hover:-translate-y-0.5">
              <h2 className="text-base font-semibold">Term 2 reporting</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Schools can use this page as a sample structure for term 2 report card planning,
                English wording, and subject-by-subject performance communication.
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-6 shadow-sm shadow-slate-200/70 transition-transform duration-200 hover:-translate-y-0.5">
              <h2 className="text-base font-semibold">Report card software</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Education Track SMS helps schools prepare report cards from assessment records instead
                of rebuilding documents manually every term.
              </p>
            </article>
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-card p-6 md:p-8">
            <h2 className="text-2xl font-bold tracking-tight">Search terms schools often use</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Visitors often search for phrases like school management system Uganda login, school
              management system Uganda free download, school management system Uganda download, free
              school management system Uganda, free offline school management system, and school
              management system login. Education Track SMS is built to answer those searches with a
              real school platform for reports, assessments, attendance, and records.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-muted/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold tracking-tight">
              Sample report card content schools usually need
            </h2>
            <div className="mt-4 grid gap-4">
              <p className="text-sm leading-7 text-muted-foreground">
                A useful sample report card for Uganda should include learner identification details,
                class and term information, subject grades, competency comments, class teacher
                remarks, head teacher comments, attendance summary, and promotion guidance where
                needed.
              </p>
              <p className="text-sm leading-7 text-muted-foreground">
                For the new curriculum, schools often search for a report card PDF that is clear,
                printable, and easy to adapt for English language presentation. This page provides
                that language so the site can appear for terms like "new curriculum sample report
                card pdf", "new curriculum sample report card term 2", and "sample report card pdf".
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                For schools
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Use it as a reporting guide.</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Schools can use the wording on this page to shape report card layouts for lower
                secondary and other classes that need structured, competency-based reporting.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                For visitors
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                Request access to the full school system.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                If you need a complete school management platform for report cards, assessments,
                marksheets, attendance, and academic setup, Education Track SMS is built for that
                workflow.
              </p>
              <Link
                to="/signup"
                className="mt-5 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Request access
              </Link>
            </article>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
