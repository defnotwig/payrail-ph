# PCI DSS Scoping & Cardholder Data Protection Policy

## 1. Scope Determination & Architecture Posture
Under the Payment Card Industry Data Security Standard (PCI DSS v4.0), systems that store, process, or transmit Cardholder Data (CHD) or Sensitive Authentication Data (SAD) fall under strict compliance obligations.

**PayRail PH is engineered as a PCI-Conscious Orchestrator:**
* **Primary Acquisition Method:** Dynamic QR Ph (EMVCo specification) via PayMongo sandbox/APIs.
* **Card Processing Method:** Tokenized redirection / direct PSP tokenization.
* **Cardholder Data Environment (CDE) Boundary:** PayRail PH servers **never touch, store, or log raw Primary Account Numbers (PAN) or Card Verification Values (CVV/CVC)** in production.

---

## 2. Cardholder Data Storage Matrix

| Data Element | Storage Permitted? | PayRail PH Treatment |
|---|---|---|
| **Primary Account Number (PAN)** | Strictly Masked Only | Masked as `4111 11** **** 1111` (first 6 / last 4 only) for transaction identification and receipt display. Full PAN is discarded immediately upon tokenization. |
| **Card Verification Value (CVV/CVC/CAV2)** | **PROHIBITED** | **Never stored under any circumstance**, in PostgreSQL, memory buffers, ephemeral disks, or application logs. Dropped immediately post-authorization request. |
| **PIN / PIN Blocks** | **PROHIBITED** | Never accepted or processed. |
| **Cardholder Name** | Permitted with Business Need | Stored in UTF-8 text with role-based access control. |
| **Expiration Date** | Permitted with Business Need | Stored alongside masked PAN for card expiry notifications. |

---

## 3. Cryptographic Controls & Key Management
1. **Transport Layer Security (TLS):** Strict enforcement of TLS 1.3 (with fallback only to TLS 1.2 with secure cipher suites: `ECDHE-RSA-AES256-GCM-SHA384`).
2. **Encryption at Rest:** All PostgreSQL volumes and table spaces encrypted using AES-256 via AWS KMS Customer Managed Keys.
3. **Database Column Tokenization:** Merchant API secrets and session tokens stored using salted SHA-256 digests; reversible encryption uses AES-256-GCM with envelope encryption.

---

## 4. Operational & Engineering Safeguards
* **Log Redaction Filter:** Automated logging middleware strips headers like `authorization`, `cookie`, `x-card-cvv`, and patterns matching Luhn-valid 13-to-19 digit card numbers.
* **Ephemeral Memory Hygiene:** In-memory variables containing sensitive customer inputs are scoped to local function execution blocks and released to garbage collection immediately.
* **Separation of Duties:** Production database access is restricted via bastion hosts with mandatory MFA, session recording, and ephemeral credentials.
