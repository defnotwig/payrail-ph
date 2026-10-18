# Security policy

PayRail PH is an active sandbox-only portfolio. The `main` branch is the supported public line. The application is not authorized to process live payments, hold real funds, or handle PAN/CVV.

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Use GitHub's private vulnerability reporting for this repository when it is available. If private reporting is unavailable, contact the maintainer through [the GitHub profile](https://github.com/defnotwig) and request a private channel. Do not include credentials, personal data, or live payment information in a report.

Include the affected revision, a concise impact description, safe reproduction steps, and any proposed mitigation. Reports are reviewed as time permits; this project does not provide a formal response-time or disclosure guarantee.

## Scope

Security reports may cover authorization, merchant/environment isolation, webhook verification, idempotency, job fencing, ledger integrity, secret exposure, and unsafe deployment configuration. Do not test against live payment systems or accounts you do not own.
