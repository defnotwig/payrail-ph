import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { parseEnvironment } from "../config/environment";

@Injectable()
export class DatabasePool extends Pool implements OnModuleDestroy {
  constructor() {
    const { DATABASE_URL } = parseEnvironment(process.env);
    super({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 1_000,
      keepAlive: true,
    });

    this.on("error", () => {
      // Keep pool errors out of public health responses and credential-bearing logs.
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.end();
  }
}
