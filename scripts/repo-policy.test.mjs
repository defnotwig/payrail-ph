import assert from "node:assert/strict";
import test from "node:test";

import { isConventionalCommitSubject, isPromotionAllowed } from "./repo-policy.mjs";

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

test("allows only the documented promotion flow and urgent fixes", () => {
  assert.equal(isPromotionAllowed("personal/defnotwig", "dev"), true);
  assert.equal(isPromotionAllowed("dev", "staging"), true);
  assert.equal(isPromotionAllowed("staging", "main"), true);
  assert.equal(isPromotionAllowed("fix/provider-outage", "main"), true);
  assert.equal(isPromotionAllowed("main", "dev"), false);
  assert.equal(isPromotionAllowed("dev", "main"), false);
  assert.equal(isPromotionAllowed("topic/money", "staging"), false);
});
