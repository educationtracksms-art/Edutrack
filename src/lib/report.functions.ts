import { createServerFn } from "@tanstack/react-start";
import { requireRateLimitedSupabaseAuth as requireSupabaseAuth } from "@/integrations/supabase/rate-limited-auth-middleware";
import { buildReportCards } from "./report.server";

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
