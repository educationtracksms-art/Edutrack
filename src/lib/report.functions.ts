import { createServerFn } from "@tanstack/react-start";
import { requireRateLimitedSupabaseAuth as requireSupabaseAuth } from "@/integrations/supabase/rate-limited-auth-middleware";
import { buildReportCards } from "./report.server";
import type { ReportCardData, SubjectRow } from "./report-types";

const REPORT_PRINT_ROLES = ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"];

async function requireReportPrintAccess(supabase: any, userId: string) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(`Unable to verify report access: ${error.message}`);
  if (!(roles ?? []).some((item: { role: string }) => REPORT_PRINT_ROLES.includes(item.role))) {
    throw new Error("Only the Director of Studies, School Admin, Head Teacher, or Deputy Head Teacher can print reports");
  }
}

export const getReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentIds: string[]; termId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    await requireReportPrintAccess(context.supabase, context.userId);
    return buildReportCards(context.supabase, data.studentIds, data.termId ?? null);
  });

export const getOLevelReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentIds: string[]; termId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    await requireReportPrintAccess(context.supabase, context.userId);
    return buildReportCards(context.supabase, data.studentIds, data.termId ?? null, "ordinary");
  });

export const getALevelReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentIds: string[]; termId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    await requireReportPrintAccess(context.supabase, context.userId);
    return buildReportCards(context.supabase, data.studentIds, data.termId ?? null, "advanced");
  });

export const getMarksheetResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentIds: string[]; termId: string }) => data)
  .handler(async ({ data, context }) => {
    const allowedRoles = [
      "dos",
      "school_admin",
      "head_teacher",
      "deputy_head_teacher",
      "class_teacher",
      "subject_teacher",
      "super_admin",
    ];
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("school_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(`Unable to load your school: ${profileError.message}`);
    if (!profile?.school_id) throw new Error("Your account is not linked to a school");

    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(`Unable to verify marksheet access: ${roleError.message}`);
    if (
      !(roles ?? []).some(
        (role) =>
          role.role === "super_admin" ||
          (role.school_id === profile.school_id && allowedRoles.includes(role.role)),
      )
    ) {
      throw new Error("You are not allowed to view this marksheet");
    }

    const studentIds = Array.from(new Set(data.studentIds.filter(Boolean)));
    if (!studentIds.length) return [];
    const { data: students, error: studentsError } = await context.supabase
      .from("students")
      .select("id, class_id")
      .eq("school_id", profile.school_id)
      .in("id", studentIds);
    if (studentsError) throw new Error(`Unable to load learners: ${studentsError.message}`);
    if ((students ?? []).length !== studentIds.length) {
      throw new Error("One or more selected learners are not available in your school");
    }

    const classIds = Array.from(new Set((students ?? []).map((student) => student.class_id).filter(Boolean)));
    const { data: classes, error: classesError } = classIds.length
      ? await context.supabase
          .from("classes")
          .select("id, education_level")
          .eq("school_id", profile.school_id)
          .in("id", classIds as string[])
      : { data: [], error: null };
    if (classesError) throw new Error(`Unable to load learner classes: ${classesError.message}`);

    const classLevels = new Map(
      (classes ?? []).map((item) => [item.id, item.education_level === "advanced" ? "advanced" : "ordinary"] as const),
    );
    const idsByLevel = new Map<"ordinary" | "advanced", string[]>([
      ["ordinary", []],
      ["advanced", []],
    ]);
    for (const student of students ?? []) {
      const level = classLevels.get(student.class_id ?? "") ?? "ordinary";
      idsByLevel.get(level)?.push(student.id);
    }

    const reportGroups = await Promise.all(
      Array.from(idsByLevel.entries())
        .filter(([, ids]) => ids.length > 0)
        .map(([level, ids]) => buildReportCards(context.supabase, ids, data.termId, level)),
    );
    return reportGroups.flat().map((card: ReportCardData) => ({
      studentId: card.studentId,
      gradingLevel: card.gradingLevel,
      rows: card.rows as SubjectRow[],
      activeSummativePeriods: card.activeSummativePeriods,
    }));
  });
