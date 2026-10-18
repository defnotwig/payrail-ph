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
- Review record: JSON under `harness/code_review/reviews/`, matching the exact PR base SHA and SHA-256 of the binary diff excluding review records.
- Merges: merge commit only. No squash, rebase merge, force push, protected-branch deletion, or routine admin bypass.
- No required second-human approval in the selected solo workflow.

## Implementation steps

1. Scan every reachable Git commit and the committed source tree for secrets; resolve any real finding before publishing.
2. Create the empty public repository, preserve current history, publish all four branches, and set `main` as default.
3. Add project guidance and public README/license material.
4. Add policy scripts and tests, pin GitHub Actions to immutable revisions, and run the full local baseline.
5. Obtain an independent read-only review, record the exact base/diff evidence, open the PR to `dev`, and merge with a merge commit after checks pass.
6. Promote `dev` → `staging` → `main` through real PRs, then configure protections and verify settings.
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
- Initial CI runs for all four branches passed; see the phase build log for run links.
- Provider credentials and hosted environments have not yet been verified.
