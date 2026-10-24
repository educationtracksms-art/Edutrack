import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "./auth-middleware";
import { getRetryAfterSeconds } from "@/lib/server-function-rate-limit";

const RATE_LIMIT = 120;
const WINDOW_MS = 60_000;

type Bucket = { windowStartedAt: number; count: number };
const buckets = new Map<string, Bucket>();
let remoteRateLimitAvailable = true;

function consumeInMemory(userId: string): { allowed: boolean; remaining: number; reset_at: string } {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const bucket = buckets.get(userId);

  let count: number;
  if (!bucket || bucket.windowStartedAt !== windowStart) {
    count = 1;
    buckets.set(userId, { windowStartedAt: windowStart, count });
  } else {
    count = Math.min(bucket.count + 1, RATE_LIMIT + 1);
    bucket.count = count;
  }

  return {
    allowed: count <= RATE_LIMIT,
    remaining: Math.max(RATE_LIMIT - count, 0),
    reset_at: new Date(windowStart + WINDOW_MS).toISOString(),
  };
}

export const requireRateLimitedSupabaseAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    let rateLimit: { allowed: boolean; remaining: number; reset_at: string };

    if (remoteRateLimitAvailable) {
      try {
        const { data, error } = await context.supabase.rpc("consume_server_function_rate_limit");
        if (error) throw error;
        const result = data?.[0];
        if (!result) throw new Error("Supabase returned no server-function rate-limit result.");
        rateLimit = result;
      } catch (error) {
        remoteRateLimitAvailable = false;
        console.warn(
          "[RateLimit] Supabase rate-limit check unavailable; using in-memory fallback.",
          error instanceof Error ? error.message : error,
        );
        rateLimit = consumeInMemory(context.userId);
      }
    } else {
      rateLimit = consumeInMemory(context.userId);
    }

    if (!rateLimit.allowed) {
      const retryAfter = getRetryAfterSeconds(Date.parse(rateLimit.reset_at));
      setResponseStatus(429, "Too Many Requests");
      setResponseHeader("Retry-After", String(retryAfter));
      throw new Error(`Too many requests. Please try again in ${retryAfter} seconds.`);
    }

    return next();
  });
