import { Global, Module } from "@nestjs/common";
import { PG_POOL } from "./database.constants";
import { DatabasePool } from "./database.pool";

@Global()
@Module({
  providers: [DatabasePool, { provide: PG_POOL, useExisting: DatabasePool }],
  exports: [PG_POOL],
})
export class DatabaseModule {}
