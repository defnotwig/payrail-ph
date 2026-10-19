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

    const response = await fetch(`${apiBase}/ops/jobs`, {
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
      "Durable jobs service unavailable. Could not fetch active jobs and dead-letter queue records.",
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
    const apiBase = resolveInternalApiUrl();
    const apiKey = resolveDemoMerchantApiKey();

    const body = await request.json().catch(() => ({}));
    const dlqId = typeof body.id === "string" ? body.id : "";

    if (!dlqId) {
      return NextResponse.json({ message: "DLQ ID is required" }, { status: 400 });
    }

    const response = await fetch(`${apiBase}/ops/jobs/dlq/${encodeURIComponent(dlqId)}/replay`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
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
      "Dead letter replay failed. Could not communicate with durable jobs service.",
      requestId,
    );
  }
}
