export type RequestHeaders = HeadersInit;

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: T | string;
  statusCode?: number;
  client?: string;
};

/**
 * Small fetch wrapper used by the Pesapal service.
 *
 * This module is intended to run on the server. It does not contain any
 * browser-only APIs, but callers should still avoid sending Pesapal secrets
 * to the client.
 */
export class Curl {
  private static client: typeof fetch | undefined;
  private static defaultHeaders: Record<string, string> = {};

  static initialize(client: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.client = client;
  }

  static async get<T = unknown>(
    url: string,
    headers: RequestHeaders = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", url, headers);
  }

  // Uppercase aliases preserve the public method names from the PHP client.
  static async Get<T = unknown>(
    url: string,
    headers: RequestHeaders = {},
  ): Promise<ApiResponse<T>> {
    return this.get<T>(url, headers);
  }

  static async post<T = unknown>(
    url: string,
    headers: RequestHeaders = {},
    body?: BodyInit | Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", url, headers, body);
  }

  static async Post<T = unknown>(
    url: string,
    headers: RequestHeaders = {},
    body?: BodyInit | Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    return this.post<T>(url, headers, body);
  }

  static async postToken<T = unknown>(
    url: string,
    headers: RequestHeaders = {},
    body?: BodyInit | Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    return this.post<T>(url, headers, body);
  }

  static async PostToken<T = unknown>(
    url: string,
    headers: RequestHeaders = {},
    body?: BodyInit | Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    return this.postToken<T>(url, headers, body);
  }

  private static async request<T>(
    method: "GET" | "POST",
    url: string,
    headers: RequestHeaders,
    body?: BodyInit | Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    if (!this.client) this.initialize();

    const mergedHeaders = new Headers(this.defaultHeaders);
    new Headers(headers).forEach((value, key) => mergedHeaders.set(key, value));

    try {
      const response = await this.client!(url, {
        method,
        headers: mergedHeaders,
        body: this.serializeBody(body),
      });
      const rawBody = await response.text();
      const message = this.parseBody(rawBody) as T;

      if (!response.ok) {
        return {
          success: false,
          message:
            rawBody && typeof message === "string"
              ? message
              : (`Request failed with status ${response.status}` as T),
          statusCode: response.status,
          client: "",
        };
      }

      return {
        success: true,
        message,
        statusCode: response.status,
      };
    } catch (error) {
      return this.formatErrorResponse<T>(error instanceof Error ? error.message : String(error));
    }
  }

  private static serializeBody(body?: BodyInit | Record<string, unknown>) {
    if (!body || typeof body === "string" || body instanceof FormData || body instanceof Blob) {
      return body as BodyInit | undefined;
    }

    return JSON.stringify(body);
  }

  private static parseBody(body: string): unknown {
    if (!body) return null;

    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  private static formatErrorResponse<T>(errorMessage: string): ApiResponse<T> {
    console.error(errorMessage);
    return {
      success: false,
      message: errorMessage as T,
      client: "",
    };
  }
}
