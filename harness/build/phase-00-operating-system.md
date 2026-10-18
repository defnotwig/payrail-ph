# Phase 00 — Lightweight project operating system

## Objective
Create the minimum operating context needed to preserve approved scope, financial constraints, threat assumptions, and phase evidence.

## Scope
- AGENTS.md
- PLANS.md
- docs/architecture/system.md
- docs/architecture/database-invariants.md
- docs/security/threat-model.md
- harness/build-log.md
- This phase record and .mex/events/decisions.jsonl for the required decision trail.
- Initialize Git on a focused phase branch and commit the verified foundation.

## Prerequisites
The product specification, zero-cost directive, architecture plan, machine-exact payment graph, separate refund states, immediate/recovery processing model, and M0/M1/M2 gates have been approved in this task.

## Interfaces and contracts
The docs agree on PHP minor units, payment and refund enums, PostgreSQL system-of-record behavior, verified webhook persistence, post-commit best-effort processing, five-minute recovery, and sandbox-only scope.

## Verification
1. Confirm all required files exist and are non-empty.
2. Run git diff --check.
3. Check the state graph has only the approved concrete values and that refund states are separate.
4. Check Mermaid and Markdown code fences are balanced.
5. Inspect the staged diff, commit, and record the exact revision and command results in harness/build-log.md.

## Acceptance criteria
- An engineer can identify the next phase and its gates without chat history.
- Only approved lightweight operating docs exist.
- The normative state graph contains no shorthand or wildcard states.
- Sandbox and zero-cost limits are prominent.
- Verification status is factual and no unsupported test/deployment claim is made.

## Security and financial considerations
This phase writes no application or financial data. Documentation must preserve uncertainty handling, no-network-transaction rule, merchant isolation, immutable balanced ledger, refund reservation ceiling, and stale-worker fencing.

## Commit boundary
One focused commit: docs: establish PayRail PH operating baseline.
