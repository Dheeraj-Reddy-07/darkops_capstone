# DarkOps — Security Architecture

## 1. Authentication

### Supabase Auth
- **Mechanism**: Email + Password (for internal ops users) and Magic Link (for customers)
- **Session storage**: httpOnly cookies via `@supabase/ssr` server-side helpers — never localStorage
- **JWT**: Signed by Supabase, validated server-side on every API route call
- **Session refresh**: Handled by Supabase SSR middleware, transparent to the user

### Critical Rules
1. The `SUPABASE_SERVICE_ROLE_KEY` **MUST NEVER** appear in:
   - Vite public environment variables (`VITE_*`)
   - Any frontend bundle
   - Client-side code
   - Git history
2. The service role key is used **ONLY** in TanStack Start server functions / Nitro API routes
3. The anon key (`VITE_SUPABASE_ANON_KEY`) is safe for the browser — it is subject to RLS

---

## 2. Authorization — RBAC

### Role Definitions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `ADMIN` | System administrator | All actions including user management |
| `EXECUTIVE` | Network leadership | Read all KPIs, insights, stores, aggregates. No mutations. |
| `OPERATIONS_MANAGER` | Shift manager | View+assign+escalate any case, manage work orders |
| `OPERATIONS_AGENT` | Support agent | View+update **assigned** cases only |
| `FRAUD_ANALYST` | Risk/trust team | View all fraud reviews, make decisions (approve/deny/escalate) |
| `STORE_MANAGER` | Dark store manager | View their own store only, update work orders for their store |
| `CUSTOMER` | End customer | Access only their own orders, complaints, refunds |

### Permission Matrix

| Action | ADMIN | EXEC | OPS_MGR | OPS_AGENT | FRAUD | STORE_MGR | CUSTOMER |
|--------|-------|------|---------|-----------|-------|-----------|---------|
| `executive:read` | ✓ | ✓ | — | — | — | — | — |
| `cases:read:all` | ✓ | ✓(summary) | ✓ | — | — | — | — |
| `cases:read:assigned` | ✓ | — | ✓ | ✓ | — | — | — |
| `cases:assign` | ✓ | — | ✓ | — | — | — | — |
| `cases:escalate` | ✓ | — | ✓ | ✓(own) | — | — | — |
| `cases:resolve` | ✓ | — | ✓ | ✓(own) | — | — | — |
| `cases:comment` | ✓ | — | ✓ | ✓(own) | ✓(fraud cases) | — | — |
| `stores:read:all` | ✓ | ✓ | ✓ | — | — | — | — |
| `stores:read:own` | ✓ | — | — | — | — | ✓ | — |
| `fraud:read` | ✓ | ✓(summary) | — | — | ✓ | — | — |
| `fraud:decide` | ✓ | — | — | — | ✓ | — | — |
| `customer:read:own` | ✓ | — | — | — | — | — | ✓ |
| `customer:complaint:create` | ✓ | — | — | — | — | — | ✓ |
| `audit:read` | ✓ | — | — | — | — | — | — |
| `admin:users` | ✓ | — | — | — | — | — | — |

### Authorization Implementation
- Roles are stored in `profiles.role` (server-trusted)
- Every API route reads the authenticated user's role from the server-side Supabase session
- Frontend **never** sends its own role in requests — the role is derived server-side
- A frontend hiding a button is UX, not security

---

## 3. Row Level Security (RLS)

All tables have RLS enabled. Key policies:

### `profiles`
```sql
-- Users can only read/update their own profile
CREATE POLICY "profiles_own" ON profiles
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_admin" ON profiles
  USING (get_role() = 'ADMIN');
```

### `complaints`
```sql
-- Customers see only their own complaints
CREATE POLICY "complaints_customer" ON complaints
  FOR SELECT USING (
    get_role() = 'CUSTOMER'
    AND customer_id = get_customer_id()
  );

-- Ops agents see only assigned cases
CREATE POLICY "complaints_agent" ON complaints
  FOR SELECT USING (
    get_role() = 'OPERATIONS_AGENT'
    AND assigned_agent_id = auth.uid()
  );

-- Ops managers, fraud analysts, executives, admins see all
CREATE POLICY "complaints_elevated" ON complaints
  FOR SELECT USING (
    get_role() IN ('OPERATIONS_MANAGER','FRAUD_ANALYST','EXECUTIVE','ADMIN')
  );
```

### `fraud_reviews`
```sql
-- Only fraud analysts, ops managers, admins can read fraud data
CREATE POLICY "fraud_elevated" ON fraud_reviews
  FOR SELECT USING (
    get_role() IN ('FRAUD_ANALYST','OPERATIONS_MANAGER','ADMIN')
  );
```

### `stores`
```sql
-- Store managers only see their own store
CREATE POLICY "stores_manager" ON stores
  FOR SELECT USING (
    get_role() = 'STORE_MANAGER'
    AND id = get_profile_store_id()
  );

-- All elevated roles see all stores
CREATE POLICY "stores_elevated" ON stores
  FOR SELECT USING (
    get_role() IN ('EXECUTIVE','OPERATIONS_MANAGER','FRAUD_ANALYST','ADMIN')
  );
```

### `audit_logs`
```sql
-- Append only: INSERT allowed to service role, no UPDATE/DELETE ever
-- SELECT: ADMIN only
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY; -- controlled by service role only
-- The API route for audit uses service role client directly
```

### `notifications`
```sql
-- Users see only their own notifications
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (recipient_id = auth.uid());
```

---

## 4. API Security

### Every API Route Must
1. Validate the Supabase session cookie (return 401 if missing/invalid)
2. Check that the authenticated user has the required role/permission (return 403 if not)
3. Validate request body/params with Zod (return 400 if invalid)
4. Use the service-role Supabase client for DB operations (bypasses RLS safely from server)
5. Never return stack traces or internal details to the client
6. Log errors server-side with correlation ID

### Protected Against
| Attack | Mitigation |
|--------|-----------|
| IDOR (Insecure Direct Object Reference) | RLS + server-side ownership check on every resource access |
| Privilege escalation | Role read from server-side profile, never from request |
| Mass assignment | Explicit allow-list of mutable fields per endpoint |
| Unauthorized state transitions | Server-side state machine for complaint/fraud workflows |
| Replay attacks | Supabase JWT expiry + refresh |
| XSS token theft | httpOnly cookies — JS cannot read the token |
| CSRF | Supabase SameSite=Lax + state validation |
| Brute force | Supabase rate limiting on auth endpoints |

---

## 5. Secrets Management

| Secret | Location | Access |
|--------|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server environment variable (Nitro) | Server functions only |
| `VITE_SUPABASE_ANON_KEY` | Vite public env | Browser (safe — subject to RLS) |
| `VITE_SUPABASE_URL` | Vite public env | Browser |
| `OPENAI_API_KEY` | Server environment variable | Server functions only |

**Never committed**: `.env` is in `.gitignore`. The repository contains only `.env.example` with placeholder values.

---

## 6. Audit Logging

### Mandatory Audit Events

| Event | `action` | `resource_type` |
|-------|----------|-----------------|
| Complaint created | `complaint.create` | `complaint` |
| Complaint assigned | `complaint.assign` | `complaint` |
| Complaint escalated | `complaint.escalate` | `complaint` |
| Complaint resolved | `complaint.resolve` | `complaint` |
| Fraud decision made | `fraud.decide` | `fraud_review` |
| Work order updated | `work_order.update` | `work_order` |
| User role changed | `profile.role_change` | `profile` |
| Login | `auth.login` | `profile` |
| Logout | `auth.logout` | `profile` |

### Audit Log Properties
```json
{
  "id": "uuid",
  "actor_id": "uuid of the authenticated user",
  "actor_role": "OPERATIONS_AGENT",
  "action": "complaint.escalate",
  "resource_type": "complaint",
  "resource_id": "CS-4100",
  "metadata": { "from_status": "in_progress", "to_status": "escalated_l2", "city": "Kolkata" },
  "ip_address": "redacted in logs but stored for compliance",
  "correlation_id": "req-abc123",
  "occurred_at": "2026-08-29T16:10:00Z"
}
```

### Audit Immutability
- `audit_logs` table is INSERT-only via service role
- No UPDATE or DELETE policies exist
- Exposed only to ADMIN role via `/api/v1/audit`

---

## 7. Safe Logging Rules

Logs MUST NOT contain:
- Passwords or auth tokens
- Service role key
- Full customer PII beyond masked IDs
- OpenAI API key
- Supabase connection strings

Logs SHOULD contain:
- Correlation/request IDs
- HTTP method + path + status code
- Response latency
- Error codes (not raw DB errors)
- Actor ID + role (for audit events)
