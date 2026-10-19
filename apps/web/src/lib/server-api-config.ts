import { NextResponse } from "next/server";

export class ApiConfigurationError extends Error {
  readonly statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = "ApiConfigurationError";
  }
}

/**
 * Returns true if the runtime is running in a hosted production or preview environment.
 */
export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")
  );
}

/**
 * Checks if a URL string targets a local loopback interface.
 */
export function isLocalhostUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      parsed.protocol !== "https:"
    );
  } catch {
    return true;
  }
}

/**
 * Resolves the internal API base URL for server-side proxy routes.
 *
 * Strict Production Invariant:
 * - In production (or Vercel), INTERNAL_API_URL MUST be a deployed HTTPS endpoint.
 * - Silent fallbacks to localhost / 127.0.0.1:4000 are strictly forbidden in production.
 * - Fails closed with ApiConfigurationError (HTTP 503) if unconfigured or pointing to localhost.
 */
export function resolveInternalApiUrl(): string {
  const isProd = isProductionRuntime();
  const rawUrl = process.env.INTERNAL_API_URL || process.env.API_BASE_URL;

  if (isProd) {
    if (!rawUrl) {
      throw new ApiConfigurationError(
        "INTERNAL_API_URL is not configured in this production environment. A deployed HTTPS API endpoint is required.",
      );
    }

    const sanitized = rawUrl.trim().replace(/\/+$/, "");

    if (!sanitized.startsWith("https://") || isLocalhostUrl(sanitized)) {
      throw new ApiConfigurationError(
        `Production requires a valid HTTPS deployed API endpoint. Invalid INTERNAL_API_URL: ${sanitized}`,
      );
    }

    return sanitized;
  }

  // Local development runtime only: allow localhost:4000 fallback
  const localUrl = rawUrl || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";

  return localUrl.trim().replace(/\/+$/, "");
}

/**
 * Resolves the demo merchant API key for server-side authentication.
 *
 * In production:
 * - Must be explicitly configured via DEMO_MERCHANT_API_KEY.
 * - Hardcoded fallback is prohibited in production.
 */
export function resolveDemoMerchantApiKey(): string {
  const isProd = isProductionRuntime();
  const configuredKey = process.env.DEMO_MERCHANT_API_KEY;

  if (isProd) {
    if (!configuredKey) {
      throw new ApiConfigurationError(
        "DEMO_MERCHANT_API_KEY is not configured in this production environment.",
      );
    }
    return configuredKey.trim();
  }

  // Local development default
  return configuredKey || "sk_test_payrail_demo_merchant_default_9f8e7d6c5b4a";
}

/**
 * Standard error response formatter for server-side route handlers.
 */
export function formatRouteError(
  error: unknown,
  fallbackMessage: string,
  requestId: string,
): NextResponse {
  if (error instanceof ApiConfigurationError) {
    return NextResponse.json(
      {
        message: "Operations data unavailable",
        detail: error.message,
        configured: false,
      },
      {
        status: error.statusCode,
        headers: {
          "x-request-id": requestId,
          "x-correlation-id": requestId,
        },
      },
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;

  return NextResponse.json(
    {
      message: fallbackMessage,
      detail: message,
    },
    {
      status: 502,
      headers: {
        "x-request-id": requestId,
        "x-correlation-id": requestId,
      },
    },
  );
}
