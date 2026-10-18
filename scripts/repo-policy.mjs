import { execFileSync } from "node:child_process";

const commitPattern =
  /^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert)(\([a-z0-9][a-z0-9._/-]*\))?(!)?: [^\s].*$/;

export function isConventionalCommitSubject(subject) {
  return typeof subject === "string" && commitPattern.test(subject);
}

export function isConventionalMergeCommitSubject(subject) {
  return isConventionalCommitSubject(subject) && /\(#\d+\)$/.test(subject);
}

export function isConventionalPullRequestTitle(title, number) {
  return (
    isConventionalCommitSubject(title) &&
    Number.isInteger(Number(number)) &&
    Number(number) > 0 &&
    title.endsWith(`(#${number})`)
  );
}

export function isCommitRangeValid(commits) {
  return commits.every(({ subject, parentCount }) =>
    parentCount > 1
      ? isConventionalMergeCommitSubject(subject)
      : isConventionalCommitSubject(subject),
  );
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

function gitCommitShas(baseSha, headSha) {
  return execFileSync("git", ["rev-list", "--reverse", `${baseSha}..${headSha}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

function reportInvalidSubjects(subjects, isValid = isConventionalCommitSubject) {
  const invalid = subjects.filter((subject) => !isValid(subject));
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

  if (!isConventionalPullRequestTitle(title, env.PR_NUMBER)) {
    console.error(
      `Invalid pull request title (expected Conventional Commit and (#${env.PR_NUMBER || "PR"})): ${title || "(empty)"}`,
    );
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
    const commits = gitCommitShas(baseSha, headSha).map((commitSha) => ({
      subject: gitSubject(commitSha),
      parentCount: gitParentCount(commitSha),
    }));
    if (!isCommitRangeValid(commits)) {
      for (const commit of commits) {
        const valid =
          commit.parentCount > 1
            ? isConventionalMergeCommitSubject(commit.subject)
            : isConventionalCommitSubject(commit.subject);
        if (!valid) console.error(`Invalid commit subject: ${commit.subject}`);
      }
      failures += 1;
    }
  }

  return failures;
}

function validatePush(env) {
  const headSha = env.GIT_HEAD || env.GITHUB_SHA || "HEAD";
  const beforeSha = env.GIT_BEFORE ?? "";
  const isZeroSha = /^0+$/.test(beforeSha);
  if (beforeSha && !isZeroSha) {
    const commits = gitCommitShas(beforeSha, headSha).map((commitSha) => ({
      subject: gitSubject(commitSha),
      parentCount: gitParentCount(commitSha),
    }));
    if (isCommitRangeValid(commits)) return 0;
    for (const commit of commits) {
      const valid =
        commit.parentCount > 1
          ? isConventionalMergeCommitSubject(commit.subject)
          : isConventionalCommitSubject(commit.subject);
      if (!valid) console.error(`Invalid commit subject: ${commit.subject}`);
    }
    return 1;
  }
  const subject = gitSubject(headSha);
  const merge = gitParentCount(headSha) > 1;
  return merge
    ? reportInvalidSubjects([subject], isConventionalMergeCommitSubject)
    : reportInvalidSubjects([subject]);
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
