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
    const message =
      error instanceof Error ? error.message : "Failed to communicate with durable jobs service";
    return NextResponse.json(
      {
        message: "We couldn't reach the durable jobs service.",
        detail: message,
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
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
    const message = error instanceof Error ? error.message : "Failed to replay dead letter item";
    return NextResponse.json(
      {
        message: "We couldn't replay the dead letter job.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
