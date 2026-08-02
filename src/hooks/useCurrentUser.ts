import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "school_admin"
  | "head_teacher"
  | "deputy_head_teacher"
  | "dos"
  | "class_teacher"
  | "subject_teacher"
  | "librarian";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  school_admin: "School Administrator",
  head_teacher: "Head Teacher",
  deputy_head_teacher: "Deputy Head Teacher",
  dos: "Director of Studies",
  class_teacher: "Class Teacher",
  subject_teacher: "Subject Teacher",
  librarian: "Librarian",
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      let school = null;
      if (profile?.school_id) {
        const { data } = await supabase
          .from("schools")
          .select("id, name, code, logo_url, status")
          .eq("id", profile.school_id)
          .maybeSingle();
        school = data;
      }

      const roleList = (roles ?? []).map((r) => r.role as AppRole);
      return {
        userId: user.id,
        email: user.email ?? "",
        profile,
        school,
        roles: roleList,
        isSuperAdmin: roleList.includes("super_admin"),
        mustChangePassword: !!profile?.must_change_password,
      };
    },
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
  "class_teacher",
  "subject_teacher",
  "librarian",
];
