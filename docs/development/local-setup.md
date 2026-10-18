# Local development

Requirements: Node.js 22.12 or newer in the Node 22 line, pnpm 10.30.3, Git, and PostgreSQL 17 command-line/server tools on `PATH`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
# Set SUPABASE_URL to the HTTPS URL of the sandbox Supabase project.
# Generate and append a local-only 256-bit key without printing it:
$keyBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
Add-Content .env "WEBHOOK_ENCRYPTION_KEY=$([Convert]::ToHexString($keyBytes))"
$keyBytes.Clear()
pnpm db:local:start
pnpm db:migrate
pnpm dev:api
```

In a second terminal, run `pnpm dev:web`. The API listens on port 4000 and the public site on port 3000. The isolated local database is stored in ignored `.local/postgres` and listens on loopback port 55432; it does not use the separately installed PostgreSQL service. Stop the isolated cluster with `pnpm db:local:stop`.

The API requires a configured Supabase project URL, a 32-byte `WEBHOOK_ENCRYPTION_KEY`, and PayMongo test-mode secrets. The template's `sk_test_placeholder` and `whsk_test_placeholder` values support only the local payment simulator and signed webhook fixtures; incoming webhook signatures are still checked cryptographically. Replace the placeholder `SUPABASE_URL` and generate a fresh encryption key per environment. Keep `.env` out of version control.

Operator access uses Supabase Auth access tokens and active rows in `payrail_private.operators` and `payrail_private.operator_memberships`. After creating an operator in the Supabase sandbox, provision its UUID and merchant role using a controlled database administration session. The API does not expose a membership-management endpoint. `x-merchant-id` selects among that user's existing memberships and cannot grant access by itself.
