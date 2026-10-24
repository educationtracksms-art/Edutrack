export type AbsenceAlert = {
  id: string; school_id: string; student_id: string; term_id: string | null;
  streak_start_date: string; streak_end_date: string; consecutive_days: number;
  parent_phone: string | null; sms_communication_id: string | null;
  notified_at: string; notified_by: string | null; created_at: string;
};
export type AbsenceAlertCandidate = {
  studentId: string; studentName: string | null; parentPhone: string | null;
  startDate: string; endDate: string; consecutiveDays: number; termId: string | null;
};
