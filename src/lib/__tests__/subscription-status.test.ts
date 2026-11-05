import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSubscriptionAccessGranted,
  isSubscriptionExpired,
  resolveSchoolSubscription,
} from "../subscription-status.ts";

test("active, trial, and confirmed subscriptions grant access", () => {
  assert.equal(isSubscriptionAccessGranted("active"), true);
  assert.equal(isSubscriptionAccessGranted("trial"), true);
  assert.equal(isSubscriptionAccessGranted("confirmed"), true);
});

test("inactive subscription states do not grant access", () => {
  assert.equal(isSubscriptionAccessGranted("pending"), false);
  assert.equal(isSubscriptionAccessGranted("past_due"), false);
  assert.equal(isSubscriptionAccessGranted("expired"), false);
  assert.equal(isSubscriptionAccessGranted("cancelled"), false);
  assert.equal(isSubscriptionAccessGranted("not_configured"), false);
});

test("a newer pending request does not override an existing active subscription", () => {
  const result = resolveSchoolSubscription(
    [
      { status: "pending", starts_at: "2026-11-05", ends_at: null },
      { status: "active", starts_at: "2026-10-01", ends_at: "2026-12-01" },
    ],
    new Date("2026-11-05T12:00:00Z"),
  );

  assert.equal(result.status, "active");
  assert.equal(result.subscription?.starts_at, "2026-10-01");
});

test("an expired newer subscription does not override an older valid trial", () => {
  const result = resolveSchoolSubscription(
    [
      { status: "active", starts_at: "2026-01-01", ends_at: "2026-03-01" },
      { status: "trial", starts_at: "2026-10-01", ends_at: "2026-12-01" },
    ],
    new Date("2026-11-05T12:00:00Z"),
  );

  assert.equal(result.status, "trial");
  assert.equal(result.subscription?.starts_at, "2026-10-01");
});

test("a subscription whose start date is in the future does not grant access", () => {
  const result = resolveSchoolSubscription(
    [{ status: "active", starts_at: "2026-11-06", ends_at: "2026-12-01" }],
    new Date("2026-11-05T12:00:00Z"),
  );

  assert.equal(result.status, "not_started");
  assert.equal(isSubscriptionAccessGranted(result.status), false);
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
