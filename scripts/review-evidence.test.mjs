import assert from "node:assert/strict";
import test from "node:test";

import { reviewEvidenceMatches } from "./review-evidence.mjs";

const validEvidence = {
  schemaVersion: 1,
  reviewedBaseSha: "base-sha",
  reviewedDiffSha256: "diff-sha",
  reviewer: "codex/independent-reviewer",
  reviewedAt: "2026-10-18T00:00:00.000Z",
  verdict: "approve",
  findings: [],
};

test("accepts review evidence for the exact base and diff", () => {
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "base-sha",
      diffSha256: "diff-sha",
    }),
    true,
  );
});

test("rejects evidence after the base or reviewed diff changes", () => {
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "new-base-sha",
      diffSha256: "diff-sha",
    }),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "base-sha",
      diffSha256: "new-diff-sha",
    }),
    false,
  );
});

test("rejects missing reviewer, non-approved verdict, or unresolved high findings", () => {
  assert.equal(
    reviewEvidenceMatches(
      { ...validEvidence, reviewer: "" },
      {
        baseSha: "base-sha",
        diffSha256: "diff-sha",
      },
    ),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(
      { ...validEvidence, verdict: "request_changes" },
      {
        baseSha: "base-sha",
        diffSha256: "diff-sha",
      },
    ),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(
      {
        ...validEvidence,
        findings: [{ severity: "high", status: "open" }],
      },
      {
        baseSha: "base-sha",
        diffSha256: "diff-sha",
      },
    ),
    false,
  );
});
