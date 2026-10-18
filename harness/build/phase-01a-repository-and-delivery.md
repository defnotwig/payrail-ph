# Phase 01A — Repository and delivery bootstrap

## Objective

Publish the verified Phase 00/01 foundation as `defnotwig/payrail-ph`, establish the solo PR and merge-commit workflow, and document the project before financial implementation begins.

## Prerequisites

- Clean verified foundation at `75386a231e060f81b0ea4e8959fa92ca5c36ef96`.
- GitHub CLI authenticated as `defnotwig`.
- Full reachable history and committed source scanned for secrets before public publication.
- No paid account, provider credential, or hosted deployment requirement.

## Scope

- Root README, MIT license, contributor/security guidance, CODEOWNERS, and issue/PR templates.
- `personal/defnotwig`, `dev`, `staging`, and `main` branches at the verified foundation; `main` is default.
- Conventional Commit and promotion-source validation, exact-diff independent review evidence, and secret-free CI.
- Branch protection with merge commits only after the required checks have passed.
- Actual free-capacity and credential audit for any hosted foundation; pending blockers remain explicit.

## Interfaces and policy

- PR promotion: `personal/defnotwig` → `dev` → `staging` → `main`; `fix/*` may target a protected branch and is synchronized downstream.
- Required PR checks: `CI / verify` and `CI / review-evidence`.
- Review record: JSON under `harness/code_review/reviews/`, matching the exact PR base SHA and SHA-256 of the binary diff excluding review records. The record check binds evidence to the diff; a separate Codex reviewer provides process independence because this solo repository has no second GitHub reviewer identity.
- Merges: merge commit only. PR titles use a plain Conventional Commit subject; GitHub appends `(#PR_NUMBER)` to the merge commit subject. No squash, rebase merge, force push, protected-branch deletion, or routine admin bypass.
- CI validates every PR-range commit, including merge commits. Push validation checks merge-subject shape; PR CI validates the title before GitHub appends the number.
- No required second-human approval in the selected solo workflow.

## Implementation steps

1. Scan every reachable Git commit and the committed source tree for secrets; resolve any real finding before publishing.
2. Create the empty public repository, preserve current history, publish all four branches, and set `main` as default.
3. Add project guidance and public README/license material.
4. Add policy scripts and tests, pin GitHub Actions to immutable revisions, and run the full local baseline.
5. Obtain an independent read-only Codex review, record the exact base/diff evidence, and open the PR to `dev`. After the required checks pass, configure and verify protections on `dev`, `staging`, and `main` before merging with a merge commit.
6. Promote `dev` → `staging` → `main` through real PRs and verify the checks and merge commits on each promotion.
7. Audit Vercel, Supabase, and Cloudflare access/capacity. Deploy only environments that can be provisioned safely within the approved free plans.

## Verification

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:repo-policy
pnpm validate:commits
pnpm build
git diff --check
```

GitHub Actions must pass for each PR head and each promoted branch merge SHA. Confirm branch protections, merge methods, PR history, and clean primary/worktree state using GitHub and Git.

## Security considerations

- Scan history and committed source before public push; do not print secret values into logs.
- Never put deployment/provider secrets in Git, build artifacts, PRs, or chat.
- Keep branch CI secret-free and do not run untrusted pull-request code with write tokens or deployment credentials.
- Do not claim hosted deployment, environment isolation, or protection until checked against live account settings.

## Acceptance criteria

- Public repo exists at `https://github.com/defnotwig/payrail-ph` with the original commit history.
- README, MIT license, contribution/security process, templates, and ownership file are present.
- Four requested branches exist and `main` is the default branch.
- PR CI, promotion rules, review evidence, and merge-commit-only settings are active and tested.
- Each actual PR is attached to the Codex task and phase evidence records its link, merge revision, and checks.
- Hosted environments either pass deployed verification or remain visibly pending with the exact free-tier/access blocker.

## Commit boundaries

- `docs(repo): add README, license, and contributor guidance`
- `ci(github): enforce semantic PR and branch policy`
- `docs(build): record repository bootstrap evidence`

## Current external evidence

- GitHub repository: `https://github.com/defnotwig/payrail-ph` (public; `main` default).
- Branches were published from the verified foundation before new bootstrap changes.
- Repository merge settings allow merge commits only, use the PR title/body for merge commits, and keep squash, rebase, and branch deletion disabled.
- GitHub protections are active on `dev`, `staging`, and `main`: strict `verify` and `review-evidence` checks, PRs, resolved conversations, enforced administrator rules, no force pushes/deletion, and no linear-history requirement.
- Both CI jobs use `ubuntu-24.04`, `actions/checkout` v7.0.1, and `actions/setup-node` v7.1.0 at immutable Node 24-compatible SHAs. The `verify` job also uses `pnpm/action-setup` v6.1.0 at its immutable Node 24-compatible SHA; application tooling remains pinned to Node 22.14.0.
- Initial CI runs for all four branches passed; see the phase build log for run links.
- PR #1, `docs(repo): establish public collaboration and CI policy`, merged from `personal/defnotwig` to `dev` as `3c62834af3160c5b1e212e02b2e04b8b316c98a8`. Required `verify` and `review-evidence` checks passed on its exact head; see [PR #1](https://github.com/defnotwig/payrail-ph/pull/1) and [CI run](https://github.com/defnotwig/payrail-ph/actions/runs/39108908266).
- GitHub appends a pull request number to the merge subject even when `merge_commit_title` is `PR_TITLE`; PR-title validation therefore rejects an in-title number to prevent duplicates. The PR #1 merge subject contains a duplicated number because that policy was corrected after the first merge.
- To preserve published history, CI allows the duplicate title only for the exact PR #1 merge SHA `3c62834af3160c5b1e212e02b2e04b8b316c98a8` and its recorded subject. All other merge commits require exactly one trailing PR number; future PR titles cannot contain that suffix.
- PayMo qualification integration adds a narrow exception for exactly three agent heads (`codex/paymo-financial`, `codex/paymo-product`, `codex/paymo-security`) targeting `personal/defnotwig`; no other codex branch may enter the implementation branch. PR CI now includes that target so each workstream can receive the same exact-diff review and verification checks before the normal promotion flow.
- Promotions to `staging` and `main` remain pending until their PR checks and merge commits complete.
- Provider credentials and hosted environments have not yet been verified.
