import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, PasswordInput, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/account-settings")({
  head: () => ({
    meta: [
      { title: "My settings · EduTrack" },
      { name: "description", content: "Update your profile and password." },
    ],
  }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const [profile, setProfile] = useState({ full_name: "", initials: "", phone: "" });
  const [password, setPassword] = useState({ next: "", confirm: "" });

  useEffect(() => {
    if (me?.profile) {
      setProfile({
        full_name: me.profile.full_name ?? "",
        initials: me.profile.initials ?? "",
        phone: me.profile.phone ?? "",
      });
    }
  }, [me?.profile]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!me?.userId) return toast.error("Your account could not be found");
    if (!profile.full_name.trim()) return toast.error("Enter your full name");
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name.trim(),
        initials: profile.initials.trim().toUpperCase() || null,
        phone: profile.phone.trim() || null,
      })
      .eq("id", me.userId);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    toast.success("Profile updated");
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.next.length < 8) return toast.error("Use at least 8 characters");
    if (password.next !== password.confirm) return toast.error("The passwords do not match");
    const { error } = await supabase.auth.updateUser({ password: password.next });
    if (error) return toast.error(error.message);
    if (me?.userId) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", me.userId);
    }
    setPassword({ next: "", confirm: "" });
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    toast.success("Password updated");
  }

  return (
    <div>
      <PageHeader title="My settings" description="Manage your personal profile and password." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="My profile">
          <form className="space-y-3" onSubmit={saveProfile}>
            <Field label="Full name">
              <input required className={inputClass} value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </Field>
            <Field label="Initials">
              <input maxLength={5} className={inputClass} value={profile.initials} onChange={(e) => setProfile({ ...profile, initials: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input disabled className={inputClass} value={me?.email ?? ""} />
            </Field>
            <Btn type="submit" variant="accent">Save profile</Btn>
          </form>
        </Panel>

        <Panel title="Change password">
          <form className="space-y-3" onSubmit={savePassword}>
            <Field label="New password">
              <PasswordInput required minLength={8} className={inputClass} value={password.next} onChange={(e) => setPassword({ ...password, next: e.target.value })} />
            </Field>
            <Field label="Confirm new password">
              <PasswordInput required minLength={8} className={inputClass} value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} />
            </Field>
            <p className="text-xs text-muted-foreground">Your new password must contain at least 8 characters.</p>
            <Btn type="submit" variant="accent">Update password</Btn>
          </form>
        </Panel>
      </div>
    </div>
  );
}
