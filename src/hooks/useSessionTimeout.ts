import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { clearCachedUser } from "@/hooks/useCurrentUser";
import {
  clearSessionState,
  recordSessionActivity,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from "@/lib/session";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
  "focus",
] as const;

/**
 * Guards the authenticated session for as long as the shell is mounted.
 *
 * - Sliding 30-minute inactivity expiry: any interaction resets the timer, so
 *   the session never expires while the system is in use. When the window
 *   elapses the user is signed out and returned to the sign-in page.
 * - Session-presence guard: a user sitting on an authenticated route without a
 *   real Supabase session (expired, cleared in another tab, or wiped) is signed
 *   out too — you cannot stay "logged in" without a session.
 *
 * Mounted inside AppShell, so it only runs for signed-in users.
 */
export function useSessionTimeout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timerRef = useRef<number | null>(null);
  const lastResetRef = useRef(0);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const endSession = async (reason: "inactivity" | "no-session") => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      clearTimer();

      await clearSessionState({ queryClient });

      toast.info(
        reason === "inactivity"
          ? "You were signed out after 30 minutes of inactivity."
          : "Your session is no longer valid. Please sign in again.",
      );
      navigate({ to: "/auth", replace: true });
    };

    const resetTimer = () => {
      const now = Date.now();
      // Throttle resets so high-frequency events (mousemove) do not churn
      // timers on every pixel of movement.
      if (now - lastResetRef.current < 1000) return;
      lastResetRef.current = now;
      recordSessionActivity();
      clearTimer();
      timerRef.current = window.setTimeout(
        () => void endSession("inactivity"),
        SESSION_INACTIVITY_TIMEOUT_MS,
      );
    };

    // Confirms a real Supabase session exists. Kicks out users who are "logged
    // in" only in UI state (cached profile, previous tab) but have no session.
    const ensureSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session) {
          void endSession("no-session");
        }
      } catch {
        // Network blip: do not kick the user out. The next interaction or
        // route change re-checks presence.
      }
    };

    const handleActivity = () => resetTimer();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to the tab: refresh activity and make sure the session
        // still exists (it may have expired or been cleared elsewhere).
        resetTimer();
        void ensureSession();
      }
    };

    // Initialise the sliding timer and validate the session exists.
    resetTimer();
    void ensureSession();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, {
        passive: true,
        capture: true,
      });
    });
    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity, { capture: true });
      });
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigate, queryClient]);
}
