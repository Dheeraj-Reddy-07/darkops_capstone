# DarkOps — Data Model

Derived from the existing mock data structures and product workflows observed in the Lovable prototype.

---

## Domain Overview

```
┌──────────────┐     ┌─────────────┐     ┌───────────────┐
│   profiles   │     │    stores   │     │   customers   │
│  (auth users)│     │ (200 dark   │     │               │
└──────┬───────┘     │  stores)    │     └───────┬───────┘
       │             └──────┬──────┘             │
       │                   │                    │
       │             ┌──────┴──────┐     ┌──────┴───────┐
       │             │pulse_scores │     │    orders    │
       │             │(historical) │     │              │
       │             └─────────────┘     └──────┬───────┘
       │                                        │
       │     ┌─────────────────────────────────┐│
       │     │         complaints              ││
       │     │  (unified case management)      ││
       │     └───────────────┬─────────────────┘│
       │                     │                  │
       │             ┌───────┴──────┐           │
       │             │ assignments  │           │
       │             │ escalations  │           │
       │             │  comments    │           │
       │             └──────────────┘           │
       │                                        │
       │     ┌────────────────────────────────┐ │
       │     │        fraud_reviews           │ │
       │     │  (risk scoring + decisions)    │ │
       │     └────────────────────────────────┘ │
       │                                        │
       └────────────────┐                       │
                   ┌────┴────────────────────────┴──┐
                   │           audit_logs           │
                   │  (immutable event log)         │
                   └────────────────────────────────┘
```

---

## Tables

### Identity & RBAC

#### `profiles`

```sql
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          app_role NOT NULL DEFAULT 'OPERATIONS_AGENT',
  hub_city      TEXT,           -- For agents: their assigned hub city
  store_id      TEXT,           -- For STORE_MANAGER: their store
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Role Enum

```sql
CREATE TYPE app_role AS ENUM (
  'ADMIN',
  'EXECUTIVE',
  'OPERATIONS_MANAGER',
  'OPERATIONS_AGENT',
  'FRAUD_ANALYST',
  'STORE_MANAGER',
  'CUSTOMER'
);
```

---

### Stores

#### `stores`

```sql
CREATE TABLE stores (
  id                    TEXT PRIMARY KEY,          -- e.g. "DS-1462"
  name                  TEXT NOT NULL,             -- e.g. "Kolkata Central DS"
  city                  TEXT NOT NULL,
  zone                  TEXT NOT NULL,             -- North/South/East/West/Central
  manager_name          TEXT NOT NULL,
  manager_profile_id    UUID REFERENCES profiles(id),
  pickers_on_shift      INT NOT NULL DEFAULT 12,
  riders_assigned       INT NOT NULL DEFAULT 8,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `store_metrics_snapshots`

Hourly snapshot of key operational metrics (avoids expensive real-time aggregation).

```sql
CREATE TABLE store_metrics_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              TEXT NOT NULL REFERENCES stores(id),
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_pct               NUMERIC(5,2) NOT NULL,
  refund_rate_pct       NUMERIC(5,2) NOT NULL,
  avg_resolution_mins   INT NOT NULL,
  open_issues           INT NOT NULL DEFAULT 0,
  equipment_failures_14d INT NOT NULL DEFAULT 0,
  inventory_issues      INT NOT NULL DEFAULT 0,
  delivery_delays       INT NOT NULL DEFAULT 0,
  picker_delay_mins     NUMERIC(4,1) NOT NULL DEFAULT 2.5
);
```

---

### PulseScore

#### `pulse_scores`

```sql
CREATE TABLE pulse_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          TEXT NOT NULL REFERENCES stores(id),
  score             INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  -- Breakdown (penalty points each)
  equipment_pts     INT NOT NULL DEFAULT 0 CHECK (equipment_pts BETWEEN 0 AND 25),
  sla_pts           INT NOT NULL DEFAULT 0 CHECK (sla_pts BETWEEN 0 AND 25),
  refunds_pts       INT NOT NULL DEFAULT 0 CHECK (refunds_pts BETWEEN 0 AND 20),
  delivery_pts      INT NOT NULL DEFAULT 0 CHECK (delivery_pts BETWEEN 0 AND 15),
  picker_pts        INT NOT NULL DEFAULT 0 CHECK (picker_pts BETWEEN 0 AND 10),
  inventory_pts     INT NOT NULL DEFAULT 0 CHECK (inventory_pts BETWEEN 0 AND 10),
  -- Audit
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Computed: score = max(12, 100 - sum(all_pts))
  CONSTRAINT valid_score CHECK (
    score = GREATEST(12, 100 - (equipment_pts + sla_pts + refunds_pts + delivery_pts + picker_pts + inventory_pts))
  )
);
```

---

### Customers & Orders

#### `customers`

```sql
CREATE TABLE customers (
  id                TEXT PRIMARY KEY,              -- e.g. "CU-771204"
  profile_id        UUID UNIQUE REFERENCES profiles(id),
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE,
  phone             TEXT,
  city              TEXT,
  address           TEXT,
  prior_claims_90d  INT NOT NULL DEFAULT 0,
  upheld_claims_90d INT NOT NULL DEFAULT 0,
  account_standing  TEXT NOT NULL DEFAULT 'good' CHECK (account_standing IN ('good','restricted','banned')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `orders`

```sql
CREATE TABLE orders (
  id                TEXT PRIMARY KEY,              -- e.g. "ORD-884213"
  customer_id       TEXT NOT NULL REFERENCES customers(id),
  store_id          TEXT NOT NULL REFERENCES stores(id),
  placed_at         TIMESTAMPTZ NOT NULL,
  status            order_status NOT NULL DEFAULT 'packing',
  total_amount_paise BIGINT NOT NULL,              -- store in paise (₹ × 100)
  item_count        INT NOT NULL DEFAULT 0,
  items_preview     TEXT,
  delivery_partner  TEXT,
  delivery_partner_id TEXT,
  eta_at            TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE order_status AS ENUM (
  'packing', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'refund_in_progress'
);
```

---

### Complaints & Cases

#### `complaints`

The unified case record — one complaint per customer issue.

```sql
CREATE TABLE complaints (
  id                  TEXT PRIMARY KEY,            -- e.g. "CS-4100"
  complaint_ref       TEXT NOT NULL UNIQUE,        -- e.g. "CMP-482137"
  customer_id         TEXT NOT NULL REFERENCES customers(id),
  order_id            TEXT NOT NULL REFERENCES orders(id),
  store_id            TEXT NOT NULL REFERENCES stores(id),
  summary             TEXT NOT NULL,
  detail              TEXT NOT NULL,
  category            complaint_category NOT NULL,
  type                complaint_type NOT NULL,
  priority            priority_level NOT NULL DEFAULT 'P3',
  status              complaint_status NOT NULL DEFAULT 'unassigned',
  sla_state           sla_state NOT NULL DEFAULT 'on-track',
  sla_due_at          TIMESTAMPTZ,
  assigned_agent_id   UUID REFERENCES profiles(id),
  order_value_paise   BIGINT NOT NULL DEFAULT 0,
  refund_amount_paise BIGINT NOT NULL DEFAULT 0,
  urgency             TEXT,
  sentiment           TEXT,
  qc_score            INT CHECK (qc_score BETWEEN 0 AND 100),
  classifier_confidence INT CHECK (classifier_confidence BETWEEN 0 AND 100),
  resolution          TEXT,
  resolved_note       TEXT,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE complaint_category AS ENUM (
  'late_delivery','quality_issue','missing_item','wrong_item','damaged_item','payment_issue','other'
);
CREATE TYPE complaint_type AS ENUM ('refund','reorder','operational_investigation');
CREATE TYPE priority_level AS ENUM ('P1','P2','P3','P4');
CREATE TYPE complaint_status AS ENUM (
  'unassigned','assigned','in_progress','awaiting_customer','escalated_l2','resolved'
);
CREATE TYPE sla_state AS ENUM ('on_track','at_risk','breached');
```

#### `complaint_status_history`

Immutable status change log.

```sql
CREATE TABLE complaint_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    TEXT NOT NULL REFERENCES complaints(id),
  from_status     complaint_status,
  to_status       complaint_status NOT NULL,
  changed_by      UUID REFERENCES profiles(id),
  note            TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `complaint_comments`

```sql
CREATE TABLE complaint_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    TEXT NOT NULL REFERENCES complaints(id),
  author_id       UUID NOT NULL REFERENCES profiles(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Operations

#### `work_orders`

Maintenance/repair tickets raised against store assets.

```sql
CREATE TABLE work_orders (
  id              TEXT PRIMARY KEY,               -- e.g. "WO-77412"
  store_id        TEXT NOT NULL REFERENCES stores(id),
  asset_id        TEXT NOT NULL,                  -- e.g. "FRZ-08"
  asset_name      TEXT NOT NULL,
  priority        priority_level NOT NULL,
  status          work_order_status NOT NULL DEFAULT 'open',
  sla_due_at      TIMESTAMPTZ,
  assigned_to     UUID REFERENCES profiles(id),
  description     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE work_order_status AS ENUM (
  'open','assigned','in_progress','awaiting_parts','resolved','cancelled'
);
```

#### `alerts`

Network-wide operational alerts (the "Red Alerts" panel).

```sql
CREATE TABLE alerts (
  id              TEXT PRIMARY KEY,               -- e.g. "ALT-48219"
  store_id        TEXT REFERENCES stores(id),
  title           TEXT NOT NULL,
  detail          TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('crit','warn','info')),
  is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Fraud & Risk

#### `fraud_reviews`

```sql
CREATE TABLE fraud_reviews (
  id                    TEXT PRIMARY KEY,          -- complaint_ref e.g. "CMP-482000"
  complaint_id          TEXT NOT NULL REFERENCES complaints(id),
  customer_id           TEXT NOT NULL REFERENCES customers(id),
  risk_confidence       INT NOT NULL CHECK (risk_confidence BETWEEN 0 AND 100),
  reason                TEXT NOT NULL,
  decision              fraud_decision NOT NULL DEFAULT 'pending_review',
  decided_by            UUID REFERENCES profiles(id),
  decision_note         TEXT,
  decided_at            TIMESTAMPTZ,
  ai_model              TEXT,                      -- "rule-engine" or "gpt-4o"
  ai_model_version      TEXT,
  flagged_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE fraud_decision AS ENUM (
  'pending_review','approved','denied','escalated'
);
```

#### `fraud_risk_factors`

```sql
CREATE TABLE fraud_risk_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_review_id TEXT NOT NULL REFERENCES fraud_reviews(id),
  label           TEXT NOT NULL,
  weight          INT NOT NULL,
  evidence        TEXT NOT NULL
);
```

#### `fraud_review_history`

```sql
CREATE TABLE fraud_review_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_review_id TEXT NOT NULL REFERENCES fraud_reviews(id),
  actor_id        UUID REFERENCES profiles(id),
  actor_label     TEXT NOT NULL,
  action          TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Notifications

#### `notifications`

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL,
  meta            TEXT,
  link_type       TEXT,                           -- "store"|"operations"|"fraud"
  link_ref        TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Audit

#### `audit_logs`

Append-only. No UPDATE/DELETE allowed (enforced by RLS).

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES profiles(id),
  actor_role      TEXT NOT NULL,
  action          TEXT NOT NULL,                  -- e.g. "complaint.assign"
  resource_type   TEXT NOT NULL,                  -- e.g. "complaint"
  resource_id     TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  ip_address      INET,
  correlation_id  TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Key Relationships Summary

| Child Table              | Parent                    | FK                    | Notes                          |
| ------------------------ | ------------------------- | --------------------- | ------------------------------ |
| profiles                 | auth.users                | id                    | 1:1                            |
| stores                   | —                         | —                     | Root entity                    |
| pulse_scores             | stores                    | store_id              | Many per store (history)       |
| store_metrics_snapshots  | stores                    | store_id              | Hourly snapshots               |
| customers                | profiles                  | profile_id            | Optional (ops agents see all)  |
| orders                   | customers, stores         | customer_id, store_id |                                |
| complaints               | customers, orders, stores |                       | Central entity                 |
| complaint_status_history | complaints                | complaint_id          | Immutable                      |
| complaint_comments       | complaints                | complaint_id          |                                |
| work_orders              | stores                    | store_id              |                                |
| alerts                   | stores                    | store_id              | Optional (network-wide alerts) |
| fraud_reviews            | complaints, customers     |                       |                                |
| fraud_risk_factors       | fraud_reviews             | fraud_review_id       |                                |
| fraud_review_history     | fraud_reviews             | fraud_review_id       |                                |
| notifications            | profiles                  | recipient_id          |                                |
| audit_logs               | profiles                  | actor_id              | Append-only                    |
