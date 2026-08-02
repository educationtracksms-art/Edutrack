import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, ResponsiveTable } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs · EduTrack" },
      {
        name: "description",
        content: "Immutable record of every sensitive action taken in your school.",
      },
      { property: "og:title", content: "Audit Logs · EduTrack" },
      {
        property: "og:description",
        content: "Track approvals, resets, verifications and report printing.",
      },
    ],
  }),
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const { data } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () =>
      (
        await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      ).data ?? [],
  });

  return (
    <div>
      <PageHeader title="Audit logs" description="Who did what, and when." />
      <Panel>
        <ResponsiveTable
          desktop={
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">When</th>
                    <th className="pb-2">User</th>
                    <th className="pb-2">Action</th>
                    <th className="pb-2">Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((log) => (
                    <tr key={log.id} className="border-t border-border">
                      <td className="py-2 text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>{log.user_name ?? "System"}</td>
                      <td className="font-medium">{log.action}</td>
                      <td>{log.entity ?? "—"}</td>
                    </tr>
                  ))}
                  {(data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          }
          mobile={
            <>
              {(data ?? []).map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {log.entity ?? "—"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{log.user_name ?? "System"}</span>
                  </p>
                </div>
              ))}
              {(data ?? []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                  No activity recorded yet.
                </div>
              )}
            </>
          }
        />
      </Panel>
    </div>
  );
}
