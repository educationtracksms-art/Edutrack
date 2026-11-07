import assert from "node:assert/strict";
import { test } from "node:test";

import { canManageSchoolModules } from "../modules";

test("only DOS, head teacher and deputy head teacher can manage school modules", () => {
  assert.equal(canManageSchoolModules(["dos"]), true);
  assert.equal(canManageSchoolModules(["head_teacher"]), true);
  assert.equal(canManageSchoolModules(["deputy_head_teacher"]), true);

  assert.equal(canManageSchoolModules(["school_admin"]), false);
  assert.equal(canManageSchoolModules(["class_teacher"]), false);
  assert.equal(canManageSchoolModules(["hod"]), false);
});
