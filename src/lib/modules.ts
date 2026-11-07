import type { SupabaseClient } from "@supabase/supabase-js";

export type ModuleKey =
  | "fees"
  | "attendance"
  | "library"
  | "transport"
  | "hostel"
  | "inventory"
  | "sms"
  | "parent_portal"
  | "discipline"
  | "report_cards"
  | "co_curricular"
  | "academics"
  | "students"
  | "finance"
  | "timetable";

export const SCHOOL_MODULE_MANAGEMENT_ROLES = [
  "dos",
  "head_teacher",
  "deputy_head_teacher",
] as const;

export function canManageSchoolModules(roles: readonly string[] | string[] | undefined): boolean {
  const roleSet = new Set(SCHOOL_MODULE_MANAGEMENT_ROLES);
  return (roles ?? []).some((role) => roleSet.has(role as (typeof SCHOOL_MODULE_MANAGEMENT_ROLES)[number]));
}

type AnyClient = SupabaseClient<any, any, any>;

export async function getEnabledModuleMap(supabase: AnyClient, schoolId: string | null) {
  if (!schoolId) return new Map<string, boolean>();

  const { data } = await supabase
    .from("feature_toggles")
    .select("module, enabled")
    .eq("school_id", schoolId);

  return new Map((data ?? []).map((row: any) => [row.module as string, !!row.enabled]));
}

export async function isModuleEnabled(
  supabase: AnyClient,
  schoolId: string | null,
  module: ModuleKey,
) {
  const enabledModules = await getEnabledModuleMap(supabase, schoolId);
  return enabledModules.get(module) ?? true;
}
