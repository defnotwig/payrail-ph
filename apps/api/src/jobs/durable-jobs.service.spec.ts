import { describe, it, expect, vi, beforeEach } from "vitest";
import { DurableJobsService } from "./durable-jobs.service";
import type { DatabasePool } from "../database/database.pool";
import { NotFoundException } from "@nestjs/common";

describe("DurableJobsService", () => {
  let service: DurableJobsService;
  let mockDb: { connect: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    };
    service = new DurableJobsService(mockDb as unknown as DatabasePool);
  });

  describe("Claiming & Leases", () => {
    it("claims pending jobs with FOR UPDATE SKIP LOCKED and increments attempt_count", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("WITH claimable AS")) {
          return Promise.resolve({
            rows: [
              {
                id: "job-1",
                job_type: "OUTBOX_DISPATCH",
                payload: { eventId: "evt-1" },
                state: "CLAIMED",
                attempt_count: 1,
                max_attempts: 5,
                next_attempt_at: new Date(),
                locked_by: "worker-1",
                locked_until: new Date(Date.now() + 30000),
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const jobs = await service.claimJobs("worker-1", 5, 30);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.id).toBe("job-1");
      expect(jobs[0]?.state).toBe("CLAIMED");
      expect(jobs[0]?.lockedBy).toBe("worker-1");
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });
  });

  describe("Failures & DLQ Routing", () => {
    it("schedules exponential retry when attempts are below max", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, job_type, payload, attempt_count")) {
          return Promise.resolve({
            rows: [
              {
                id: "job-1",
                job_type: "WEBHOOK_DELIVERY",
                payload: { url: "https://merchant.com" },
                attempt_count: 2,
                max_attempts: 5,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await service.failJob("job-1", "worker-1", "claim-1", new Error("503 Gateway Timeout"), true);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET state = 'RETRY_SCHEDULED'"),
        expect.any(Array),
      );
    });

    it("routes job to DEAD_LETTER when max attempts are reached", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, job_type, payload, attempt_count")) {
          return Promise.resolve({
            rows: [
              {
                id: "job-1",
                job_type: "WEBHOOK_DELIVERY",
                payload: { url: "https://merchant.com", merchantId: "merchant_test" },
                attempt_count: 5, // At max attempts
                max_attempts: 5,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await service.failJob(
        "job-1",
        "worker-1",
        "claim-1",
        new Error("Persistent 500 error"),
        true,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET state = 'DEAD_LETTER'"),
        expect.any(Array),
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payrail_private.dead_letter_queue"),
        expect.any(Array),
      );
    });
  });

  describe("DLQ Replay", () => {
    it("replays a dead letter job, marks it replayed, and creates audit log", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, job_type, payload FROM payrail_private.dead_letter_queue")) {
          return Promise.resolve({
            rows: [
              {
                id: "dlq-1",
                job_type: "WEBHOOK_DELIVERY",
                payload: { url: "https://merchant.com" },
              },
            ],
          });
        }
        if (sql.includes("INSERT INTO payrail_private.durable_jobs")) {
          return Promise.resolve({
            rows: [{ id: "new-job-100" }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const newJobId = await service.replayDeadLetter("dlq-1", "operator-ops");

      expect(newJobId).toBe("new-job-100");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE payrail_private.dead_letter_queue"),
        ["operator-ops", "dlq-1"],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payrail_private.audit_events"),
        expect.any(Array),
      );
    });

    it("throws NotFoundException if DLQ item does not exist", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, job_type, payload FROM payrail_private.dead_letter_queue")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(service.replayDeadLetter("dlq-missing", "operator-ops")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
