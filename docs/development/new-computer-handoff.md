# PayRail PH — New Computer Setup & Handoff Guide

This runbook documents the clean, repeatable setup of PayRail PH on a fresh Windows development workstation without requiring administrative privilege escalation or dirty environment copies.

---

## 1. Prerequisites & Toolchain Verification

| Component | Pinned Version | Windows Location / Command | Notes |
|---|---|---|---|
| **Node.js** | `v22.14.0` | `C:\Users\admin\node-v22\node.exe` | Portable x64 binary. Prepend `C:\Users\admin\node-v22;` to user `PATH`. |
| **pnpm** | `10.30.3` | `corepack enable && corepack prepare pnpm@10.30.3 --activate` | Repository package manager defined in `package.json`. |
| **Git** | `>=2.40` | `git --version` | Standard git with Windows credential manager. |
| **PostgreSQL** | `18` | `C:\Program Files\PostgreSQL\18\bin` | Used for local database cluster. |
| **GitHub CLI** | Latest | `gh auth status` | Authenticated as `defnotwig`. |

---

## 2. Repository Initialization

Clone the canonical repository directly using Git:

```powershell
git clone https://github.com/defnotwig/payrail-ph.git
Set-Location payrail-ph
git checkout main
git pull --ff-only origin main
```

Install workspace dependencies with frozen lockfile:

```powershell
$env:PATH = "C:\Users\admin\node-v22;" + $env:PATH
pnpm install --frozen-lockfile
```

---

## 3. Local Environment & Database Initialization

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Populate `WEBHOOK_ENCRYPTION_KEY` in `.env` with a 64-character hex test key:
   ```text
   WEBHOOK_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   ```
3. Start the project-owned local PostgreSQL cluster on `127.0.0.1:55432`:
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D .local/postgres/data
   ```
4. Run migrations:
   ```powershell
   pnpm db:migrate
   ```
   All 8 migrations (`0001` through `0008`) will be applied, including the seeded demo merchant API key for the sandbox demo.

---

## 4. Local Development Workflows

Run services in separate terminals:

```powershell
# API (NestJS modular monolith, port 4000)
pnpm dev:api

# Web (Next.js App Router, port 3000)
pnpm dev:web
```

Navigate to:
- Public Home: `http://localhost:3000`
- QR Ph Sandbox Checkout: `http://localhost:3000/demo/qrph`
- Operator Console: `http://localhost:3000/ops`
- API Health Check: `http://localhost:4000/health/live`
- API Ready Check: `http://localhost:4000/health/ready`

---

## 5. Local Quality Gates & Verification Commands

Run deterministic baseline checks before creating any pull request:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:security-http
pnpm test:repo-policy
pnpm validate:commits
pnpm build
```

---

## 6. Promotion Pipeline

Promotions strictly follow the immutable sequence:

$$\text{personal/defnotwig} \longrightarrow \text{dev} \longrightarrow \text{staging} \longrightarrow \text{main}$$

Rules:
1. Merge commits only (fast-forward and squash merges are rejected).
2. PR titles must follow Conventional Commits without PR numbers (e.g. `feat(scope): title`).
3. Merge commits must have the PR number appended (e.g. `feat(scope): title (#12)`).
4. Every PR requires an independent review record in `harness/code_review/reviews/*.json` matching the PR's exact base SHA and diff SHA-256 (`node scripts/review-evidence.mjs`).
