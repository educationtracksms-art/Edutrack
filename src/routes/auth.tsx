import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { PasswordInput } from "@/components/ui-kit";
import logoUrl from "@/assets/logo-optimized.png";
import { fetchCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | Education Track SMS" },
      {
        name: "description",
        content: "Sign in to Education Track SMS to manage your school, learners and report cards.",
      },
      { property: "og:title", content: "Sign in | Education Track SMS" },
      {
        property: "og:description",
        content: "Secure access for school administrators, teachers and platform owners.",
      },
    ],
    links: [{ rel: "preload", href: logoUrl, as: "image" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      // Local-only read: no network, resolves in ~1ms from localStorage.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        // Warm the user cache in the background while navigating instantly.
        void queryClient.prefetchQuery({
          queryKey: ["current-user"],
          queryFn: fetchCurrentUser,
          staleTime: 5 * 60_000,
        });
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setCheckedSession(true);
    };

    syncSession();

    return () => {
      cancelled = true;
    };
  }, [navigate, queryClient]);

  if (!checkedSession) {
    // Session check is local-only and completes in ~1ms. Show a minimal spinner
    // only during that tiny window to avoid flicker.
    return (
      <PublicShell>
        <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center bg-muted/40 px-4 py-10">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </PublicShell>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Navigate FIRST (shell paints instantly from cached/in-flight user),
      // warm the current-user query in the background. No extra getSession()
      // round-trip: signIn already persisted the session locally.
      void queryClient.prefetchQuery({
        queryKey: ["current-user"],
        queryFn: fetchCurrentUser,
        staleTime: 5 * 60_000,
      });
      void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center bg-muted/40 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="EduTrack logo"
              className="h-14 w-14 object-cover"
              fetchPriority="high"
              decoding="async"
            />
            <h1 className="mt-4 text-xl font-semibold">Sign in to EduTrack</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              School accounts are created by administrators - use the credentials you were issued.
            </p>
          </div>

          <form
            onSubmit={submit}
            className="mt-6 space-y-4"
            onFocus={() => {
              // While the user types credentials, warm the dashboard route
              // chunk so navigation after sign-in has no JS left to fetch.
              void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
            }}
          >
            <div>
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <PasswordInput
                id="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Signing you in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}
