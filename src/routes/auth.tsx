import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import logoUrl from "@/assets/logo.png";
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
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
      if (!cancelled) setCheckingSession(false);
    };

    syncSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checkingSession) {
    return (
      <PublicShell>
        <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center bg-muted/40 px-4 py-10">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-primary/15" />
            <h1 className="mt-4 text-xl font-semibold">Loading your session</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Checking whether you should go straight to your dashboard.
            </p>
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
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
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
            <img src={logoUrl} alt="EduTrack logo" className="h-16 w-16 object-cover" />
            <h1 className="mt-4 text-xl font-semibold">Sign in to EduTrack</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              School accounts are created by administrators - use the credentials you were issued.
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
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
              <input
                id="password"
                type="password"
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
              {loading ? "Please wait..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}
