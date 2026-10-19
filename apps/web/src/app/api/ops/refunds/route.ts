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

    const paymentIntentId = request.nextUrl.searchParams.get("paymentIntentId");
    const query = paymentIntentId ? `?paymentIntentId=${encodeURIComponent(paymentIntentId)}` : "";

    const response = await fetch(`${apiBase}/refunds${query}`, {
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
      "Refund operations unavailable. Could not communicate with upstream refunds service.",
      requestId,
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  try {
    const idempotencyKey =
      request.headers.get("idempotency-key") || `ref_${crypto.randomUUID().replace(/-/g, "")}`;

    const body = await request.json();
    const apiBase = resolveInternalApiUrl();
    const apiKey = resolveDemoMerchantApiKey();

    const response = await fetch(`${apiBase}/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-API-Key": apiKey,
        "X-Request-Id": requestId,
        "X-Correlation-Id": requestId,
      },
      body: JSON.stringify(body),
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
      "Refund processing unavailable. Could not submit refund request.",
      requestId,
    );
  }
}
