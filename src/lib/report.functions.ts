import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildReportCards } from "./report.server";

export const getReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentIds: string[]; termId?: string | null }) => data)
  .handler(async ({ data, context }) =>
    buildReportCards(context.supabase, data.studentIds, data.termId ?? null),
  );
