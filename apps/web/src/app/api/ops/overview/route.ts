import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiBase = (
      process.env.INTERNAL_API_URL ||
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");

    const apiKey =
      process.env.DEMO_MERCHANT_API_KEY || "sk_test_payrail_demo_merchant_default_9f8e7d6c5b4a";

    const requestId =
      request.headers.get("x-request-id") ||
      request.headers.get("x-correlation-id") ||
      crypto.randomUUID();

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
    const message =
      error instanceof Error ? error.message : "Failed to communicate with operations service";
    return NextResponse.json(
      {
        message: "We couldn't reach the operations service.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
