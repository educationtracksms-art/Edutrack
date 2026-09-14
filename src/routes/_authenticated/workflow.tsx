import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Circle,
  ClipboardCheck,
  FileBadge,
  GraduationCap,
  Library,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import { useMemo } from "react";

import { Btn, PageHeader, Panel, Pill, Stat } from "@/components/ui-kit";
import { ACADEMIC_MANAGERS, hasAny, SCHOOL_ROLES, useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workflow")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "School workflow · EduTrack" },
      {
        name: "description",
        content: "Follow the school setup, teaching, assessment and reporting process in order.",
      },
    ],
  }),
  component: WorkflowPage,
});

type WorkflowSnapshot = {
  departments: number;
  teachingStaff: number;
  classes: number;
  streams: number;
  subjects: number;
  terms: number;
  gradingScales: number;
  students: number;
  allocations: number;
  assessments: number;
  approvedAssessments: number;
};

type WorkflowPath =
  | "/users"
  | "/academics"
  | "/students"
  | "/assessments"
  | "/reports"
  | "/timetable"
  | "/attendance"
  | "/marksheet";

type WorkflowStep = {
  number: number;
  title: string;
  description: string;
  detail: string;
  href: WorkflowPath;
  icon: typeof Users;
  done: boolean;
  canOpen: boolean;
};

function WorkflowPage() {
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canManageUsers = hasAny(me?.roles, ["super_admin", "school_admin"]);
  const canManageAcademics = hasAny(me?.roles, ACADEMIC_MANAGERS);
  const canManageStudents = hasAny(me?.roles, SCHOOL_ROLES);
  const canEnterMarks = hasAny(me?.roles, [
    "dos",
    "hod",
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "subject_teacher",
    "class_teacher",
  ]);
  const canGenerateReports = hasAny(me?.roles, [
    "school_admin",
    "head_teacher",
    "deputy_head_teacher",
    "dos",
    "class_teacher",
  ]);

  const snapshotQuery = useQuery<WorkflowSnapshot>({
    queryKey: ["school-workflow", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [
        departments,
        profiles,
        roles,
        classes,
        streams,
        subjects,
        terms,
        gradingScales,
        students,
        allocations,
        assessments,
      ] = await Promise.all([
        supabase.from("departments").select("id").eq("school_id", schoolId!),
        supabase.from("profiles").select("id").eq("school_id", schoolId!),
        supabase.from("user_roles").select("user_id, role").eq("school_id", schoolId!),
        supabase.from("classes").select("id").eq("school_id", schoolId!),
        supabase.from("streams").select("id").eq("school_id", schoolId!),
        supabase.from("subjects").select("id").eq("school_id", schoolId!),
        supabase.from("terms").select("id").eq("school_id", schoolId!),
        supabase.from("grading_scales").select("id").eq("school_id", schoolId!),
        supabase.from("students").select("id").eq("school_id", schoolId!).eq("status", "active"),
        supabase.from("teacher_allocations").select("id").eq("school_id", schoolId!),
        supabase.from("assessments").select("id, status").eq("school_id", schoolId!),
      ]);

      const result = [
        departments,
        profiles,
        roles,
        classes,
        streams,
        subjects,
        terms,
        gradingScales,
        students,
        allocations,
        assessments,
      ].find((item) => item.error);
      if (result?.error) throw new Error(result.error.message);

      const teachingUserIds = new Set(
        (roles.data ?? [])
          .filter((item) =>
            [
              "head_teacher",
              "deputy_head_teacher",
              "dos",
              "hod",
              "class_teacher",
              "subject_teacher",
            ].includes(item.role),
          )
          .map((item) => item.user_id),
      );
      const assessmentRows = (assessments.data ?? []) as Array<{ status: string }>;

      return {
        departments: departments.data?.length ?? 0,
        teachingStaff: (profiles.data ?? []).filter((profile) => teachingUserIds.has(profile.id))
          .length,
        classes: classes.data?.length ?? 0,
        streams: streams.data?.length ?? 0,
        subjects: subjects.data?.length ?? 0,
        terms: terms.data?.length ?? 0,
        gradingScales: gradingScales.data?.length ?? 0,
        students: students.data?.length ?? 0,
        allocations: allocations.data?.length ?? 0,
        assessments: assessmentRows.length,
        approvedAssessments: assessmentRows.filter((item) => item.status === "approved").length,
      };
    },
  });

  const snapshot = snapshotQuery.data;
  const steps = useMemo<WorkflowStep[]>(
    () => [
      {
        number: 1,
        title: "Staff and departments",
        description:
          "Create the people who will run the school and place teaching staff in departments.",
        detail: `${snapshot?.teachingStaff ?? 0} teaching staff · ${snapshot?.departments ?? 0} departments`,
        href: "/users",
        icon: Users,
        done: (snapshot?.teachingStaff ?? 0) > 0 && (snapshot?.departments ?? 0) > 0,
        canOpen: canManageUsers,
      },
      {
        number: 2,
        title: "Academic structure",
        description: "Set up classes, streams and the subjects that belong to each department.",
        detail: `${snapshot?.classes ?? 0} classes · ${snapshot?.streams ?? 0} streams · ${snapshot?.subjects ?? 0} subjects`,
        href: "/academics",
        icon: Library,
        done: (snapshot?.classes ?? 0) > 0 && (snapshot?.subjects ?? 0) > 0,
        canOpen: canManageAcademics,
      },
      {
        number: 3,
        title: "Academic year and terms",
        description:
          "Create the active year, terms and grading rules before marks can be recorded.",
        detail: `${snapshot?.terms ?? 0} terms · ${snapshot?.gradingScales ?? 0} grading rules`,
        href: "/academics",
        icon: Settings2,
        done: (snapshot?.terms ?? 0) > 0 && (snapshot?.gradingScales ?? 0) > 0,
        canOpen: canManageAcademics,
      },
      {
        number: 4,
        title: "Learners",
        description: "Register learners and assign each one to the correct class and stream.",
        detail: `${snapshot?.students ?? 0} active learners`,
        href: "/students",
        icon: GraduationCap,
        done: (snapshot?.students ?? 0) > 0,
        canOpen: canManageStudents,
      },
      {
        number: 5,
        title: "Teacher allocations",
        description:
          "Connect teachers to subjects, classes and streams before timetable or marks entry.",
        detail: `${snapshot?.allocations ?? 0} allocations`,
        href: "/academics",
        icon: Users,
        done: (snapshot?.allocations ?? 0) > 0,
        canOpen: canManageAcademics,
      },
      {
        number: 6,
        title: "Enter and approve marks",
        description:
          "Teachers submit marks and the Director of Studies approves them for reporting.",
        detail: `${snapshot?.approvedAssessments ?? 0} approved · ${snapshot?.assessments ?? 0} total marks`,
        href: "/assessments",
        icon: ClipboardCheck,
        done: (snapshot?.approvedAssessments ?? 0) > 0,
        canOpen: canEnterMarks,
      },
      {
        number: 7,
        title: "Produce report cards",
        description: "Generate and print report cards from approved assessment data.",
        detail: snapshot?.approvedAssessments ? "Reports are ready" : "Waiting for approved marks",
        href: "/reports",
        icon: FileBadge,
        done: (snapshot?.approvedAssessments ?? 0) > 0,
        canOpen: canGenerateReports,
      },
    ],
    [
      canEnterMarks,
      canGenerateReports,
      canManageAcademics,
      canManageStudents,
      canManageUsers,
      snapshot,
    ],
  );

  const firstIncomplete = steps.findIndex((step) => !step.done);
  const completed = steps.filter((step) => step.done).length;
  const nextStep = steps[firstIncomplete === -1 ? steps.length - 1 : firstIncomplete];

  if (!schoolId) {
    return (
      <div>
        <PageHeader
          eyebrow="School workflow"
          title="Choose a school to begin"
          description="The guided school workflow is available after a school account is selected."
        />
        <Panel title="Platform administration">
          <p className="text-sm text-muted-foreground">
            Super Admins should create or open a school first. School staff see the operational
            workflow after signing in to their school account.
          </p>
          <Link
            to="/schools"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            Open schools <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="School workflow"
        title="Run the school in the right order"
        description="Use this single workspace as the starting point. Complete each step before moving to the next one; the linked tool opens the exact place where that step is completed."
        actions={
          <Btn
            variant="ghost"
            onClick={() => void snapshotQuery.refetch()}
            disabled={snapshotQuery.isFetching}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className={cn("h-4 w-4", snapshotQuery.isFetching && "animate-spin")} />
              Refresh progress
            </span>
          </Btn>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Workflow progress"
          value={`${completed}/${steps.length}`}
          hint="completed steps"
        />
        <Stat label="Active learners" value={snapshot?.students ?? 0} hint="ready for teaching" />
        <Stat
          label="Approved marks"
          value={snapshot?.approvedAssessments ?? 0}
          hint="available for reports"
        />
      </div>

      <Panel title="Your working sequence" className="mt-4">
        <div className="mb-5 rounded-2xl border border-primary/15 bg-primary-soft/50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Next action</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{nextStep?.title ?? "Workflow complete"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {firstIncomplete === -1
                  ? "All required steps are complete. You can generate reports or start the next academic cycle."
                  : nextStep.description}
              </p>
            </div>
            {nextStep && !nextStep.done && nextStep.canOpen && (
              <Link
                to={nextStep.href}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-foreground"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const locked = firstIncomplete !== -1 && index > firstIncomplete && !step.done;
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={cn(
                  "relative flex gap-3 rounded-2xl border p-4 transition-colors sm:gap-4",
                  step.done
                    ? "border-success/30 bg-success/5"
                    : locked
                      ? "border-border bg-muted/25 opacity-70"
                      : "border-primary/25 bg-background",
                )}
              >
                {index < steps.length - 1 && (
                  <span className="absolute left-[1.65rem] top-[4.4rem] hidden h-5 w-px bg-border sm:block" />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    step.done ? "bg-success text-white" : "bg-primary text-primary-foreground",
                  )}
                >
                  {step.done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-bold">{step.number}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-semibold">{step.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <Pill tone={step.done ? "success" : locked ? "muted" : "warning"}>
                      {step.done
                        ? "Complete"
                        : locked
                          ? "Locked until previous step"
                          : step.canOpen
                            ? "Next step"
                            : "Ask an administrator"}
                    </Pill>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{step.detail}</span>
                    {step.canOpen && !locked ? (
                      <Link
                        to={step.href}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                      >
                        {step.done ? "Review" : "Open step"} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Circle className="h-3.5 w-3.5" />
                        {locked
                          ? "Complete the earlier steps first"
                          : "Ask an administrator to complete this step"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Supporting tools" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            to="/timetable"
            className="rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-primary-soft/30"
          >
            <p className="font-semibold">Build timetable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Schedule allocated lessons after teaching loads are ready.
            </p>
          </Link>
          <Link
            to="/attendance"
            className="rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-primary-soft/30"
          >
            <p className="font-semibold">Record attendance</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Take daily roll call for active learners.
            </p>
          </Link>
          <Link
            to="/marksheet"
            className="rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-primary-soft/30"
          >
            <p className="font-semibold">Review marks</p>
            <p className="mt-1 text-sm text-muted-foreground">
              View approved scores by class, stream and subject.
            </p>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
