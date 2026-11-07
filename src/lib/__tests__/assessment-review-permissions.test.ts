import assert from "node:assert/strict";
import { test } from "node:test";

import { canRejectApprovedMarks } from "../admin.functions";

test("only DOS, Head teacher and Deputy Head teacher can reject approved marks", () => {
  assert.equal(canRejectApprovedMarks(["dos"]), true);
  assert.equal(canRejectApprovedMarks(["head_teacher"]), true);
  assert.equal(canRejectApprovedMarks(["deputy_head_teacher"]), true);

  assert.equal(canRejectApprovedMarks(["school_admin"]), false);
  assert.equal(canRejectApprovedMarks(["super_admin"]), false);
  assert.equal(canRejectApprovedMarks(["class_teacher"]), false);
});
