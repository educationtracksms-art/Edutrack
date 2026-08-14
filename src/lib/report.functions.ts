import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildReportCards } from "./report.server";

export const getReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentIds: string[]; termId?: string | null }) => data)
  .handler(async ({ data, context }) =>
    buildReportCards(context.supabase, data.studentIds, data.termId ?? null),
  );

export const getOLevelReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentIds: string[]; termId?: string | null }) => data)
  .handler(async ({ data, context }) =>
    (await buildReportCards(context.supabase, data.studentIds, data.termId ?? null)).filter(
      (card) => card.gradingLevel === "ordinary",
    ),
  );

export const getALevelReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentIds: string[]; termId?: string | null }) => data)
  .handler(async ({ data, context }) =>
    (await buildReportCards(context.supabase, data.studentIds, data.termId ?? null)).filter(
      (card) => card.gradingLevel === "advanced",
    ),
  );

