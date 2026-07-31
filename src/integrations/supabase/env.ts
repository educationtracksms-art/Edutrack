type EnvSource = Record<string, string | undefined>;

declare global {
  // eslint-disable-next-line no-var
  var __EDUTRACK_RUNTIME_ENV__: EnvSource | undefined;
}

function getImportMetaEnv(): EnvSource {
  return typeof import.meta !== "undefined" ? ((import.meta as unknown as { env?: EnvSource }).env ?? {}) : {};
}

export function readSupabaseEnv(name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY") {
  const viteName = `VITE_${name}`;
  const metaEnv = getImportMetaEnv();
  const runtimeEnv = globalThis.__EDUTRACK_RUNTIME_ENV__ ?? {};
  const processEnv = typeof process !== "undefined" ? process.env : {};

  return (
    metaEnv[name] ??
    metaEnv[viteName] ??
    runtimeEnv[name] ??
    runtimeEnv[viteName] ??
    processEnv[name] ??
    processEnv[viteName]
  );
}
