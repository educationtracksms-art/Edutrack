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
    const candidatePaths = [
      resolve(process.cwd(), ".env"),
      resolve(process.cwd(), "..", ".env"),
      resolve(process.cwd(), "..", "..", ".env"),
      resolve(process.cwd(), "..", "..", "..", ".env"),
      resolve(process.cwd(), ".env.production"),
      resolve(process.cwd(), "..", ".env.production"),
      resolve(process.cwd(), "..", "..", ".env.production"),
    ];

    const filePath = candidatePaths.find((candidate) => existsSync(candidate));
    cachedDotenvPath = filePath;
    cachedDotenv = filePath ? parseDotenv(readFileSync(filePath, "utf8")) : {};
  } catch {
    cachedDotenv = {};
  }

  return cachedDotenv;
}

export function readServerSupabaseEnv(
  name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY",
) {
  const viteName = `VITE_${name}`;
  const metaEnv = typeof import.meta !== "undefined" ? ((import.meta as unknown as { env?: EnvSource }).env ?? {}) : {};
  const dotenv = loadDotenvFile();
  const processEnv = typeof process !== "undefined" ? process.env : {};

  return (
    metaEnv[name] ??
    metaEnv[viteName] ??
    processEnv[name] ??
    processEnv[viteName] ??
    dotenv[name] ??
    dotenv[viteName]
  );
}

export function getServerSupabaseEnvDebugInfo() {
  const dotenv = loadDotenvFile();

  return {
    dotenvPath: cachedDotenvPath ?? null,
    hasDotenv: Boolean(cachedDotenvPath),
    hasProcessServiceRoleKey: Boolean(process.env?.SUPABASE_SERVICE_ROLE_KEY),
    hasProcessPublishableKey: Boolean(process.env?.SUPABASE_PUBLISHABLE_KEY),
    hasProcessUrl: Boolean(process.env?.SUPABASE_URL),
    hasDotenvServiceRoleKey: Boolean(dotenv.SUPABASE_SERVICE_ROLE_KEY ?? dotenv.VITE_SUPABASE_SERVICE_ROLE_KEY),
    hasDotenvPublishableKey: Boolean(dotenv.SUPABASE_PUBLISHABLE_KEY ?? dotenv.VITE_SUPABASE_PUBLISHABLE_KEY),
    hasDotenvUrl: Boolean(dotenv.SUPABASE_URL ?? dotenv.VITE_SUPABASE_URL),
  };
}
