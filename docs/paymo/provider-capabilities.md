# Provider capability and evidence matrix

**Assessment date:** 2026-10-18  
**Purpose:** Record what PayRail implements, what PayMongo publicly documents, and what this workspace has actually verified. A provider's public documentation is not evidence that a merchant account is enabled or that PayRail has successfully exercised the capability.

## Status meanings

- `VERIFIED`: PayRail behavior passed a reproducible check against the stated provider environment; include the run and evidence reference.
- `SUPPORTED_NOT_VERIFIED`: the provider documents the capability, but this workspace has no successful provider sandbox run proving it for this account and integration.
- `UNSUPPORTED`: PayRail has no implementation for this capability in the current release.
- `UNKNOWN`: available evidence does not establish the capability or account eligibility.

The current evidence inventory has no PayMongo sandbox credentials, successful provider API run, provider event delivery, or account enablement record. Local unit tests and fixture runs do not change that status. The public Vercel frontend is deployment evidence for the web app only; it does not prove API, database, worker, or provider integration is deployed.

## PayMongo

| Capability | Status | Evidence and limits |
|---|---|---|
| QR Ph test-mode payment initiation | `SUPPORTED_NOT_VERIFIED` | PayMongo documents QR Ph test mode and provides `test_url` flows. It explicitly says test QR codes must not be scanned or paid. This is documentation evidence only; no real sandbox request or `test_url` run has been captured for this PayRail workspace. [Testing payment channels](https://docs.paymongo.com/docs/payment-acceptance-testing) |
| Card payments in test mode | `SUPPORTED_NOT_VERIFIED` | PayMongo documents test cards and test-mode card flows. This does not establish a successful PayRail-to-PayMongo run. Card data must remain on provider-hosted/tokenized flows; this portfolio must not collect or persist raw PAN/CVC. [Cards](https://docs.paymongo.com/docs/payment-acceptance-cards), [testing payment channels](https://docs.paymongo.com/docs/payment-acceptance-testing) |
| 3-D Secure card authentication | `SUPPORTED_NOT_VERIFIED` | PayMongo documents 3DS support and test cases. No authenticated sandbox challenge/return/webhook run is recorded here. Browser return is an observation; the server must verify provider state. [Cards](https://docs.paymongo.com/docs/payment-acceptance-cards), [testing payment channels](https://docs.paymongo.com/docs/payment-acceptance-testing), [payment best practices](https://docs.paymongo.com/docs/payment-acceptance-best-practices) |
| Authorization hold and later capture | `SUPPORTED_NOT_VERIFIED` | PayMongo documents Hold Then Capture, but states that it is available only to merchants acquired through Robinsons Bank and must be activated. PayRail account eligibility and activation are unknown; do not present capture as usable in this release. [Hold Then Capture](https://docs.paymongo.com/docs/payment-acceptance-hold-then-capture) |
| Void/cancel an uncaptured hold | `SUPPORTED_NOT_VERIFIED` | The documented hold flow supports cancellation before capture. It has the same Robinsons Bank acquisition and activation gate; no account eligibility or sandbox cancellation has been verified. [Hold Then Capture](https://docs.paymongo.com/docs/payment-acceptance-hold-then-capture) |
| Full refunds | `SUPPORTED_NOT_VERIFIED` | PayMongo documents refunds, including a QR Ph refund window. No PayRail sandbox refund request or resulting provider event is in the evidence inventory. [Refunds](https://docs.paymongo.com/docs/payment-acceptance-refunds) |
| Partial refunds | `SUPPORTED_NOT_VERIFIED` | PayMongo documents partial refunds, subject to provider rules and available refundable balance. No PayRail sandbox partial refund has been verified. [Refunds](https://docs.paymongo.com/docs/payment-acceptance-refunds) |
| Disputes/chargebacks | `UNKNOWN` | No verified PayRail integration or provider account evidence establishes dispute retrieval or handling. Do not imply dispute operations are implemented. |
| Settlement reports / settlement reconciliation | `UNKNOWN` | PayMongo's existence of payout APIs does not establish that this integration can retrieve settlement statements or reconcile merchant settlements. No settlement evidence is present. |
| Hosted Checkout (card, GCash, QR Ph) | `SUPPORTED_NOT_VERIFIED` | PayMongo documents hosted checkout channels and a test-key flow. No PayRail checkout session, callback, webhook, or end-to-end sandbox run has been captured. [Hosted Checkout channels](https://docs.paymongo.com/docs/payment-channels-hosted-checkout), [quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start) |

## Other providers

| Provider | Status | Evidence and limits |
|---|---|---|
| Xendit | `UNSUPPORTED` | No Xendit adapter or exercised integration is present in the current release evidence. This describes PayRail's implementation, not Xendit's product capabilities. |

## Evidence required to upgrade a status

For any capability to become `VERIFIED`, preserve a reproducible run record that identifies the sandbox environment, redacted request/response or provider event identifiers, application commit, test command or operator steps, and observed financial-state/ledger result. Never store credentials, customer data, full provider payloads containing sensitive data, or QR images in Git. Provider documentation and local simulation results remain separately labeled evidence.

## Provider source links

- [PayMongo testing payment channels](https://docs.paymongo.com/docs/payment-acceptance-testing)
- [PayMongo cards](https://docs.paymongo.com/docs/payment-acceptance-cards)
- [PayMongo Hold Then Capture](https://docs.paymongo.com/docs/payment-acceptance-hold-then-capture)
- [PayMongo refunds](https://docs.paymongo.com/docs/payment-acceptance-refunds)
- [PayMongo Hosted Checkout channels](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [PayMongo Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [PayMongo payment best practices](https://docs.paymongo.com/docs/payment-acceptance-best-practices)
