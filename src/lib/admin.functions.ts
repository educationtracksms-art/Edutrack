import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isModuleEnabled } from "./modules";

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
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

    const { data: school, error: schoolError } = await context.supabase
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
      user_metadata: {
        full_name: data.adminName,
        school_id: school.id,
        initials: null,
      },
    });
    if (userError) throw new Error(userError.message);
    const uid = created.user!.id;

    const adminProfilePayload = {
      id: uid,
      school_id: school.id,
      full_name: data.adminName,
      email: data.adminEmail,
      must_change_password: true,
    };

    await context.supabase.from("profiles").upsert(adminProfilePayload, { onConflict: "id" });
    await context.supabase
      .from("user_roles")
      .insert({ user_id: uid, role: "school_admin", school_id: school.id });

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
    await context.supabase.from("feature_toggles").insert(
      modules.map((module) => ({
        school_id: school.id,
        module,
        enabled: ["attendance", "report_cards", "fees", "co_curricular"].includes(module),
      })),
    );
    await context.supabase.from("notifications").insert({
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
    (data: {
      fullName: string;
      email: string;
      role: string;
      initials?: string;
      schoolId?: string;
    }) => data,
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
      user_metadata: {
        full_name: data.fullName,
        school_id: schoolId,
        initials: data.initials ?? null,
      },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    const staffProfilePayload = {
      id: uid,
      school_id: schoolId,
      full_name: data.fullName,
      email: data.email,
      initials: data.initials ?? null,
      must_change_password: true,
    };

    await context.supabase.from("profiles").upsert(staffProfilePayload, { onConflict: "id" });
    await context.supabase
      .from("user_roles")
      .insert({ user_id: uid, role: data.role as never, school_id: schoolId });

    await logAudit(context.supabase, context.userId, schoolId, "USER_CREATED", "profiles", {
      email: data.email,
      role: data.role,
    });

    return { oneTimePassword: password };
  });

export const updateStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      userId: string;
      fullName: string;
      email: string;
      role: string;
      initials?: string;
      schoolId?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const isSuper = roles.includes("super_admin");
    if (!isSuper && !roles.includes("school_admin")) throw new Error("Not allowed to edit users");

    const { data: target } = await context.supabase
      .from("profiles")
      .select("id, school_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("User not found");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("school_id")
      .eq("id", context.userId)
      .maybeSingle();

    const schoolId = isSuper
      ? (data.schoolId ?? target.school_id ?? profile?.school_id)
      : profile?.school_id;
    if (!schoolId) throw new Error("A school must be selected");
    if (data.role === "super_admin")
      throw new Error("Super Admin accounts cannot be assigned here");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: profileError } = await context.supabase
      .from("profiles")
      .update({
        school_id: schoolId,
        full_name: data.fullName,
        email: data.email,
        initials: data.initials ?? null,
      })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    const { error: roleDeleteError } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (roleDeleteError) throw new Error(roleDeleteError.message);

    const { error: roleInsertError } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role as never, school_id: schoolId });
    if (roleInsertError) throw new Error(roleInsertError.message);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      user_metadata: {
        full_name: data.fullName,
        school_id: schoolId,
        initials: data.initials ?? null,
      },
    });
    if (authError) throw new Error(authError.message);

    await logAudit(context.supabase, context.userId, schoolId, "USER_UPDATED", "profiles", {
      user_id: data.userId,
      email: data.email,
      role: data.role,
    });

    return { ok: true };
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
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId);

    await logAudit(
      context.supabase,
      context.userId,
      target.school_id,
      "PASSWORD_RESET",
      "profiles",
      {
        user_id: data.userId,
      },
    );
    return { oneTimePassword: password };
  });

export const setSchoolStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { schoolId: string; status: "active" | "suspended" }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.includes("super_admin"))
      throw new Error("Only the Super Admin can change school status");
    const { error } = await context.supabase
      .from("schools")
      .update({ status: data.status })
      .eq("id", data.schoolId);
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      data.schoolId,
      "SCHOOL_STATUS_CHANGED",
      "schools",
      {
        status: data.status,
      },
    );
    return { ok: true };
  });

export const reviewAssessments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      ids: string[];
      action: "approve" | "reject";
      reason?: string;
      classId?: string | null;
      streamId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const canReviewAny = roles.some((r) =>
      ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
    );
    const isClassTeacher = roles.includes("class_teacher");
    if (!canReviewAny && !isClassTeacher) throw new Error("Not allowed to review assessments");

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    if (isClassTeacher && !canReviewAny) {
      const { data: assessments } = await context.supabase
        .from("assessments")
        .select("id, student_id")
        .in("id", data.ids)
        .eq("school_id", schoolId);
      if (!assessments || assessments.length !== data.ids.length) {
        throw new Error("One or more assessments were not found in your school");
      }

      const { data: students } = await context.supabase
        .from("students")
        .select("id, class_id")
        .in(
          "id",
          assessments.map((assessment: any) => assessment.student_id),
        );

      const { data: classes } = await context.supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", context.userId);
      const assignedClassIds = new Set((classes ?? []).map((cls: any) => cls.id));
      const studentClassById = new Map(
        (students ?? []).map((student: any) => [student.id, student.class_id]),
      );

      const unauthorized = assessments.some(
        (assessment: any) => !assignedClassIds.has(studentClassById.get(assessment.student_id)),
      );
      if (unauthorized) {
        throw new Error("Class teachers can only review assessments for their assigned class");
      }
    }

    if (data.classId || data.streamId) {
      if (!canReviewAny && !isClassTeacher) throw new Error("Not allowed to review assessments");
      if (data.classId) {
        const { data: classRow } = await context.supabase
          .from("classes")
          .select("id, school_id")
          .eq("id", data.classId)
          .maybeSingle();
        if (!classRow || classRow.school_id !== schoolId) {
          throw new Error("Class not found in your school");
        }
      }
      if (data.streamId) {
        const { data: streamRow } = await context.supabase
          .from("streams")
          .select("id, school_id, class_id")
          .eq("id", data.streamId)
          .maybeSingle();
        if (!streamRow || streamRow.school_id !== schoolId) {
          throw new Error("Stream not found in your school");
        }
        if (data.classId && streamRow.class_id !== data.classId) {
          throw new Error("Selected stream does not belong to the selected class");
        }
      }

      const { data: scopedAssessments } = await context.supabase
        .from("assessments")
        .select("id, student_id")
        .eq("school_id", schoolId)
        .in("id", data.ids);
      const { data: scopedStudents } = await context.supabase
        .from("students")
        .select("id, class_id, stream_id")
        .in(
          "id",
          (scopedAssessments ?? []).map((assessment: any) => assessment.student_id),
        );
      const studentById = new Map(
        (scopedStudents ?? []).map((student: any) => [student.id, student]),
      );
      const scopedMismatch = (scopedAssessments ?? []).some((assessment: any) => {
        const student = studentById.get(assessment.student_id);
        if (!student) return true;
        if (data.classId && student.class_id !== data.classId) return true;
        if (data.streamId && student.stream_id !== data.streamId) return true;
        return false;
      });
      if (scopedMismatch) {
        throw new Error("One or more assessments are outside the selected class or stream");
      }
    }

    const patch =
      data.action === "approve"
        ? {
            status: "approved",
            locked: true,
            approved_by: context.userId,
            approved_at: new Date().toISOString(),
          }
        : {
            status: "rejected",
            locked: false,
            rejection_reason: data.reason ?? "Returned for correction",
          };

    const { error } = await context.supabase
      .from("assessments")
      .update(patch as never)
      .in("id", data.ids);
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

export const upsertReportComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      studentId: string;
      termId: string;
      classTeacherComment?: string | null;
      headTeacherComment?: string | null;
      games?: string | null;
      clubs?: string | null;
      projects?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        [
          "class_teacher",
          "head_teacher",
          "deputy_head_teacher",
          "dos",
          "school_admin",
          "super_admin",
        ].includes(r),
      )
    ) {
      throw new Error("Not allowed to edit report comments");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    if (!(await isModuleEnabled(context.supabase, schoolId, "report_cards"))) {
      throw new Error("Report comments module is disabled");
    }

    const [{ data: student }, { data: term }, { data: existing }] = await Promise.all([
      context.supabase
        .from("students")
        .select("id, school_id")
        .eq("id", data.studentId)
        .maybeSingle(),
      context.supabase.from("terms").select("id, school_id").eq("id", data.termId).maybeSingle(),
      context.supabase
        .from("report_comments")
        .select("class_teacher_comment, head_teacher_comment")
        .eq("student_id", data.studentId)
        .eq("term_id", data.termId)
        .maybeSingle(),
    ]);

    if (!student || student.school_id !== schoolId)
      throw new Error("Student not found in your school");
    if (!term || term.school_id !== schoolId) throw new Error("Term not found in your school");

    if (
      roles.includes("class_teacher") &&
      !roles.some((r) =>
        ["head_teacher", "deputy_head_teacher", "dos", "school_admin", "super_admin"].includes(r),
      )
    ) {
      const { data: assignedClasses } = await context.supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", context.userId);
      const assignedClassIds = new Set((assignedClasses ?? []).map((cls: any) => cls.id));
      const { data: studentClass } = await context.supabase
        .from("students")
        .select("class_id")
        .eq("id", data.studentId)
        .maybeSingle();
      if (!studentClass || !assignedClassIds.has(studentClass.class_id)) {
        throw new Error("Class teachers can only comment on learners in their assigned class");
      }
    }

    const canEditCoCurricular =
      !roles.includes("class_teacher") ||
      roles.some((r) =>
        ["head_teacher", "deputy_head_teacher", "dos", "school_admin", "super_admin"].includes(r),
      );
    if (!canEditCoCurricular) {
      const { data: assignedClasses } = await context.supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", context.userId);
      const assignedClassIds = new Set((assignedClasses ?? []).map((cls: any) => cls.id));
      const { data: studentClass } = await context.supabase
        .from("students")
        .select("class_id")
        .eq("id", data.studentId)
        .maybeSingle();
      if (!studentClass || !assignedClassIds.has(studentClass.class_id)) {
        throw new Error(
          "Class teachers can only update co-curricular entries for their assigned class",
        );
      }
    }

    const payload = {
      school_id: schoolId,
      student_id: data.studentId,
      term_id: data.termId,
      class_teacher_comment: data.classTeacherComment ?? existing?.class_teacher_comment ?? null,
      head_teacher_comment: data.headTeacherComment ?? existing?.head_teacher_comment ?? null,
    };

    const { error } = await context.supabase
      .from("report_comments")
      .upsert(payload, { onConflict: "student_id,term_id" });
    if (error) throw new Error(error.message);

    const coCurricularPayload = {
      school_id: schoolId,
      student_id: data.studentId,
      term_id: data.termId,
      games: data.games ?? null,
      clubs: data.clubs ?? null,
      projects: data.projects ?? null,
    };
    if (data.games != null || data.clubs != null || data.projects != null) {
      if (!(await isModuleEnabled(context.supabase, schoolId, "co_curricular"))) {
        throw new Error("Co-curricular module is disabled");
      }
      const { error: coCurricularError } = await context.supabase
        .from("co_curricular")
        .upsert(coCurricularPayload, { onConflict: "student_id,term_id" });
      if (coCurricularError) throw new Error(coCurricularError.message);
    }

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "REPORT_COMMENT_SAVED",
      "report_comments",
      {
        student_id: data.studentId,
        term_id: data.termId,
      },
    );

    return { ok: true };
  });

export const deleteReportComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      studentId: string;
      termId: string;
      commentType: "class_teacher" | "head_teacher";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        [
          "class_teacher",
          "head_teacher",
          "deputy_head_teacher",
          "dos",
          "school_admin",
          "super_admin",
        ].includes(r),
      )
    ) {
      throw new Error("Not allowed to edit report comments");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    if (!(await isModuleEnabled(context.supabase, schoolId, "report_cards"))) {
      throw new Error("Report comments module is disabled");
    }

    const [{ data: student }, { data: term }, { data: existing }] = await Promise.all([
      context.supabase
        .from("students")
        .select("id, school_id")
        .eq("id", data.studentId)
        .maybeSingle(),
      context.supabase.from("terms").select("id, school_id").eq("id", data.termId).maybeSingle(),
      context.supabase
        .from("report_comments")
        .select("id, class_teacher_comment, head_teacher_comment")
        .eq("student_id", data.studentId)
        .eq("term_id", data.termId)
        .maybeSingle(),
    ]);

    if (!student || student.school_id !== schoolId)
      throw new Error("Student not found in your school");
    if (!term || term.school_id !== schoolId) throw new Error("Term not found in your school");
    if (!existing) return { ok: true };

    const canManageComment =
      !roles.includes("class_teacher") ||
      roles.some((r) =>
        ["head_teacher", "deputy_head_teacher", "dos", "school_admin", "super_admin"].includes(r),
      );
    if (!canManageComment) {
      const { data: assignedClasses } = await context.supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", context.userId);
      const assignedClassIds = new Set((assignedClasses ?? []).map((cls: any) => cls.id));
      const { data: studentClass } = await context.supabase
        .from("students")
        .select("class_id")
        .eq("id", data.studentId)
        .maybeSingle();
      if (!studentClass || !assignedClassIds.has(studentClass.class_id)) {
        throw new Error("Class teachers can only edit learners in their assigned class");
      }
    }

    if (data.commentType === "class_teacher") {
      const nextClassComment = null;
      if ((existing.head_teacher_comment ?? "").trim()) {
        const { error } = await context.supabase
          .from("report_comments")
          .update({ class_teacher_comment: nextClassComment })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await context.supabase.from("report_comments").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
    } else {
      const nextHeadComment = null;
      if ((existing.class_teacher_comment ?? "").trim()) {
        const { error } = await context.supabase
          .from("report_comments")
          .update({ head_teacher_comment: nextHeadComment })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await context.supabase.from("report_comments").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
    }

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "REPORT_COMMENT_DELETED",
      "report_comments",
      {
        student_id: data.studentId,
        term_id: data.termId,
        comment_type: data.commentType,
      },
    );

    return { ok: true };
  });

export const upsertAssessmentEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      studentId: string;
      subjectId: string;
      termId: string;
      examType?: string;
      gradeDescriptor?: string | null;
      formative?: number | null;
      summative?: number | null;
      teacherInitials?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        [
          "subject_teacher",
          "class_teacher",
          "dos",
          "school_admin",
          "head_teacher",
          "deputy_head_teacher",
          "super_admin",
        ].includes(r),
      )
    ) {
      throw new Error("Not allowed to enter assessments");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const [studentResult, subjectResult, termResult, profileResult] = await Promise.all([
      context.supabase
        .from("students")
        .select("id, school_id, class_id, stream_id, status")
        .eq("id", data.studentId)
        .maybeSingle(),
      context.supabase
        .from("subjects")
        .select("id, school_id")
        .eq("id", data.subjectId)
        .maybeSingle(),
      context.supabase.from("terms").select("id, school_id").eq("id", data.termId).maybeSingle(),
      context.supabase.from("profiles").select("initials").eq("id", context.userId).maybeSingle(),
    ]);

    const student = studentResult.data;
    const subject = subjectResult.data;
    const term = termResult.data;
    if (!student || student.school_id !== schoolId)
      throw new Error("Student not found in your school");
    if (!subject || subject.school_id !== schoolId)
      throw new Error("Subject not found in your school");
    if (!term || term.school_id !== schoolId) throw new Error("Term not found in your school");

    if (student.status !== "active") {
      throw new Error("Only verified students can receive assessments");
    }

    const teacherRoles = new Set(["subject_teacher", "class_teacher", "dos"]);
    if (roles.some((role) => teacherRoles.has(role))) {
      const { data: allocations, error: allocationError } = await context.supabase
        .from("teacher_allocations")
        .select("subject_id, class_id, stream_id")
        .eq("school_id", schoolId)
        .eq("teacher_id", context.userId)
        .eq("subject_id", data.subjectId);
      if (allocationError) throw new Error(allocationError.message);
      const matchesAllocation = (allocations ?? []).some(
        (allocation) =>
          (!allocation.class_id || allocation.class_id === student.class_id) &&
          (!allocation.stream_id || allocation.stream_id === student.stream_id),
      );
      if (!matchesAllocation) {
        throw new Error("You are not allocated to this learner's subject or class");
      }
    }

    const teacherInitials =
      data.teacherInitials?.trim() || profileResult.data?.initials?.trim() || null;
    const { data: gradingScales } = await context.supabase
      .from("grading_scales")
      .select("grade, min_score, max_score, grade_descriptor")
      .eq("school_id", schoolId);
    const gradeFor = (total: number) => {
      const hit = (gradingScales ?? []).find(
        (scale: any) => total >= Number(scale.min_score) && total <= Number(scale.max_score),
      );
      return hit
        ? {
            grade: hit.grade as string,
            descriptor: hit.grade_descriptor as string,
          }
        : { grade: "", descriptor: "" };
    };
    const formativeScore = Number(data.formative ?? 0);
    const summativeScore = Number(data.summative ?? 0);
    const totalScore = formativeScore + summativeScore;
    const gradeMatch = gradeFor(totalScore);
    const { data: existingAssessment, error: existingError } = await context.supabase
      .from("assessments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_id", data.studentId)
      .eq("subject_id", data.subjectId)
      .eq("term_id", data.termId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existingAssessment) {
      throw new Error("An assessment already exists for this learner, subject and term. Existing marks were left unchanged.");
    }

    const { error } = await context.supabase.from("assessments").insert({
      school_id: schoolId,
      student_id: data.studentId,
      subject_id: data.subjectId,
      term_id: data.termId,
      exam_type: data.examType?.trim() || "end_of_term",
      grade_descriptor: gradeMatch.descriptor || null,
      formative: data.formative ?? null,
      summative: data.summative ?? null,
      teacher_initials: teacherInitials,
      status: "draft",
      locked: false,
      rejection_reason: null,
      submitted_by: null,
      submitted_at: null,
      approved_by: null,
      approved_at: null,
    });
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "ASSESSMENT_DRAFT_SAVED",
      "assessments",
      {
        student_id: data.studentId,
        subject_id: data.subjectId,
        term_id: data.termId,
      },
    );

    return { ok: true };
  });

export const updateAssessmentDraftEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      assessmentId: string;
      examType?: string;
      gradeDescriptor?: string | null;
      formative?: number | null;
      summative?: number | null;
      teacherInitials?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        [
          "subject_teacher",
          "class_teacher",
          "dos",
          "school_admin",
          "head_teacher",
          "deputy_head_teacher",
          "super_admin",
        ].includes(r),
      )
    ) {
      throw new Error("Not allowed to edit assessments");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: existingAssessment, error: existingError } = await context.supabase
      .from("assessments")
      .select("id, school_id, status, locked")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existingAssessment || existingAssessment.school_id !== schoolId) {
      throw new Error("Assessment not found in your school");
    }
    if (existingAssessment.status !== "draft" || existingAssessment.locked) {
      throw new Error("Only draft assessments can be edited");
    }

    const teacherInitials = data.teacherInitials?.trim() || null;
    const { data: gradingScales } = await context.supabase
      .from("grading_scales")
      .select("grade, min_score, max_score, grade_descriptor")
      .eq("school_id", schoolId);
    const totalScore = Number(data.formative ?? 0) + Number(data.summative ?? 0);
    const gradeMatch = (gradingScales ?? []).find(
      (scale: any) => totalScore >= Number(scale.min_score) && totalScore <= Number(scale.max_score),
    );

    const { error } = await context.supabase
      .from("assessments")
      .update({
        exam_type: data.examType?.trim() || "end_of_term",
        grade_descriptor: gradeMatch?.grade_descriptor ?? null,
        formative: data.formative ?? null,
        summative: data.summative ?? null,
        teacher_initials: teacherInitials,
      })
      .eq("id", data.assessmentId);
    if (error) throw new Error(error.message);

    await logAudit(context.supabase, context.userId, schoolId, "ASSESSMENT_DRAFT_UPDATED", "assessments", {
      assessment_id: data.assessmentId,
    });

    return { ok: true };
  });

export const submitAssessmentEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      assessmentId: string;
      formative?: number | null;
      summative?: number | null;
      teacherInitials?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        [
          "subject_teacher",
          "class_teacher",
          "dos",
          "school_admin",
          "head_teacher",
          "deputy_head_teacher",
          "super_admin",
        ].includes(r),
      )
    ) {
      throw new Error("Not allowed to submit assessments");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: existingAssessment, error: existingError } = await context.supabase
      .from("assessments")
      .select("id, school_id, status, locked")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existingAssessment || existingAssessment.school_id !== schoolId) {
      throw new Error("Assessment not found in your school");
    }
    if (existingAssessment.locked) {
      throw new Error("Locked assessments cannot be submitted");
    }

    const { data: gradingScales } = await context.supabase
      .from("grading_scales")
      .select("grade, min_score, max_score, grade_descriptor")
      .eq("school_id", schoolId);
    const totalScore = Number(data.formative ?? 0) + Number(data.summative ?? 0);
    const gradeMatch = (gradingScales ?? []).find(
      (scale: any) => totalScore >= Number(scale.min_score) && totalScore <= Number(scale.max_score),
    );

    const teacherInitials = data.teacherInitials?.trim() || null;
    const { error } = await context.supabase
      .from("assessments")
      .update({
        formative: data.formative ?? null,
        summative: data.summative ?? null,
        teacher_initials: teacherInitials,
        grade_descriptor: gradeMatch?.grade_descriptor ?? null,
        status: "submitted",
        submitted_by: context.userId,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", data.assessmentId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await logAudit(context.supabase, context.userId, schoolId, "ASSESSMENT_SUBMITTED", "assessments", {
      assessment_id: data.assessmentId,
    });

    return { ok: true };
  });

export const deleteAssessmentEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { assessmentId: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        [
          "subject_teacher",
          "class_teacher",
          "dos",
          "school_admin",
          "head_teacher",
          "deputy_head_teacher",
          "super_admin",
        ].includes(r),
      )
    ) {
      throw new Error("Not allowed to delete assessments");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: existing } = await context.supabase
      .from("assessments")
      .select("id, school_id, student_id, subject_id, term_id")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (!existing || existing.school_id !== schoolId)
      throw new Error("Assessment not found in your school");

    const { error } = await context.supabase
      .from("assessments")
      .delete()
      .eq("id", data.assessmentId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await logAudit(context.supabase, context.userId, schoolId, "ASSESSMENT_DELETED", "assessments", {
      assessment_id: data.assessmentId,
      student_id: existing.student_id,
      subject_id: existing.subject_id,
      term_id: existing.term_id,
    });

    return { ok: true };
  });

export const verifyStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const canVerifyAny = roles.some((r) =>
      ["school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
    );
    const isClassTeacher = roles.includes("class_teacher");
    if (!canVerifyAny && !isClassTeacher) {
      throw new Error("Not allowed to verify students");
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("school_id")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: student } = await context.supabase
      .from("students")
      .select("id, school_id, class_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student || student.school_id !== profile?.school_id)
      throw new Error("Student not found in your school");

    if (!canVerifyAny) {
      if (!student.class_id) {
        throw new Error("Student is not assigned to a class");
      }
      const { data: assignedClass } = await context.supabase
        .from("classes")
        .select("id")
        .eq("id", student.class_id)
        .eq("class_teacher_id", context.userId)
        .maybeSingle();
      if (!assignedClass)
        throw new Error("Class teachers can only approve learners in their assigned class");
    }

    const { error } = await context.supabase
      .from("students")
      .update({
        status: "active",
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      profile?.school_id ?? null,
      "STUDENT_VERIFIED",
      "students",
      {
        student_id: data.studentId,
      },
    );
    return { ok: true };
  });

export const updateStudentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string; status: "pending" | "active" | "inactive" }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
      )
    ) {
      throw new Error("Not allowed to change student status");
    }

    const patch: {
      status: "pending" | "active" | "inactive";
      verified_by?: string;
      verified_at?: string;
    } = {
      status: data.status,
    };
    if (data.status === "active") {
      patch.verified_by = context.userId;
      patch.verified_at = new Date().toISOString();
    }

    const { error } = await context.supabase
      .from("students")
      .update(patch)
      .eq("id", data.studentId);
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
      "STUDENT_STATUS_CHANGED",
      "students",
      {
        student_id: data.studentId,
        status: data.status,
      },
    );
    return { ok: true };
  });

export const updateStudentFeesBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string; feesBalance: number }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const canEditAny = roles.some((r) =>
      ["super_admin", "school_admin", "head_teacher", "deputy_head_teacher", "dos"].includes(r),
    );
    const isClassTeacher = roles.includes("class_teacher");
    if (!canEditAny && !isClassTeacher) throw new Error("Not allowed to update fees balance");

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    if (!(await isModuleEnabled(context.supabase, schoolId, "fees"))) {
      throw new Error("Fees module is disabled");
    }

    const { data: student } = await context.supabase
      .from("students")
      .select("id, school_id, class_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student || student.school_id !== schoolId)
      throw new Error("Student not found in your school");

    if (isClassTeacher && !canEditAny) {
      const { data: assignedClasses } = await context.supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", context.userId);
      const assignedClassIds = new Set((assignedClasses ?? []).map((cls: any) => cls.id));
      if (!student.class_id || !assignedClassIds.has(student.class_id)) {
        throw new Error("Class teachers can only update fees for their assigned class");
      }
    }

    const { error } = await context.supabase
      .from("students")
      .update({ fees_balance: data.feesBalance })
      .eq("id", data.studentId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await logAudit(context.supabase, context.userId, schoolId, "STUDENT_FEES_UPDATED", "students", {
      student_id: data.studentId,
      fees_balance: data.feesBalance,
    });
    return { ok: true };
  });

export const deleteAttendanceSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string; termId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["class_teacher", "dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
      )
    ) {
      throw new Error("Not allowed to delete attendance summaries");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: existing } = await context.supabase
      .from("attendance_summaries")
      .select("id, school_id, student_id, term_id")
      .eq("student_id", data.studentId)
      .eq("term_id", data.termId)
      .maybeSingle();
    if (!existing || existing.school_id !== schoolId)
      throw new Error("Attendance summary not found in your school");

    const { error } = await context.supabase
      .from("attendance_summaries")
      .delete()
      .eq("student_id", data.studentId)
      .eq("term_id", data.termId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await logAudit(context.supabase, context.userId, schoolId, "ATTENDANCE_SUMMARY_DELETED", "attendance_summaries", {
      student_id: data.studentId,
      term_id: data.termId,
    });
    return { ok: true };
  });

async function schoolOf(supabase: any, id: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("school_id").eq("id", id).maybeSingle();
  return data?.school_id ?? null;
}

async function ensureCanManageSchool(context: any): Promise<string | null> {
  const roles = await rolesOf(context.supabase, context.userId);
  if (!roles.some((r) => ["super_admin", "school_admin"].includes(r))) {
    throw new Error("Not allowed to manage this record");
  }
  return schoolOf(context.supabase, context.userId);
}

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { classId: string }) => data)
  .handler(async ({ data, context }) => {
    const schoolId = await ensureCanManageSchool(context);
    const { data: cls } = await context.supabase
      .from("classes")
      .select("id, school_id, name")
      .eq("id", data.classId)
      .maybeSingle();
    if (!cls) throw new Error("Class not found");
    if (schoolId && cls.school_id !== schoolId) throw new Error("Not allowed to delete this class");

    const { error } = await context.supabase.from("classes").delete().eq("id", data.classId);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, cls.school_id, "CLASS_DELETED", "classes", {
      class_id: data.classId,
      name: cls.name,
    });
    return { ok: true };
  });

export const deleteStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { streamId: string }) => data)
  .handler(async ({ data, context }) => {
    const schoolId = await ensureCanManageSchool(context);
    const { data: stream } = await context.supabase
      .from("streams")
      .select("id, school_id, name")
      .eq("id", data.streamId)
      .maybeSingle();
    if (!stream) throw new Error("Stream not found");
    if (schoolId && stream.school_id !== schoolId)
      throw new Error("Not allowed to delete this stream");

    const { error } = await context.supabase.from("streams").delete().eq("id", data.streamId);
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      stream.school_id,
      "STREAM_DELETED",
      "streams",
      { stream_id: data.streamId, name: stream.name },
    );
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string }) => data)
  .handler(async ({ data, context }) => {
    const schoolId = await ensureCanManageSchool(context);
    const { data: student } = await context.supabase
      .from("students")
      .select("id, school_id, full_name")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");
    if (schoolId && student.school_id !== schoolId)
      throw new Error("Not allowed to delete this student");

    const { error } = await context.supabase.from("students").delete().eq("id", data.studentId);
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      student.school_id,
      "STUDENT_DELETED",
      "students",
      {
        student_id: data.studentId,
        name: student.full_name,
      },
    );
    return { ok: true };
  });

export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin"].includes(r)))
      throw new Error("Not allowed to delete users");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");

    const { data: target } = await context.supabase
      .from("profiles")
      .select("id, school_id, full_name, email")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("User not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    const { error: profileError } = await context.supabase
      .from("profiles")
      .delete()
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (authError) throw new Error(authError.message);

    await logAudit(context.supabase, context.userId, target.school_id, "USER_DELETED", "profiles", {
      user_id: data.userId,
      email: target.email,
      name: target.full_name,
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
    await logAudit(
      context.supabase,
      context.userId,
      profile?.school_id ?? null,
      "REPORTS_PRINTED",
      "reports",
      data,
    );
    return { ok: true };
  });

export const upsertGradingScale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string | null;
      schoolId?: string;
      grade: string;
      minScore: number;
      maxScore: number;
      gradeDescriptor: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
      )
    ) {
      throw new Error("Not allowed to manage grading scales");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const payload = {
      school_id: schoolId,
      grade: data.grade.trim().toUpperCase(),
      min_score: data.minScore,
      max_score: data.maxScore,
      grade_descriptor: data.gradeDescriptor.trim(),
    };

    const query = data.id
      ? context.supabase
          .from("grading_scales")
          .update(payload)
          .eq("id", data.id)
          .eq("school_id", schoolId)
      : context.supabase.from("grading_scales").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "GRADING_SCALE_SAVED",
      "grading_scales",
      {
        grade: payload.grade,
        min_score: payload.min_score,
        max_score: payload.max_score,
      },
    );
    return { ok: true };
  });

export const deleteGradingScale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
      )
    ) {
      throw new Error("Not allowed to manage grading scales");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { error } = await context.supabase
      .from("grading_scales")
      .delete()
      .eq("id", data.id)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "GRADING_SCALE_DELETED",
      "grading_scales",
      {
        grading_scale_id: data.id,
      },
    );
    return { ok: true };
  });

export const upsertIdentifierScale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string | null;
      schoolId?: string;
      identifier: number;
      minScore: number;
      maxScore: number;
      descriptor: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
      )
    ) {
      throw new Error("Not allowed to manage identifier scales");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const payload = {
      school_id: schoolId,
      identifier: data.identifier,
      min_score: data.minScore,
      max_score: data.maxScore,
      descriptor: data.descriptor.trim(),
    };

    const query = data.id
      ? context.supabase
          .from("grading_identifier_scales")
          .update(payload)
          .eq("id", data.id)
          .eq("school_id", schoolId)
      : context.supabase.from("grading_identifier_scales").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIdentifierScale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(r),
      )
    ) {
      throw new Error("Not allowed to manage identifier scales");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { error } = await context.supabase
      .from("grading_identifier_scales")
      .delete()
      .eq("id", data.id)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
