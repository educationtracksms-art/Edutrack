import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";

import { PageHeader, Panel } from "@/components/ui-kit";
import { useCurrentUser, hasAny } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/env-debug")({
  head: () => ({
    meta: [
      { title: "Runtime env debug · EduTrack" },
      { name: "description", content: "Inspect server runtime environment availability for Supabase admin client." },
      { property: "og:title", content: "Runtime env debug · EduTrack" },
    ],
  }),
  component: EnvDebug,
});

const getEnvDebugInfo = createServerFn({ method: "GET" }, async () => {
  const { getServerSupabaseEnvDebugInfo } = await import("@/integrations/supabase/server-env");
  return getServerSupabaseEnvDebugInfo();
});

function EnvDebug() {
  const { data: me, isLoading: isUserLoading } = useCurrentUser();
  const debugInfo = useServerFn(getEnvDebugInfo);

  if (isUserLoading || debugInfo.state === "loading") {
    return <p className="text-sm text-muted-foreground">Loading debug info…</p>;
  }

  if (!me || !hasAny(me.roles, ["super_admin"])) {
    return <p className="text-sm text-muted-foreground">Unauthorized. Only super admins can access this debug page.</p>;
  }

  if (debugInfo.error) {
    return <p className="text-sm text-destructive">Error loading debug info: {debugInfo.error.message}</p>;
  }

  return (
    <div>
      <PageHeader
        title="Runtime environment debug"
        description="Verify server-side Supabase environment visibility for the deployed app."
      />

      <Panel title="Supabase environment debug info">
        <div className="space-y-2 text-sm">
          <div>
            <strong>Dotenv path:</strong> {debugInfo.data?.dotenvPath ?? "None"}
          </div>
          <div>
            <strong>Has dotenv:</strong> {String(debugInfo.data?.hasDotenv ?? false)}
          </div>
          <div>
            <strong>Has SUPABASE_URL:</strong> {String(debugInfo.data?.hasDotenvUrl ?? false)}
          </div>
          <div>
            <strong>Has SUPABASE_PUBLISHABLE_KEY:</strong> {String(debugInfo.data?.hasDotenvPublishableKey ?? false)}
          </div>
          <div>
            <strong>Has SUPABASE_SERVICE_ROLE_KEY:</strong> {String(debugInfo.data?.hasDotenvServiceRoleKey ?? false)}
          </div>
        </div>
      </Panel>

      <Panel title="Usage">
        <p className="text-sm text-muted-foreground">
          If the service role key is not available, check that the deployment runtime has <code>SUPABASE_SERVICE_ROLE_KEY</code> set.
        </p>
      </Panel>
    </div>
  );
}
