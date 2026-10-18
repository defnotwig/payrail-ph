import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { parseEnvironment } from "./config/environment";
export function configureApplication(app: INestApplication): void {
  const environment = parseEnvironment(process.env);
  app.enableShutdownHooks();
  app.use(
    (
      _request: unknown,
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
      response.setHeader("X-Request-Id", randomUUID());
      next();
    },
  );
  app.enableCors({
    origin: environment.WEB_ORIGIN,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Idempotency-Key",
      "Authorization",
      "X-Merchant-Id",
      "X-API-Key",
    ],
    credentials: false,
  });
  SwaggerModule.setup("openapi", app, createOpenApiDocument(app), {
    ui: false,
    raw: ["json"],
    jsonDocumentUrl: "openapi.json",
  });
}
export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("PayRail PH sandbox operator API")
    .setVersion("1.0.0")
    .setDescription(
      "Sandbox only. Operator JWT and current database membership authorize administrative routes; test merchant keys authorize explicitly scoped payment routes. No PAN/CVV accepted.",
    )
    .addBearerAuth()
    .addApiKey({ type: "apiKey", in: "header", name: "X-API-Key" }, "merchantKey")
    .build();
  return SwaggerModule.createDocument(app, config);
}
