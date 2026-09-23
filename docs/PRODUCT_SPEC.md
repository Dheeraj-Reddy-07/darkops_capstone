# DarkOps - Product Specification

**Final Implementation Contract**

This document defines the complete DarkOps product specification, serving as the single source of truth for personas, RBAC, navigation, workflows, and data flow. All implementation must align with this specification.

---

## 1. Personas

### 1.1 Executive

**Role**: Network leadership  
**Primary Goal**: High-level visibility into network health, trends, and strategic decision-making  
**Login Destination**: `/executive`

**Capabilities**:

- Read-only access to network-wide metrics
- View store health across all cities/zones
- Access executive insights (deterministic analytics)
- View aggregated case/fraud trends
- No mutation permissions

---

### 1.2 Operations Manager

**Role**: Shift manager / operations lead  
**Primary Goal**: Manage case queue, assign work, monitor SLA performance  
**Login Destination**: `/operations`

**Capabilities**:

- View all cases in the queue
- Assign cases to agents
- Escalate cases
- View store operational status
- Monitor SLA compliance
- Resolve cases

---

### 1.3 Operations Agent (Case Agent)

**Role**: Support agent handling customer complaints  
**Primary Goal**: Resolve assigned cases efficiently  
**Login Destination**: `/operations`

**Capabilities**:

- View only assigned cases
- Update case status
- Add comments/notes
- Resolve cases
- Escalate own cases
- No access to other agents' cases

---

### 1.4 Fraud Analyst

**Role**: Risk/trust team member  
**Primary Goal**: Review and decide on flagged fraud cases  
**Login Destination**: `/fraud`

**Capabilities**:

- View fraud review queue
- Access risk factors and evidence
- Make fraud decisions (approve/deny/escalate)
- View customer fraud history
- Comment on fraud cases

---

### 1.5 Store Manager

**Role**: Dark store manager  
**Primary Goal**: Monitor and manage own store's operations  
**Login Destination**: `/dark-stores/[store-id]`

**Capabilities**:

- View own store only
- Access PulseScore and breakdown
- View store metrics and trends
- Manage work orders for own store
- View incidents affecting own store
- No access to other stores' data

---

### 1.6 Delivery Partner

**Role**: Delivery rider  
**Primary Goal**: View assigned deliveries and report issues  
**Login Destination**: `/operations` (filtered view)

**Capabilities**:

- View own delivery tasks
- Update delivery status
- Report delivery issues
- No access to customer PII beyond order details
- No access to executive/fraud data

---

### 1.7 Customer

**Role**: End customer  
**Primary Goal**: Track orders, submit complaints, view support status  
**Login Destination**: `/customer`

**Capabilities**:

- View own orders
- View own complaints
- Submit new complaints
- View complaint status
- Access support
- No access to operational data

---

### 1.8 Platform Admin

**Role**: System administrator  
**Primary Goal**: Manage users, roles, and system configuration  
**Login Destination**: `/admin`

**Capabilities**:

- View all users
- View role assignments
- View audit logs
- Manage system settings
- Full access to all data

---

## 2. RBAC Matrix

### 2.1 Role Definitions

| Role                 | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `ADMIN`              | System administrator with full access                      |
| `EXECUTIVE`          | Network leadership with read-only strategic access         |
| `OPERATIONS_MANAGER` | Operations lead with case assignment and escalation rights |
| `OPERATIONS_AGENT`   | Support agent with access to assigned cases only           |
| `FRAUD_ANALYST`      | Risk team with fraud review and decision rights            |
| `STORE_MANAGER`      | Store manager with access to own store only                |
| `CUSTOMER`           | End customer with access to own data only                  |

### 2.2 Permission Matrix

| Permission                   | ADMIN | EXEC | OPS_MGR | OPS_AGENT | FRAUD    | STORE_MGR | CUSTOMER |
| ---------------------------- | ----- | ---- | ------- | --------- | -------- | --------- | -------- |
| `executive.read`             | ✓     | ✓    | -       | -         | -        | -         | -        |
| `cases.read.all`             | ✓     | ✓    | ✓       | -         | -        | -         | -        |
| `cases.read.assigned`        | ✓     | -    | ✓       | ✓         | -        | -         | -        |
| `cases.assign`               | ✓     | -    | ✓       | -         | -        | -         | -        |
| `cases.escalate`             | ✓     | -    | ✓       | ✓(own)    | -        | -         | -        |
| `cases.resolve`              | ✓     | -    | ✓       | ✓(own)    | -        | -         | -        |
| `cases.comment`              | ✓     | -    | ✓       | ✓(own)    | ✓(fraud) | -         | -        |
| `stores.read.all`            | ✓     | ✓    | ✓       | -         | -        | -         | -        |
| `stores.read.own`            | ✓     | -    | -       | -         | -        | ✓         | -        |
| `fraud.read`                 | ✓     | ✓    | ✓       | -         | ✓        | -         | -        |
| `fraud.decide`               | ✓     | -    | -       | -         | ✓        | -         | -        |
| `customers.read.own`         | ✓     | -    | -       | -         | -        | -         | ✓        |
| `customers.create_complaint` | ✓     | -    | -       | -         | -        | -         | ✓        |
| `orders.read.all`            | ✓     | ✓    | ✓       | ✓         | ✓        | -         | -        |
| `orders.read.own`            | ✓     | -    | -       | -         | -        | -         | ✓        |
| `work_orders.read.all`       | ✓     | ✓    | ✓       | -         | -        | -         | -        |
| `work_orders.read.own`       | ✓     | -    | -       | -         | -        | ✓         | -        |
| `work_orders.manage`         | ✓     | -    | ✓       | -         | -        | ✓         | -        |
| `audit.read`                 | ✓     | -    | -       | -         | -        | -         | -        |
| `admin.users`                | ✓     | -    | -       | -         | -        | -         | -        |

---

## 3. Navigation by Persona

### 3.1 Executive

```
- Overview (/executive)
- Network Intelligence (/executive/insights)
- Dark Stores (/dark-stores)
- Alerts (dropdown)
```

### 3.2 Operations Manager

```
- Operations (/operations)
- Cases (/operations)
- Dark Stores (/dark-stores)
- Escalations (/operations?filter=escalated)
```

### 3.3 Operations Agent

```
- My Cases (/operations?filter=assigned)
- Dark Stores (/dark-stores) [read-only]
```

### 3.4 Fraud Analyst

```
- Risk Queue (/fraud)
- Investigations (/fraud)
- Decisions (/fraud)
```

### 3.5 Store Manager

```
- My Store (/dark-stores/[store-id])
- PulseScore (/dark-stores/[store-id]/pulse)
- Work Orders (/dark-stores/[store-id]?tab=work-orders)
- Incidents (/dark-stores/[store-id]?tab=incidents)
```

### 3.6 Delivery Partner

```
- My Deliveries (/operations?filter=deliveries)
- Report Issue (/operations/report)
```

### 3.7 Customer

```
- Home (/customer)
- My Orders (/customer/orders)
- Support (/customer/support)
- Notifications (/customer/notifications)
```

### 3.8 Admin

```
- Overview (/admin)
- Users (/admin/users)
- Roles & Permissions (/admin/roles)
- Stores (/admin/stores)
- Audit Logs (/admin/audit)
- Settings (/admin/settings)
```

---

## 4. Core Workflows

### 4.1 Customer Support Workflow

**Flow**:

1. Customer experiences issue with order
2. Customer navigates to `/customer/support`
3. Customer selects order from their order history
4. Customer selects complaint category and provides details
5. System creates complaint record in `complaints` table
6. System assigns priority based on category and order value
7. System calculates SLA deadline
8. Complaint appears in operations queue
9. Operations manager assigns to agent
10. Agent investigates and updates status
11. Agent can escalate if needed
12. Resolution is recorded
13. Customer sees updated status in `/customer`
14. Audit event is logged
15. Notification is sent to customer

**Database Entities**: `customers`, `orders`, `complaints`, `complaint_status_history`, `profiles`, `notifications`, `audit_logs`

**API Endpoints**:

- `POST /api/v1/customers/complaints` - Create complaint
- `GET /api/v1/customers/orders` - Get customer orders
- `GET /api/v1/customers/complaints` - Get customer complaints
- `POST /api/v1/cases/:id/assign` - Assign case
- `POST /api/v1/cases/:id/escalate` - Escalate case
- `POST /api/v1/cases/:id/resolve` - Resolve case

---

### 4.2 Operations Case Workflow

**Flow**:

1. Complaint enters queue with status `unassigned`
2. System determines priority (P1-P4)
3. SLA deadline is calculated based on priority
4. SLA state is tracked (on_track, at_risk, breached)
5. Operations manager views queue at `/operations`
6. Manager assigns case to agent
7. Agent receives notification
8. Agent investigates case
9. Agent updates status to `in_progress`
10. Agent adds comments/notes
11. If resolution requires escalation, agent escalates to L2
12. Once resolved, agent marks as `resolved`
13. Resolution details are recorded
14. Audit event is logged for each state change
15. Notifications are sent to relevant parties

**State Transitions** (validated server-side):

```
unassigned → assigned → in_progress → awaiting_customer → resolved
unassigned → assigned → in_progress → escalated_l2 → resolved
```

**Database Entities**: `complaints`, `complaint_status_history`, `complaint_comments`, `profiles`, `notifications`, `audit_logs`

**API Endpoints**:

- `GET /api/v1/cases` - List cases (filtered by role)
- `GET /api/v1/cases/:id` - Get case details
- `POST /api/v1/cases/:id/assign` - Assign to agent
- `POST /api/v1/cases/:id/escalate` - Escalate case
- `POST /api/v1/cases/:id/resolve` - Resolve case
- `POST /api/v1/cases/:id/comments` - Add comment
- `GET /api/v1/cases/:id/history` - Get case history

---

### 4.3 Fraud Review Workflow

**Flow**:

1. Complaint is flagged by risk engine
2. Fraud review record created in `fraud_reviews`
3. Risk factors are calculated and stored
4. Case appears in fraud queue at `/fraud`
5. Fraud analyst reviews case
6. Analyst sees risk factors, customer history, order details
7. Analyst makes decision (approve/deny/escalate)
8. Decision is recorded with note
9. Complaint status is updated accordingly
10. Audit event is logged
11. Notification is sent to operations team
12. Customer is notified of decision

**State Transitions** (validated server-side):

```
pending_review → approved
pending_review → denied
pending_review → escalated
```

**Database Entities**: `fraud_reviews`, `fraud_risk_factors`, `fraud_review_history`, `complaints`, `customers`, `notifications`, `audit_logs`

**API Endpoints**:

- `GET /api/v1/fraud` - List fraud reviews (filtered by role)
- `GET /api/v1/fraud/:id` - Get fraud review details
- `POST /api/v1/fraud/:id/decision` - Record decision
- `GET /api/v1/fraud/:id/history` - Get review history

---

### 4.4 Dark Store Workflow

**Flow**:

1. Store operational metrics are collected
2. PulseScore is calculated based on factors:
   - Equipment failures (0-25 pts)
   - SLA performance (0-25 pts)
   - Refund rate (0-20 pts)
   - Delivery delays (0-15 pts)
   - Picker delays (0-10 pts)
   - Inventory issues (0-10 pts)
3. PulseScore = max(12, 100 - sum of penalties)
4. PulseScore snapshot is stored in `pulse_scores`
5. Store manager views dashboard at `/dark-stores/[store-id]`
6. Manager sees current score, breakdown, and trends
7. If issue detected, manager creates work order
8. Work order is tracked through resolution
9. Metrics are updated as issues are resolved
10. Historical snapshots show improvement over time

**Database Entities**: `stores`, `pulse_scores`, `store_metrics_snapshots`, `work_orders`, `profiles`, `audit_logs`

**API Endpoints**:

- `GET /api/v1/stores` - List stores (filtered by role)
- `GET /api/v1/stores/:id` - Get store details
- `GET /api/v1/stores/:id/pulse` - Get PulseScore breakdown
- `GET /api/v1/stores/:id/work-orders` - Get work orders
- `POST /api/v1/stores/:id/work-orders` - Create work order
- `PATCH /api/v1/stores/:id/work-orders/:id` - Update work order

---

### 4.5 Executive Intelligence Workflow

**Flow**:

1. Executive navigates to `/executive`
2. System aggregates network-wide metrics:
   - Total stores and critical stores
   - Average PulseScore
   - SLA compliance rate
   - Refund rate
   - Active cases
   - Fraud exposure
3. Metrics are displayed in dashboard
4. Executive can drill down by city/zone
5. Executive can access `/executive/insights`
6. Insights engine processes natural language query
7. System returns structured answer with:
   - Answer text
   - Relevant metrics
   - Suggested actions
   - Data sources
8. All metrics are derived from real database data

**Database Entities**: `stores`, `pulse_scores`, `complaints`, `fraud_reviews`, `store_metrics_snapshots`

**API Endpoints**:

- `GET /api/v1/executive/overview` - Get executive metrics
- `GET /api/v1/executive/alerts` - Get network alerts
- `POST /api/v1/executive/insights` - Query insights engine

---

## 5. Data Flow Architecture

### 5.1 Data Source Chain

```
Supabase PostgreSQL (with RLS)
    ↓
Express API (with auth, RBAC, validation)
    ↓
TanStack Query hooks
    ↓
React UI components
```

**Critical Rule**: No business metrics may be hardcoded in frontend code. All numbers displayed to users must originate from the database via the API.

### 5.2 API Contract

All API endpoints follow REST conventions under `/api/v1/`:

**Authentication**:

- All protected endpoints require valid Supabase session
- Session is validated via `requireAuth` middleware
- Role is resolved from `profiles` table server-side

**Authorization**:

- Permissions checked via `requirePermission` middleware
- RLS policies enforced at database level
- Resource ownership validated for scoped access

**Response Format**:

```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 200,
    "totalPages": 4
  }
}
```

**Error Format**:

```json
{
  "error": {
    "code": "CASE_INVALID_TRANSITION",
    "message": "This case cannot be resolved from its current state.",
    "details": { ... }
  }
}
```

---

## 6. Dashboard Metrics

### 6.1 Executive Dashboard

All metrics must be calculated from database:

| Metric            | Source                    | Calculation                                                     |
| ----------------- | ------------------------- | --------------------------------------------------------------- |
| Store Count       | `stores`                  | COUNT(*) WHERE is_active = true                                 |
| Critical Stores   | `stores` + `pulse_scores` | COUNT WHERE pulse < 60                                          |
| Avg PulseScore    | `pulse_scores`            | AVG(score)                                                      |
| Avg SLA %         | `store_metrics_snapshots` | AVG(sla_pct)                                                    |
| Avg Refund Rate % | `store_metrics_snapshots` | AVG(refund_rate_pct)                                            |
| Active Cases      | `complaints`              | COUNT WHERE status IN ('unassigned', 'assigned', 'in_progress') |
| Fraud Exposure    | `fraud_reviews`           | COUNT WHERE decision = 'pending_review'                         |
| 30-Day Volume     | `complaints`              | GROUP BY created_at (last 30 days)                              |

### 6.2 Operations Dashboard

| Metric            | Source       | Calculation                                          |
| ----------------- | ------------ | ---------------------------------------------------- |
| Queue Size        | `complaints` | COUNT WHERE status != 'resolved'                     |
| SLA at Risk       | `complaints` | COUNT WHERE sla_state = 'at_risk'                    |
| SLA Breached      | `complaints` | COUNT WHERE sla_state = 'breached'                   |
| Priority P1       | `complaints` | COUNT WHERE priority = 'P1' AND status != 'resolved' |
| Agent Workload    | `complaints` | COUNT assigned_agent_id GROUP BY agent               |
| Escalation Volume | `complaints` | COUNT WHERE status = 'escalated_l2'                  |

### 6.3 Fraud Dashboard

| Metric           | Source          | Calculation                                                    |
| ---------------- | --------------- | -------------------------------------------------------------- |
| Pending Reviews  | `fraud_reviews` | COUNT WHERE decision = 'pending_review'                        |
| High Risk (90%+) | `fraud_reviews` | COUNT WHERE risk_confidence >= 90                              |
| Approved Today   | `fraud_reviews` | COUNT WHERE decision = 'approved' AND DATE(decided_at) = TODAY |
| Denied Today     | `fraud_reviews` | COUNT WHERE decision = 'denied' AND DATE(decided_at) = TODAY   |
| Avg Risk Score   | `fraud_reviews` | AVG(risk_confidence)                                           |

### 6.4 Store Manager Dashboard

| Metric                 | Source                    | Calculation                                       |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| Current PulseScore     | `pulse_scores`            | score WHERE store_id = X                          |
| Previous PulseScore    | `pulse_scores`            | score WHERE store_id = X (previous snapshot)      |
| Open Work Orders       | `work_orders`             | COUNT WHERE store_id = X AND status != 'resolved' |
| Equipment Failures 14d | `store_metrics_snapshots` | equipment_failures_14d WHERE store_id = X         |
| SLA %                  | `store_metrics_snapshots` | sla_pct WHERE store_id = X                        |
| Refund Rate %          | `store_metrics_snapshots` | refund_rate_pct WHERE store_id = X                |

### 6.5 Customer Dashboard

| Metric           | Source       | Calculation                                                              |
| ---------------- | ------------ | ------------------------------------------------------------------------ |
| Active Orders    | `orders`     | COUNT WHERE customer_id = X AND status NOT IN ('delivered', 'cancelled') |
| Recent Orders    | `orders`     | SELECT * WHERE customer_id = X ORDER BY placed_at DESC LIMIT 10          |
| Open Complaints  | `complaints` | COUNT WHERE customer_id = X AND status != 'resolved'                     |
| Complaint Status | `complaints` | SELECT * WHERE customer_id = X                                           |

---

## 7. Notification System

### 7.1 Notification Types

| Type                  | Trigger                                | Recipients                        |
| --------------------- | -------------------------------------- | --------------------------------- |
| `case_assigned`       | Case assigned to agent                 | Assigned agent                    |
| `case_escalated`      | Case escalated to L2                   | Operations manager                |
| `case_resolved`       | Case resolved                          | Customer                          |
| `fraud_decision`      | Fraud decision made                    | Operations team                   |
| `sla_breach`          | SLA deadline breached                  | Operations manager                |
| `work_order_assigned` | Work order created                     | Store manager                     |
| `store_alert`         | Store PulseScore drops below threshold | Store manager, operations manager |
| `admin_event`         | System configuration change            | Admins                            |

### 7.2 Notification Structure

```typescript
{
  id: UUID,
  recipient_id: UUID,
  title: string,
  meta: string, // JSON metadata
  link_type: 'store' | 'operations' | 'fraud' | 'customer' | 'admin',
  link_ref: string, // ID of linked entity
  is_read: boolean,
  created_at: TIMESTAMPTZ
}
```

### 7.3 Notification Display

- Notification bell in header shows unread count
- Dropdown shows recent notifications
- Clicking notification navigates to linked entity
- Mark as read on click or via dismiss action

---

## 8. Audit Logging

### 8.1 Mandatory Audit Events

| Event              | Action                | Resource Type |
| ------------------ | --------------------- | ------------- |
| User login         | `auth.login`          | profile       |
| User logout        | `auth.logout`         | profile       |
| Complaint created  | `complaint.create`    | complaint     |
| Case assigned      | `complaint.assign`    | complaint     |
| Case escalated     | `complaint.escalate`  | complaint     |
| Case resolved      | `complaint.resolve`   | complaint     |
| Fraud decision     | `fraud.decide`        | fraud_review  |
| Work order created | `work_order.create`   | work_order    |
| Work order updated | `work_order.update`   | work_order    |
| Role changed       | `profile.role_change` | profile       |
| User deactivated   | `profile.deactivate`  | profile       |

### 8.2 Audit Record Structure

```typescript
{
  id: UUID,
  actor_id: UUID,
  actor_role: string,
  action: string,
  resource_type: string,
  resource_id: string,
  metadata: JSONB,
  ip_address: INET,
  correlation_id: string,
  occurred_at: TIMESTAMPTZ
}
```

### 8.3 Audit Immutability

- `audit_logs` table is INSERT-only
- No UPDATE or DELETE permissions
- Accessible only to ADMIN role
- Service role key required for writes

---

## 9. Chatbot Architecture

### 9.1 Role-Aware Capabilities

**Customer**:

- Order status lookup
- Complaint status lookup
- Help with common issues
- Create support request

**Operations**:

- Case summaries
- Queue questions
- SLA questions
- Store issue summaries

**Executive**:

- Explain dashboard metrics
- Summarize trends
- Surface notable issues

**Fraud**:

- Summarize investigation context
- Explain risk factors
- Never autonomously approve/deny

**Admin**:

- System/user assistance
- Audit log queries

### 9.2 Security Constraints

- Chatbot must respect RBAC
- Cannot expose information user cannot access via normal UI
- Cannot perform mutations without explicit user confirmation
- All chatbot data access goes through same API endpoints

### 9.3 Implementation

For initial implementation, use deterministic rule-based responses:

- Pre-defined response templates for common queries
- Metric explanations from database
- No LLM integration required for MVP
- Architecture designed for future LLM plug-in

---

## 10. Admin Capabilities

### 10.1 User Management

- View all users with roles
- View user status (active/inactive)
- View user last login
- Activate/deactivate users (where permitted)
- No password management (handled by Supabase Auth)

### 10.2 Role Management

- View role definitions
- View permission matrix
- View users per role
- Role assignment changes (where permitted by security model)

### 10.3 Store Management

- View all stores
- View store status
- View store managers
- Store configuration (where appropriate)

### 10.4 Audit Logs

- Searchable audit trail
- Filter by actor, action, resource type, date range
- View audit event details
- Export audit logs (where appropriate)

### 10.5 System Settings

- Notification preferences
- SLA thresholds
- PulseScore thresholds
- System configuration

---

## 11. Security Requirements

### 11.1 Authentication

- Supabase Auth with email/password
- Session stored in httpOnly cookies
- JWT validated on every API request
- Session refresh handled automatically
- Logout destroys session

### 11.2 Authorization

- Role resolved server-side from `profiles` table
- Permissions checked via middleware
- RLS policies enforced at database level
- Resource ownership validated for scoped access
- Frontend hiding is UX, not security

### 11.3 Data Protection

- Service role key never reaches browser
- Customer PII accessible only to customer and authorized staff
- Audit logs immutable
- No mass assignment vulnerabilities
- Safe error handling (no stack traces to client)

### 11.4 Rate Limiting

- Auth endpoints rate-limited
- API endpoints rate-limited per user
- Brute force protection on login

---

## 12. Implementation Priorities

### Phase 1: Foundation (Current)

- ✅ Database schema and migrations
- ✅ Express backend structure
- ✅ Basic auth middleware
- ✅ RBAC definitions
- ✅ Seed data

### Phase 2: Auth & Shell

- Role-aware redirect after login
- Role-aware navigation
- Logout functionality
- Session persistence

### Phase 3: RBAC Enforcement

- Frontend route guards
- Express authorization middleware
- RLS policy verification
- Cross-persona access testing

### Phase 4: Data Integrity

- Verify seed data relationships
- Ensure all personas have meaningful data
- Remove mock data fallbacks
- Verify all metrics are DB-driven

### Phase 5: Core Workflows

- Customer complaint creation
- Operations case management
- Fraud review decisions
- Store manager operations

### Phase 6: Dashboards

- Executive dashboard (DB-driven)
- Operations dashboard (DB-driven)
- Fraud dashboard (DB-driven)
- Store manager dashboard (DB-driven)
- Customer dashboard (DB-driven)

### Phase 7: Admin & Notifications

- Admin interface
- Notification generation
- Notification display
- Audit logging verification

### Phase 8: Chatbot

- Deterministic response engine
- Role-aware capabilities
- Security constraints

### Phase 9: Polish

- Loading/error/empty states
- Responsive design
- Accessibility
- UX consistency

### Phase 10: Verification

- E2E testing for all personas
- Security testing
- Performance testing
- Documentation

---

## 13. Acceptance Criteria

DarkOps is complete only when:

✓ Landing page works without hardcoded operational metrics  
✓ Login works for all personas  
✓ Logout destroys session  
✓ Role-aware redirect works  
✓ Role-aware navigation works  
✓ RBAC is enforced frontend and backend  
✓ RLS is enforced at database level  
✓ All dashboards use real DB data  
✓ No mock data fallbacks remain  
✓ Seed data is properly interconnected  
✓ All workflows work end-to-end  
✓ Audit logging works for all mutations  
✓ Notifications are generated and displayed  
✓ Chatbot respects RBAC  
✓ Admin interface is functional  
✓ Direct URL authorization works  
✓ Production build succeeds  
✓ No service-role secret reaches client  
✓ No critical console/runtime errors  
✓ No dead buttons or pages  
✓ No persona can access unauthorized data

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-30  
**Status**: Implementation Contract
