// Loader for `node --test` so modules can use the `@/` path alias from tsconfig.
// Usage: node --test --experimental-loader ./scripts/test-loader.mjs src/lib/__tests__/session.test.ts
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveSource(specifier, from) {
  const base = specifier.startsWith("@/")
    ? path.join(packageRoot, "src", specifier.slice(2))
    : path.join(path.dirname(fileURLToPath(from)), specifier);
  for (const ext of [".ts", ".tsx", ".js", ".mjs", ""]) {
    const candidate = base + ext;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return base; // let nextResolve surface a clean error
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return { shortCircuit: true, url: resolveSource(specifier, context.parentURL) };
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    if (!context.parentURL) return nextResolve(specifier, context);
    return { shortCircuit: true, url: resolveSource(specifier, context.parentURL) };
  }
  return nextResolve(specifier, context);
}
