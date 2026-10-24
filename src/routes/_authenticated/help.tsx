import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CheckCircle2, CircleHelp } from "lucide-react";

import { PageHeader, Panel } from "@/components/ui-kit";
import { ROLE_LABELS, hasAny, useCurrentUser, type AppRole } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help & user guide · EduTrack" },
      { name: "description", content: "A practical guide to the main EduTrack school tasks." },
    ],
  }),
  component: HelpPage,
});

type GuideLink = {
  title: string;
  description: string;
  to: string;
  roles: AppRole[];
};

const guideLinks: GuideLink[] = [
  {
    title: "Set up classes, subjects and terms",
    description: "Prepare the academic structure and assign teachers before teaching begins.",
    to: "/academics",
    roles: ["super_admin", "school_admin", "head_teacher", "deputy_head_teacher", "dos"],
  },
  {
    title: "Add learners",
    description: "Create learner records and place each learner in the right class and stream.",
    to: "/students",
    roles: ["super_admin", "school_admin", "head_teacher", "deputy_head_teacher", "dos", "hod", "class_teacher", "subject_teacher", "librarian", "bursar"],
  },
  {
    title: "Record attendance",
    description: "Mark learners present or absent for the selected class and date.",
    to: "/attendance",
    roles: ["school_admin", "head_teacher", "deputy_head_teacher", "dos", "hod", "class_teacher"],
  },
  {
    title: "Enter and approve marks",
    description: "Teachers enter assessment marks; academic leaders review and approve submissions.",
    to: "/assessments",
    roles: ["school_admin", "head_teacher", "deputy_head_teacher", "dos", "hod", "class_teacher", "subject_teacher"],
  },
  {
    title: "View reports",
    description: "Review learner performance and generate report cards after marks are approved.",
    to: "/reports",
    roles: ["school_admin", "head_teacher", "deputy_head_teacher", "dos", "class_teacher"],
  },
  {
    title: "Manage staff and roles",
    description: "Invite staff and assign the roles that determine which school tools they can use.",
    to: "/users",
    roles: ["super_admin", "school_admin"],
  },
  {
    title: "Open finance tools",
    description: "Manage fees, receipts, expenses and finance reports.",
    to: "/finance",
    roles: ["bursar"],
  },
  {
    title: "Update your account",
    description: "Change your password and review your personal account details.",
    to: "/account-settings",
    roles: ["super_admin", "school_admin", "head_teacher", "deputy_head_teacher", "dos", "hod", "class_teacher", "subject_teacher", "librarian", "bursar"],
  },
];

function HelpPage() {
  const { data: me } = useCurrentUser();
  const roleNames = (me?.roles ?? []).map((role) => ROLE_LABELS[role]).join(", ");
  const availableGuides = guideLinks.filter((guide) => hasAny(me?.roles, guide.roles));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Help & user guide"
        description="Find the right place for common school tasks and follow a simple path through EduTrack."
      />

      <Panel className="border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">Your access is based on your role</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {roleNames ? `Your role${(me?.roles.length ?? 0) > 1 ? "s are" : " is"} ${roleNames}. ` : ""}
              You may only see tools your school has enabled for your role. If you need access,
              contact your school administrator.
            </p>
          </div>
        </div>
      </Panel>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Common tasks</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {availableGuides.map((guide) => (
            <Link
              key={guide.to}
              to={guide.to}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{guide.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Panel title="A typical school term">
        <ol className="space-y-3 text-sm">
          {[
            "School leaders set up the term, classes, subjects and teacher assignments.",
            "Staff add or update learner records and class placements.",
            "Teachers record attendance and enter assessment marks during the term.",
            "Academic leaders review submitted marks and return or approve them.",
            "Once marks are approved, authorized staff review results and prepare reports.",
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><strong className="mr-1">{index + 1}.</strong>{step}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
