import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function reviewEvidenceMatches(evidence, { baseSha, diffSha256 }) {
  if (!evidence || typeof evidence !== "object") return false;
  if (evidence.schemaVersion !== 1) return false;
  if (evidence.reviewedBaseSha !== baseSha) return false;
  if (evidence.reviewedDiffSha256 !== diffSha256) return false;
  if (typeof evidence.reviewer !== "string" || !evidence.reviewer.startsWith("codex/")) {
    return false;
  }
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
      if (reviewEvidenceMatches(evidence, { baseSha, diffSha256 })) {
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
      `No independent approval matches base ${baseSha} and diff SHA-256 ${diffSha256}.`,
    );
    return 1;
  }

  console.log(
    `Review evidence matches the current diff: ${evidence.reviewer} at ${evidence.reviewedAt}.`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runReviewEvidenceCheck();
}
