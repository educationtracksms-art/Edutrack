import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "./auth-middleware";
import { getRetryAfterSeconds } from "@/lib/server-function-rate-limit";

export const requireRateLimitedSupabaseAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    let rateLimit: { allowed: boolean; remaining: number; reset_at: string };

    try {
      const { data, error } = await context.supabase.rpc("consume_server_function_rate_limit");
      if (error) throw error;
      const result = data?.[0];
      if (!result) throw new Error("Supabase returned no server-function rate-limit result.");
      rateLimit = result;
    } catch (error) {
      console.error(
        "[RateLimit] Supabase rate-limit check failed; denying the authenticated server function.",
        error instanceof Error ? error.name : "Unknown error",
      );
      setResponseStatus(503, "Service Unavailable");
      setResponseHeader("Retry-After", "30");
      throw new Error("Request protection is temporarily unavailable. Please try again later.");
    }

    if (!rateLimit.allowed) {
      const retryAfter = getRetryAfterSeconds(Date.parse(rateLimit.reset_at));
      setResponseStatus(429, "Too Many Requests");
      setResponseHeader("Retry-After", String(retryAfter));
      throw new Error(`Too many requests. Please try again in ${retryAfter} seconds.`);
    }

    return next();
  });
