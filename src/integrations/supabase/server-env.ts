import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type EnvSource = Record<string, string | undefined>;

let cachedDotenv: EnvSource | undefined;

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
