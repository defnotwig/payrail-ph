import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApplication } from "./bootstrap";
import type { IncomingMessage, ServerResponse } from "node:http";

let cachedHandler: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
    rawBody: true,
  });
  configureApplication(app);
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  const matchedPath = (req.headers["x-matched-path"] || req.headers["x-invoke-path"]) as
    | string
    | undefined;
  if (matchedPath && req.url === "/api") {
    req.url = matchedPath;
  }
  return cachedHandler?.(req, res);
}
