import { describe, expect, it, vi } from "vitest";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports ready only after the database answers SELECT 1", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
    const service = new HealthService({ query } as never);

    await expect(service.isReady()).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("keeps readiness false and contains database failures", async () => {
    const query = vi.fn().mockRejectedValue(new Error("private connection string"));
    const service = new HealthService({ query } as never);

    await expect(service.isReady()).resolves.toBe(false);
  });
});
