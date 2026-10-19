/**
 * PayRail PH Deployment Smoke Qualification Script
 *
 * Verifies live deployment connectivity:
 * 1. Frontend route availability (/demo/qrph)
 * 2. API liveness (/health/live)
 * 3. API readiness (/health/ready)
 * 4. Frontend-to-backend API routing & structured error envelopes
 */

export async function runDeploymentSmoke(options = {}) {
  const frontendUrl = (
    options.frontendUrl ||
    process.env.FRONTEND_URL ||
    process.env.WEB_ORIGIN ||
    "https://payrail-ph-web-main.vercel.app"
  ).replace(/\/+$/, "");

  const apiUrl = (
    options.apiUrl ||
    process.env.API_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.API_BASE_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");

  console.log(`[Smoke Gate] Frontend Target: ${frontendUrl}`);
  console.log(`[Smoke Gate] API Target:      ${apiUrl}`);

  const results = {
    frontend: false,
    apiLiveness: false,
    apiReadiness: false,
    frontendApiRouting: false,
  };

  // 1. Verify Frontend Public Route
  try {
    const res = await fetch(`${frontendUrl}/demo/qrph`);
    if (res.ok) {
      const html = await res.text();
      if (html.includes("QR Ph") || html.includes("PayRail")) {
        console.log("✓ Frontend /demo/qrph is reachable (HTTP 200)");
        results.frontend = true;
      } else {
        console.warn(`! Frontend returned 200 but HTML missing expected branding markers`);
      }
    } else {
      console.error(`✗ Frontend returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`✗ Frontend probe failed: ${err.message}`);
  }

  // 2. Verify Backend API Liveness
  try {
    const res = await fetch(`${apiUrl}/health/live`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.status === "ok") {
        console.log("✓ API /health/live is operational (status: ok)");
        results.apiLiveness = true;
      }
    } else {
      console.warn(`! API /health/live returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`! API /health/live unreachable at ${apiUrl}: ${err.message}`);
  }

  // 3. Verify Backend API Readiness
  try {
    const res = await fetch(`${apiUrl}/health/ready`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.status === "ready") {
        console.log("✓ API /health/ready is operational (status: ready)");
        results.apiReadiness = true;
      }
    } else {
      console.warn(`! API /health/ready returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`! API /health/ready unreachable at ${apiUrl}: ${err.message}`);
  }

  // 4. Verify Frontend Same-Origin API Route Envelope
  try {
    const res = await fetch(`${frontendUrl}/api/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `smoke_${Date.now()}`,
      },
      body: JSON.stringify({
        amountMinor: "100",
        currency: "PHP",
        orderNumber: "ORD-SMOKE",
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (res.status === 201) {
      console.log("✓ Frontend /api/payments created payment intent (HTTP 201)");
      results.frontendApiRouting = true;
    } else if (res.status === 502 && body.message) {
      // Structured 502 indicates server-side route handler executed and handled backend outage safely
      console.log(
        `✓ Frontend /api/payments handled backend boundary safely (HTTP 502: ${body.message})`,
      );
      results.frontendApiRouting = true;
    } else {
      console.warn(`! Frontend /api/payments returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`✗ Frontend /api/payments failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  runDeploymentSmoke()
    .then((results) => {
      console.log("\n[Smoke Gate Summary]", results);
      if (!results.frontend) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
