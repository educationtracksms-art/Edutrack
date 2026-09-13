export type PesapalConfig = {
  pesapalConsumerKey: string;
  pesapalConsumerSecret: string;
  businessCurrency: string;
  pesapalBaseUrl: string;
  pesapalCallbackBaseUrl: string;
  pesapalIpnId: string;
};

type RuntimeEnv = Record<string, string | undefined>;

function readEnvironment(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: RuntimeEnv };
    __EDUTRACK_RUNTIME_ENV__?: RuntimeEnv;
  };

  return runtime.__EDUTRACK_RUNTIME_ENV__?.[name] ?? runtime.process?.env?.[name];
}

/** Returns a JSON response for server handlers that expose Pesapal results. */
export function jsonResponse<T>(payload: T): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Reads Pesapal settings from explicit values first, then server environment
 * variables. Never call this from a browser component with private settings.
 */
export function config(overrides: Partial<PesapalConfig> = {}): PesapalConfig {
  return {
    pesapalConsumerKey:
      overrides.pesapalConsumerKey ?? readEnvironment("PESAPAL_CONSUMER_KEY") ?? "",
    pesapalConsumerSecret:
      overrides.pesapalConsumerSecret ?? readEnvironment("PESAPAL_CONSUMER_SECRET") ?? "",
    businessCurrency:
      overrides.businessCurrency ?? readEnvironment("PESAPAL_BUSINESS_CURRENCY") ?? "KES",
    pesapalBaseUrl:
      overrides.pesapalBaseUrl ??
      readEnvironment("PESAPAL_BASE_URL") ??
      "https://pay.pesapal.com/v3",
    pesapalCallbackBaseUrl:
      overrides.pesapalCallbackBaseUrl ?? readEnvironment("PESAPAL_CALLBACK_BASE_URL") ?? "",
    pesapalIpnId: overrides.pesapalIpnId ?? readEnvironment("PESAPAL_IPN_ID") ?? "",
  };
}

// Preserve the name used by the original PHP package.
export const _config = config;
