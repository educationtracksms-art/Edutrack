/**
 * Session lifecycle for EduTrack.
 *
 * A session is a *sliding* 30-minute inactivity window:
 *   - Every user interaction pushes the expiry forward, so a session never
 *     expires while the system is in use.
 *   - After 30 minutes without activity the session expires: the user is signed
 *     out and returned to the sign-in page.
 *
 * The last-activity stamp lives in localStorage so it is shared across tabs and
 * survives hook remounts. All helpers here are side-effect-light and safe to
 * call during navigation guards.
 */

import type { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { clearCachedUser } from "@/hooks/useCurrentUser";

/** Idle time after which an authenticated session is ended: 30 minutes. */
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const SESSION_LAST_ACTIVITY_KEY = "edutrack-session-last-activity";

function safeLocalStorage<T>(fn: () => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return fn();
  } catch {
    // Private mode / quota exceeded — non-fatal.
    return fallback;
  }
}

/**
 * Stamp the session as active right now. Call on login and on every significant
 * user interaction (caller is responsible for throttling).
 */
export function recordSessionActivity(): void {
  safeLocalStorage(
    () => window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, Date.now().toString()),
    undefined,
  );
}

/** Remove the activity stamp. Used on logout / expiry. */
export function removeSessionActivity(): void {
  safeLocalStorage(() => window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY), undefined);
}

/**
 * Last recorded activity timestamp, or null if none was ever recorded.
 * Shared across tabs via localStorage.
 */
export function getSessionLastActivity(): number | null {
  return safeLocalStorage(() => {
    const raw = window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }, null);
}

/**
 * True if no activity has been recorded within the 30-minute window, i.e. the
 * session has expired due to inactivity.
 */
export function isSessionExpired(): boolean {
  const last = getSessionLastActivity();
  if (!last) return true;
  return Date.now() - last > SESSION_INACTIVITY_TIMEOUT_MS;
}

/**
 * Milliseconds remaining before the session expires (0 if already expired or
 * never started).
 */
export function timeUntilExpiryMs(): number {
  const last = getSessionLastActivity();
  if (!last) return 0;
  return Math.max(0, SESSION_INACTIVITY_TIMEOUT_MS - (Date.now() - last));
}

/**
 * Terminates a session everywhere it lives:
 *   - Cancels and clears the React Query cache (fast subsequent loads start clean).
 *   - Clears the cached current-user profile.
 *   - Signs out of Supabase (clears the persisted auth session).
 *   - Removes the inactivity activity stamp.
 *
 * All failures are best-effort: the caller must still redirect to /auth.
 */
export async function clearSessionState({
  queryClient,
}: {
  queryClient: QueryClient;
}): Promise<void> {
  let error: unknown = null;
  try {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearCachedUser();
    await supabase.auth.signOut();
  } catch (caught) {
    error = caught;
  } finally {
    // Always drop the activity stamp, even if Supabase is unreachable.
    removeSessionActivity();
  }
  // Never throw: session termination must not block returning to sign in.
  if (error) console.error("[session] cleanup error", error);
}
