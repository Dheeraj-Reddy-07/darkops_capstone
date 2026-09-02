# DarkOps — Architecture

## 1. Existing Codebase (What We Found)

### Framework Stack
| Layer | Technology |
|-------|-----------|
| Runtime framework | **TanStack Start** (SSR-capable React meta-framework) |
| Bundler / Dev server | **Vite 8.1** with `@lovable.dev/vite-tanstack-config` |
| Server runtime | **Nitro** (via `@lovable.dev/vite-tanstack-config`) |
| Router | **TanStack Router** (file-based, type-safe) |
| Data fetching | **TanStack Query v5** |
| UI components | **shadcn/ui** (Radix primitives + CVA) |
| Styling | **Tailwind CSS v4** |
| Charts | **Recharts** |
| Forms | **React Hook Form** + **Zod** |
| Language | **TypeScript 5.8** |

### ⚠ Critical Architectural Observation
This is **TanStack Start** — an SSR meta-framework, NOT a plain Vite SPA. The server entry is at `src/server.ts` and routes through **Nitro** (Cloudflare target by default). 

This means:
- We do NOT add a separate Express server in a different process
- Backend API routes live inside TanStack Start's **server functions** / API routes
- Nitro handles the server-side rendering and API in one deployment unit
- The Supabase service role key stays server-side inside TanStack Start server functions

### Existing Routes
```
/                           → redirects to /executive
/executive                  → Executive dashboard (KPIs, charts, heatmap)
/executive/insights         → Analytics assistant (Q&A over operational data)
/operations                 → Operations queue (cases, SLA, agent workload)
/cases/:id                  → Case detail (classification, timeline, actions)
/dark-stores                → Store network table (200 stores, filters)
/dark-stores/:id            → Store detail (PulseScore, equipment, work orders)
/dark-stores/:id/pulse      → PulseScore breakdown detail
/fraud                      → Fraud/risk queue
/fraud/:id                  → Fraud case detail (analyst decision panel)
/customer                   → Customer home (orders, active issue, refunds)
/customer/support           → Complaint submission form
```

### Existing Mock Data (all in `src/lib/mock/`)
| File | Contents |
|------|----------|
| `stores.ts` | 200 dark stores across 14 Indian cities, PulseScore formula (100 − deductions), OVERRIDES for named stores |
| `network.ts` | Executive KPIs, 30d volume series, red alerts, city stats, notifications |
| `cases.ts` | 64 case records, 6 agents, queue KPIs, priority mix, timeline generator |
| `fraud.ts` | 14 fraud cases (subset of refund cases), risk factors, FRAUD_KPIS |
| `insights.ts` | 5 pre-written Q&A answers + fallback for arbitrary questions |
| `customer.ts` | Single customer (Aditya Menon), 4 orders, active issue, refunds |
| `random.ts` | Deterministic PRNG (mulberry32 + hashString → rngFor) |
| `format.ts` | `inr()`, `num()`, `pct()`, `istClock()`, `ageLabel()` utilities |

### Existing Key Interfaces (from mock data)
```typescript
DarkStore { id, name, city, zone, manager, pulse, prevPulse, sla, refundRate,
            avgResolutionMins, openIssues, status, pickers, riders,
            equipmentFailures14d, inventoryIssues, deliveryDelays, pickerDelayMins,
            breakdown: PulseBreakdown }

PulseBreakdown { equipment, sla, refunds, delivery, picker, inventory }
// PulseScore = max(12, 100 − sum(breakdown))

CaseRecord { id, complaintId, summary, detail, storeId, storeName, city,
             priority, agentId, status, sla, slaDueIST, ageMins,
             customerName, customerId, orderId, orderValue, refundAmount,
             partner, partnerId, type, category, urgency, sentiment,
             qcScore, classifierConfidence, resolution, resolvedNote }

FraudCase { id, caseId, complaintId, customerName, customerId, storeId,
            storeName, orderId, orderValue, refundAmount, confidence, reason,
            decision, priorClaims, upheldClaims, factors[], history[] }

Agent { id, name, hub, load, capacity }
```

### PulseScore Formula (from existing code)
```
breakdown = { equipment: 0-25, sla: 0-25, refunds: 0-20,
              delivery: 0-15, picker: 0-10, inventory: 0-10 }
deduction = sum(breakdown values)
pulse = max(12, 100 - deduction)
```

### Existing Business Logic
- **Case statuses**: Unassigned → Assigned → In progress → Awaiting customer → Escalated — L2 → Resolved
- **SLA states**: on-track (< 150 min), at-risk (150–240 min), breached (> 240 min)
- **Fraud decisions**: Pending review → Approved / Denied / Escalated
- **Store statuses**: critical (pulse < 60), at-risk (60–79), healthy (≥ 80)
- **Priorities**: P1, P2, P3, P4
- **Case types**: Refund, Reorder, Operational investigation
- **Complaint categories**: Late delivery, Quality issue, Missing item, Wrong item, Damaged item, Payment issue

---

## 2. Target Production Architecture

### Deployment Model
```
┌─────────────────────────────────────────────────────┐
│          TanStack Start + Nitro (Node.js)            │
│                                                      │
│  ┌──────────────┐    ┌────────────────────────────┐  │
│  │  React SSR   │    │  API Routes / Server Fns   │  │
│  │  (existing   │    │  /api/v1/*                 │  │
│  │   Lovable UI)│    │  (NEW — server-side only)  │  │
│  └──────────────┘    └────────────────┬───────────┘  │
│                                       │              │
└───────────────────────────────────────┼──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │      Supabase              │
                          │  ┌─────────┐ ┌──────────┐  │
                          │  │PostgreSQL│ │   Auth   │  │
                          │  │ (RLS)   │ │(JWT/magic│  │
                          │  └─────────┘ │  link)   │  │
                          │  ┌─────────┐ └──────────┘  │
                          │  │Storage  │ ┌──────────┐  │
                          │  │(evidence│ │Realtime  │  │
                          │  │ files)  │ │(cases,   │  │
                          │  └─────────┘ │ fraud)   │  │
                          │              └──────────┘  │
                          └────────────────────────────┘
```

### Key Architectural Decisions

1. **Backend = TanStack Start API routes (Nitro)**, NOT a separate Express process.
   - TanStack Start supports API routes at `src/routes/api/...` 
   - Nitro handles all server-side code
   - Service role key lives in Nitro environment, never in browser bundles

2. **Authentication = Supabase Auth**
   - JWT stored in httpOnly cookie via Supabase SSR helpers
   - Server functions validate the JWT from the cookie
   - Frontend never holds the service role key

3. **Database = Supabase PostgreSQL**
   - Full relational schema based on existing mock data structures
   - Row Level Security for multi-tenant data isolation
   - Supabase service client (service role) used ONLY in server-side API routes

4. **Frontend data fetching**
   - TanStack Query fetches from `/api/v1/...` endpoints
   - Existing mock data imports are replaced one route at a time
   - Loading/error states use existing `LoadingState`/`ErrorState` primitives

### Directory Structure (Target)
```
d:/Deloitte Capstone/DarkOps/
├── src/
│   ├── routes/
│   │   ├── __root.tsx              (existing — add auth guard)
│   │   ├── index.tsx               (existing — redirect)
│   │   ├── executive.index.tsx     (existing — replace mock imports)
│   │   ├── executive.insights.tsx  (existing — replace mock imports)
│   │   ├── operations.tsx          (existing — replace mock imports)
│   │   ├── cases.$id.tsx           (existing — replace mock imports)
│   │   ├── dark-stores.index.tsx   (existing — replace mock imports)
│   │   ├── dark-stores.$id.index.tsx (existing — replace mock imports)
│   │   ├── dark-stores.$id.pulse.tsx (existing — replace mock imports)
│   │   ├── fraud.index.tsx         (existing — replace mock imports)
│   │   ├── fraud.$id.tsx           (existing — replace mock imports)
│   │   ├── customer.index.tsx      (existing — replace mock imports)
│   │   ├── customer.support.tsx    (existing — replace mock imports)
│   │   ├── login.tsx               (NEW)
│   │   └── api/                    (NEW — Nitro API routes)
│   │       ├── v1/
│   │       │   ├── me.ts
│   │       │   ├── executive/
│   │       │   │   ├── overview.ts
│   │       │   │   ├── complaints-trend.ts
│   │       │   │   ├── store-health.ts
│   │       │   │   ├── alerts.ts
│   │       │   │   └── insights.ts
│   │       │   ├── cases/
│   │       │   │   ├── index.ts
│   │       │   │   ├── [id].ts
│   │       │   │   ├── [id]/assign.ts
│   │       │   │   ├── [id]/escalate.ts
│   │       │   │   ├── [id]/comments.ts
│   │       │   │   └── [id]/history.ts
│   │       │   ├── stores/
│   │       │   │   ├── index.ts
│   │       │   │   ├── [id].ts
│   │       │   │   ├── [id]/metrics.ts
│   │       │   │   ├── [id]/pulse-score.ts
│   │       │   │   ├── [id]/work-orders.ts
│   │       │   │   └── [id]/complaints.ts
│   │       │   ├── fraud/
│   │       │   │   ├── index.ts
│   │       │   │   ├── [id].ts
│   │       │   │   ├── [id]/decision.ts
│   │       │   │   └── [id]/escalate.ts
│   │       │   ├── customer/
│   │       │   │   ├── orders.ts
│   │       │   │   ├── complaints.ts
│   │       │   │   └── complaints/index.ts
│   │       │   ├── notifications/
│   │       │   │   ├── index.ts
│   │       │   │   └── [id]/read.ts
│   │       │   └── audit.ts
│   ├── lib/
│   │   ├── mock/                   (existing — kept for dev/seed reference)
│   │   ├── api-client.ts           (NEW — typed fetch wrapper)
│   │   ├── supabase/
│   │   │   ├── client.ts           (NEW — browser Supabase client, anon key)
│   │   │   └── server.ts           (NEW — server Supabase client, service role)
│   │   ├── auth.ts                 (NEW — auth helpers)
│   │   ├── rbac.ts                 (NEW — role/permission definitions)
│   │   └── utils.ts                (existing)
│   ├── types/
│   │   ├── api.ts                  (NEW — API request/response types)
│   │   ├── domain.ts               (NEW — domain entity types)
│   │   └── auth.ts                 (NEW — auth/RBAC types)
│   └── hooks/
│       ├── use-mobile.tsx          (existing)
│       ├── use-auth.ts             (NEW)
│       ├── use-executive.ts        (NEW)
│       ├── use-cases.ts            (NEW)
│       ├── use-stores.ts           (NEW)
│       └── use-fraud.ts            (NEW)
├── database/
│   ├── migrations/
│   │   ├── 001_extensions.sql
│   │   ├── 002_enums.sql
│   │   ├── 003_profiles_roles.sql
│   │   ├── 004_stores.sql
│   │   ├── 005_customers_orders.sql
│   │   ├── 006_complaints.sql
│   │   ├── 007_operations.sql
│   │   ├── 008_fraud.sql
│   │   ├── 009_pulsescore.sql
│   │   ├── 010_notifications.sql
│   │   ├── 011_audit.sql
│   │   ├── 012_rls.sql
│   │   ├── 013_indexes.sql
│   │   └── 014_seed.sql
│   └── seed/
│       └── seed.ts                 (deterministic seed script)
└── docs/
    ├── ARCHITECTURE.md             (this file)
    ├── IMPLEMENTATION_PLAN.md
    ├── DATA_MODEL.md
    ├── API_SPEC.md
    ├── API.md
    └── SECURITY.md
```

### Environment Variables
```
# Frontend (Vite public — browser-safe)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Server-only (Nitro runtime — never in browser bundle)
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=           # optional, for executive insights LLM
AI_PROVIDER=openai        # or "rule-engine" (deterministic fallback)
```
