import assert from "node:assert/strict";
import { test } from "node:test";

import { canManageReportCommentRules } from "../admin.functions";

test("only DOS, head teacher and deputy head teacher can manage report comment rules", () => {
  assert.equal(canManageReportCommentRules(["dos"]), true);
  assert.equal(canManageReportCommentRules(["head_teacher"]), true);
  assert.equal(canManageReportCommentRules(["deputy_head_teacher"]), true);

  assert.equal(canManageReportCommentRules(["school_admin"]), false);
  assert.equal(canManageReportCommentRules(["class_teacher"]), false);
  assert.equal(canManageReportCommentRules(["hod"]), false);
});
