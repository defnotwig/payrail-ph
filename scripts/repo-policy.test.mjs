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

test("requires merge commit titles to preserve the Conventional PR title and PR number", () => {
  assert.equal(isConventionalMergeCommitSubject("docs(repo): bootstrap workflow (#12)"), true);
  assert.equal(isConventionalMergeCommitSubject("docs(repo): bootstrap workflow"), false);
  assert.equal(isConventionalMergeCommitSubject("Merge pull request #12 from owner/branch"), false);
});

test("requires PR titles to carry their own PR number for the merge commit", () => {
  assert.equal(isConventionalPullRequestTitle("feat(money): add PHP primitives (#7)", 7), true);
  assert.equal(isConventionalPullRequestTitle("feat(money): add PHP primitives (#8)", 7), false);
  assert.equal(isConventionalPullRequestTitle("feat(money): add PHP primitives", 7), false);
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

test("allows only the documented promotion flow and urgent fixes", () => {
  assert.equal(isPromotionAllowed("personal/defnotwig", "dev"), true);
  assert.equal(isPromotionAllowed("dev", "staging"), true);
  assert.equal(isPromotionAllowed("staging", "main"), true);
  assert.equal(isPromotionAllowed("fix/provider-outage", "main"), true);
  assert.equal(isPromotionAllowed("main", "dev"), false);
  assert.equal(isPromotionAllowed("dev", "main"), false);
  assert.equal(isPromotionAllowed("topic/money", "staging"), false);
});
