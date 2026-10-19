import { type NextRequest, NextResponse } from "next/server";
import {
  resolveInternalApiUrl,
  resolveDemoMerchantApiKey,
  formatRouteError,
} from "../../../../lib/server-api-config";

export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  try {
    const apiBase = resolveInternalApiUrl();
    const apiKey = resolveDemoMerchantApiKey();

    const period = request.nextUrl.searchParams.get("period") || "today";

    const response = await fetch(`${apiBase}/ops/overview?period=${encodeURIComponent(period)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey,
        "X-Request-Id": requestId,
        "X-Correlation-Id": requestId,
      },
    });

    const data = await response.json().catch(() => ({}));

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "x-request-id": requestId,
        "x-correlation-id": requestId,
      },
    });
  } catch (error) {
    return formatRouteError(
      error,
      "Operations data unavailable. We can't reach the PayRail API right now. Payment data may be delayed.",
      requestId,
    );
  }
}
