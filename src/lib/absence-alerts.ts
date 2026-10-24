/**
 * Pure consecutive-absence detector shared by the nightly scanner, the
 * manual trigger and the automated tests. No network, DOM or Supabase.
 */
export type AbsenceRecord = { studentId: string; date: string; status: string };
export type AbsenceStreak = {
  studentId: string; startDate: string; endDate: string; consecutiveDays: number;
};
export function trailingAbsenceStreak(
  records: AbsenceRecord[], studentId: string, throughDate?: string,
): AbsenceStreak | null {
  const dates = records
    .filter((r) => r.studentId === studentId && r.status === "absent")
    .map((r) => r.date.slice(0, 10)).sort();
  if (!dates.length) return null;
  const end = (throughDate ?? dates[dates.length - 1]).slice(0, 10);
  let streak = 0; let cursor = end;
  const seen = new Set(dates);
  while (seen.has(cursor)) {
    streak += 1;
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  if (streak < 2) return null;
  const s = new Date(end + "T00:00:00Z");
  s.setUTCDate(s.getUTCDate() - (streak - 1));
  return { studentId, startDate: s.toISOString().slice(0, 10), endDate: end, consecutiveDays: streak };
}
export function buildAbsenceSmsBody(input: {
  schoolName?: string | null; studentName?: string | null;
  startDate: string; endDate: string;
}): string {
  const school = input.schoolName?.trim() || "School";
  const learner = input.studentName?.trim() || "Learner";
  return `${school}: ${learner} was absent on ${input.startDate} and ${input.endDate}. Please contact the school.`;
}
