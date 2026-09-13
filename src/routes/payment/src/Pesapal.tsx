import { Curl, type ApiResponse } from "./Curl";
import { _config, type PesapalConfig } from "./helpers";

type TokenResponse = {
  token: string;
  expiryDate?: string;
  error?: unknown;
};

export type RegisterIpnResponse = {
  url?: string;
  ipn_id?: string;
  ipnId?: string;
  [key: string]: unknown;
};

export type OrderResponse = {
  order_tracking_id?: string;
  merchant_reference?: string;
  redirect_url?: string;
  [key: string]: unknown;
};

export type TransactionStatusParams = {
  orderTrackingId?: string;
  orderMerchantReference?: string;
};

function failed<T>(message: string): ApiResponse<T> {
  return { success: false, message };
}

function authToken(response: ApiResponse<TokenResponse>): string | undefined {
  if (!response.success || !response.message || typeof response.message !== "object") {
    return undefined;
  }

  const token = (response.message as TokenResponse).token;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

function callbackUrlFromBase(url: string): string {
  return new URL("/pesapal/callback", url.endsWith("/") ? url : `${url}/`).toString();
}

function merchantReference(): string {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

/**
 * Server-side Pesapal API client translated from the original PHP package.
 * Keep this module out of client bundles because it reads the consumer secret.
 */
export class Pesapal {
  private static options: PesapalConfig = _config();

  static config(overrides: Partial<PesapalConfig> = {}): PesapalConfig {
    if (Object.keys(overrides).length > 0) {
      this.options = { ...this.options, ...overrides };
    }

    return { ...this.options };
  }

  static configure(overrides: Partial<PesapalConfig>): PesapalConfig {
    return this.config(overrides);
  }

  static async pesapalAuth(): Promise<ApiResponse<TokenResponse>> {
    const settings = this.config();

    if (!settings.pesapalConsumerKey || !settings.pesapalConsumerSecret) {
      return failed("Pesapal consumer key and secret are required");
    }

    return Curl.postToken<TokenResponse>(
      `${settings.pesapalBaseUrl}/api/Auth/RequestToken`,
      { "Content-Type": "application/json", accept: "application/json" },
      {
        consumer_key: settings.pesapalConsumerKey,
        consumer_secret: settings.pesapalConsumerSecret,
      },
    );
  }

  static async pesapalRegisterIPN(baseUrl?: string): Promise<ApiResponse<RegisterIpnResponse>> {
    const tokenResponse = await this.pesapalAuth();
    const token = authToken(tokenResponse);

    if (!token) {
      return failed("Failed to obtain Token");
    }

    const settings = this.config();
    const registrationBaseUrl = baseUrl ?? settings.pesapalCallbackBaseUrl;
    if (!registrationBaseUrl) {
      return failed("Pesapal callback base URL is required");
    }

    return Curl.post<RegisterIpnResponse>(
      `${settings.pesapalBaseUrl}/api/URLSetup/RegisterIPN`,
      {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      {
        url: callbackUrlFromBase(registrationBaseUrl),
        ipn_notification_type: "POST",
      },
    );
  }

  static async listIPNS(): Promise<ApiResponse<unknown[]>> {
    const tokenResponse = await this.pesapalAuth();
    const token = authToken(tokenResponse);

    if (!token) {
      return failed("Failed to obtain Token");
    }

    const settings = this.config();
    return Curl.get<unknown[]>(`${settings.pesapalBaseUrl}/api/URLSetup/GetIpnList`, {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
  }

  static async listIpns(): Promise<ApiResponse<unknown[]>> {
    return this.listIPNS();
  }

  static async orderProcess(
    amount: number,
    phone: string,
    callback?: string,
    updatePesapalIPNID?: string,
  ): Promise<ApiResponse<OrderResponse>> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return failed("Amount must be greater than zero");
    }

    const tokenResponse = await this.pesapalAuth();
    const token = authToken(tokenResponse);

    if (!token) {
      return failed("Failed to obtain Token");
    }

    const settings = this.config();
    const callbackUrl = callback ?? settings.pesapalCallbackBaseUrl;
    const ipnId = updatePesapalIPNID ?? settings.pesapalIpnId;

    if (!callbackUrl || !ipnId) {
      return failed("Pesapal callback URL and IPN ID are required");
    }

    return Curl.post<OrderResponse>(
      `${settings.pesapalBaseUrl}/api/Transactions/SubmitOrderRequest`,
      {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      {
        id: merchantReference(),
        currency: settings.businessCurrency,
        amount,
        description: "testApi",
        redirect_mode: "PARENT_WINDOW",
        callback_url: callbackUrl,
        notification_id: ipnId,
        billing_address: { phone_number: phone },
      },
    );
  }

  static async transactionStatus(
    params: TransactionStatusParams | string,
  ): Promise<ApiResponse<unknown>> {
    const orderTrackingId = typeof params === "string" ? params : params.orderTrackingId;

    if (!orderTrackingId) {
      return failed("Missing Transaction ID");
    }

    const tokenResponse = await this.pesapalAuth();
    const token = authToken(tokenResponse);

    if (!token) {
      return failed("Failed to obtain Token");
    }

    const settings = this.config();
    const url = new URL(`${settings.pesapalBaseUrl}/api/Transactions/GetTransactionStatus`);
    url.searchParams.set("orderTrackingId", orderTrackingId);

    return Curl.get<unknown>(url.toString(), {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
  }
}
