import "reflect-metadata";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { parseEnvironment } from "./config/environment";

async function bootstrap() {
  const rootEnvironmentFile = resolve(process.cwd(), "../../.env");
  if (existsSync(rootEnvironmentFile)) {
    process.loadEnvFile(rootEnvironmentFile);
  }

  const environment = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  app.enableShutdownHooks();
  app.enableCors({ origin: environment.WEB_ORIGIN, methods: ["GET"], credentials: false });
  await app.listen(environment.API_PORT, "0.0.0.0");
}

void bootstrap();
