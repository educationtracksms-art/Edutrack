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

async function ensureFinanceAccounts(supabase: any, schoolId: string) {
  const defaults = [
    { code: "1000", name: "Cash", category: "Assets", account_type: "asset" },
    { code: "1010", name: "Bank", category: "Assets", account_type: "asset" },
    { code: "1100", name: "Accounts Receivable", category: "Assets", account_type: "asset" },
    { code: "4000", name: "Tuition Fees", category: "Income", account_type: "income" },
    { code: "4001", name: "Other Income", category: "Income", account_type: "income" },
    { code: "5000", name: "School Expenses", category: "Expenses", account_type: "expense" },
  ];
  const { data: existing } = await supabase
    .from("chart_of_accounts")
    .select("id, code")
    .eq("school_id", schoolId);
  const existingCodes = new Set((existing ?? []).map((row: any) => row.code));
  const missing = defaults
    .filter((account) => !existingCodes.has(account.code))
    .map((account) => ({
      school_id: schoolId,
      code: account.code,
      name: account.name,
      category: account.category,
      account_type: account.account_type,
      is_system_account: true,
    }));
  if (missing.length) {
    const { error } = await supabase.from("chart_of_accounts").insert(missing);
    if (error) throw new Error(error.message);
  }
  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("id, code")
    .eq("school_id", schoolId);
  const byCode = new Map(
    (accounts ?? []).map((row: any) => [row.code as string, row.id as string]),
  );
  return byCode;
}

async function postBalancedJournal(
  supabase: any,
  payload: {
    schoolId: string;
    transactionId: string;
    entryNumber: string;
    description: string;
    lines: Array<{ accountId: string; debit?: number; credit?: number; narration?: string }>;
    userId: string;
  },
) {
  const debitTotal = payload.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
  const creditTotal = payload.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);
  if (Math.abs(debitTotal - creditTotal) > 0.01) {
    throw new Error("Journal entry must balance");
  }

  const { data: journal, error: journalError } = await supabase
    .from("journal_entries")
    .insert({
      school_id: payload.schoolId,
      transaction_id: payload.transactionId,
      entry_number: payload.entryNumber,
      description: payload.description,
      status: "posted",
      created_by: payload.userId,
    })
    .select("id")
    .single();
  if (journalError) throw new Error(journalError.message);

  const { error: lineError } = await supabase.from("journal_entry_lines").insert(
    payload.lines.map((line) => ({
      school_id: payload.schoolId,
      journal_entry_id: journal.id,
      account_id: line.accountId,
      debit: Number(line.debit ?? 0),
      credit: Number(line.credit ?? 0),
      narration: line.narration ?? null,
    })),
  );
  if (lineError) throw new Error(lineError.message);
  return journal.id;
}

export const createSchoolWithAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
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
  .validator(
    (data: {
      fullName: string;
      email: string;
      role: string;
      initials?: string;
      schoolId?: string;
      departmentId?: string;
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
  .validator(
    (data: {
      userId: string;
      fullName: string;
      email: string;
      role: string;
      initials?: string;
      schoolId?: string;
      departmentId?: string | null;
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
        department_id: data.departmentId ?? null,
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
  .validator((data: { userId: string }) => data)
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
  .validator((data: { schoolId: string; status: "active" | "suspended" }) => data)
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
  .validator(
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
    const canReviewAny = roles.some((r) => ["dos", "super_admin"].includes(r));
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

    if (data.action === "approve" && !roles.includes("dos") && !roles.includes("super_admin")) {
      throw new Error("Only the Director of Studies can approve submitted marks");
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

export const updateAssessmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      assessmentId: string;
      status: "draft" | "submitted" | "approved" | "rejected";
      reason?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["dos", "super_admin"].includes(r))) {
      throw new Error("Only the Director of Studies can change assessment status");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: existingAssessment, error: existingError } = await context.supabase
      .from("assessments")
      .select("id, school_id")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existingAssessment || existingAssessment.school_id !== schoolId) {
      throw new Error("Assessment not found in your school");
    }

    const patch: Record<string, unknown> = {
      status: data.status,
      locked: data.status === "approved",
      rejection_reason:
        data.status === "rejected" ? (data.reason ?? "Returned for correction") : null,
      submitted_by: data.status === "submitted" ? context.userId : null,
      submitted_at: data.status === "submitted" ? new Date().toISOString() : null,
      approved_by: data.status === "approved" ? context.userId : null,
      approved_at: data.status === "approved" ? new Date().toISOString() : null,
    };

    const { error } = await context.supabase
      .from("assessments")
      .update(patch as never)
      .eq("id", data.assessmentId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "ASSESSMENT_STATUS_CHANGED",
      "assessments",
      {
        assessment_id: data.assessmentId,
        status: data.status,
      },
    );

    return { ok: true };
  });

export const upsertReportComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
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

export const upsertReportCommentRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      id?: string | null;
      commentRole: "class_teacher" | "head_teacher";
      descriptor: string;
      comment: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const allowedRoles =
      data.commentRole === "class_teacher"
        ? [
            "class_teacher",
            "dos",
            "school_admin",
            "head_teacher",
            "deputy_head_teacher",
            "super_admin",
          ]
        : ["head_teacher", "deputy_head_teacher", "dos", "school_admin", "super_admin"];
    if (!roles.some((role) => allowedRoles.includes(role))) {
      throw new Error("Not allowed to manage report comment rules");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const payload = {
      school_id: schoolId,
      comment_role: data.commentRole,
      descriptor: data.descriptor.trim(),
      comment: data.comment.trim(),
    };

    const query = data.id
      ? context.supabase
          .from("report_comment_rules")
          .update(payload)
          .eq("id", data.id)
          .eq("school_id", schoolId)
      : context.supabase.from("report_comment_rules").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReportCommentRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; commentRole: "class_teacher" | "head_teacher" }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    const allowedRoles =
      data.commentRole === "class_teacher"
        ? [
            "class_teacher",
            "dos",
            "school_admin",
            "head_teacher",
            "deputy_head_teacher",
            "super_admin",
          ]
        : ["head_teacher", "deputy_head_teacher", "dos", "school_admin", "super_admin"];
    if (!roles.some((role) => allowedRoles.includes(role))) {
      throw new Error("Not allowed to manage report comment rules");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { error } = await context.supabase
      .from("report_comment_rules")
      .delete()
      .eq("id", data.id)
      .eq("school_id", schoolId)
      .eq("comment_role", data.commentRole);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReportComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { studentId: string; termId: string; commentType: "class_teacher" | "head_teacher" }) =>
      data,
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
        const { error } = await context.supabase
          .from("report_comments")
          .delete()
          .eq("id", existing.id);
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
        const { error } = await context.supabase
          .from("report_comments")
          .delete()
          .eq("id", existing.id);
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
  .validator(
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
      throw new Error(
        "An assessment already exists for this learner, subject and term. Existing marks were left unchanged.",
      );
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
      submitted_by: context.userId,
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
  .validator(
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
    if (!["draft", "rejected"].includes(existingAssessment.status) || existingAssessment.locked) {
      throw new Error("Only draft or rejected assessments can be edited");
    }

    const teacherInitials = data.teacherInitials?.trim() || null;
    const { data: gradingScales } = await context.supabase
      .from("grading_scales")
      .select("grade, min_score, max_score, grade_descriptor")
      .eq("school_id", schoolId);
    const totalScore = Number(data.formative ?? 0) + Number(data.summative ?? 0);
    const gradeMatch = (gradingScales ?? []).find(
      (scale: any) =>
        totalScore >= Number(scale.min_score) && totalScore <= Number(scale.max_score),
    );

    const { error } = await context.supabase
      .from("assessments")
      .update({
        exam_type: data.examType?.trim() || "end_of_term",
        grade_descriptor: gradeMatch?.grade_descriptor ?? null,
        formative: data.formative ?? null,
        summative: data.summative ?? null,
        teacher_initials: teacherInitials,
        rejection_reason: null,
        submitted_by: context.userId,
      })
      .eq("id", data.assessmentId);
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "ASSESSMENT_DRAFT_UPDATED",
      "assessments",
      {
        assessment_id: data.assessmentId,
      },
    );

    return { ok: true };
  });

export const submitAssessmentEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
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
      (scale: any) =>
        totalScore >= Number(scale.min_score) && totalScore <= Number(scale.max_score),
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
        locked: false,
        rejection_reason: null,
        submitted_by: context.userId,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", data.assessmentId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "ASSESSMENT_SUBMITTED",
      "assessments",
      {
        assessment_id: data.assessmentId,
      },
    );

    return { ok: true };
  });

export const submitAssessmentEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { assessmentIds: string[]; teacherInitials?: string | null }) => data)
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

    if (!data.assessmentIds.length) {
      throw new Error("No assessments were selected");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: assessments, error: fetchError } = await context.supabase
      .from("assessments")
      .select("id, school_id, status, locked, formative, summative")
      .in("id", data.assessmentIds);
    if (fetchError) throw new Error(fetchError.message);
    if (!assessments || assessments.length !== data.assessmentIds.length) {
      throw new Error("One or more assessments were not found in your school");
    }
    if (assessments.some((item) => item.school_id !== schoolId)) {
      throw new Error("One or more assessments were not found in your school");
    }
    if (assessments.some((item) => item.locked)) {
      throw new Error("Locked assessments cannot be submitted");
    }

    const teacherInitials = data.teacherInitials?.trim() || null;
    const { data: gradingScales } = await context.supabase
      .from("grading_scales")
      .select("grade, min_score, max_score, grade_descriptor")
      .eq("school_id", schoolId);

    const updates = assessments.map((assessment) => {
      const totalScore = Number(assessment.formative ?? 0) + Number(assessment.summative ?? 0);
      const gradeMatch = (gradingScales ?? []).find(
        (scale: any) =>
          totalScore >= Number(scale.min_score) && totalScore <= Number(scale.max_score),
      );
      return context.supabase
        .from("assessments")
        .update({
          status: "submitted",
          locked: false,
          rejection_reason: null,
          submitted_by: context.userId,
          submitted_at: new Date().toISOString(),
          teacher_initials: teacherInitials,
          grade_descriptor: gradeMatch?.grade_descriptor ?? null,
        })
        .eq("id", assessment.id)
        .eq("school_id", schoolId);
    });
    const results = await Promise.all(updates);
    const firstError = results.find((result) => result.error);
    if (firstError?.error) throw new Error(firstError.error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "ASSESSMENTS_SUBMITTED",
      "assessments",
      {
        assessment_ids: data.assessmentIds,
      },
    );

    return { ok: true };
  });

export const deleteAssessmentEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { assessmentId: string }) => data)
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

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "ASSESSMENT_DELETED",
      "assessments",
      {
        assessment_id: data.assessmentId,
        student_id: existing.student_id,
        subject_id: existing.subject_id,
        term_id: existing.term_id,
      },
    );

    return { ok: true };
  });

export const verifyStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { studentId: string }) => data)
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
  .validator((data: { studentId: string; status: "pending" | "active" | "inactive" }) => data)
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
  .validator((data: { studentId: string; feesBalance: number }) => data)
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
  .validator((data: { studentId: string; termId: string }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        [
          "class_teacher",
          "dos",
          "school_admin",
          "head_teacher",
          "deputy_head_teacher",
          "super_admin",
        ].includes(r),
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

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "ATTENDANCE_SUMMARY_DELETED",
      "attendance_summaries",
      {
        student_id: data.studentId,
        term_id: data.termId,
      },
    );
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
  .validator((data: { classId: string }) => data)
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
  .validator((data: { streamId: string }) => data)
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
  .validator((data: { studentId: string }) => data)
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
  .validator((data: { userId: string }) => data)
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

export const createStudentInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      studentId: string;
      invoiceNumber: string;
      amount: number;
      termId?: string | null;
      financialYearId?: string | null;
      dueDate?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to create invoices");
    }

    const { data: student } = await context.supabase
      .from("students")
      .select("id, school_id, fees_balance")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invoice amount must be positive");
    const accounts = await ensureFinanceAccounts(context.supabase, student.school_id);
    const receivableAccountId = accounts.get("1100");
    const tuitionAccountId = accounts.get("4000");
    if (!receivableAccountId || !tuitionAccountId)
      throw new Error("Default finance accounts are missing");

    const { data: invoice, error: invoiceError } = await context.supabase
      .from("student_invoices")
      .insert({
        school_id: student.school_id,
        student_id: data.studentId,
        financial_year_id: data.financialYearId ?? null,
        term_id: data.termId ?? null,
        invoice_number: data.invoiceNumber,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: data.dueDate ?? null,
        status: "issued",
        total_amount: amount,
        amount_paid: 0,
        balance_due: amount,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (invoiceError) throw new Error(invoiceError.message);

    const { error: itemError } = await context.supabase.from("student_invoice_items").insert({
      school_id: student.school_id,
      invoice_id: invoice.id,
      fee_type: "Tuition",
      description: "Student fee invoice",
      quantity: 1,
      unit_amount: amount,
      line_total: amount,
    });
    if (itemError) throw new Error(itemError.message);

    const { error: studentUpdateError } = await context.supabase
      .from("students")
      .update({ fees_balance: Number(student.fees_balance ?? 0) + amount })
      .eq("id", data.studentId);
    if (studentUpdateError) throw new Error(studentUpdateError.message);

    const { data: transaction, error: transactionError } = await context.supabase
      .from("transactions")
      .insert({
        school_id: student.school_id,
        transaction_number: `TXN-${data.invoiceNumber}`,
        transaction_date: new Date().toISOString().slice(0, 10),
        source_module: "fees",
        source_record_id: invoice.id,
        transaction_type: "income",
        narration: `Student invoice ${data.invoiceNumber}`,
        total_amount: amount,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (transactionError) throw new Error(transactionError.message);

    await postBalancedJournal(context.supabase, {
      schoolId: student.school_id,
      transactionId: transaction.id,
      entryNumber: `JE-${data.invoiceNumber}`,
      description: `Invoice ${data.invoiceNumber}`,
      userId: context.userId,
      lines: [
        {
          accountId: receivableAccountId,
          debit: amount,
          credit: 0,
          narration: "Student receivable",
        },
        { accountId: tuitionAccountId, debit: 0, credit: amount, narration: "Tuition income" },
      ],
    });

    await logAudit(
      context.supabase,
      context.userId,
      student.school_id,
      "STUDENT_INVOICE_CREATED",
      "student_invoices",
      {
        student_id: data.studentId,
        invoice_id: invoice.id,
        amount,
      },
    );
    return { invoiceId: invoice.id };
  });

export const recordStudentPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      studentId: string;
      paymentNumber: string;
      amount: number;
      paymentMethod: string;
      paymentDate?: string | null;
      referenceNumber?: string | null;
      narration?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to record payments");
    }

    const { data: student } = await context.supabase
      .from("students")
      .select("id, school_id, fees_balance")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be positive");
    const accounts = await ensureFinanceAccounts(context.supabase, student.school_id);
    const cashAccountId = accounts.get(data.paymentMethod === "bank" ? "1010" : "1000");
    const receivableAccountId = accounts.get("1100");
    if (!cashAccountId || !receivableAccountId)
      throw new Error("Default finance accounts are missing");

    const { data: payment, error: paymentError } = await context.supabase
      .from("payments")
      .insert({
        school_id: student.school_id,
        student_id: data.studentId,
        payment_number: data.paymentNumber,
        payment_date: data.paymentDate ?? new Date().toISOString().slice(0, 10),
        amount,
        payment_method: data.paymentMethod,
        reference_number: data.referenceNumber ?? null,
        narration: data.narration ?? null,
        status: "posted",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (paymentError) throw new Error(paymentError.message);

    const receiptNumber = `RCT-${data.paymentNumber}`;
    const { data: receipt, error: receiptError } = await context.supabase
      .from("receipts")
      .insert({
        school_id: student.school_id,
        payment_id: payment.id,
        receipt_number: receiptNumber,
        status: "active",
      })
      .select("id")
      .single();
    if (receiptError) throw new Error(receiptError.message);

    const { error: paymentUpdateError } = await context.supabase
      .from("payments")
      .update({ receipt_id: receipt.id })
      .eq("id", payment.id);
    if (paymentUpdateError) throw new Error(paymentUpdateError.message);

    const { error: balanceUpdateError } = await context.supabase
      .from("students")
      .update({ fees_balance: Math.max(0, Number(student.fees_balance ?? 0) - amount) })
      .eq("id", data.studentId);
    if (balanceUpdateError) throw new Error(balanceUpdateError.message);

    const { data: transaction, error: transactionError } = await context.supabase
      .from("transactions")
      .insert({
        school_id: student.school_id,
        transaction_number: data.paymentNumber,
        transaction_date: data.paymentDate ?? new Date().toISOString().slice(0, 10),
        source_module: "fees",
        source_record_id: payment.id,
        transaction_type: "income",
        reference_number: data.referenceNumber ?? null,
        narration: data.narration ?? `Payment for student ${data.studentId}`,
        total_amount: amount,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (transactionError) throw new Error(transactionError.message);

    await postBalancedJournal(context.supabase, {
      schoolId: student.school_id,
      transactionId: transaction.id,
      entryNumber: `JE-${data.paymentNumber}`,
      description: `Payment ${data.paymentNumber}`,
      userId: context.userId,
      lines: [
        { accountId: cashAccountId, debit: amount, credit: 0, narration: "Cash received" },
        {
          accountId: receivableAccountId,
          debit: 0,
          credit: amount,
          narration: "Reduce receivable",
        },
      ],
    });

    await logAudit(
      context.supabase,
      context.userId,
      student.school_id,
      "STUDENT_PAYMENT_RECORDED",
      "payments",
      {
        student_id: data.studentId,
        payment_id: payment.id,
        amount,
        receipt_number: receiptNumber,
      },
    );
    return { paymentId: payment.id, receiptId: receipt.id };
  });

export const createBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      financialYearId: string;
      title: string;
      departmentName?: string | null;
      budgetLines: Array<{
        budgetCategory: string;
        accountId?: string | null;
        periodName?: string | null;
        proposedAmount: number;
        notes?: string | null;
      }>;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["super_admin", "school_admin", "head_teacher", "bursar", "hod"].includes(r),
      )
    ) {
      throw new Error("Not allowed to create budgets");
    }

    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { data: year } = await context.supabase
      .from("financial_years")
      .select("id, school_id")
      .eq("id", data.financialYearId)
      .maybeSingle();
    if (!year || year.school_id !== schoolId) throw new Error("Financial year not found");

    const { data: budget, error: budgetError } = await context.supabase
      .from("budgets")
      .insert({
        school_id: schoolId,
        financial_year_id: data.financialYearId,
        title: data.title,
        department_name: data.departmentName ?? null,
        status: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (budgetError) throw new Error(budgetError.message);

    const total = data.budgetLines.reduce((sum, line) => sum + Number(line.proposedAmount ?? 0), 0);
    const { error: lineError } = await context.supabase.from("budget_lines").insert(
      data.budgetLines.map((line) => ({
        school_id: schoolId,
        budget_id: budget.id,
        account_id: line.accountId ?? null,
        budget_category: line.budgetCategory,
        period_name: line.periodName ?? null,
        proposed_amount: Number(line.proposedAmount ?? 0),
        approved_amount: 0,
        revised_amount: Number(line.proposedAmount ?? 0),
        actual_amount: 0,
        committed_amount: 0,
        notes: line.notes ?? null,
      })),
    );
    if (lineError) throw new Error(lineError.message);

    await logAudit(context.supabase, context.userId, schoolId, "BUDGET_CREATED", "budgets", {
      budget_id: budget.id,
      title: data.title,
      total,
    });

    return { budgetId: budget.id };
  });

export const updateBudgetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      budgetId: string;
      status:
        | "submitted"
        | "under_review"
        | "returned_for_revision"
        | "approved"
        | "rejected"
        | "active"
        | "closed";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["super_admin", "school_admin", "head_teacher", "bursar", "hod"].includes(r),
      )
    ) {
      throw new Error("Not allowed to update budgets");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: budget } = await context.supabase
      .from("budgets")
      .select("id, school_id")
      .eq("id", data.budgetId)
      .maybeSingle();
    if (!budget || budget.school_id !== schoolId) throw new Error("Budget not found");

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "approved" || data.status === "active") {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = context.userId;
    }

    const { error } = await context.supabase.from("budgets").update(patch).eq("id", data.budgetId);
    if (error) throw new Error(error.message);

    await logAudit(context.supabase, context.userId, schoolId, "BUDGET_STATUS_CHANGED", "budgets", {
      budget_id: data.budgetId,
      status: data.status,
    });
    return { ok: true };
  });

export const submitBudgetRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      budgetId: string;
      note?: string | null;
      revisedAmounts: Array<{ lineId: string; revisedAmount: number }>;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["super_admin", "school_admin", "head_teacher", "bursar", "hod"].includes(r),
      )
    ) {
      throw new Error("Not allowed to revise budgets");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: budget } = await context.supabase
      .from("budgets")
      .select("id, school_id, status")
      .eq("id", data.budgetId)
      .maybeSingle();
    if (!budget || budget.school_id !== schoolId) throw new Error("Budget not found");

    const { data: lines } = await context.supabase
      .from("budget_lines")
      .select("id, revised_amount, approved_amount")
      .eq("budget_id", data.budgetId);
    const byId = new Map((lines ?? []).map((line: any) => [line.id, line]));
    for (const line of data.revisedAmounts) {
      const existing = byId.get(line.lineId);
      if (!existing) throw new Error("Budget line not found");
      const nextAmount = Number(line.revisedAmount);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        throw new Error("Revised amount must be zero or positive");
      }
      const { error } = await context.supabase
        .from("budget_lines")
        .update({ revised_amount: nextAmount })
        .eq("id", line.lineId)
        .eq("budget_id", data.budgetId);
      if (error) throw new Error(error.message);
    }

    const { error: budgetError } = await context.supabase
      .from("budgets")
      .update({
        status: "returned_for_revision",
      })
      .eq("id", data.budgetId)
      .eq("school_id", schoolId);
    if (budgetError) throw new Error(budgetError.message);

    await logAudit(context.supabase, context.userId, schoolId, "BUDGET_REVISED", "budgets", {
      budget_id: data.budgetId,
      note: data.note ?? null,
      line_count: data.revisedAmounts.length,
    });
    return { ok: true };
  });

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      supplierName: string;
      contactPerson?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      taxNumber?: string | null;
      paymentDetails?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to create suppliers");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: supplier, error } = await context.supabase
      .from("suppliers")
      .insert({
        school_id: schoolId,
        supplier_name: data.supplierName.trim(),
        contact_person: data.contactPerson ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        tax_number: data.taxNumber ?? null,
        payment_details: data.paymentDetails ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(context.supabase, context.userId, schoolId, "SUPPLIER_CREATED", "suppliers", {
      supplier_id: supplier.id,
      supplier_name: data.supplierName,
    });
    return { supplierId: supplier.id };
  });

export const createPurchaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      requestNumber: string;
      budgetId?: string | null;
      supplierId?: string | null;
      departmentName?: string | null;
      itemDescription: string;
      requestedAmount: number;
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["super_admin", "school_admin", "head_teacher", "bursar", "hod"].includes(r),
      )
    ) {
      throw new Error("Not allowed to create purchase requests");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const amount = Number(data.requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("Requested amount must be positive");

    if (data.budgetId) {
      const { data: budget } = await context.supabase
        .from("budgets")
        .select("id, school_id, status")
        .eq("id", data.budgetId)
        .maybeSingle();
      if (!budget || budget.school_id !== schoolId) throw new Error("Budget not found");
    }

    const { data: request, error } = await context.supabase
      .from("purchase_requests")
      .insert({
        school_id: schoolId,
        budget_id: data.budgetId ?? null,
        supplier_id: data.supplierId ?? null,
        request_number: data.requestNumber,
        requested_by: context.userId,
        department_name: data.departmentName ?? null,
        item_description: data.itemDescription.trim(),
        requested_amount: amount,
        approved_amount: 0,
        status: "submitted",
        approval_status: "pending",
        remarks: data.remarks ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "PURCHASE_REQUEST_CREATED",
      "purchase_requests",
      {
        request_id: request.id,
        request_number: data.requestNumber,
        amount,
      },
    );
    return { requestId: request.id };
  });

export const reviewPurchaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      requestId: string;
      status: "approved" | "rejected" | "returned_for_revision";
      remarks?: string | null;
      approvedAmount?: number | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "head_teacher"].includes(r))) {
      throw new Error("Not allowed to review purchase requests");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");

    const { data: request } = await context.supabase
      .from("purchase_requests")
      .select("id, school_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request || request.school_id !== schoolId) throw new Error("Purchase request not found");

    const patch: Record<string, unknown> = {
      approval_status: data.status,
      status:
        data.status === "approved"
          ? "approved"
          : data.status === "rejected"
            ? "rejected"
            : "returned",
      remarks: data.remarks ?? null,
      approved_amount: data.status === "approved" ? Number(data.approvedAmount ?? 0) : 0,
    };

    const { error } = await context.supabase
      .from("purchase_requests")
      .update(patch)
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "PURCHASE_REQUEST_REVIEWED",
      "purchase_requests",
      {
        request_id: data.requestId,
        status: data.status,
        approved_amount: patch.approved_amount,
      },
    );
    return { ok: true };
  });

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; description?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher"].includes(r))) {
      throw new Error("Not allowed to create departments");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { data: dept, error } = await context.supabase
      .from("departments")
      .insert({
        school_id: schoolId,
        name: data.name.trim(),
        description: data.description ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { departmentId: dept.id };
  });

export const assignDepartmentHod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { departmentId: string; hodUserId: string | null }) => data)
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher"].includes(r))) {
      throw new Error("Not allowed to assign department heads");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { error } = await context.supabase
      .from("departments")
      .update({ hod_user_id: data.hodUserId })
      .eq("id", data.departmentId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    if (data.hodUserId) {
      await context.supabase
        .from("profiles")
        .update({ department_id: data.departmentId })
        .eq("id", data.hodUserId)
        .eq("school_id", schoolId);
      await context.supabase
        .from("user_roles")
        .upsert(
          { user_id: data.hodUserId, role: "hod", school_id: schoolId },
          { onConflict: "user_id,role" },
        );
    }
    return { ok: true };
  });

export const updatePurchaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      requestId: string;
      requestNumber?: string;
      departmentName?: string | null;
      itemDescription?: string;
      requestedAmount?: number;
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (
      !roles.some((r) =>
        ["super_admin", "school_admin", "head_teacher", "bursar", "hod"].includes(r),
      )
    ) {
      throw new Error("Not allowed to update purchase requests");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const patch: Record<string, unknown> = {};
    if (data.requestNumber) patch.request_number = data.requestNumber.trim();
    if (data.departmentName !== undefined) patch.department_name = data.departmentName;
    if (data.itemDescription) patch.item_description = data.itemDescription.trim();
    if (data.requestedAmount !== undefined) patch.requested_amount = Number(data.requestedAmount);
    if (data.remarks !== undefined) patch.remarks = data.remarks;
    const { error } = await context.supabase
      .from("purchase_requests")
      .update(patch)
      .eq("id", data.requestId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      orderNumber: string;
      purchaseRequestId?: string | null;
      supplierId?: string | null;
      departmentName?: string | null;
      totalAmount: number;
      expectedDeliveryDate?: string | null;
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to create purchase orders");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const amount = Number(data.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Total amount must be positive");

    const { data: order, error } = await context.supabase
      .from("purchase_orders")
      .insert({
        school_id: schoolId,
        purchase_request_id: data.purchaseRequestId ?? null,
        supplier_id: data.supplierId ?? null,
        order_number: data.orderNumber,
        ordered_by: context.userId,
        department_name: data.departmentName ?? null,
        total_amount: amount,
        expected_delivery_date: data.expectedDeliveryDate ?? null,
        status: "approved",
        remarks: data.remarks ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.purchaseRequestId) {
      await context.supabase
        .from("purchase_requests")
        .update({ status: "approved", approval_status: "approved", approved_amount: amount })
        .eq("id", data.purchaseRequestId)
        .eq("school_id", schoolId);
    }

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "PURCHASE_ORDER_CREATED",
      "purchase_orders",
      {
        order_id: order.id,
        order_number: data.orderNumber,
        total_amount: amount,
      },
    );
    return { purchaseOrderId: order.id };
  });

export const updatePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      orderId: string;
      orderNumber?: string;
      status?: string;
      departmentName?: string | null;
      expectedDeliveryDate?: string | null;
      totalAmount?: number;
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to update purchase orders");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const patch: Record<string, unknown> = {};
    if (data.orderNumber) patch.order_number = data.orderNumber.trim();
    if (data.status) patch.status = data.status;
    if (data.departmentName !== undefined) patch.department_name = data.departmentName;
    if (data.expectedDeliveryDate !== undefined)
      patch.expected_delivery_date = data.expectedDeliveryDate;
    if (data.totalAmount !== undefined) patch.total_amount = Number(data.totalAmount);
    if (data.remarks !== undefined) patch.remarks = data.remarks;
    const { error } = await context.supabase
      .from("purchase_orders")
      .update(patch)
      .eq("id", data.orderId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordGoodsReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      purchaseOrderId: string;
      receiptNumber: string;
      itemsReceived: number;
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to record goods receipts");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const amount = Number(data.itemsReceived);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("Received quantity must be positive");

    const { data: po } = await context.supabase
      .from("purchase_orders")
      .select("id, school_id")
      .eq("id", data.purchaseOrderId)
      .maybeSingle();
    if (!po || po.school_id !== schoolId) throw new Error("Purchase order not found");

    const { data: receipt, error } = await context.supabase
      .from("goods_receipts")
      .insert({
        school_id: schoolId,
        purchase_order_id: data.purchaseOrderId,
        receipt_number: data.receiptNumber,
        received_by: context.userId,
        items_received: amount,
        remarks: data.remarks ?? null,
        status: "received",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase
      .from("purchase_orders")
      .update({ status: "received" })
      .eq("id", data.purchaseOrderId)
      .eq("school_id", schoolId);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "GOODS_RECEIPT_RECORDED",
      "goods_receipts",
      {
        receipt_id: receipt.id,
        purchase_order_id: data.purchaseOrderId,
        items_received: amount,
      },
    );
    return { goodsReceiptId: receipt.id };
  });

export const createSupplierInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      invoiceNumber: string;
      supplierId?: string | null;
      purchaseOrderId?: string | null;
      departmentName?: string | null;
      invoiceDate?: string | null;
      dueDate?: string | null;
      amount: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to create supplier invoices");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invoice amount must be positive");

    const { data: invoice, error } = await context.supabase
      .from("approved_invoices")
      .insert({
        school_id: schoolId,
        supplier_id: data.supplierId ?? null,
        purchase_order_id: data.purchaseOrderId ?? null,
        invoice_number: data.invoiceNumber,
        department_name: data.departmentName ?? null,
        invoice_date: data.invoiceDate ?? new Date().toISOString().slice(0, 10),
        due_date: data.dueDate ?? null,
        amount,
        status: "draft",
        approval_status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "SUPPLIER_INVOICE_CREATED",
      "approved_invoices",
      {
        invoice_id: invoice.id,
        invoice_number: data.invoiceNumber,
        amount,
      },
    );
    return { invoiceId: invoice.id };
  });

export const updateSupplierInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      invoiceId: string;
      invoiceNumber?: string;
      approvalStatus?: "pending" | "approved" | "rejected";
      approvalNote?: string | null;
      departmentName?: string | null;
      amount?: number;
      dueDate?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to update supplier invoices");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const patch: Record<string, unknown> = {};
    if (data.invoiceNumber) patch.invoice_number = data.invoiceNumber.trim();
    if (data.approvalStatus) patch.approval_status = data.approvalStatus;
    if (data.approvalNote !== undefined) patch.approval_note = data.approvalNote;
    if (data.departmentName !== undefined) patch.department_name = data.departmentName;
    if (data.amount !== undefined) patch.amount = Number(data.amount);
    if (data.dueDate !== undefined) patch.due_date = data.dueDate;
    const { error } = await context.supabase
      .from("approved_invoices")
      .update(patch)
      .eq("id", data.invoiceId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePaymentVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      voucherId: string;
      voucherNumber?: string;
      status?: string;
      payeeName?: string;
      departmentName?: string | null;
      amount?: number;
      paymentMethod?: string;
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to update payment vouchers");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const patch: Record<string, unknown> = {};
    if (data.voucherNumber) patch.voucher_number = data.voucherNumber.trim();
    if (data.status) patch.status = data.status;
    if (data.payeeName) patch.payee_name = data.payeeName.trim();
    if (data.departmentName !== undefined) patch.department_name = data.departmentName;
    if (data.amount !== undefined) patch.amount = Number(data.amount);
    if (data.paymentMethod) patch.payment_method = data.paymentMethod;
    if (data.remarks !== undefined) patch.remarks = data.remarks;
    const { error } = await context.supabase
      .from("payment_vouchers")
      .update(patch)
      .eq("id", data.voucherId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewSupplierInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { invoiceId: string; status: "approved" | "rejected"; note?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "head_teacher"].includes(r))) {
      throw new Error("Not allowed to review invoices");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const patch =
      data.status === "approved"
        ? {
            approval_status: "approved",
            status: "approved",
            approved_by: context.userId,
            approved_at: new Date().toISOString(),
            approval_note: data.note ?? null,
          }
        : {
            approval_status: "rejected",
            status: "rejected",
            approval_note: data.note ?? null,
          };
    const { error } = await context.supabase
      .from("approved_invoices")
      .update(patch)
      .eq("id", data.invoiceId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "SUPPLIER_INVOICE_REVIEWED",
      "approved_invoices",
      {
        invoice_id: data.invoiceId,
        status: data.status,
      },
    );
    return { ok: true };
  });

export const createPaymentVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      voucherNumber: string;
      invoiceId?: string | null;
      payeeName: string;
      amount: number;
      paymentMethod: string;
      remarks?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r) => ["super_admin", "school_admin", "head_teacher", "bursar"].includes(r))) {
      throw new Error("Not allowed to create payment vouchers");
    }
    const schoolId = await schoolOf(context.supabase, context.userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Voucher amount must be positive");

    const { data: voucher, error } = await context.supabase
      .from("payment_vouchers")
      .insert({
        school_id: schoolId,
        approved_invoice_id: data.invoiceId ?? null,
        voucher_number: data.voucherNumber,
        payee_name: data.payeeName,
        amount,
        payment_method: data.paymentMethod,
        prepared_by: context.userId,
        status: "draft",
        remarks: data.remarks ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.invoiceId) {
      await context.supabase
        .from("approved_invoices")
        .update({ payment_voucher_id: voucher.id })
        .eq("id", data.invoiceId)
        .eq("school_id", schoolId);
    }

    await logAudit(
      context.supabase,
      context.userId,
      schoolId,
      "PAYMENT_VOUCHER_CREATED",
      "payment_vouchers",
      {
        voucher_id: voucher.id,
        voucher_number: data.voucherNumber,
        amount,
      },
    );
    return { paymentVoucherId: voucher.id };
  });

export const logReportPrint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { count: number; scope: string }) => data)
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
  .validator(
    (data: {
      id?: string | null;
      schoolId?: string;
      educationLevel?: "ordinary" | "advanced";
      grade: string;
      minScore: number;
      maxScore: number;
      gradeDescriptor: string;
      points?: number | null;
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
      education_level: data.educationLevel ?? "ordinary",
      grade: data.grade.trim().toUpperCase(),
      min_score: data.minScore,
      max_score: data.maxScore,
      grade_descriptor: data.gradeDescriptor.trim(),
      points: data.points ?? null,
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
  .validator((data: { id: string }) => data)
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
  .validator(
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
  .validator((data: { id: string }) => data)
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

