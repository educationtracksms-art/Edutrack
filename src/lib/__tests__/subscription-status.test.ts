import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSubscriptionAccessGranted,
  isSubscriptionExpired,
} from "../subscription-status.ts";

test("active and trial subscriptions grant access", () => {
  assert.equal(isSubscriptionAccessGranted("active"), true);
  assert.equal(isSubscriptionAccessGranted("trial"), true);
});

test("inactive subscription states do not grant access", () => {
  assert.equal(isSubscriptionAccessGranted("pending"), false);
  assert.equal(isSubscriptionAccessGranted("past_due"), false);
  assert.equal(isSubscriptionAccessGranted("expired"), false);
  assert.equal(isSubscriptionAccessGranted("cancelled"), false);
  assert.equal(isSubscriptionAccessGranted("not_configured"), false);
});

test("an active subscription remains valid through its end date", () => {
  assert.equal(
    isSubscriptionExpired("active", "2026-11-05", new Date("2026-11-05T06:38:00Z")),
    false,
  );
});

test("an active subscription expires the day after its end date", () => {
  assert.equal(
    isSubscriptionExpired("active", "2026-11-05", new Date("2026-11-06T00:00:00Z")),
    true,
  );
});

test("subscriptions without an end date or in closed states are not date-expired", () => {
  assert.equal(isSubscriptionExpired("active", null), false);
  assert.equal(isSubscriptionExpired("cancelled", "2026-11-04", new Date("2026-11-05T00:00:00Z")), false);
});
