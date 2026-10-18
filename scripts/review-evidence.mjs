import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export function reviewEvidenceMatches(evidence, { baseSha, diffSha256, reportSha256, reportText }) {
  if (!evidence || typeof evidence !== "object") return false;
  if (evidence.schemaVersion !== 2) return false;
  if (!/^[a-f0-9]{40}$/.test(baseSha)) return false;
  if (!/^[a-f0-9]{64}$/.test(diffSha256)) return false;
  if (evidence.reviewedBaseSha !== baseSha) return false;
  if (evidence.reviewedDiffSha256 !== diffSha256) return false;
  if (
    typeof evidence.reviewer !== "string" ||
    !/^codex-subagent\/[a-z0-9_-]+$/.test(evidence.reviewer)
  )
    return false;
  if (evidence.reviewSource !== "separate-agent-review") return false;
  if (typeof evidence.reviewReport !== "string" || !/^[a-z0-9-]+\.md$/.test(evidence.reviewReport))
    return false;
  if (
    typeof evidence.reviewReportSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(evidence.reviewReportSha256)
  )
    return false;
  if (!/^[a-f0-9]{64}$/.test(reportSha256) || evidence.reviewReportSha256 !== reportSha256)
    return false;
  const requiredReportLines = [
    `Reviewer: ${evidence.reviewer}`,
    `Reviewed base SHA: ${baseSha}`,
    `Reviewed diff SHA-256: ${diffSha256}`,
    "Verdict: APPROVE",
  ];
  if (typeof reportText !== "string") return false;
  const reportLines = reportText.split(/\r?\n/);
  if (
    requiredReportLines.some(
      (expected) => reportLines.filter((line) => line === expected).length !== 1,
    )
  )
    return false;
  const metadataPrefixes = [
    "Reviewer: ",
    "Reviewed base SHA: ",
    "Reviewed diff SHA-256: ",
    "Verdict: ",
  ];
  if (
    metadataPrefixes.some(
      (prefix) => reportLines.filter((line) => line.startsWith(prefix)).length !== 1,
    )
  )
    return false;
  if (evidence.verdict !== "approve") return false;
  if (typeof evidence.reviewedAt !== "string" || Number.isNaN(Date.parse(evidence.reviewedAt))) {
    return false;
  }
  if (!Array.isArray(evidence.findings)) return false;

  return evidence.findings.every((finding) => {
    if (!finding || typeof finding !== "object") return false;
    const highSeverity = ["critical", "high"].includes(String(finding.severity).toLowerCase());
    const resolved = ["fixed", "mitigated", "not_applicable"].includes(
      String(finding.status).toLowerCase(),
    );
    return !highSeverity || resolved;
  });
}

export function calculateReviewDiffSha256(baseSha, headSha) {
  const diff = execFileSync(
    "git",
    ["diff", "--binary", baseSha, headSha, "--", ".", ":(exclude)harness/code_review/**"],
    { encoding: "buffer", stdio: ["ignore", "pipe", "pipe"] },
  );
  return createHash("sha256").update(diff).digest("hex");
}

export function findMatchingReviewEvidence({ baseSha, headSha, root = process.cwd() }) {
  const evidenceRoot = resolve(root, "harness/code_review/reviews");
  const diffSha256 = calculateReviewDiffSha256(baseSha, headSha);
  let names;
  try {
    names = readdirSync(evidenceRoot).filter((name) => name.endsWith(".json"));
  } catch {
    return { diffSha256, evidence: null };
  }

  for (const name of names) {
    try {
      const evidence = JSON.parse(readFileSync(resolve(evidenceRoot, name), "utf8"));
      const reportPath = resolve(evidenceRoot, evidence.reviewReport ?? "");
      if (!reportPath.startsWith(`${evidenceRoot}${sep}`)) continue;
      const reportText = readFileSync(reportPath, "utf8");
      const reportSha256 = createHash("sha256").update(reportText).digest("hex");
      if (reviewEvidenceMatches(evidence, { baseSha, diffSha256, reportSha256, reportText })) {
        return { diffSha256, evidence };
      }
    } catch {
      // Ignore malformed records; only valid review evidence can satisfy the check.
    }
  }

  return { diffSha256, evidence: null };
}

export function runReviewEvidenceCheck(env = process.env) {
  const baseSha = env.PR_BASE_SHA;
  const headSha = env.PR_HEAD_SHA;
  if (!baseSha || !headSha) {
    console.error("Review evidence requires the pull request base and head revisions.");
    return 1;
  }

  const { diffSha256, evidence } = findMatchingReviewEvidence({ baseSha, headSha });
  if (!evidence) {
    console.error(
      `No separate-agent review report matches base ${baseSha} and diff SHA-256 ${diffSha256}.`,
    );
    return 1;
  }

  console.log(
    `Codex review record and report match the current diff: ${evidence.reviewer} at ${evidence.reviewedAt}.`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runReviewEvidenceCheck();
}
