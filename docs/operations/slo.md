# Service Level Objectives (SLOs) & SRE Observability Framework

## 1. Google SRE Framework Alignment
PayRail PH implements Google SRE principles, utilizing Service Level Indicators (SLIs), Service Level Objectives (SLOs), and Service Level Agreements (SLAs) with error-budget alerting to manage production payment reliability.

---

## 2. Core Service Level Indicators (SLIs) & Objectives (SLOs)

### 2.1 Availability SLO (Core API & Webhook Ingress)
* **SLI Definition:** Ratio of successful non-5xx HTTP requests to total valid HTTP requests received at the Application Load Balancer.
  $$\text{SLI}_{\text{avail}} = \frac{\sum \text{Requests}_{\text{status} < 500}}{\sum \text{Total Requests}}$$
* **Target Objective (SLO):** **99.95%** over any rolling 30-day window.
* **Monthly Error Budget:** 21.6 minutes of unplanned downtime per 30 days.

### 2.2 Latency SLO (Critical Payment Paths)
* **SLI Definition:** Percentile latency of payment intent creation and state transition queries.
* **Target Objectives:**
  * **P95 Latency:** $\le 250\text{ms}$ for `POST /v1/payment-intents`.
  * **P99 Latency:** $\le 800\text{ms}$ for database transactional mutations.
  * **Fast Webhook Ingress ACK:** P99 $\le 100\text{ms}$ (persisting to inbox before synchronous processing).

### 2.3 Financial Consistency SLO (Double-Entry Invariant)
* **SLI Definition:** Percentage of journal entries where $\sum \text{Debits} == \sum \text{Credits}$.
* **Target Objective:** **100.000%** (Zero error budget). Any imbalance immediately triggers a P1 incident and halts automated settlement payouts.

### 2.4 Asynchronous Worker Throughput & Delivery Latency
* **SLI Definition:** Time elapsed from provider webhook receipt to merchant outbound webhook dispatch.
* **Target Objective (SLO):** **99.0%** of notifications delivered within 5 seconds; 99.9% delivered within 30 seconds.

---

## 3. Error Budget Burn Rate Alerts (Multi-Window Multi-Burn)

| Severity | Burn Rate | % Budget Consumed | Time Window | Action Required |
|---|---|---|---|---|
| **P1 - Critical** | **14.4x** | 2% in 1 hour | 1h window | Immediate pager escalation to on-call engineer; halt non-critical deployments. |
| **P2 - High** | **6x** | 5% in 6 hours | 6h window | On-call investigation within 30 minutes. |
| **P3 - Warning** | **1x** | 10% in 3 days | 3-day window | Review during daily engineering standup; investigate persistent transient errors. |
