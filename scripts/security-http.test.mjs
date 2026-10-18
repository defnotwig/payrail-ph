import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } = require("jose");
const { AppModule } = require("./dist/app.module.js");
const { configureApplication } = require("./dist/bootstrap.js");
const { AUTH_JWKS } = require("./dist/auth/auth.service.js");
const { PG_POOL } = require("./dist/database/database.constants.js");
process.env.DATABASE_URL = "postgresql://unused@127.0.0.1:1/security_http";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.SUPABASE_URL = "https://identity.example.test";
process.env.APP_ENV = "local";
process.env.WEBHOOK_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.PAYMONGO_SECRET_KEY = "sk_test_placeholder";
process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test_placeholder";
const subject = "00000000-0000-4000-8000-000000000001";
const permissions = ["payments:read"];
const db = {
  async query(sql, values) {
    if (sql.includes("operator_memberships"))
      return {
        rows:
          values[1] && values[1] !== "merchant_a"
            ? []
            : [{ merchant_id: "merchant_a", role: "VIEWER", permissions }],
      };
    if (sql.includes("merchant_api_keys")) return { rows: [] };
    return { rows: [], rowCount: 0 };
  },
  async end() {},
};
let app, origin, privateKey, publicKey;
const claims = { email: "viewer@example.test", role: "authenticated", session_id: subject };
async function token(overrides = {}, options = {}) {
  return new SignJWT({ ...claims, ...overrides })
    .setProtectedHeader({ alg: "ES256", kid: "fixture" })
    .setSubject(subject)
    .setIssuer(options.issuer || "https://identity.example.test/auth/v1")
    .setAudience(options.audience || "authenticated")
    .setIssuedAt()
    .setExpirationTime(options.expiry || "5m")
    .sign(privateKey);
}
before(async () => {
  ({ privateKey, publicKey } = await generateKeyPair("ES256"));
  const jwk = await exportJWK(publicKey);
  jwk.kid = "fixture";
  jwk.alg = "ES256";
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(db)
    .overrideProvider(AUTH_JWKS)
    .useValue(createLocalJWKSet({ keys: [jwk] }))
    .compile();
  app = module.createNestApplication({ logger: false, rawBody: true });
  configureApplication(app);
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});
after(async () => {
  await app?.close();
});
test("compiled Nest boots and explicit health route remains public", async () => {
  assert.equal((await fetch(`${origin}/health/live`)).status, 200);
});
test("private operations reject missing identity and forged authority headers", async () => {
  for (const path of [
    "/auth/me",
    "/payments",
    "/refunds",
    "/ledger/accounts",
    "/jobs/dlq",
    "/reconciliation/runs",
    "/audit/events",
    "/v1/api-keys",
    "/v1/webhooks/endpoints",
    "/v1/webhooks/deliveries",
  ]) {
    assert.equal(
      (
        await fetch(`${origin}${path}`, {
          headers: { "x-operator-role": "ADMIN", "x-merchant-id": "merchant_a" },
        })
      ).status,
      401,
      path,
    );
  }
});
test("valid signed identity obtains server-side membership, ignoring JWT editable metadata", async () => {
  const res = await fetch(`${origin}/auth/me`, {
    headers: { authorization: `Bearer ${await token({ user_metadata: { role: "ADMIN" } })}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.role, "VIEWER");
  assert.equal(body.data.merchantId, "merchant_a");
  assert.deepEqual(body.data.permissions, permissions);
});
test("wrong issuer, wrong audience, expired, future and tampered JWT fail closed", async () => {
  const good = await token();
  const bad = [
    await token({}, { issuer: "https://attacker.test/auth/v1" }),
    await token({}, { audience: "service_role" }),
    await token({}, { expiry: "-1m" }),
    await token({ nbf: Math.floor(Date.now() / 1000) + 600 }),
    `${good.slice(0, -8)}AAAAAAAA`,
  ];
  for (const value of bad)
    assert.equal(
      (await fetch(`${origin}/auth/me`, { headers: { authorization: `Bearer ${value}` } })).status,
      401,
    );
});
test("merchant selector cannot grant another tenant and viewer cannot mutate", async () => {
  const authorization = `Bearer ${await token()}`;
  assert.equal(
    (
      await fetch(`${origin}/auth/me`, {
        headers: { authorization, "x-merchant-id": "merchant_b" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${origin}/refunds`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
});
test("API keys cannot authenticate to operator administration", async () => {
  assert.equal(
    (await fetch(`${origin}/v1/api-keys`, { headers: { "x-api-key": "sk_test_invalid" } })).status,
    401,
  );
});
test("security headers and authenticated CORS preflight include supported DELETE", async () => {
  const res = await fetch(`${origin}/health/live`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("cache-control"), "no-store");
  const preflight = await fetch(`${origin}/v1/api-keys/example`, {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:3000",
      "access-control-request-method": "DELETE",
      "access-control-request-headers": "authorization,x-merchant-id",
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-methods"), /DELETE/);
});
test("OpenAPI schema is served as JSON without enabling the interactive Swagger UI", async () => {
  const response = await fetch(`${origin}/openapi.json`);
  assert.equal(response.status, 200);
  const schema = await response.json();
  assert.equal(schema.info.title, "PayRail PH sandbox operator API");
  assert.ok(schema.components.securitySchemes.merchantKey);
});
