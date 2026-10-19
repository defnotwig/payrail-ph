import { type NextRequest, NextResponse } from "next/server";
import {
  resolveInternalApiUrl,
  resolveDemoMerchantApiKey,
  formatRouteError,
} from "../../../../lib/server-api-config";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    const apiBase = resolveInternalApiUrl();
    const apiKey = resolveDemoMerchantApiKey();

    const isInvestigation = request.nextUrl.searchParams.get("investigation") === "true";
    const targetUrl = isInvestigation
      ? `${apiBase}/payments/${encodeURIComponent(id)}/investigation`
      : `${apiBase}/payments/${encodeURIComponent(id)}`;

    const response = await fetch(targetUrl, {
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
      "We couldn't reach the sandbox payment service. Polling will retry.",
      requestId,
    );
  }
}
