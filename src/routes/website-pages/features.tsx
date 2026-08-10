import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";

import { PublicShell } from "@/components/layout/PublicShell";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Feature = {
  slug: string;
  title: string;
  summary: string;
  sections: {
    heading: string;
    paragraphs: string[];
  }[];
};

const FEATURES: Feature[] = [
  {
    slug: "students",
    title: "Students",
    summary: "Manage learner profiles, placements, and core student records in one place.",
    sections: [
      {
        heading: "Why the student record matters",
        paragraphs: [
          "The student module is the center of the school database because every other academic workflow depends on it. Admissions, class placement, assessment records, attendance, promotions, report cards, and even administrative decisions become easier to manage when the learner exists as one well-structured record instead of several disconnected files. That is why the module is designed to hold the information schools repeatedly need, while keeping it simple enough for staff to use under real daily pressure.",
          "A strong student record reduces the friction that usually shows up when schools rely on paper registers or multiple spreadsheets. Rather than asking teachers and administrators to type the same learner details again and again, the system gives them one profile that can be reused throughout the school year. That means there is less duplication, fewer mistakes, and more confidence that staff are looking at the same information each time they open the learner record.",
        ],
      },
      {
        heading: "How schools use it in practice",
        paragraphs: [
          "When a learner joins the school, staff can capture basic identity details, admission information, class placement, and other relevant notes in a single place. Once stored, the record becomes available across the rest of the system so that teachers, heads of department, and administrators can all work from the same source of truth. This is especially useful when schools need to move quickly at the start of term or when new staff members need to understand learner history without digging through archived files.",
          "The module also helps with continuity. If a learner changes class, receives new academic comments, or needs updated school information, the record can be refreshed without losing the earlier history. That gives the school a clearer picture of the learner over time and makes it easier to support communication, reporting, and planning.",
        ],
      },
      {
        heading: "What improves when student data is centralized",
        paragraphs: [
          "Centralized student data improves speed, consistency, and accountability. Teachers do not have to ask the office for the same details repeatedly. Administrators do not need to reconcile mismatched records. School leaders get a more dependable view of the learner population. These benefits may sound simple, but they create a big difference in schools where many people depend on accurate records every day.",
          "It also lays the groundwork for better reporting. Once the student module is reliable, other parts of the system can generate more trustworthy assessment summaries, promotion decisions, attendance patterns, and class histories. In that sense, the student module is not only about storing names and dates. It is the foundation that helps the rest of the platform function cleanly and consistently.",
        ],
      },
    ],
  },
  {
    slug: "academic-setup",
    title: "Academic setup",
    summary: "Set up classes, subjects, streams, and the academic structure of the school.",
    sections: [
      {
        heading: "Building the school structure",
        paragraphs: [
          "The academic setup module defines the skeleton that the rest of the school system follows. It is where classes, levels, streams, subjects, and other structural pieces are organized so the platform reflects how the school actually operates. When that structure is clear, every other workflow becomes easier because the school is no longer asking staff to guess where a learner belongs or how a subject should be grouped.",
          "Schools often spend a lot of time correcting structure-related problems after term has already started. This module helps reduce that problem by making the academic layout visible and manageable before assessments, timetables, and reporting begin. A well-prepared setup means fewer last-minute adjustments and less confusion for teachers and administrators.",
        ],
      },
      {
        heading: "Why setup consistency matters",
        paragraphs: [
          "Consistency across terms is one of the main benefits of a strong academic setup. If the school keeps the same naming patterns and organizational logic every term, staff can work faster and with fewer errors. That matters for schools with many classes or multiple academic tracks because even small inconsistencies can create problems in reporting and data entry.",
          "The module also supports better planning. Once the school structure is in place, assessment records, report card layouts, and timetable decisions can all align with the same academic framework. That creates a smoother workflow from the first week of term to the final reporting stage.",
        ],
      },
    ],
  },
  {
    slug: "assessments",
    title: "Assessments",
    summary: "Capture and review learner assessments for continuous academic tracking.",
    sections: [
      {
        heading: "Continuous assessment in one place",
        paragraphs: [
          "The assessment module helps teachers record learner performance over time instead of only seeing the end-of-term result. That is important because schools need a fuller picture of progress, not just a final score. By storing assessments as they happen, the system makes it easier to follow development, identify gaps early, and respond before a learner falls too far behind.",
          "This is especially useful in environments where continuous assessment is part of the academic model. Teachers can enter scores, review trends, and compare outcomes across subjects or classes without having to move between spreadsheets and separate registers. The result is a cleaner process that supports actual teaching work rather than interrupting it.",
        ],
      },
      {
        heading: "Supporting better academic decisions",
        paragraphs: [
          "When assessment data is organized properly, the school can make better decisions about support, promotion, and reporting. Teachers can look at a learner's history and understand whether a result is an isolated issue or part of a broader trend. School leaders can also use the same data to monitor class performance and identify where intervention is needed.",
          "For lower secondary, this matters even more because the competency-based approach depends on tracking performance across multiple dimensions. A strong assessment module makes it easier to support that model with evidence, structure, and continuity rather than relying on memory or scattered notes.",
        ],
      },
    ],
  },
  {
    slug: "attendance",
    title: "Attendance",
    summary: "Record attendance and monitor class participation across the school.",
    sections: [
      {
        heading: "Daily attendance without the paper trail",
        paragraphs: [
          "Attendance is one of the most frequent school tasks, which means it needs to be simple and reliable. This module gives teachers a straightforward way to record presence, absence, and participation without relying on paper registers that can get misplaced or updated inconsistently. Because the data lives in one system, attendance becomes easier to check and easier to use later.",
          "A well-run attendance process also saves time at the start of lessons and during class coordination. Teachers can record attendance quickly and move on to instruction, while administrators get a clearer overview of day-to-day participation across the school.",
        ],
      },
      {
        heading: "Using attendance as an early warning signal",
        paragraphs: [
          "Attendance data is not only useful for counting who is present. It also helps schools notice patterns that need attention. Repeated absences, irregular participation, or class-specific attendance issues can reveal concerns that deserve follow-up before they become bigger academic or discipline problems.",
          "By making attendance visible in the system, the school can respond more quickly and with better evidence. That improves communication between teachers, administrators, and families, and it helps the school build a more complete picture of learner engagement over time.",
        ],
      },
    ],
  },
  {
    slug: "report-cards",
    title: "Report cards",
    summary: "Prepare report card data and reporting workflows more efficiently.",
    sections: [
      {
        heading: "From assessment data to a usable report",
        paragraphs: [
          "The report card module turns assessment information into something that can be reviewed, checked, and prepared for release. Instead of rebuilding reports manually each term, the school can work from data already entered elsewhere in the system. That reduces repetitive work and makes the reporting process more dependable.",
          "When reporting is connected to the same records used for assessment and student management, the school gets a stronger final output. Teachers can review information more confidently, administrators can check for mistakes earlier, and the school can release reports with less stress at the end of term.",
        ],
      },
      {
        heading: "Why consistency matters at reporting time",
        paragraphs: [
          "Consistent report card preparation is valuable because families and school leaders expect clarity. If reports are formatted differently every term or class, they become harder to read and harder to trust. This module helps schools keep the process structured so each class follows the same reporting logic.",
          "It also shortens the review cycle. When a report is easy to verify, teachers and administrators spend less time correcting layout or copy issues and more time checking whether the academic information itself is accurate and complete.",
        ],
      },
    ],
  },
  {
    slug: "marksheet",
    title: "Marksheet",
    summary: "Review marks, performance data, and academic summaries at a glance.",
    sections: [
      {
        heading: "A practical academic summary",
        paragraphs: [
          "The marksheet module gives staff a focused view of learner results across subjects and terms. Instead of moving through multiple records to understand how a class is doing, the marksheet collects the information into one place. That helps teachers and leaders scan performance quickly and find the points that need attention.",
          "This is especially useful during busy reporting periods or review meetings, when staff need a reliable snapshot rather than a long manual search. A compact view of marks saves time and improves the quality of the academic discussion.",
        ],
      },
      {
        heading: "Turning marks into action",
        paragraphs: [
          "A marksheet is most useful when it does more than display numbers. It should help people identify patterns, strengths, gaps, and trends. That is why the module supports review and comparison across different classes and subjects, making it easier to see where performance is strong and where support may be needed.",
          "When the marksheet is part of the same system that holds assessments and student records, the school can move from raw data to meaningful academic action much faster. That gives teachers more confidence and helps leaders make better decisions about progress and promotion.",
        ],
      },
    ],
  },
  {
    slug: "promotions",
    title: "Promotions",
    summary: "Move learners to the next level with a more organized promotion workflow.",
    sections: [
      {
        heading: "Managing learner movement cleanly",
        paragraphs: [
          "Promotion is one of the most sensitive end-of-year academic tasks because it affects how learners move through the school structure. This module helps organize that movement so staff can update classes and levels in a controlled way instead of relying on manual adjustments that can introduce mistakes.",
          "When promotions are connected to the learner record and academic history, schools can make transitions more predictable. That reduces confusion for staff, keeps records consistent, and helps ensure that the next academic year begins with the right learner placement.",
        ],
      },
      {
        heading: "Why promotion history matters",
        paragraphs: [
          "A good promotion process should not just move a learner forward. It should preserve the academic story behind that movement. By keeping the records linked, the school can understand how the learner got to the next level and what performance history informed the decision.",
          "This helps administrators and teachers make better progression decisions and gives the school a cleaner trail to review later if questions arise. It also makes year-to-year transitions smoother because the system already knows where each learner belongs.",
        ],
      },
    ],
  },
  {
    slug: "library",
    title: "Library",
    summary: "Track books and library resources for easier student and staff access.",
    sections: [
      {
        heading: "Keeping resources visible",
        paragraphs: [
          "The library module helps schools keep books and other resources visible instead of leaving them buried in a manual register. When staff can see what is available, what is in use, and what needs attention, the library becomes easier to manage as part of the wider school operation.",
          "This is valuable for schools where books move between classes, teachers, and learners throughout the year. A structured system helps reduce lost items, avoid confusion, and support better responsibility for shared resources.",
        ],
      },
      {
        heading: "Supporting access and accountability",
        paragraphs: [
          "The library is not just about storage. It is also about access. A well-organized module can help schools track which resources are being used and by whom, which makes borrowing and inventory checks easier to manage.",
          "That accountability matters because it keeps the resource center from becoming a separate island of manual work. Instead, it becomes part of the school's broader management workflow, with clearer oversight and fewer gaps.",
        ],
      },
    ],
  },
  {
    slug: "timetable",
    title: "Timetable",
    summary: "Plan class schedules and organize periods across the school week.",
    sections: [
      {
        heading: "Planning the school week",
        paragraphs: [
          "The timetable module helps schools organize teaching periods, subject delivery, and weekly class movement in one place. That makes it easier to see how the school day is arranged and helps staff avoid the confusion that often comes with schedules built in isolation.",
          "Because timetables affect teachers, learners, and administrators alike, the module is designed to support clear planning before the schedule is shared. That reduces the chance of clashes, gaps, or conflicting assignments later in the week.",
        ],
      },
      {
        heading: "Why visibility matters",
        paragraphs: [
          "A visible timetable gives the whole school a better sense of rhythm. Teachers can prepare, learners can follow the structure, and administrators can review whether the schedule is balanced. It also becomes easier to spot missing slots or overloaded days before they create problems.",
          "When the timetable is managed centrally, it becomes a planning tool rather than just a published document. That helps the school keep the weekly flow more organized and more responsive to real classroom needs.",
        ],
      },
    ],
  },
  {
    slug: "schools",
    title: "Schools",
    summary: "For administrators managing multiple schools, keep each institution organized.",
    sections: [
      {
        heading: "One platform, multiple institutions",
        paragraphs: [
          "The schools module is designed for organizations that manage more than one institution under the same platform. It keeps each school separated while still allowing centralized oversight, which is important for owners and administrators who need a clear view without mixing records.",
          "That separation helps maintain data integrity. Each campus or school can have its own records, structure, and operational details while still being part of a broader administrative picture.",
        ],
      },
      {
        heading: "Making oversight easier",
        paragraphs: [
          "Managing multiple schools becomes much easier when the information is organized in a single system. Leaders can compare operations, review performance, and understand where support is needed without jumping between different tools or logging into different systems.",
          "This gives school groups a stronger administrative foundation and makes it easier to grow without losing control of the details that matter day to day.",
        ],
      },
    ],
  },
  {
    slug: "users-and-roles",
    title: "Users and roles",
    summary: "Assign access and responsibilities to staff with role-based permissions.",
    sections: [
      {
        heading: "Matching access to responsibility",
        paragraphs: [
          "The users and roles module makes it possible to give each staff member access that matches their job. This matters because schools do not operate with one type of user. Teachers, heads, administrators, and support staff all need different tools, and the system should reflect that clearly.",
          "Role-based permissions reduce confusion and prevent people from seeing or changing areas they do not need. That makes the platform safer and more aligned with how the school actually works.",
        ],
      },
      {
        heading: "Security and accountability",
        paragraphs: [
          "When access is controlled properly, the school benefits from stronger security and better accountability. Sensitive records are protected, accidental edits are less likely, and the system can better support responsible administration.",
          "This module also helps the software mirror the school's real organizational structure, which makes onboarding and daily use easier for staff because the tools they see are the tools they actually need.",
        ],
      },
    ],
  },
  {
    slug: "school-settings",
    title: "School settings",
    summary: "Configure the school profile, setup details, and core system preferences.",
    sections: [
      {
        heading: "The administrative foundation",
        paragraphs: [
          "School settings hold the core identity of the institution inside the platform. This is where the school profile, configuration choices, and key preferences live so the rest of the system can behave consistently. Without this foundation, the platform would have to guess too much about how the school is organized.",
          "The module helps staff make important setup changes in one place rather than scattered across different screens. That saves time and keeps the system aligned with the school's actual details.",
        ],
      },
      {
        heading: "Keeping the platform aligned",
        paragraphs: [
          "Settings are useful because schools change over time. Names, branding, structures, and preferences can evolve, and the system needs to adapt without breaking the rest of the workflow. Centralized settings make that easier.",
          "It also keeps the user experience consistent. When everyone is working from the same configuration, the platform feels more stable and less likely to drift into mismatched behavior.",
        ],
      },
    ],
  },
  {
    slug: "audit-logs",
    title: "Audit logs",
    summary: "Review important activity and changes for better accountability.",
    sections: [
      {
        heading: "Watching system activity",
        paragraphs: [
          "Audit logs provide visibility into important actions inside the system. They show what changed, when it changed, and who made the change, which is important for accountability in a school environment where many people work with shared records.",
          "This kind of visibility is useful not only when something goes wrong, but also during routine review. It helps administrators understand how the system is being used and whether changes are happening in the right places.",
        ],
      },
      {
        heading: "Supporting trust and review",
        paragraphs: [
          "When staff know that actions can be reviewed later, the system encourages more careful and responsible use. That improves trust across the platform and gives leaders a clearer trail when they need to investigate or confirm something.",
          "Audit logs are often invisible when everything is working well, but they become essential the moment a school needs clarity. That makes them a valuable part of a mature administrative system.",
        ],
      },
    ],
  },
  {
    slug: "approvals",
    title: "Approvals",
    summary: "Support departmental review and approvals where decision-making needs oversight.",
    sections: [
      {
        heading: "A controlled review process",
        paragraphs: [
          "Approvals help schools add a review step to important academic or administrative actions. That is useful when a decision should not be finalized by one person alone and needs an extra layer of oversight before it is accepted.",
          "By organizing approvals inside the system, the school avoids scattered manual sign-off processes and creates a clearer record of what was reviewed, by whom, and when.",
        ],
      },
      {
        heading: "Clearer accountability for decisions",
        paragraphs: [
          "Approval workflows are valuable because they create shared responsibility without creating confusion. Staff know what has been submitted, leaders know what needs attention, and the school can keep a visible history of what was accepted or rejected.",
          "That makes the process easier to manage and easier to trust, especially in areas where the school needs structured oversight rather than informal verbal approval.",
        ],
      },
    ],
  },
  {
    slug: "dashboard-insights",
    title: "Dashboard insights",
    summary: "See school activity and progress in a more organized administrative view.",
    sections: [
      {
        heading: "Turning data into a useful view",
        paragraphs: [
          "Dashboard insights help the school move from raw records to a more useful administrative view. Instead of forcing staff to inspect every dataset separately, the dashboard surfaces important information in a way that is easier to scan and understand quickly.",
          "That matters because leaders rarely have time to dig through many screens before making a decision. A good dashboard gives them the overview they need while still pointing to the areas that deserve more attention.",
        ],
      },
      {
        heading: "Helping leaders act sooner",
        paragraphs: [
          "When school activity is summarized clearly, leaders can spot trends earlier and respond more quickly. That could mean noticing attendance concerns, reviewing academic progress, or understanding where operational attention is needed first.",
          "The goal is not to replace detailed records, but to make them more usable. Dashboard insights give teams a faster path from data to action, which improves day-to-day decision-making across the school.",
        ],
      },
    ],
  },
];

export function getFeature(slug: string) {
  return FEATURES.find((feature) => feature.slug === slug);
}

export const Route = createFileRoute("/website-pages/features")({
  head: () => ({
    meta: [
      { title: "Features | Education Track SMS" },
      {
        name: "description",
        content:
          "Explore the core modules of Education Track SMS, including students, academics, assessments, attendance, reports, and school administration.",
      },
      { property: "og:title", content: "Features | Education Track SMS" },
      { property: "og:description", content: "See the school modules and admin tools built into Education Track SMS." },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Features</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          The application modules that power school operations.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
          Education Track SMS is built around the same modules schools use in the admin area. These
          features help teams manage academic work, student records, reporting, and daily
          administration from one platform.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((feature) => (
            <button
              key={feature.slug}
              type="button"
              onClick={() => setActiveFeature(feature)}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.summary}</p>
              <p className="mt-4 text-sm font-medium text-accent transition-transform group-hover:translate-x-0.5">
                Read more
              </p>
            </button>
          ))}
        </div>

        <Dialog open={activeFeature !== null} onOpenChange={(open) => !open && setActiveFeature(null)}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            {activeFeature ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">{activeFeature.title}</DialogTitle>
                  <DialogDescription className="text-sm leading-6 text-muted-foreground">
                    {activeFeature.summary}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 grid gap-8">
                  {activeFeature.sections.map((section) => (
                    <section key={section.heading} className="grid gap-3">
                      <h3 className="text-lg font-semibold tracking-tight">{section.heading}</h3>
                      <div className="grid gap-4">
                        {section.paragraphs.map((paragraph) => (
                          <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="mt-10 rounded-3xl border border-border bg-muted/40 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Why this matters
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
            Instead of presenting generic website features, this page now reflects the real modules
            inside the application. That makes it easier for parents, school leaders, and staff to
            understand what the system actually does and which parts of school work it can support.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
