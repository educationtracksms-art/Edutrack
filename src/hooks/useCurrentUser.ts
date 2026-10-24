import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole =
  | "super_admin"
  | "school_admin"
  | "head_teacher"
  | "bursar"
  | "hod"
  | "deputy_head_teacher"
  | "dos"
  | "class_teacher"
  | "subject_teacher"
  | "librarian";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  school_admin: "School Administrator",
  head_teacher: "Head Teacher",
  bursar: "Bursar",
  hod: "Head of Department",
  deputy_head_teacher: "Deputy Head Teacher",
  dos: "Director of Studies",
  class_teacher: "Class Teacher",
  subject_teacher: "Subject Teacher",
  librarian: "Librarian",
};

export type RoleHierarchyLevel = {
  level: number;
  label: string;
  summary: string;
  roles: AppRole[];
};

/**
 * The reporting shape shown to school administrators. This is intentionally
 * separate from module permissions: a staff member can still hold more than
 * one role, and each module continues to apply its own access rules.
 */
export const ROLE_HIERARCHY_LEVELS: RoleHierarchyLevel[] = [
  {
    level: 1,
    label: "Platform governance",
    summary:
      "Controls the EduTrack platform, school tenants and subscription oversight—not day-to-day school activities.",
    roles: ["super_admin"],
  },
  {
    level: 2,
    label: "School leadership",
    summary: "Owns school-wide administration, daily school activities, leadership decisions and staff access.",
    roles: ["school_admin", "head_teacher", "deputy_head_teacher"],
  },
  {
    level: 3,
    label: "Academic leadership",
    summary: "Coordinates academic planning, approvals, departments and teaching quality.",
    roles: ["dos"],
  },
  {
    level: 4,
    label: "Departments and operations",
    summary: "Leads subject departments and specialist school services.",
    roles: ["hod", "bursar", "librarian"],
  },
  {
    level: 5,
    label: "Teaching delivery",
    summary: "Delivers classroom, subject, attendance and assessment workflows.",
    roles: ["class_teacher", "subject_teacher"],
  },
];

const USER_CACHE_KEY = "edutrack-current-user";

/**
 * Shape of the cached current-user record. Kept in sync with the object built
 * by `fetchCurrentUser` — the localStorage cache must satisfy the same type so
 * TanStack Query infers `CurrentUser` instead of `any` for every consumer.
 */
export type CurrentUser = {
  userId: string;
  email: string;
  /** Columns selected by `fetchCurrentUser` — not the full profiles row. */
  profile:
    | Pick<
        Database["public"]["Tables"]["profiles"]["Row"],
        | "id"
        | "full_name"
        | "email"
        | "initials"
        | "phone"
        | "school_id"
        | "department_id"
        | "is_active"
        | "must_change_password"
      >
    | null;
  /** Columns selected by `fetchCurrentUser` — not the full schools row. */
  school: Pick<
    Database["public"]["Tables"]["schools"]["Row"],
    "id" | "name" | "code" | "logo_url" | "status"
  > | null;
  roles: AppRole[];
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
};

function readCachedUser(): CurrentUser | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId) return undefined;
    return parsed as CurrentUser;
  } catch {
    return undefined;
  }
}

function writeCachedUser(user: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (!user) window.localStorage.removeItem(USER_CACHE_KEY);
    else window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // Private mode / quota — non-fatal.
  }
}

export function clearCachedUser() {
  writeCachedUser(null);
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user ?? null;
  if (!sessionUser) {
    writeCachedUser(null);
    return null;
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, initials, phone, school_id, department_id, is_active, must_change_password",
      )
      .eq("id", sessionUser.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", sessionUser.id),
  ]);

  let school: CurrentUser["school"] = null;
  if (profile?.school_id) {
    const { data } = await supabase
      .from("schools")
      .select("id, name, code, logo_url, status")
      .eq("id", profile.school_id)
      .maybeSingle();
    school = data;
  }

  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  const result: CurrentUser = {
    userId: sessionUser.id,
    email: profile?.email ?? sessionUser.email ?? "",
    profile,
    school,
    roles: roleList,
    isSuperAdmin: roleList.includes("super_admin"),
    mustChangePassword: !!profile?.must_change_password,
  };
  writeCachedUser(result);
  return result;
}

export function currentUserQueryOptions() {
  return {
    queryKey: ["current-user"] as const,
    initialData: readCachedUser,
    initialDataUpdatedAt: () => Date.now(),
    staleTime: 10 * 60_000, // Tier 2: User data, 10 min
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: fetchCurrentUser,
  };
}

export function useCurrentUser() {
  return useQuery({
    ...currentUserQueryOptions(),
    // While the shell is already interactive, revalidate silently so role
    // changes propagate without blocking paint.
    refetchOnMount: true,
  });
}

export function hasAny(roles: AppRole[] | undefined, allowed: AppRole[]) {
  return (roles ?? []).some((r) => allowed.includes(r));
}

/** Roles allowed to configure classes, streams, subjects, allocations and timetables. */
export const ACADEMIC_MANAGERS: AppRole[] = [
  "dos",
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
];

/** Every school-level (non platform) role. */
export const SCHOOL_ROLES: AppRole[] = [
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "hod",
  "class_teacher",
  "subject_teacher",
  "librarian",
];
