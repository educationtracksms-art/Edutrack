import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type EnvSource = Record<string, string | undefined>;

let cachedDotenv: EnvSource | undefined;
let cachedDotenvPath: string | undefined;

function parseDotenv(contents: string): EnvSource {
  const result: EnvSource = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadDotenvFile(): EnvSource {
  if (cachedDotenv) return cachedDotenv;

  try {
    const filePath = resolve(process.cwd(), ".env");
    cachedDotenvPath = filePath;
    cachedDotenv = existsSync(filePath) ? parseDotenv(readFileSync(filePath, "utf8")) : {};
  } catch {
    cachedDotenv = {};
  }

  return cachedDotenv;
}

export function readServerSupabaseEnv(
  name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY",
) {
  const viteName = `VITE_${name}`;
  const dotenv = loadDotenvFile();
  const globalEnv = typeof globalThis !== "undefined" ? globalThis.__EDUTRACK_RUNTIME_ENV__ ?? {} : {};
  const metaEnv = typeof import.meta !== "undefined" ? ((import.meta as unknown as { env?: EnvSource }).env ?? {}) : {};
  const processEnv = typeof process !== "undefined" ? process.env : {};

  return (
    metaEnv[name] ??
    metaEnv[viteName] ??
    globalEnv[name] ??
    globalEnv[viteName] ??
    processEnv[name] ??
    processEnv[viteName] ??
    dotenv[name] ??
    dotenv[viteName]
  );
}

export function getServerSupabaseEnvDebugInfo() {
  const dotenv = loadDotenvFile();
  const runtimeEnv = typeof globalThis !== "undefined" ? globalThis.__EDUTRACK_RUNTIME_ENV__ ?? {} : {};
  const metaEnv = typeof import.meta !== "undefined" ? ((import.meta as unknown as { env?: EnvSource }).env ?? {}) : {};
  const processEnv = typeof process !== "undefined" ? process.env : {};

  return {
    dotenvPath: cachedDotenvPath ?? null,
    hasDotenv: Boolean(cachedDotenvPath),
    hasDotenvServiceRoleKey: Boolean(
      dotenv.SUPABASE_SERVICE_ROLE_KEY ??
        dotenv.VITE_SUPABASE_SERVICE_ROLE_KEY ??
        metadataEnvValue(metaEnv, "SUPABASE_SERVICE_ROLE_KEY") ??
        metadataEnvValue(metaEnv, "VITE_SUPABASE_SERVICE_ROLE_KEY") ??
        runtimeEnv["SUPABASE_SERVICE_ROLE_KEY"] ??
        runtimeEnv["VITE_SUPABASE_SERVICE_ROLE_KEY"] ??
        processEnv["SUPABASE_SERVICE_ROLE_KEY"] ??
        processEnv["VITE_SUPABASE_SERVICE_ROLE_KEY"],
    ),
    hasDotenvPublishableKey: Boolean(
      dotenv.SUPABASE_PUBLISHABLE_KEY ??
        dotenv.VITE_SUPABASE_PUBLISHABLE_KEY ??
        metadataEnvValue(metaEnv, "SUPABASE_PUBLISHABLE_KEY") ??
        metadataEnvValue(metaEnv, "VITE_SUPABASE_PUBLISHABLE_KEY") ??
        runtimeEnv["SUPABASE_PUBLISHABLE_KEY"] ??
        runtimeEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
        processEnv["SUPABASE_PUBLISHABLE_KEY"] ??
        processEnv["VITE_SUPABASE_PUBLISHABLE_KEY"],
    ),
    hasDotenvUrl: Boolean(
      dotenv.SUPABASE_URL ??
        dotenv.VITE_SUPABASE_URL ??
        metadataEnvValue(metaEnv, "SUPABASE_URL") ??
        metadataEnvValue(metaEnv, "VITE_SUPABASE_URL") ??
        runtimeEnv["SUPABASE_URL"] ??
        runtimeEnv["VITE_SUPABASE_URL"] ??
        processEnv["SUPABASE_URL"] ??
        processEnv["VITE_SUPABASE_URL"],
    ),
  };
}

function metadataEnvValue(env: EnvSource, name: string) {
  return env[name] ?? undefined;
}
