import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "../database/database.constants";

@Injectable()
export class HealthService {
  constructor(@Inject(PG_POOL) private readonly _pool: Pick<Pool, "query">) {}

  async isReady(): Promise<boolean> {
    try {
      await this._pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
