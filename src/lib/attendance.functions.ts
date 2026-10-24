import { createServerFn } from "@tanstack/react-start";
import { requireRateLimitedSupabaseAuth as requireSupabaseAuth } from "@/integrations/supabase/rate-limited-auth-middleware";
import { buildAbsenceSmsBody, trailingAbsenceStreak } from "./absence-alerts";
const ALERT_MANAGERS = ["school_admin", "head_teacher", "deputy_head_teacher", "dos", "class_teacher"];
async function rolesOf(db: any, userId: string): Promise<string[]> {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role);
}
async function schoolOf(db: any, userId: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("school_id").eq("id", userId).maybeSingle();
  return data?.school_id ?? null;
}
async function logAudit(db: any, actorId: string, schoolId: string | null, action: string, entity: string, details?: Record<string, unknown>) {
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", actorId).maybeSingle();
  await db.from("audit_logs").insert({
    school_id: schoolId, user_id: actorId, user_name: profile?.full_name ?? null,
    action, entity, details: details ?? {},
  });
}
async function notifyStaff(db: any, schoolId: string, title: string, body: string) {
  const { data: staff } = await db.from("profiles").select("id").eq("school_id", schoolId).eq("is_active", true);
  const { data: roles } = await db.from("user_roles").select("user_id").eq("school_id", schoolId)
    .in("role", ["class_teacher", "dos", "head_teacher", "deputy_head_teacher", "school_admin"]);
  const ids = new Set((roles ?? []).map((r: any) => r.user_id));
  const rows = (staff ?? []).filter((p: any) => ids.has(p.id))
    .map((p: any) => ({ school_id: schoolId, user_id: p.id, title, body, type: "attendance" }));
  if (rows.length) await db.from("notifications").insert(rows);
}
export const listAbsenceAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { limit?: number } = {}) => data)
  .handler(async ({ data, context }: any) => {
    const supabase: any = context.supabase; const userId: string = context.userId;
    const roles = await rolesOf(supabase, userId);
    if (!roles.some((r) => ALERT_MANAGERS.includes(r))) throw new Error("Not allowed to view absence alerts");
    const schoolId = await schoolOf(supabase, userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const { data: alerts, error } = await supabase.from("attendance_absence_alerts")
      .select("id, student_id, streak_start_date, streak_end_date, consecutive_days, parent_phone, notified_at")
      .eq("school_id", schoolId).order("notified_at", { ascending: false }).limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return { alerts: alerts ?? [] };
  });
export const triggerAbsenceAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { date?: string | null } = {}) => data)
  .handler(async ({ data, context }: any) => {
    const supabase: any = context.supabase; const userId: string = context.userId;
    const roles = await rolesOf(supabase, userId);
    if (!roles.some((r) => ALERT_MANAGERS.includes(r))) throw new Error("Not allowed to trigger absence alerts");
    const schoolId = await schoolOf(supabase, userId);
    if (!schoolId) throw new Error("Your account is not linked to a school");
    const through = (data.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const since = new Date(through + "T00:00:00Z"); since.setUTCDate(since.getUTCDate() - 14);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: records, error: recError } = await supabase.from("attendance_records")
      .select("student_id, attendance_date, status, term_id").eq("school_id", schoolId)
      .gte("attendance_date", sinceStr).lte("attendance_date", through).order("attendance_date");
    if (recError) throw new Error(recError.message);
    const byStudent = new Map<string, any[]>();
    for (const r of (records ?? []) as any[]) {
      if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
      byStudent.get(r.student_id)!.push(r);
    }
    const { data: students } = await supabase.from("students")
      .select("id, full_name, parent_phone, guardian_phone").eq("school_id", schoolId);
    const studentById = new Map(((students ?? []) as any[]).map((s: any) => [s.id, s]));
    const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
    let queued = 0; let skipped = 0;
    for (const [studentId, rows] of byStudent) {
      const streak = trailingAbsenceStreak(
        rows.map((r: any) => ({ studentId, date: String(r.attendance_date).slice(0, 10), status: r.status })),
        studentId, through);
      if (!streak || streak.consecutiveDays < 2) continue;
      const { data: existing } = await supabase.from("attendance_absence_alerts").select("id")
        .eq("school_id", schoolId).eq("student_id", studentId).eq("streak_end_date", streak.endDate).maybeSingle();
      if (existing) { skipped += 1; continue; }
      const student = studentById.get(studentId);
      const parentPhone = student?.parent_phone ?? student?.guardian_phone ?? null;
      const termRows = rows as any[];
      const termId = termRows.find((r) => String(r.attendance_date).slice(0, 10) === streak.endDate)?.term_id ?? null;
      const body = buildAbsenceSmsBody({
        schoolName: school?.name ?? "School", studentName: student?.full_name ?? "Learner",
        startDate: streak.startDate, endDate: streak.endDate,
      });
      const { data: comm, error: commError } = await supabase.from("finance_communications").insert({
        school_id: schoolId, student_id: studentId, recipient_type: "parent",
        recipient_name: student?.full_name ?? null, recipient_address: parentPhone,
        channel: "sms", message_type: "absence_alert",
        subject: `Absence alert: ${student?.full_name ?? "learner"}`,
        body, entity_type: "attendance", status: "queued", sent_by: userId,
      }).select("id").single();
      if (commError) throw new Error(commError.message);
      const { error: alertError } = await supabase.from("attendance_absence_alerts").insert({
        school_id: schoolId, student_id: studentId, term_id: termId,
        streak_start_date: streak.startDate, streak_end_date: streak.endDate,
        consecutive_days: streak.consecutiveDays, parent_phone: parentPhone,
        sms_communication_id: comm.id, notified_by: userId,
      });
      if (alertError) throw new Error(alertError.message);
      await notifyStaff(supabase, schoolId,
        `Absence alert: ${student?.full_name ?? "learner"}`,
        `${student?.full_name ?? "Learner"} absent ${streak.consecutiveDays} days in a row (${streak.startDate} - ${streak.endDate}). SMS queued${parentPhone ? "" : " (no parent phone on file)"}.`);
      queued += 1;
    }
    await logAudit(supabase, userId, schoolId, "ABSENCE_ALERTS_TRIGGERED", "attendance_absence_alerts", { through, queued, skipped });
    return { ok: true, queued, skipped, through };
  });
