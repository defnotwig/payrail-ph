# AWS Production Architecture Blueprint & Enterprise Deployment

## 1. Executive Summary & Topology
This document specifies the production AWS deployment target for **PayRail PH**, evolving the local/Vercel demonstration environment into a high-availability, multi-AZ, PCI DSS-conscious payment orchestration infrastructure.

```
                      Internet Traffic
                             │
                      [ AWS Route 53 ] (DNS + Latency Routing)
                             │
                      [ AWS CloudFront + AWS WAF ] (DDoS, Rate Limiting, OWASP Top 10)
                             │
             ┌───────────────┴───────────────┐
             │                               │
    [ Public Web App (Next.js) ]    [ API Ingress (NestJS) ]
        (AWS ECS Fargate)              (Application Load Balancer)
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
          [ API Core Service (ECS) ]                 [ Webhook Ingress (ALB/ECS) ]
          - VPC Private App Subnets                  - VPC Private App Subnets
          - Multi-AZ (ap-southeast-1a/b/c)          - High-throughput ingress
                       │                                           │
         ┌─────────────┴─────────────┐                             │
         │                           │                             │
    [ PostgreSQL RDS ]         [ Amazon SQS ]                      │
    - Multi-AZ Aurora PG       - FIFO Outbox Queue                 │
    - KMS Encrypted at Rest    - Dead Letter Queue                 │
    - Row-level lock tuned           │                             │
                               [ Worker Tasks (ECS Fargate) ]──────┘
                               - Outbox Poller / Dispatcher
                               - Ledger Reconciliation Cron
```

---

## 2. Infrastructure Components

### 2.1 Networking & Segmentation (VPC Architecture)
* **Region:** `ap-southeast-1` (Singapore - optimal latency for the Philippines).
* **Availability Zones:** 3 AZs (`ap-southeast-1a`, `ap-southeast-1b`, `ap-southeast-1c`).
* **Subnet Tiers:**
  1. **Public Subnet:** Internet Gateways, NAT Gateways, Public ALBs.
  2. **Application Subnet (Private):** ECS Fargate tasks running Next.js and NestJS. Zero public IP allocation.
  3. **Database Subnet (Isolated Private):** Aurora PostgreSQL clusters, ElastiCache Redis. Zero direct route to Internet or NAT Gateways.

### 2.2 Compute Layer (AWS ECS Fargate)
* **Container Runtime:** Docker on AWS ECS Fargate (serverless container orchestration).
* **Auto-Scaling Policy:** Target Tracking scaling on CPU utilization (>65%) and ALB Request Count per Target (>1,200 req/min).
* **Graceful Termination:** 30s `SIGTERM` handling to allow in-flight database transactions to commit cleanly before container retirement.

### 2.3 Persistence Layer (Amazon Aurora PostgreSQL)
* **Engine:** Aurora PostgreSQL 16.x Multi-AZ cluster.
* **Storage Encryption:** AWS KMS Customer Managed Key (CMK) with automated annual key rotation.
* **Connection Pooling:** AWS RDS Proxy deployed in front of Aurora to eliminate connection storms and buffer during failovers (<3s failover time).
* **Backup & PITR:** Continuous automated backups with Point-in-Time Recovery (PITR) up to 35 days, replicated cross-region to `ap-northeast-1` for Disaster Recovery (DR).

### 2.4 Asynchronous Messaging & Dead Letter Queue (SQS & EventBridge)
* **Transactional Outbox Worker:** Dispatches events from `payrail_private.outbox_events` to Amazon SQS FIFO queues.
* **Dead Letter Queue (DLQ):** After 5 delivery attempts with exponential backoff and jitter, messages route to an SQS DLQ with CloudWatch alarms triggering PagerDuty.

### 2.5 Secrets & Key Management (AWS KMS + Secrets Manager)
* **KMS CMK:** Dedicated master key for encrypting merchant API keys and database volumes.
* **Secrets Manager:** Database credentials rotated automatically every 30 days via Lambda rotation functions.
* **Zero Secrets in Code:** ECS task definition fetches secrets at launch via IAM task execution roles.

---

## 3. High Availability, DR & Disaster Recovery

| Metric | Target | Technical Mechanism |
|---|---|---|
| **RPO (Recovery Point Objective)** | < 1 minute | Continuous WAL streaming to Aurora read replicas + S3 cross-region replication |
| **RTO (Recovery Time Objective)** | < 15 minutes | Aurora automated Multi-AZ failover + Terraform-automated infrastructure redeployment |
| **Availability SLO** | 99.95% | Multi-AZ ECS Fargate across 3 AZs with automated health checks |

---

## 4. Terraform / IaC Directory Blueprint
```text
terraform/
├── environments/
│   ├── staging/
│   │   ├── main.tf
│   │   └── variables.tf
│   └── production/
│       ├── main.tf
│       └── variables.tf
└── modules/
    ├── vpc/
    ├── ecs_cluster/
    ├── rds_aurora/
    ├── alb/
    ├── sqs_dlq/
    └── security_groups/
```
