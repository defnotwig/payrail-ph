# Local development

Requirements: Node.js 22.12 or newer in the Node 22 line, pnpm 10.30.3, Git, and PostgreSQL 17 command-line/server tools on `PATH`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:local:start
pnpm db:migrate
pnpm dev:api
```

In a second terminal, run `pnpm dev:web`. The API listens on port 4000 and the public site on port 3000. The isolated local database is stored in ignored `.local/postgres` and listens on loopback port 55432; it does not use the separately installed PostgreSQL service. Stop the isolated cluster with `pnpm db:local:stop`.

The `.env` template contains only local development URLs. Keep any future provider credentials out of version control and use PayMongo test-mode credentials only.
