# DarkOps — Dark-Store Operations & Resolution-Care Platform

> Real-time operational intelligence and customer resolution-care for a quick-commerce dark-store network — one control plane spanning executives, operations, store managers, support teams, and customers.

DarkOps is a role-aware operations platform for a quick-commerce (10–20 minute delivery) business. It ties together the two things that make or break quick-commerce: **the physical health of the dark stores** (cold-chain, pickers, delivery, inventory) and **the resolution of customer complaints** against strict SLAs. Every number on every dashboard is computed from the database — there are no hardcoded metrics, no mocked "AI" verdicts, and no fabricated capabilities.

---

## The problem we're solving

Quick-commerce runs on razor-thin promises: an order in 10 minutes, a fresh product, a refund before the customer churns. When something breaks — a chiller fails, a picker falls behind, a batch spoils — the damage cascades into complaints, refunds, and reputation loss within minutes, not days.

The people who run this business are fragmented across tools:

- **Executives** can't see, in one place, whether the network is healthy _right now_ or which stores are about to blow their SLAs.
- **Operations** juggle a live queue of cases with no consistent way to prioritise by SLA risk or balance agent workload.
- **Store managers** react to equipment failures after they've already caused spoilage.
- **Support teams** lose tickets in shared inboxes, can't tell who's assigned what, and have no visibility into agent performance.
- **Customers** are left in the dark on a complaint until an agent happens to pick it up.

DarkOps unifies all of this into a single, role-scoped application: a **PulseScore** that quantifies each store's health, an **SLA engine** that tracks every complaint against a resolution deadline, an **auto-assignment + auto-resolution** pipeline that keeps the queue moving, and **persona-specific consoles** so each user sees exactly what they need and nothing they shouldn't.

---

## Who it's for (personas)

| Persona              | What they get                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Platform Admin**   | Admin console: DB-backed platform metrics, a computed Security Center, user management (roles/deactivation), an audit log, a store directory, and settings. |
| **Executive**        | Network dashboard: live PulseScore, SLA compliance, critical-store identification, and a natural-language executive copilot that answers from live data. |
| **Operations**       | Live case queue with SLA-risk prioritisation, agent workload balancing, escalation, and store monitoring.        |
| **Store Manager**    | Their own store's health, equipment/work orders, and performance trend.                                          |
| **Customer Support** | Agent workspace with auto-assigned tickets; **Support Leads** additionally get a team-performance dashboard and workload/queue allocation view. |
| **Customer**         | Self-service portal: order tracking, complaint submission, an AI assistant, and live support that unlocks on SLA breach. |

---

## Feature highlights

- **PulseScore** — a composite 0–100 store-health score computed from equipment health, SLA compliance, refund rate, delivery performance, picker efficiency, and inventory accuracy. Constrained to a floor so a struggling store never reads as a hard zero.
- **SLA engine** — every complaint carries a priority (P1–P4) with a resolution deadline; state moves `on_track → at_risk → breached`. Live customer support only unlocks once a complaint is open **and** past its SLA deadline — never before.
- **Auto-assignment** — new support tickets are automatically routed to the agent with the fewest open tickets, so nothing lands in an unowned queue.
- **Threshold-gated auto-resolution** — low-risk refund claims are settled automatically under strict, explicit rules (prior claims ≤ 2, order value ≤ ₹500, confidence threshold). Anything outside the envelope escalates to a human.
- **Complaint intake API** — an external, HMAC-SHA256-signed ingestion endpoint (`POST /api/v1/intake/complaints`) with timestamp + payload verification for trusted upstream systems.
- **Executive copilot & customer assistant** — weighted-scoring intent classification over live data (no external LLM calls), with a realistic "thinking" delay and structured, rendered answers.
- **Risk-flagging (fraud review)** — refund/complaint risk scoring with explainable risk factors and a human decision workflow (approve / deny / escalate). Not an AI oracle — a scored queue with a reviewer in the loop.
- **Notifications** — an RLS-scoped notification bell shared across every persona shell, routing each recipient to the record they're allowed to open.
- **Dark / light theme** across the whole app, **PWA installability**, and an **Android build** via Capacitor.

---

## Tech stack

**Frontend**

- React 19 + Vite (Rolldown)
- TanStack Router (file-based routes) + TanStack Query
- Tailwind CSS v4 + shadcn/ui (Radix primitives)
- Recharts, Lucide icons, Sonner toasts

**Backend**

- Node.js + Express 5
- Supabase (PostgreSQL + Auth + Row-Level Security)
- Zod request validation, Helmet, rate limiting, correlation-ID + centralised error middleware
- Service-role client for server-side reads with authorization enforced in code (`requireAuth` / `requirePermission`)

**Mobile / PWA**

- Capacitor (Android) + web app manifest, with an automated APK build workflow

---

## Architecture

```
Browser / PWA / Android (Capacitor)
        │
        ▼
React 19 + TanStack Router  ──►  TanStack Query cache (single shared QueryClient)
        │  fetch (JWT / mock token)
        ▼
Express 5 API  ──►  middleware: auth · authorization (RBAC) · validation (Zod) · rate-limit · correlation · errors
        │
        ▼
Controllers ──► Services (business logic: SLA, auto-assign, auto-resolve, PulseScore, copilot)
        │
        ▼
Supabase Postgres  ◄── Row-Level Security ──►  Supabase Auth (JWT)
```

**Access control is enforced twice.** The client uses an RBAC map (`src/lib/rbac.ts`) to gate routes and UI; the server independently enforces role permissions on every request (`server/lib/rbac.ts` + authorization middleware). The client map is UX, not security — the server is the source of truth.

**Auth modes.** The app runs against real Supabase Auth when configured, and falls back to a deterministic mock-auth mode for local demos (session in `localStorage`, `mock-token-<email>` bearer tokens). Identity is resolved real-session-first to avoid stale-identity flashes when switching accounts.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project (Postgres + Auth), or use mock-auth mode for a no-backend demo

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create a `.env` in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Apply the schema

Run the SQL migrations in `database/migrations/` in numeric order against your Supabase database.

### 4. Seed realistic demo data

```bash
npm run seed
```

This idempotently seeds a full, demo-ready dataset: tiered store health, hundreds of complaints and orders spread smoothly over recent weeks, a curated customer journey, support agents with live ticket assignments, and explainable risk factors — all written straight into the database (nothing hardcoded in the UI).

### 5. Run

```bash
# Terminal 1 — frontend
npm run dev:client      # http://localhost:5173

# Terminal 2 — backend
npm run dev:server      # http://localhost:5001
```

### Build & verify

```bash
npm run build:client    # Vite production build
npm run build:server    # tsc typecheck/build of the server
npm run lint            # ESLint + Prettier
```

### Mobile (Android)

```bash
npm run build:mobile    # build web assets + cap sync android
npm run cap:open:android
```

---

## Demo accounts

All demo users share the password **`password123`**.

| Role                  | Email                      | Notes                                          |
| --------------------- | -------------------------- | ---------------------------------------------- |
| Platform Admin        | `admin@darkops.com`        | Admin console, security center, audit logs     |
| Executive             | `exec@darkops.com`         | Network dashboard + executive copilot          |
| Operations            | `manager@darkops.com`      | Case queue, store monitoring                   |
| Store Manager         | `storemanager@darkops.com` | Own store health & work orders                 |
| Support Lead          | `support@darkops.com`      | Agent workspace **+ team performance / workload** |
| Support Agent         | `agent.a@darkops.com`      | Agent workspace only (also `agent.b`, `agent.c`) |
| Customer              | `customer@darkops.com`     | Self-service portal, curated demo journey      |

---

## Project structure

```
darkops_capstone/
├── database/
│   ├── migrations/          # SQL migrations (apply in order)
│   ├── seed.ts              # Idempotent, realistic demo seeding
│   └── ...
├── server/
│   ├── controllers/         # Request handlers per domain
│   ├── services/            # Business logic (SLA, auto-assign, auto-resolve, copilot)
│   ├── middleware/          # auth, authorization, validation, rate-limit, correlation, errors
│   ├── lib/                 # rbac, supabase client, dto, sanitize, validation
│   ├── routes/              # Route definitions
│   └── index.ts             # Express entry point
├── src/
│   ├── routes/              # TanStack Router file-based routes
│   ├── components/          # UI + persona shells
│   ├── hooks/               # Data hooks (TanStack Query)
│   ├── lib/                 # rbac, current-user, supabase client, queryClient
│   └── main.tsx             # Frontend entry point
├── docs/                    # Architecture, product & data-model specs
└── package.json
```

---

## Key domain concepts

### PulseScore (0–100)

A composite store-health metric derived from equipment health, SLA compliance, refund rate, delivery performance, picker efficiency, and inventory accuracy. It's floored so a failing store degrades gracefully rather than collapsing to zero.

### SLA targets

| Priority        | Resolution target |
| --------------- | ----------------- |
| P1 (Critical)   | 15 minutes        |
| P2 (High)       | 30 minutes        |
| P3 (Medium)     | 2 hours           |
| P4 (Low)        | 4 hours           |

A complaint's `sla_state` transitions `on_track → at_risk → breached` as its deadline approaches and passes. **Live customer support only becomes available after a breach** — a just-raised complaint will not show live support.

---

## Security posture

- **Row-Level Security** on Supabase tables; the server's service-role client is only used behind explicit, code-enforced authorization checks.
- **Dual RBAC** — client-side route/UI gating plus authoritative server-side permission checks on every request.
- **Validated input** — Zod schemas on request bodies; sanitisation helpers for user-supplied content.
- **Hardened transport** — Helmet headers, CORS allow-list, rate limiting, correlation IDs, and centralised error handling that avoids leaking internals.
- **Signed external intake** — the complaint-intake endpoint requires an HMAC-SHA256 signature and a fresh timestamp.
- **No external AI / no data exfiltration** — the executive copilot and customer assistant classify intent and answer from live data locally; no complaint or customer data is sent to third-party services.

See `SECURITY.md`, `SECURITY_AUDIT.md`, and `THREAT_MODEL.md` for details.

---

## Documentation

- `docs/ARCHITECTURE.md` — system architecture
- `docs/PRODUCT_SPEC.md` / `docs/DARKOPS_PRODUCT_SPEC.md` — product specification
- `docs/DATA_MODEL.md` — database schema & relationships
- `docs/API_SPEC.md` — API surface
- `docs/DEMO_GUIDE.md` — guided demo walkthrough

---

## License

Built as a Deloitte Capstone project.
