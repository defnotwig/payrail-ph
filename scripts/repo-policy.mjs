import { execFileSync } from "node:child_process";

const commitPattern =
  /^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert)(\([a-z0-9][a-z0-9._/-]*\))?(!)?: [^\s].*$/;

export function isConventionalCommitSubject(subject) {
  return typeof subject === "string" && commitPattern.test(subject);
}

export function isPromotionAllowed(sourceBranch, targetBranch) {
  if (/^fix\/[a-z0-9][a-z0-9._/-]*$/.test(sourceBranch)) {
    return ["dev", "staging", "main"].includes(targetBranch);
  }

  return (
    (sourceBranch === "personal/defnotwig" && targetBranch === "dev") ||
    (sourceBranch === "dev" && targetBranch === "staging") ||
    (sourceBranch === "staging" && targetBranch === "main")
  );
}

function gitSubjects(baseSha, headSha) {
  return execFileSync("git", ["log", "--no-merges", "--format=%s", `${baseSha}..${headSha}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

function gitSubject(commitSha) {
  return execFileSync("git", ["show", "-s", "--format=%s", commitSha], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function gitParentCount(commitSha) {
  const parents = execFileSync("git", ["rev-list", "--parents", "-n", "1", commitSha], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .trim()
    .split(/\s+/);

  return Math.max(0, parents.length - 1);
}

function reportInvalidSubjects(subjects) {
  const invalid = subjects.filter((subject) => !isConventionalCommitSubject(subject));
  for (const subject of invalid) {
    console.error(`Invalid commit subject: ${subject}`);
  }
  return invalid.length;
}

function validatePullRequest(env) {
  const title = env.PR_TITLE ?? "";
  const source = env.PR_HEAD_BRANCH ?? "";
  const target = env.PR_BASE_BRANCH ?? "";
  const baseSha = env.PR_BASE_SHA ?? "";
  const headSha = env.PR_HEAD_SHA ?? "";
  let failures = 0;

  if (!isConventionalCommitSubject(title)) {
    console.error(`Invalid pull request title: ${title || "(empty)"}`);
    failures += 1;
  }
  if (!isPromotionAllowed(source, target)) {
    console.error(`Promotion ${source || "(empty)"} -> ${target || "(empty)"} is not allowed.`);
    failures += 1;
  }
  if (!baseSha || !headSha) {
    console.error("Pull request base and head revisions are required.");
    failures += 1;
  } else {
    failures += reportInvalidSubjects(gitSubjects(baseSha, headSha));
  }

  return failures;
}

function validatePush(env) {
  const headSha = env.GIT_HEAD || env.GITHUB_SHA || "HEAD";
  const beforeSha = env.GIT_BEFORE ?? "";
  const isZeroSha = /^0+$/.test(beforeSha);
  const subjects = beforeSha && !isZeroSha ? gitSubjects(beforeSha, headSha) : [];

  if (subjects.length > 0) {
    return reportInvalidSubjects(subjects);
  }
  if (gitParentCount(headSha) > 1) {
    console.log(
      "Merge commit received; its pull request title and non-merge commits were checked by PR CI.",
    );
    return 0;
  }

  return reportInvalidSubjects([gitSubject(headSha)]);
}

export function runRepositoryPolicy(env = process.env) {
  const failures = env.PR_TITLE ? validatePullRequest(env) : validatePush(env);
  if (failures > 0) {
    console.error(`${failures} repository policy violation(s).`);
    return 1;
  }
  console.log("Commit and branch-promotion policy passed.");
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = runRepositoryPolicy();
}
