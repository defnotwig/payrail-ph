# Privacy & Data Retention Policy (Philippine Data Privacy Act & GDPR Conscious)

## 1. Compliance Alignment
PayRail PH processes payment transaction data adhering to:
1. **Republic Act No. 10173** (Philippine Data Privacy Act of 2012 — DPA).
2. **Bangko Sentral ng Pilipinas (BSP) Circular No. 808** (IT Risk Management).
3. **General Data Protection Regulation (GDPR)** principles (Data Minimization, Purpose Limitation, Storage Limitation).

---

## 2. Personal Information Controller (PIC) vs. Processor (PIP)
* **PayRail PH Role:** Personal Information Processor (PIP) acting under the direct instruction of the merchant (the Personal Information Controller - PIC).
* **Lawful Basis of Processing:** Performance of contract (executing payment transactions authorized by the consumer) and compliance with legal/anti-money laundering (AML) obligations.

---

## 3. Data Classification & Retention Periods

| Category | Specific Elements | Retention Period | Justification |
|---|---|---|---|
| **Transactional Financial Records** | Amount, Currency, Order ID, State, Timestamp, Ledger Entries | **5 Years** | Mandated by Philippine Bureau of Internal Revenue (BIR) and BSP financial record-keeping regulations. |
| **Provider Evidence & Webhook Logs** | Event ID, Signature, Raw Response, Delivery Status | **1 Year** | Dispute resolution, chargeback defense, and automated reconciliation audit. |
| **Transient In-Flight Tokens** | Ephemeral Checkout Tokens, 3DS Session Tokens | **15 Minutes** | Short TTL to prevent token reuse and session hijacking. |
| **Application & System Logs** | Request IDs, IP addresses, HTTP status codes, latency | **90 Days** | Operational troubleshooting, security forensics, and anomaly detection. |

---

## 4. Anonymization & Data Purging Protocol
* **Automated Data Lifecycle Job:** Runs monthly to prune raw webhook delivery logs older than 365 days while preserving immutable ledger journals.
* **Right to Erasure (RTBF):** When a consumer requests data erasure through a merchant, identifying attributes (email, name, phone) are cryptographically shredded (`usr_redacted_...`) while numerical ledger journal lines are preserved to maintain mathematical accounting integrity.
