import assert from "node:assert/strict";
import test from "node:test";

import {
  isConventionalCommitSubject,
  isConventionalMergeCommitSubject,
  isConventionalPullRequestTitle,
  isCommitRangeValid,
  isPromotionAllowed,
  isProductionApiTargetValid,
} from "./repo-policy.mjs";

test("accepts the approved Conventional Commit types and optional scopes", () => {
  for (const subject of [
    "feat(money): add bigint PHP primitives",
    "fix(jobs): reject stale worker commits",
    "docs: explain local setup",
    "revert(api)!: remove unsafe endpoint",
  ]) {
    assert.equal(isConventionalCommitSubject(subject), true, subject);
  }
});

test("rejects malformed, unknown, and empty commit subjects", () => {
  for (const subject of [
    "Add payment support",
    "feature(payments): add QR",
    "feat(): add payment",
    "feat(payments): ",
    " feat(payments): add payment",
  ]) {
    assert.equal(isConventionalCommitSubject(subject), false, subject);
  }
});

test("requires merge commit subjects to use Conventional Commits and end with a PR number", () => {
  assert.equal(isConventionalMergeCommitSubject("docs(repo): bootstrap workflow (#12)"), true);
  assert.equal(
    isConventionalMergeCommitSubject("docs(repo): bootstrap workflow (#12) (#12)"),
    false,
  );
  assert.equal(isConventionalMergeCommitSubject("docs(repo): bootstrap workflow"), false);
  assert.equal(isConventionalMergeCommitSubject("Merge pull request #12 from owner/branch"), false);
});

test("requires PR titles to be Conventional Commit subjects without a duplicated PR number", () => {
  assert.equal(isConventionalPullRequestTitle("feat(money): add PHP primitives"), true);
  assert.equal(isConventionalPullRequestTitle("feat(money): add PHP primitives (#7)"), false);
  assert.equal(isConventionalPullRequestTitle("feat(money): add (#7) PHP primitives"), false);
  assert.equal(isConventionalPullRequestTitle("Add PHP primitives"), false);
});

test("PR commit-range validation includes existing merge commits", () => {
  assert.equal(
    isCommitRangeValid([
      { subject: "feat(money): add PHP primitives", parentCount: 1 },
      { subject: "docs(repo): synchronize dev (#12)", parentCount: 2 },
    ]),
    true,
  );
  assert.equal(
    isCommitRangeValid([
      { subject: "feat(money): add PHP primitives", parentCount: 1 },
      { subject: "Merge pull request #12 from owner/branch", parentCount: 2 },
    ]),
    false,
  );
});

test("allows only the preserved Phase 01A merge commit as a duplicate-number legacy exception", () => {
  const legacySubject = "docs(repo): establish public collaboration and CI policy (#1) (#1)";
  assert.equal(
    isCommitRangeValid([
      { sha: "3c62834af3160c5b1e212e02b2e04b8b316c98a8", subject: legacySubject, parentCount: 2 },
    ]),
    true,
  );
  assert.equal(
    isCommitRangeValid([
      { sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", subject: legacySubject, parentCount: 2 },
    ]),
    false,
  );
});

test("allows only the documented promotion flow and urgent fixes", () => {
  assert.equal(isPromotionAllowed("personal/defnotwig", "dev"), true);
  assert.equal(isPromotionAllowed("dev", "staging"), true);
  assert.equal(isPromotionAllowed("staging", "main"), true);
  assert.equal(isPromotionAllowed("fix/provider-outage", "main"), true);
  assert.equal(isPromotionAllowed("codex/paymo-financial", "personal/defnotwig"), true);
  assert.equal(isPromotionAllowed("codex/paymo-product", "personal/defnotwig"), true);
  assert.equal(isPromotionAllowed("codex/paymo-security", "personal/defnotwig"), true);
  assert.equal(isPromotionAllowed("codex/paymo-unrelated", "personal/defnotwig"), false);
  assert.equal(isPromotionAllowed("codex/paymo-financial", "dev"), false);
  assert.equal(isPromotionAllowed("main", "dev"), false);
  assert.equal(isPromotionAllowed("dev", "main"), false);
  assert.equal(isPromotionAllowed("topic/money", "staging"), false);
});

test("production web configuration must not resolve internal API to localhost", () => {
  const prodEnv = { NODE_ENV: "production", APP_ENV: "production", VERCEL: "1" };
  const devEnv = { NODE_ENV: "development", APP_ENV: "development" };

  // Local development allows localhost
  assert.equal(isProductionApiTargetValid("http://127.0.0.1:4000", devEnv), true);
  assert.equal(isProductionApiTargetValid("http://localhost:4000", devEnv), true);

  // Production disallows missing / undefined URL
  assert.equal(isProductionApiTargetValid(undefined, prodEnv), false);
  assert.equal(isProductionApiTargetValid("", prodEnv), false);

  // Production disallows localhost loopback
  assert.equal(isProductionApiTargetValid("http://127.0.0.1:4000", prodEnv), false);
  assert.equal(isProductionApiTargetValid("http://localhost:4000", prodEnv), false);
  assert.equal(isProductionApiTargetValid("http://0.0.0.0:4000", prodEnv), false);
  assert.equal(isProductionApiTargetValid("https://localhost:4000", prodEnv), false);

  // Production disallows non-https protocols
  assert.equal(isProductionApiTargetValid("http://api.payrail.ph", prodEnv), false);

  // Production requires a valid deployed HTTPS endpoint
  assert.equal(isProductionApiTargetValid("https://payrail-ph-api.vercel.app", prodEnv), true);
  assert.equal(isProductionApiTargetValid("https://api.payrail.ph", prodEnv), true);
});
