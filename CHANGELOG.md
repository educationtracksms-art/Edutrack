# Changelog
## 2026-10-07 — Phase 1 Task 2: auto SMS on 2+ consecutive absences
- New `attendance_absence_alerts` table (`school_id` + RLS tenant read/write, dedupe on `school_id, student_id, streak_end_date`).
- New `scan_absence_alerts()` service_role scanner + pg_cron nightly `attendance-absence-alerts` (05:30), idempotent re-runs.
- Queue path: `finance_communications` (`channel=sms`, `message_type=absence_alert`, `status=queued`) — external gateway sends later, Supabase-only preserved.
- In-app `notifications` (`type=attendance`) to class_teacher/dos/head/deputy/school_admin in same school.
- New domain module `src/lib/attendance.functions.ts` (`triggerAbsenceAlerts` POST + `listAbsenceAlerts` GET) with `requireSupabaseAuth` rate-limited middleware, `rolesOf()`/`schoolOf()` checks, `logAudit()` (`ABSENCE_ALERTS_TRIGGERED`).
- Pure detector `src/lib/absence-alerts.ts` (`trailingAbsenceStreak`, `buildAbsenceSmsBody`).
- Hooks `src/hooks/useAbsenceAlerts.ts` (staleTime 2 min).
- UI: `Attendance > Absence alerts` panel with manual scan + recent alerts; guarded to school_admin/head/deputy/dos/class_teacher; attendance module toggle unchanged.
- Types `src/types/attendance.ts`.
- Tests `node --test src/lib/__tests__/absence-alerts.test.ts` (4/4 pass). Finance suite still 30/30.
- Migrations: `20261007130000_attendance_absence_alerts.sql`, `20261007131000_attendance_absence_scan.sql`.
- Mobile money explicitly KEPT per owner decision (Phase 1 Task 1 closed as retain).
