import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  createStaffUser,
  updateStaffUser,
  resetUserPassword,
  deleteStaffUser,
} from "@/lib/admin.functions";
import { hasAny, useCurrentUser, type AppRole } from "@/hooks/useCurrentUser";

export { ROLE_LABELS } from "@/hooks/useCurrentUser";
export type { AppRole } from "@/hooks/useCurrentUser";

export const ASSIGNABLE: AppRole[] = [
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "bursar",
  "hod",
  "class_teacher",
  "subject_teacher",
  "librarian",
];

export const DEPARTMENT_REQUIRED_ROLES: AppRole[] = [
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "hod",
  "class_teacher",
  "subject_teacher",
];

export interface StaffUserFormValues {
  fullName: string;
  email: string;
  role: AppRole;
  initials: string;
  schoolId: string;
  departmentId: string;
}

const ADMIN_UNAVAILABLE_MSG =
  "Supabase admin client is unavailable because the committed .env file was not found at runtime.";

function adminUnavailable(action: string) {
  return `${action} is unavailable because the committed .env file is not being shipped with the deployment.`;
}

export function useUsersData() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const isSuper = hasAny(me?.roles, ["super_admin"]);
  const schoolId = isSuper ? undefined : me?.profile?.school_id ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ["schools-list"],
    enabled: isSuper,
    queryFn: async () =>
      (await supabase.from("schools").select("id, name").order("name")).data ?? [],
  });

  const { data: people, isLoading: peopleLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, initials, is_active, must_change_password, school_id, department_id",
          ),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((profile: any) => ({
        ...profile,
        roles: (roles ?? [])
          .filter((r: any) => r.user_id === profile.id)
          .map((r: any) => r.role as AppRole),
      }));
    },
  });

  const schoolNameFor = (id: string | null) =>
    (schools ?? []).find((school: any) => school.id === id)?.name ?? null;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["staff"] });
    queryClient.invalidateQueries({ queryKey: ["departments"] });
  }

  return { me, queryClient, isSuper, people, peopleLoading, schools, refresh, schoolNameFor };
}

/**
 * Departments are always read for exactly one school. Super administrators pick
 * the school in the form, so the list stays empty until a school is chosen —
 * this mirrors the original single-screen behaviour without loading every
 * tenant's departments at once.
 */
export function useSchoolDepartments(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["departments", schoolId ?? null],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, hod_user_id")
        .eq("school_id", schoolId as string)
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useStaffUserMutations() {
  const { data: me } = useCurrentUser();
  const isSuper = hasAny(me?.roles, ["super_admin"]);
  const queryClient = useQueryClient();
  const createUser = useServerFn(createStaffUser);
  const updateUser = useServerFn(updateStaffUser);
  const resetPassword = useServerFn(resetUserPassword);
  const deleteUserFn = useServerFn(deleteStaffUser);

  const createMutation = useMutation({
    mutationFn: (form: StaffUserFormValues) => {
      const fullName = form.fullName.trim();
      const email = form.email.trim();
      if (!fullName) throw new Error("Enter the user's full name first");
      if (!email) throw new Error("Enter the user's email first");
      if (isSuper && !form.schoolId) throw new Error("Select a school before creating the account");
      return createUser({
        data: {
          fullName,
          email,
          role: form.role,
          initials: form.initials || undefined,
          schoolId: form.schoolId || undefined,
          departmentId: form.departmentId || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Account created");
    },
    onError: (error: Error) =>
      toast.error(
        error.message === ADMIN_UNAVAILABLE_MSG
          ? adminUnavailable("Account creation")
          : error.message,
      ),
  });

  const editMutation = useMutation({
    mutationFn: (vars: { userId: string } & StaffUserFormValues) => {
      if (!vars.fullName.trim()) throw new Error("Enter the user's full name first");
      if (!vars.email.trim()) throw new Error("Enter the user's email first");
      if (isSuper && !vars.schoolId) throw new Error("Select a school before saving the account");
      return updateUser({
        data: {
          userId: vars.userId,
          fullName: vars.fullName.trim(),
          email: vars.email.trim(),
          role: vars.role,
          initials: vars.initials?.trim() || undefined,
          schoolId: vars.schoolId,
          departmentId: vars.departmentId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("User updated");
    },
    onError: (error: Error) =>
      toast.error(
        error.message === ADMIN_UNAVAILABLE_MSG
          ? adminUnavailable("User editing")
          : error.message,
      ),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) => resetPassword({ data: { userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("New one-time password issued");
    },
    onError: (error: Error) =>
      toast.error(
        error.message === ADMIN_UNAVAILABLE_MSG
          ? adminUnavailable("Password reset")
          : error.message,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUserFn({ data: { userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("User deleted");
    },
    onError: (error: Error) =>
      toast.error(
        error.message === ADMIN_UNAVAILABLE_MSG
          ? adminUnavailable("User deletion")
          : error.message,
      ),
  });

  return { createMutation, editMutation, resetMutation, deleteMutation, isSuper };
}

