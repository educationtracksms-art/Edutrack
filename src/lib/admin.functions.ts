import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function otp() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function rolesOf(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role);
}

async function logAudit(
  supabase: any,
  userId: string,
  schoolId: string | null,
  action: string,
  entity: string,
  details?: Record<string, unknown>,
) {
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  await supabase.from("audit_logs").insert({
    school_id: schoolId,
    user_id: userId,
    user_name: profile?.full_name ?? null,
    action,
    entity,
    details: details ?? {},
  });
}

export const createSchoolWithAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      name: string;
      code: string;
      address?: string;
      email?: string;
      phone?: string;
      adminName: string;
      adminEmail: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) throw new Error("Only the Super Admin can create schools");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
      })
      .select("id")
      .single();
    if (schoolError) throw new Error(schoolError.message);

    const password = otp();
    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.adminName },
    });
    if (userError) throw new Error(userError.message);

    const uid = created.user!.id;
    await supabaseAdmin
      .from("profiles")
      .update({
        school_id: school.id,
        full_name: data.adminName,
        email: data.adminEmail,
        must_change_password: true,
      })
      .eq("id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "school_admin", school_id: school.id });

    const modules = [
      "fees",
      "attendance",
      "library",
      "transport",
      "hostel",
      "inventory",
      "sms",
      "parent_portal",
      "discipline",
      "report_cards",
      "co_curricular",
    ];
    await supabaseAdmin.from("feature_toggles").insert(
      modules.map((module) => ({
        school_id: school.id,
        module,
        enabled: ["attendance", "report_cards", "fees", "co_curricular"].includes(module),
      })),
    );
    await supabaseAdmin.from("notifications").insert({
      school_id: school.id,
      user_id: uid,
      title: "One-time password generated",
      body: "Sign in with your one-time password and set a new password.",
    });

    await logAudit(context.supabase, context.userId, school.id, "SCHOOL_CREATED", "schools", {
      name: data.name,
    });

    return { schoolId: school.id, oneTimePassword: password };
  });

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { fullName: string; email: string; role: string; initials?: string; schoolId?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const isSuper = roles.includes("super_admin");
    if (!isSuper && !roles.includes("school_admin")) throw new Error("Not allowed to create users");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("school_id")
      .eq("id", context.userId)
      .maybeSingle();
    const schoolId = isSuper ? (data.schoolId ?? profile?.school_id) : profile?.school_id;
    if (!schoolId) throw new Error("A school must be selected");
    if (data.role === "super_admin") throw new Error("Super Admin accounts cannot be created here");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = otp();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    await supabaseAdmin
      .from("profiles")
      .update({
        school_id: schoolId,
        full_name: data.fullName,
        email: data.email,
        initials: data.initials ?? null,
        must_change_password: true,
      })
      .eq("id", uid);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role as never, school_id: schoolId });

    await logAudit(context.supabase, context.userId, schoolId, "USER_CREATED", "profiles", {
      email: data.email,
      role: data.role,
    });

    return { oneTimePassword: password };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin"].includes(r)))
      throw new Error("Not allowed to reset passwords");

    const { data: target } = await context.supabase
      .from("profiles")
      .select("id, school_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("User not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = otp();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.userId);

    await logAudit(context.supabase, context.userId, target.school_id, "PASSWORD_RESET", "profiles", {
      user_id: data.userId,
    });
    return { oneTimePassword: password };
  });

export const setSchoolStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { schoolId: string; status: "active" | "suspended" }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin")) throw new Error("Only the Super Admin can change school status");
    const { error } = await context.supabase
      .from("schools")
      .update({ status: data.status })
      .eq("id", data.schoolId);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, data.schoolId, "SCHOOL_STATUS_CHANGED", "schools", {
      status: data.status,
    });
    return { ok: true };
  });

export const reviewAssessments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ids: string[]; action: "approve" | "reject"; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r)))
      throw new Error("Only the Director of Studies can review assessments");

    const patch =
      data.action === "approve"
        ? { status: "approved", locked: true, approved_by: context.userId, approved_at: new Date().toISOString() }
        : { status: "rejected", locked: false, rejection_reason: data.reason ?? "Returned for correction" };

    const { error } = await context.supabase.from("assessments").update(patch as never).in("id", data.ids);
    if (error) throw new Error(error.message);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("school_id")
      .eq("id", context.userId)
      .maybeSingle();
    await logAudit(
      context.supabase,
      context.userId,
      profile?.school_id ?? null,
      data.action === "approve" ? "ASSESSMENTS_APPROVED" : "ASSESSMENTS_REJECTED",
      "assessments",
      { count: data.ids.length },
    );
    return { ok: true };
  });

export const verifyStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r)))
      throw new Error("Not allowed to verify students");
    const { error } = await context.supabase
      .from("students")
      .update({ status: "active", verified_by: context.userId, verified_at: new Date().toISOString() })
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("school_id")
      .eq("id", context.userId)
      .maybeSingle();
    await logAudit(context.supabase, context.userId, profile?.school_id ?? null, "STUDENT_VERIFIED", "students", {
      student_id: data.studentId,
    });
    return { ok: true };
  });

export const logReportPrint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { count: number; scope: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("school_id")
      .eq("id", context.userId)
      .maybeSingle();
    await logAudit(context.supabase, context.userId, profile?.school_id ?? null, "REPORTS_PRINTED", "reports", data);
    return { ok: true };
  });