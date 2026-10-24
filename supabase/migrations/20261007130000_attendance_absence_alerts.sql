-- Phase 1 Task 2: auto SMS queue on 2+ consecutive absences (Supabase-only)
-- New table: attendance_absence_alerts (dedupe guard so each streak alerts once)
CREATE TABLE IF NOT EXISTS public.attendance_absence_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  streak_start_date date NOT NULL,
  streak_end_date date NOT NULL,
  consecutive_days integer NOT NULL DEFAULT 2 CHECK (consecutive_days >= 2),
  parent_phone text,
  sms_communication_id uuid,
  notified_at timestamptz NOT NULL DEFAULT now(),
  notified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, streak_end_date)
);
CREATE INDEX IF NOT EXISTS idx_absence_alerts_school_student
  ON public.attendance_absence_alerts (school_id, student_id, streak_end_date DESC);
GRANT SELECT, INSERT ON public.attendance_absence_alerts TO authenticated;
GRANT ALL ON public.attendance_absence_alerts TO service_role;
ALTER TABLE public.attendance_absence_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read_attendance_absence_alerts ON public.attendance_absence_alerts;
DROP POLICY IF EXISTS tenant_write_attendance_absence_alerts ON public.attendance_absence_alerts;
CREATE POLICY tenant_read_attendance_absence_alerts ON public.attendance_absence_alerts
  FOR SELECT TO authenticated USING (school_id = public.current_school_id());
CREATE POLICY tenant_write_attendance_absence_alerts ON public.attendance_absence_alerts
  FOR INSERT TO authenticated
  WITH CHECK (school_id = public.current_school_id() AND public.can_manage_academics());
