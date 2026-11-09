import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REPORT_MODULE_PREFERENCES,
  parseReportModulePreferences,
} from "../report-module-preferences";

test("report module preferences default to all report sections enabled", () => {
  assert.deepEqual(parseReportModulePreferences({}), DEFAULT_REPORT_MODULE_PREFERENCES);
});

test("report module preferences preserve saved section and payment choices", () => {
  assert.deepEqual(
    parseReportModulePreferences({
      grades: false,
      comments: true,
      attendance: false,
      coCurricular: true,
      includeFeesBalance: false,
      paymentReferenceType: "account_number",
      accountNumber: "123456",
    }),
    {
      grades: false,
      comments: true,
      attendance: false,
      coCurricular: true,
      includeFeesBalance: false,
      paymentReferenceType: "account_number",
      accountNumber: "123456",
    },
  );
});

test("report module preferences reject invalid saved values", () => {
  assert.throws(
    () => parseReportModulePreferences({ comments: "yes" }),
    /report module preference "comments" is invalid/,
  );
  assert.throws(
    () => parseReportModulePreferences({ paymentReferenceType: "invalid" }),
    /payment reference preference is invalid/,
  );
});
