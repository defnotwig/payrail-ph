import assert from "node:assert/strict";
import test from "node:test";

import { reviewEvidenceMatches } from "./review-evidence.mjs";

const validEvidence = {
  schemaVersion: 2,
  reviewedBaseSha: "a".repeat(40),
  reviewedDiffSha256: "b".repeat(64),
  reviewer: "codex-subagent/phase01a_review",
  reviewSource: "separate-agent-review",
  reviewReport: "phase-01a-review.md",
  reviewReportSha256: "a".repeat(64),
  reviewedAt: "2026-10-18T00:00:00.000Z",
  verdict: "approve",
  findings: [],
};
const reviewReportText = [
  `Reviewer: ${validEvidence.reviewer}`,
  `Reviewed base SHA: ${validEvidence.reviewedBaseSha}`,
  `Reviewed diff SHA-256: ${validEvidence.reviewedDiffSha256}`,
  "Verdict: APPROVE",
].join("\n");

test("accepts review evidence for the exact base and diff", () => {
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "a".repeat(40),
      diffSha256: "b".repeat(64),
      reportSha256: "a".repeat(64),
      reportText: reviewReportText,
    }),
    true,
  );
});

test("rejects evidence after the base or reviewed diff changes", () => {
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "d".repeat(40),
      diffSha256: "b".repeat(64),
      reportSha256: "a".repeat(64),
      reportText: reviewReportText,
    }),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "a".repeat(40),
      diffSha256: "d".repeat(64),
      reportSha256: "a".repeat(64),
      reportText: reviewReportText,
    }),
    false,
  );
});

test("rejects missing reviewer, non-approved verdict, or unresolved high findings", () => {
  assert.equal(
    reviewEvidenceMatches(
      { ...validEvidence, reviewer: "" },
      {
        baseSha: "a".repeat(40),
        diffSha256: "b".repeat(64),
        reportSha256: "a".repeat(64),
        reportText: reviewReportText,
      },
    ),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(
      { ...validEvidence, verdict: "request_changes" },
      {
        baseSha: "a".repeat(40),
        diffSha256: "b".repeat(64),
        reportSha256: "a".repeat(64),
        reportText: reviewReportText,
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
        baseSha: "a".repeat(40),
        diffSha256: "b".repeat(64),
        reportSha256: "a".repeat(64),
        reportText: reviewReportText,
      },
    ),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "a".repeat(40),
      diffSha256: "b".repeat(64),
      reportSha256: "b".repeat(64),
      reportText: reviewReportText,
    }),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "a".repeat(40),
      diffSha256: "b".repeat(64),
      reportSha256: "a".repeat(64),
      reportText: reviewReportText.replace("Verdict: APPROVE", "Verdict: REQUEST_CHANGES"),
    }),
    false,
  );
  assert.equal(
    reviewEvidenceMatches(validEvidence, {
      baseSha: "a".repeat(40),
      diffSha256: "b".repeat(64),
      reportSha256: "a".repeat(64),
      reportText: `${reviewReportText}\nVerdict: REQUEST_CHANGES`,
    }),
    false,
  );
});
