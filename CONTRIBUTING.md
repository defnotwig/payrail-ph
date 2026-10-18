# Contributing

PayRail PH is a sandbox-only portfolio. Contributions must preserve the payment, authorization, ledger, and recovery invariants in `AGENTS.md` and `docs/architecture/database-invariants.md`.

## Branches and pull requests

The normal flow is `personal/defnotwig` → `dev` → `staging` → `main`. Open one implementation PR for each independently verified phase. Promote verified integration through staging before a milestone release. Use `fix/*` from `main` for urgent corrections, then synchronize the fix through staging and dev. Do not push directly to protected branches.

Keep the primary checkout available for release inspection and use a linked worktree for implementation. Each Git branch can be checked out in one worktree at a time. Give parallel worktrees distinct ports, ignored `.env` files, and isolated test databases. Before removing a worktree, preserve its branch and uncommitted work.

PR titles and commit subjects use Conventional Commits. Do not add the PR number to the PR title; GitHub appends it to the merge commit subject automatically:

```text
feat(payments): add guarded submission
fix(jobs): fence stale worker writes
docs(repo): explain promotion workflow
test(ledger): cover duplicate posting
```

Allowed types are `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, and `revert`. Use a scope when it clarifies the area. Add `!` or a `BREAKING CHANGE` footer for breaking changes. PR CI checks the semantic title and every commit in the PR range, including existing merge commits. GitHub is configured to create merge subjects from the PR title and append the PR number; push CI checks semantic merge-subject format without querying GitHub for the merge-to-PR association.

GitHub merges pull requests with merge commits. Do not squash or rebase-merge. Preserve the original commit authors and history.

## Review and verification

Keep each PR focused on one phase or a small related maintenance change. Describe its behavior, financial effect, migrations, authorization changes, tests, and remaining limits. CI must pass for the exact PR head, and an independent Codex review record must match the PR base and binary diff digest. A source change after review needs a new review record. The record check binds the evidence to the exact diff; because this solo repository has no second GitHub reviewer identity, reviewer independence is established by the separate Codex review process and recorded report, not by a cryptographic GitHub identity check. `pnpm review:evidence` checks the record format and diff binding.

For financial behavior, add a focused test first, observe it fail for the expected reason, implement the smallest safe change, then run the relevant suite and the workspace checks. Do not mark unavailable external checks as passing. Label evidence as local simulation, genuine provider sandbox activity, or deployed verification.

## Security

Never include secrets, real customer data, raw provider payloads, or scannable sandbox QR codes in code, issues, logs, fixtures, screenshots, or artifacts. Use PayMongo test mode only. Never handle PAN/CVV or live funds. Report suspected vulnerabilities using the private process in `SECURITY.md`.
