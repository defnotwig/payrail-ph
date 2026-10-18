# PayRail PH — Public portfolio home design brief

## Target and audience
Build the desktop-first public homepage for the PayRail PH fintech engineering portfolio. Its audience is fintech hiring managers, recruiters, and engineers evaluating the system.

## User outcome
A visitor should quickly understand that PayRail is a sandbox-only payment orchestration project, see how provider evidence becomes durable financial state, and navigate to the system explanation or reliability evidence without being offered a payment action.

## Selected visual source
The selected source is the third generated design direction, captured at docs/design/assets/payrail-home-reference.png (1487 × 1058 px). Recreate its editorial layout, large serif headline, warm-white canvas, cobalt and coral accents, single system-flow illustration, four-step narrative, pending-evidence status, and pale mountain footer motif.

## Scope and behavior
- Header links navigate within this single page: System design → the four-step flow; Reliability Lab → the evidence status; Operator sign-in → an access status explaining that private operations require authenticated access.
- Primary action “See how it works” scrolls to the system flow.
- Show “SANDBOX ONLY” and “PAYMONGO TEST MODE” prominently.
- Until genuine sandbox evidence exists, state “Sandbox integration evidence: pending.” Do not invent activity, metrics, dates, test results, or PASS labels.
- Public content is read-only. Do not display a checkout, payment CTA, QR code, customer details, or provider secrets.
- The page must remain usable at mobile, tablet, laptop, and desktop widths; navigation and anchor targets must be keyboard accessible.

## Design review and constraints
The visual review of the selected reference confirmed a clear hierarchy, useful negative space, and a strong narrative flow. The illustration should remain supportive and never compete with the title. Coral is a decorative accent only because it is not strong enough for small text on the paper background. The dedicated design-critique connector rejected the full-resolution image because it exceeded its 1 MB input limit; browser-rendered design QA will provide the implementation comparison.

Stitch access was checked for this environment and no Stitch connector or page was available. The project has no saved Product Design references or design tokens; this brief and DESIGN.md establish the starting direction.
