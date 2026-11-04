import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryClient } from "@tanstack/react-query";

import {
  clearSessionState,
  getSessionLastActivity,
  isSessionExpired,
  recordSessionActivity,
  removeSessionActivity,
  SESSION_INACTIVITY_TIMEOUT_MS,
  timeUntilExpiryMs,
} from "../session.ts";

const MIN = 60_000;
const ACTIVITY_KEY = "edutrack-session-last-activity";

// --- Mock browser localStorage: tests run in Node, which has no window. ---
const store = new Map<string, string>();
type LocalStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};
const storage: LocalStorageLike = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};
// Minimal browser shim for Node's test runner (no `any` casts needed).
Object.defineProperty(globalThis, "window", {
  value: { localStorage: storage },
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
});

function clearStore() {
  store.clear();
}

test("SESSION_INACTIVITY_TIMEOUT_MS is 30 minutes", () => {
  assert.equal(SESSION_INACTIVITY_TIMEOUT_MS, 30 * 60 * 1000);
});

test("a brand-new session is expired with no activity recorded", () => {
  clearStore();
  assert.equal(getSessionLastActivity(), null);
  assert.equal(isSessionExpired(), true);
  assert.equal(timeUntilExpiryMs(), 0);
});

test("recording activity marks the session as active", () => {
  clearStore();
  const before = Date.now();
  recordSessionActivity();
  const after = Date.now();

  const last = getSessionLastActivity();
  assert.ok(last !== null);
  assert.ok(last >= before && last <= after);

  assert.equal(isSessionExpired(), false);
  const remaining = timeUntilExpiryMs();
  assert.ok(remaining > 29 * MIN && remaining <= 30 * MIN);
});

test("activity is shared across tabs via localStorage", () => {
  clearStore();
  recordSessionActivity();
  const first = getSessionLastActivity();
  assert.ok(first !== null);

  recordSessionActivity();
  const second = getSessionLastActivity();
  assert.ok(second !== null && second >= first);
});

test("clearing activity expires the session", () => {
  clearStore();
  recordSessionActivity();
  assert.equal(isSessionExpired(), false);

  removeSessionActivity();
  assert.equal(getSessionLastActivity(), null);
  assert.equal(isSessionExpired(), true);
  assert.equal(timeUntilExpiryMs(), 0);
});

test("session expires after 30 minutes of inactivity", () => {
  clearStore();
  store.set(ACTIVITY_KEY, String(Date.now() - 31 * MIN));

  assert.equal(isSessionExpired(), true);
  assert.equal(timeUntilExpiryMs(), 0);
});

test("session stays valid while the user is active", () => {
  clearStore();
  store.set(ACTIVITY_KEY, String(Date.now() - 5 * MIN));

  assert.equal(isSessionExpired(), false);
  const remaining = timeUntilExpiryMs();
  assert.ok(remaining > 24 * MIN && remaining <= 25 * MIN);
});

test("clearSessionState resolves without network and wipes state", async () => {
  const cancelled: boolean[] = [];
  const cleared: boolean[] = [];
  const queryClient = {
    cancelQueries: async () => {
      cancelled.push(true);
    },
    clear: () => {
      cleared.push(true);
    },
  } as unknown as QueryClient;

  const origUrl = process.env.SUPABASE_URL;
  const origKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "http://localhost:1";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dummy";
  try {
    clearStore();
    store.set(ACTIVITY_KEY, String(Date.now()));

    await assert.doesNotReject(clearSessionState({ queryClient }));
  } finally {
    if (origUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = origUrl;
    if (origKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = origKey;
  }

  assert.equal(cancelled.length, 1);
  assert.equal(cleared.length, 1);
  assert.equal(store.get(ACTIVITY_KEY), undefined);
});
