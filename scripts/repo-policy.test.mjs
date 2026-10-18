import assert from "node:assert/strict";
import test from "node:test";

import {
  isConventionalCommitSubject,
  isConventionalMergeCommitSubject,
  isConventionalPullRequestTitle,
  isCommitRangeValid,
  isPromotionAllowed,
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
  assert.equal(isPromotionAllowed("main", "dev"), false);
  assert.equal(isPromotionAllowed("dev", "main"), false);
  assert.equal(isPromotionAllowed("topic/money", "staging"), false);
});
