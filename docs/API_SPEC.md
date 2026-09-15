# DarkOps - API Specification

The backend uses TanStack Start API routes (Nitro runtime) served from `/api/v1/`.

All requests require authentication via Supabase JWT (passed automatically in the httpOnly cookie) except where noted.
All request and response bodies use JSON.
Timestamps use ISO 8601 strings in UTC.

---

## 1. Authentication & Identity

### `GET /api/v1/me`

Retrieves the profile and role of the currently authenticated user.

**Response** (200 OK)

```json
{
  "id": "uuid",
  "email": "agent@darkops.com",
  "full_name": "Ananya Kulkarni",
  "role": "OPERATIONS_AGENT",
  "hub_city": "Bengaluru",
  "store_id": null
}
```

---

## 2. Executive Dashboard

### `GET /api/v1/executive/overview`

Requires role: `EXECUTIVE` or `ADMIN`.

**Response** (200 OK)

```json
{
  "store_count": 200,
  "critical_stores": 24,
  "avg_sla_pct": 94.2,
  "avg_refund_rate_pct": 4.1,
  "avg_pulse": 82,
  "active_cases": 124,
  "thirty_day_volume": [
    { "date": "2026-08-01", "complaints": 420, "refunds": 112 },
    ...
  ]
}
```

### `GET /api/v1/executive/alerts`

Retrieves active network-level alerts.

**Response** (200 OK)

```json
[
  {
    "id": "ALT-48219",
    "store_id": "DS-0012",
    "title": "Chiller failure",
    "detail": "Bay 4 chiller offline, 20% inventory at risk",
    "severity": "crit",
    "created_at": "2026-08-30T14:12:00Z"
  }
]
```

### `POST /api/v1/executive/insights`

Submits a natural language query against operational data.

**Request**

```json
{
  "query": "Which stores in Bangalore have SLA below 90% today?"
}
```

**Response** (200 OK)

```json
{
  "answer": "There are 4 stores in Bengaluru with SLA below 90% today...",
  "metrics": [{ "label": "Affected stores", "value": "4", "tone": "warn" }],
  "causes": ["Rider shortage", "Rain"],
  "stores": [{ "id": "DS-BLR-01", "note": "88% SLA" }],
  "action": "Rebalance rider pool from Koramangala hub.",
  "sources": "stores, cases (last 24h)"
}
```

---

## 3. Dark Stores

### `GET /api/v1/stores`

List all stores. Filters via query params (`?city=Bengaluru&zone=South&status=critical`).

**Response** (200 OK)

```json
{
  "data": [
    {
      "id": "DS-1462",
      "name": "Koramangala 4th Block DS",
      "city": "Bengaluru",
      "manager_name": "Rahul S.",
      "pulse": 58,
      "sla_pct": 88.5,
      "refund_rate_pct": 6.2,
      "open_issues": 12,
      "status": "critical"
    }
  ],
  "total": 200,
  "page": 1
}
```

### `GET /api/v1/stores/:id`

Get full details for a single store, including current PulseScore components.

**Response** (200 OK)

```json
{
  "id": "DS-1462",
  "name": "Koramangala 4th Block DS",
  "city": "Bengaluru",
  "pulse": 58,
  "breakdown": {
    "equipment": 15,
    "sla": 12,
    "refunds": 8,
    "delivery": 5,
    "picker": 2,
    "inventory": 0
  },
  "metrics": {
    "equipment_failures_14d": 3,
    "inventory_issues": 12,
    "delivery_delays": 45,
    "picker_delay_mins": 3.1
  }
}
```

### `GET /api/v1/stores/:id/work-orders`

List work orders for a specific store.

**Response** (200 OK)

```json
[
  {
    "id": "WO-77412",
    "asset_id": "FRZ-08",
    "asset_name": "Walk-in freezer Bay 2",
    "priority": "P1",
    "status": "open",
    "sla_due_at": "2026-08-30T10:12:00Z"
  }
]
```

---

## 4. Cases & Complaints

### `GET /api/v1/cases`

List complaints in the queue.
Supports pagination and filters (`?status=unassigned&priority=P1`).

**Response** (200 OK)

```json
{
  "data": [
    {
      "id": "CS-4100",
      "complaint_ref": "CMP-482137",
      "summary": "Melted ice cream, late delivery",
      "category": "quality_issue",
      "priority": "P1",
      "status": "unassigned",
      "sla_state": "at_risk",
      "age_mins": 145,
      "store_id": "DS-1462"
    }
  ],
  "total": 124,
  "page": 1
}
```

### `GET /api/v1/cases/:id`

Detailed view of a case.

### `POST /api/v1/cases/:id/assign`

Assign a case to an agent.
Requires role: `OPERATIONS_MANAGER` (can assign to anyone) or `OPERATIONS_AGENT` (can self-assign).

**Request**

```json
{
  "agent_id": "uuid"
}
```

### `POST /api/v1/cases/:id/escalate`

Escalates a case to L2.

**Request**

```json
{
  "note": "Requires store manager intervention regarding damaged freezer."
}
```

### `POST /api/v1/cases/:id/resolve`

Resolves a case.

**Request**

```json
{
  "resolution": "Refund approved and inventory cycle count initiated.",
  "note": "Refund processed successfully."
}
```

### `GET /api/v1/cases/:id/history`

Returns the status transition history and audit log for a case.

---

## 5. Fraud & Risk Review

### `GET /api/v1/fraud`

List flagged fraud reviews.
Requires role: `FRAUD_ANALYST`, `OPERATIONS_MANAGER`, `ADMIN`.

**Response** (200 OK)

```json
{
  "data": [
    {
      "id": "CMP-482000",
      "complaint_id": "CS-4099",
      "customer_name": "Aditya Menon",
      "store_id": "DS-1462",
      "refund_amount_paise": 45000,
      "risk_confidence": 92,
      "reason": "Velocity abuse: 4th high-value claim this month",
      "decision": "pending_review"
    }
  ]
}
```

### `GET /api/v1/fraud/:id`

Detailed view of a fraud risk case, including contributing factors.

**Response** (200 OK)

```json
{
  "id": "CMP-482000",
  "risk_confidence": 92,
  "decision": "pending_review",
  "factors": [
    { "label": "Claim velocity", "weight": 35, "evidence": "4 claims in 30 days" },
    { "label": "Item category", "weight": 20, "evidence": "High-risk electronics" }
  ],
  "customer": {
    "prior_claims_90d": 6,
    "upheld_claims_90d": 3,
    "lifetime_refund_value_paise": 350000
  },
  "history": []
}
```

### `POST /api/v1/fraud/:id/decision`

Record an analyst decision on a fraud case.
Requires role: `FRAUD_ANALYST`.

**Request**

```json
{
  "decision": "denied",
  "note": "Confirmed abuse pattern. Refund denied."
}
```

---

## 6. Customer

### `GET /api/v1/customer/orders`

Retrieves recent orders for the authenticated customer.
Requires role: `CUSTOMER`.

### `GET /api/v1/customer/complaints`

Retrieves open complaints and refund status for the authenticated customer.

### `POST /api/v1/customer/complaints`

Submit a new complaint.

**Request**

```json
{
  "order_id": "ORD-884213",
  "category": "quality_issue",
  "details": "Ice cream was melted."
}
```

---

## 7. Audit (Internal)

### `GET /api/v1/audit`

Retrieve the immutable audit log.
Requires role: `ADMIN`.

**Response** (200 OK)

```json
[
  {
    "id": "uuid",
    "actor_id": "uuid",
    "actor_role": "OPERATIONS_AGENT",
    "action": "complaint.assign",
    "resource_type": "complaint",
    "resource_id": "CS-4100",
    "occurred_at": "2026-08-30T10:05:00Z"
  }
]
```
