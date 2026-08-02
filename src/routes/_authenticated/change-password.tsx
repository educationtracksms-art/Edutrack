import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({
    meta: [
      { title: "Change password · EduTrack" },
      {
        name: "description",
        content: "Set a new password before continuing to your EduTrack workspace.",
      },
      { property: "og:title", content: "Change password · EduTrack" },
      { property: "og:description", content: "Mandatory password change at first sign-in." },
    ],
  }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters");
    if (password !== confirm) return toast.error("The two passwords do not match");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (me?.userId) {
        await supabase.from("profiles").update({ must_change_password: false }).eq("id", me.userId);
      }
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Password updated");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Set a new password"
        description="Your account was issued a one-time password. Choose a private password to continue."
      />
      <Panel>
        <form className="space-y-3" onSubmit={submit}>
          <Field label="New password">
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Btn type="submit" variant="accent" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Btn>
        </form>
      </Panel>
    </div>
  );
}
