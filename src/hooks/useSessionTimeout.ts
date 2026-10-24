import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { clearCachedUser } from "@/hooks/useCurrentUser";

/** Idle time after which an authenticated session is ended. */
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

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
 * Ends the Supabase session after 30 minutes without user activity.
 *
 * Mounted inside the authenticated shell so it only runs for signed-in users.
 * Any interaction resets the timer; expiry signs out, clears cached user data,
 * and redirects to the sign-in page.
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

    const expireSession = async () => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      clearTimer();

      try {
        await queryClient.cancelQueries();
        queryClient.clear();
        clearCachedUser();
        await supabase.auth.signOut();
      } catch {
        // Best-effort cleanup; always send the user back to sign in.
      } finally {
        toast.info("You were signed out after 30 minutes of inactivity.");
        navigate({ to: "/auth", replace: true });
      }
    };

    const resetTimer = () => {
      const now = Date.now();
      // Throttle resets so high-frequency events (mousemove) do not churn
      // timers on every pixel of movement.
      if (now - lastResetRef.current < 1000) return;
      lastResetRef.current = now;
      clearTimer();
      timerRef.current = window.setTimeout(expireSession, SESSION_INACTIVITY_TIMEOUT_MS);
    };

    resetTimer();

    const handleActivity = () => resetTimer();
    const handleVisibilityChange = () => {
      if (!document.hidden) resetTimer();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true, capture: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity, { capture: true });
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigate, queryClient]);
}
