import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Btn, Field, PageHeader, Panel, inputClass } from "@/components/ui-kit";
import { uploadImage } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "School Settings · EduTrack" },
      { name: "description", content: "Update school branding, contacts and enabled modules." },
      { property: "og:title", content: "School Settings · EduTrack" },
      { property: "og:description", content: "Branding and module configuration for your school." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const [form, setForm] = useState({ name: "", address: "", email: "", phone: "", motto: "", logo_url: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (me?.school) {
      supabase
        .from("schools")
        .select("name, address, email, phone, motto, logo_url")
        .eq("id", me.school.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data)
            setForm({
              name: data.name ?? "",
              address: data.address ?? "",
              email: data.email ?? "",
              phone: data.phone ?? "",
              motto: data.motto ?? "",
              logo_url: data.logo_url ?? "",
            });
        });
    }
  }, [me?.school]);

  const { data: toggles } = useQuery({
    queryKey: ["feature-toggles", schoolId],
    enabled: !!schoolId,
    queryFn: async () => (await supabase.from("feature_toggles").select("*").order("module")).data ?? [],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school linked to your account");
      const logoUrl = logoFile ? await uploadImage(logoFile, `schools/${schoolId}/logo`) : form.logo_url;
      const { error } = await supabase.from("schools").update({ ...form, logo_url: logoUrl }).eq("id", schoolId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("School details updated");
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      setLogoFile(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (vars: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("feature_toggles").update({ enabled: vars.enabled }).eq("id", vars.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feature-toggles", schoolId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader title="School settings" description="Branding shown on report cards and the modules your staff can use." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="School profile">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Field label="Name">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Motto">
              <input className={inputClass} value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} />
            </Field>
            <Field label="School logo">
              {form.logo_url && (
                <div className="mb-2">
                  <img
                    src={form.logo_url}
                    alt="Current school logo"
                    className="h-20 w-20 rounded-md border border-border object-cover"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className={inputClass}
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Upload an image up to 1 MB. New uploads replace the current logo in the images bucket.
              </p>
            </Field>
            <Btn type="submit" variant="accent" disabled={saveMutation.isPending}>
              Save changes
            </Btn>
          </form>
        </Panel>

        <Panel title="Modules">
          <ul className="space-y-2 text-sm">
            {(toggles ?? []).map((toggle) => (
              <li key={toggle.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="capitalize">{toggle.module.replace(/_/g, " ")}</span>
                <input
                  type="checkbox"
                  checked={toggle.enabled}
                  onChange={(e) => toggleMutation.mutate({ id: toggle.id, enabled: e.target.checked })}
                />
              </li>
            ))}
            {(toggles ?? []).length === 0 && <p className="text-muted-foreground">No modules configured.</p>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
