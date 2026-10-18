import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { parseEnvironment } from "./config/environment";
import type { IncomingMessage, ServerResponse } from "node:http";

let cachedHandler: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;

async function bootstrap() {
  const env = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
    rawBody: true,
  });
  app.enableShutdownHooks();
  app.enableCors({
    origin: env.WEB_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Idempotency-Key",
      "idempotency-key",
      "Authorization",
      "paymongo-signature",
    ],
    credentials: false,
  });
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  return cachedHandler?.(req, res);
}
