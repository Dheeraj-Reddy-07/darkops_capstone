# DarkOps — Full-Stack Implementation Plan

This document outlines the strict, step-by-step phased plan to transition the DarkOps prototype from deterministic client-side mock data to a production-ready enterprise full-stack application.

## Core Directives

1. **Preserve the UI**: The existing Lovable-generated frontend is the source of truth. We will not rebuild it, change its visual design, or remove pages.
2. **Security is Non-Negotiable**: Supabase Auth, RBAC, and RLS will be implemented securely. The service role key will NEVER reach the browser.
3. **Database Integrity**: Workflows (like case assignment or fraud decision) will be transactional. Audit logging is immutable.
4. **Deterministic Insights**: The first production version will use a deterministic insights engine based on real metrics, architected to allow future LLM pluggability.

## Implementation Sequence

### PHASE 0: Existing Codebase Inspection (DONE)

- Mapped all routes, mock data structures, and workflows.

### PHASE 1: Architecture & Security Model (DONE)

- Locked in TanStack Start (Nitro) architecture.
- Documented data model, API contract, and stricnpm run dt RBAC/RLS policies.

### PHASE 2: Database Migrations

- Write and execute versioned SQL migrations for schema, enums, constraints, RLS, and functions.
- _Note: SQL execution against hosted Supabase will be done manually by the user._

### PHASE 3: Supabase Auth

- Implement `profiles`, `roles`, and `permissions`.
- Set up session handling and cookie management.

### PHASE 4: Secure Nitro Backend Foundation

- Build auth middleware, RBAC checks, input validation (Zod), standard error formats, and rate limiting.

### PHASE 5: Seed Database

- Write a server-side seed script (`database/seed.ts`) to deterministically migrate the existing mock data into the relational tables, preserving recognizable entities (e.g., `DS-1462`).

### PHASE 6: Case/Complaint Workflow

- Build API routes and transactional logic for case assignment, escalation, and resolution.

### PHASE 7: Dark Store & PulseScore Workflow

- Build API routes for store metrics, work orders, and explainable PulseScore calculation.

### PHASE 8: Fraud Workflow

- Build API routes for fraud queue fetching and fraud review decisions.

### PHASE 9: Executive Aggregation & Insights

- Implement aggregate metrics endpoints and the deterministic rule-engine for Executive Insights.

### PHASE 10: Frontend API Integration

- Gradually replace `src/lib/mock/*` imports with TanStack Query hooks fetching from the new `/api/v1/*` routes.
- Add robust loading, error, and empty states.

### PHASE 11: Customer Workflows

- Build and integrate API routes for the customer portal (order tracking, complaint submission).

### PHASE 12: Testing & Security Verification

- Ensure automated tests, RBAC checks, and RLS assumptions pass.
- Verify TypeScript compilation and build.

### PHASE 13: Demo-Data Verification & Final Polish

- Write `docs/DEMO_GUIDE.md`.
- Verify the final deployed app accurately reflects the original prototype with real backend power.
