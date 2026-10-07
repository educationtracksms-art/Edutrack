import assert from "node:assert/strict";
import { test } from "node:test";

import { getRetryAfterSeconds } from "../server-function-rate-limit.ts";

test("retry delay rounds up to whole seconds", () => {
  assert.equal(getRetryAfterSeconds(10_001, 1_000), 10);
  assert.equal(getRetryAfterSeconds(2_001, 1_000), 2);
});

test("retry delay never falls below one second", () => {
  assert.equal(getRetryAfterSeconds(1_000, 1_000), 1);
  assert.equal(getRetryAfterSeconds(500, 1_000), 1);
});
