import { describe, it, expect, vi } from "vitest";
import { DurableJobsService } from "./durable-jobs.service";
import type { DatabasePool } from "../database/database.pool";
import type { PoolClient } from "pg";

describe("Jobs Concurrency & Fencing Invariants", () => {
  describe("Lease Fencing & Stale Worker Token Rejection", () => {
    it("rejects completion and failure from a stale worker whose lease expired or whose fencing token was superseded", async () => {
      const jobId = "job_fenced_100";
      const tokenWorker1 = "fencing-token-worker-1";
      const tokenWorker2 = "fencing-token-worker-2";

      // Simulated database state for job
      const currentLockedBy = "worker-2"; // Worker 2 has reclaimed the job
      const currentClaimToken = tokenWorker2; // New token issued to Worker 2
      let currentState = "CLAIMED";

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (
            sql.includes("UPDATE payrail_private.durable_jobs") &&
            sql.includes("SET state = 'COMPLETED'")
          ) {
            const [, workerId, claimToken] = params as [string, string, string];
            if (workerId === currentLockedBy && claimToken === currentClaimToken) {
              currentState = "COMPLETED";
              return { rowCount: 1, rows: [] };
            }
            // Stale worker or expired token does not match active claim
            return { rowCount: 0, rows: [] };
          }

          if (sql.includes("SELECT id, job_type, payload, attempt_count, max_attempts")) {
            const [, workerId, claimToken] = params as [string, string, string];
            if (workerId === currentLockedBy && claimToken === currentClaimToken) {
              return {
                rows: [
                  {
                    id: jobId,
                    job_type: "OUTBOX_DISPATCH",
                    payload: {},
                    attempt_count: 1,
                    max_attempts: 5,
                  },
                ],
              };
            }
            return { rows: [] };
          }

          return { rowCount: 1, rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          return mockClient.query(sql, params);
        }),
      } as unknown as DatabasePool;

      const jobsService = new DurableJobsService(mockPool);

      // 1. Worker 1 (stale) attempts to complete the job with its old claim token
      await expect(jobsService.completeJob(jobId, "worker-1", tokenWorker1)).rejects.toThrow(
        "Job claim is stale or not owned by this worker",
      );

      // 2. Worker 1 (stale) attempts to fail the job with its old claim token
      await expect(
        jobsService.failJob(jobId, "worker-1", tokenWorker1, "Worker 1 transient failure"),
      ).rejects.toThrow("Job claim is stale or not owned by this worker");

      // 3. Worker 2 (active owner) completes the job with valid fencing token
      await expect(
        jobsService.completeJob(jobId, "worker-2", tokenWorker2),
      ).resolves.toBeUndefined();

      expect(currentState).toBe("COMPLETED");
    });
  });

  describe("Concurrent Job Claiming with SKIP LOCKED", () => {
    it("ensures concurrent workers claim distinct jobs with unique fencing tokens without overlap", async () => {
      const availableJobIds = ["job-1", "job-2", "job-3", "job-4"];
      const claimedJobs = new Map<string, { workerId: string; token: string }>();

      const createClient = (): PoolClient => {
        return {
          query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes("WITH claimable AS")) {
              const [, workerId] = params as [number, string, number];
              // Pop one unclaimed job
              const unassigned = availableJobIds.filter((id) => !claimedJobs.has(id));
              if (unassigned.length === 0) {
                return { rows: [] };
              }
              const claimedId = unassigned[0];
              if (!claimedId) {
                return { rows: [] };
              }
              const token = `token-${claimedId}-${workerId}`;
              claimedJobs.set(claimedId, { workerId, token });

              return {
                rows: [
                  {
                    id: claimedId,
                    job_type: "PROCESS_PAYMENT",
                    payload: {},
                    state: "CLAIMED",
                    attempt_count: 1,
                    max_attempts: 3,
                    next_attempt_at: new Date(),
                    locked_by: workerId,
                    claim_token: token,
                    locked_until: new Date(Date.now() + 30000),
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                ],
              };
            }
            return { rowCount: 1, rows: [] };
          }),
          release: vi.fn(),
        } as unknown as PoolClient;
      };

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => createClient()),
        query: vi.fn(),
      } as unknown as DatabasePool;

      const jobsService = new DurableJobsService(mockPool);

      // Launch 4 concurrent workers attempting to claim jobs
      const [workerA, workerB, workerC, workerD] = await Promise.all([
        jobsService.claimJobs("worker-A", 1, 30),
        jobsService.claimJobs("worker-B", 1, 30),
        jobsService.claimJobs("worker-C", 1, 30),
        jobsService.claimJobs("worker-D", 1, 30),
      ]);

      const allClaimed = [...workerA, ...workerB, ...workerC, ...workerD];
      const claimedIds = allClaimed.map((j) => j.id);
      const claimedTokens = allClaimed.map((j) => j.claimToken);

      // 4 distinct jobs claimed, no duplicates
      expect(new Set(claimedIds).size).toBe(4);
      expect(new Set(claimedTokens).size).toBe(4);
    });
  });
});
