import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createSchoolWithAdmin, setSchoolStatus } from "@/lib/admin.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { Btn, Field, PageHeader, Panel, Pill, ResponsiveTable, inputClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/schools")({
  head: () => ({
    meta: [
      { title: "Schools · EduTrack" },
      { name: "description", content: "Create, suspend and monitor every school tenant on the platform." },
      { property: "og:title", content: "Schools · EduTrack" },
      { property: "og:description", content: "Super Admin control centre for school tenants." },
    ],
  }),
  component: SchoolsPage,
});

function SchoolsPage() {
  const queryClient = useQueryClient();
  const createSchool = useServerFn(createSchoolWithAdmin);
  const changeStatus = useServerFn(setSchoolStatus);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    email: "",
    phone: "",
    adminName: "",
    adminEmail: "",
  });
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createSchool({ data: form }),
    onSuccess: (result) => {
      setIssued({ email: form.adminEmail, password: result.oneTimePassword });
      setForm({ name: "", code: "", address: "", email: "", phone: "", adminName: "", adminEmail: "" });
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success("School created with an administrator account");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { schoolId: string; status: "active" | "suspended" }) => changeStatus({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success("School status updated");
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  return (
    <div>
      <PageHeader title="Schools" description="Each school is an isolated tenant with its own staff, learners and data." />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="Registered schools">
          <ResponsiveTable
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">School</th>
                      <th className="pb-2">Code</th>
                      <th className="pb-2">Plan</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(schools ?? []).map((school) => (
                      <tr key={school.id} className="border-t border-border">
                        <td className="py-2.5 font-medium">{school.name}</td>
                        <td>{school.code}</td>
                        <td className="capitalize">{school.subscription_plan}</td>
                        <td>
                          <Pill tone={school.status === "active" ? "success" : "danger"}>{school.status}</Pill>
                        </td>
                        <td className="text-right">
                          <Btn
                            variant="ghost"
                            onClick={() =>
                              statusMutation.mutate({
                                schoolId: school.id,
                                status: school.status === "active" ? "suspended" : "active",
                              })
                            }
                          >
                            {school.status === "active" ? "Suspend" : "Activate"}
                          </Btn>
                        </td>
                      </tr>
                    ))}
                    {(schools ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          No schools yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            }
            mobile={
              <>
                {(schools ?? []).map((school) => (
                  <div key={school.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{school.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Code: {school.code}</p>
                      </div>
                      <Pill tone={school.status === "active" ? "success" : "danger"}>{school.status}</Pill>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">
                        {school.subscription_plan}
                      </span>
                      <Btn
                        variant="ghost"
                        onClick={() =>
                          statusMutation.mutate({
                            schoolId: school.id,
                            status: school.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {school.status === "active" ? "Suspend" : "Activate"}
                      </Btn>
                    </div>
                  </div>
                ))}
                {(schools ?? []).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                    No schools yet.
                  </div>
                )}
              </>
            }
          />
        </Panel>

        <Panel title="Add a school">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <Field label="School name">
              <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="School code">
              <input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="School email">
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="School phone">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Administrator name">
              <input required className={inputClass} value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
            </Field>
            <Field label="Administrator email">
              <input required type="email" className={inputClass} value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
            </Field>
            <Btn type="submit" variant="accent" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create school"}
            </Btn>
          </form>

          {issued && (
            <div className="mt-4 rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm">
              <p className="font-semibold">One-time password issued</p>
              <p className="mt-1 break-all text-muted-foreground">{issued.email}</p>
              <p className="mt-1 font-mono text-base">{issued.password}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Share it securely. The administrator must change it at first sign-in.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
