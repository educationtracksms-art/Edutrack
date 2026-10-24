import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAbsenceSmsBody, trailingAbsenceStreak } from "../absence-alerts.ts";
test("two consecutive absences ending today raise a streak", () => {
  const streak = trailingAbsenceStreak([
    { studentId: "s1", date: "2026-10-05", status: "absent" },
    { studentId: "s1", date: "2026-10-06", status: "absent" },
  ], "s1", "2026-10-06");
  assert.equal(streak?.consecutiveDays, 2);
  assert.equal(streak?.startDate, "2026-10-05");
  assert.equal(streak?.endDate, "2026-10-06");
});
test("a present day breaks the trailing streak", () => {
  const streak = trailingAbsenceStreak([
    { studentId: "s1", date: "2026-10-05", status: "absent" },
    { studentId: "s1", date: "2026-10-06", status: "present" },
  ], "s1", "2026-10-06");
  assert.equal(streak, null);
});
test("non-consecutive absences do not alert", () => {
  const streak = trailingAbsenceStreak([
    { studentId: "s1", date: "2026-10-04", status: "absent" },
    { studentId: "s1", date: "2026-10-06", status: "absent" },
  ], "s1", "2026-10-06");
  assert.equal(streak, null);
});
test("sms body names school, learner and both dates", () => {
  const body = buildAbsenceSmsBody({ schoolName: "Kampala SS", studentName: "Amina K", startDate: "2026-10-05", endDate: "2026-10-06" });
  assert.ok(body.includes("Kampala SS"));
  assert.ok(body.includes("Amina K"));
  assert.ok(body.includes("2026-10-05"));
  assert.ok(body.includes("2026-10-06"));
});
