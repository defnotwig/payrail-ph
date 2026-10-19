import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    const apiBase = (
      process.env.INTERNAL_API_URL ||
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");

    const isLocalOrTest =
      process.env.NODE_ENV === "test" ||
      process.env.APP_ENV === "local" ||
      (!process.env.VERCEL && !process.env.APP_ENV);

    const apiKey =
      process.env.DEMO_MERCHANT_API_KEY ||
      (isLocalOrTest ? "sk_test_payrail_demo_merchant_default_9f8e7d6c5b4a" : undefined);

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "CONFIGURATION_ERROR",
          message:
            "Demo merchant credentials (DEMO_MERCHANT_API_KEY) are not configured in this environment.",
        },
        { status: 503 },
      );
    }

    const requestId =
      request.headers.get("x-request-id") ||
      request.headers.get("x-correlation-id") ||
      crypto.randomUUID();

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
    const message =
      error instanceof Error ? error.message : "Failed to communicate with payment service";
    return NextResponse.json(
      {
        message: "We couldn't reach the sandbox payment service. Polling will retry.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
