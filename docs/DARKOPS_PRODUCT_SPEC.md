# DarkOps Product Specification

**Canonical Source of Truth for DarkOps Architecture**

---

## Product Purpose

DarkOps is an operational intelligence platform for quick-commerce / dark-store networks. The system connects:

**Customers → Support → Operations → Dark Stores → Fraud → Executive Oversight**

The platform helps organizations:

- Identify operational problems in real-time
- Investigate and resolve customer complaints
- Monitor dark-store health via PulseScore
- Detect and investigate fraud/risk
- Assign and resolve operational cases
- Detect deteriorating stores early
- Surface important events through notifications
- Give executives network-level visibility

---

## Core Dashboards (4)

### 1. Executive Dashboard

**Network-wide strategic overview**

- Network KPIs (orders, complaints, SLA compliance, store health)
- Trends over time (orders, complaints, SLA, fraud, store health)
- Network health distribution
- Critical alerts
- City-level roll-ups

**Removed:** Executive Insights page (was separate, now integrated or removed)

### 2. Operations Dashboard

**Customer support / operational case management**

- Active cases queue
- Unassigned cases
- SLA risk monitoring
- Priority distribution
- Agent workload (managers only)
- Resolution rate
- Escalation rate
- Recent cases with filters and search

### 3. Dark Stores Dashboard

**Store/network health and operational performance**

**Network View:**

- Store list with health indicators
- Geographic/map/heatmap visualization
- Health distribution
- PulseScore
- Order throughput
- Fulfillment time
- Cancellation rate
- Stock availability
- Equipment issues

**Store Detail:**

- Store health and PulseScore
- Historical trend
- Order volume
- Fulfillment SLA
- Cancellations
- Inventory signals
- Equipment/work orders
- Alerts
- Recent incidents

### 4. Fraud Dashboard

**Fraud/risk investigation and decisioning**

- Fraud queue
- Risk score
- Transaction value
- Customer risk context
- Reason/factors
- Age of case
- Analyst assignment
- Status
- Decision actions (Pending → Approved/Denied/Escalated)
- Review history

---

## Role Model (5 Roles)

### ROLE 1 - PLATFORM_ADMIN

**System-level administrator**

**Can:**

- Manage users
- Manage roles
- Manage system configuration
- View all operational data
- Manage notification rules
- Manage platform settings
- Troubleshoot the system

**Navigation:**

- Overview
- Users
- Stores
- Audit logs

### ROLE 2 - EXECUTIVE

**Strategic oversight**

**Can see:**

- Executive Dashboard
- Network-level KPIs
- Revenue/order trends
- Complaint trends
- Fraud trends
- Dark-store health summary
- Major operational alerts
- High-severity notifications

**Should NOT see:**

- Detailed customer support queues
- Individual agent workload management
- Detailed fraud decision workflow
- Platform administration

**Navigation:**

- Executive
- Notifications
- Profile

### ROLE 3 - OPERATIONS

**Combines operational management and frontline support**

**Operations Manager scope:**

- Regional/network operations
- Assign cases
- Monitor agents
- Escalate
- See operational KPIs
- View all stores

**Support Agent scope:**

- Only assigned cases
- Customer information required to resolve those cases
- Update/resolve assigned cases

**Navigation (Manager):**

- Operations
- Dark Stores
- Notifications
- Profile

**Navigation (Agent):**

- My Cases
- Notifications
- Profile

### ROLE 4 - STORE_MANAGER

**Store-specific operational management**

**Can see:**

- Dark Stores Dashboard (their assigned store(s) only)
- Store health
- PulseScore
- Orders/performance
- SLA/fulfillment metrics
- Equipment/work orders
- Inventory/availability indicators
- Store-specific alerts
- Historical trends

**Should NOT see:**

- Other stores (unless explicitly permitted)
- Customer-wide data
- Fraud dashboard
- Executive dashboard
- Platform administration

**Navigation:**

- Dark Store
- Notifications
- Profile

### ROLE 5 - FRAUD_ANALYST

**Fraud/risk investigation**

**Can see:**

- Fraud Dashboard
- Fraud queue
- Risk factors
- Transaction/customer risk context
- Review history
- Approve/deny/escalate actions
- Fraud-related alerts

**Should NOT see:**

- Executive dashboard
- Unrelated operations controls
- Platform administration
- Unrelated store management

**Navigation:**

- Fraud
- Notifications
- Profile

---

## Customer Portal (Separate Experience)

**Customer should see only:**

- Their orders
- Order tracking
- Complaints
- Complaint status
- Support interaction
- Notifications relevant to their account
- Profile/account settings

**Must NEVER see:**

- Internal operations
- Executive data
- Fraud data
- Store management
- Employee data
- System data

**Navigation:**

- My Orders
- Support
- Notifications
- Profile

---

## Information Architecture

### Executive

```
DarkOps
├── Executive
├── Notifications
└── Profile
```

### Operations Manager

```
DarkOps
├── Operations
├── Dark Stores
├── Notifications
└── Profile
```

### Support Agent

```
DarkOps
├── My Cases
├── Notifications
└── Profile
```

### Store Manager

```
DarkOps
├── Dark Store
├── Notifications
└── Profile
```

### Fraud Analyst

```
DarkOps
├── Fraud
├── Notifications
└── Profile
```

### Customer

```
DarkOps
├── My Orders
├── Support
├── Notifications
└── Profile
```

### Platform Admin

```
DarkOps
├── Overview
├── Users
├── Stores
├── Audit
├── Notifications
└── Profile
```

---

## Landing Page

**Professional DarkOps landing page explaining:**

- What DarkOps is
- Operational problems it solves
- Major platform capabilities
- How teams use it
- Security/reliability positioning
- CTA to sign in

**NO fake "10M orders processed" style claims** unless backed by database data.

---

## Authentication Requirements

**Must implement:**

- Login
- Logout
- Session persistence
- Session refresh
- Protected routes
- Redirect after login based on persona
- Unauthorized route handling
- Expired-session handling
- Proper error messages
- Profile loading
- Role loading
- Account active/inactive handling

**Critical requirement:**
If user logs in as one user, logs out, then logs in as another user:

- Entire application must switch to second user's permissions, navigation, data, dashboard, notifications, profile, settings
- No stale state from previous account

---

## RBAC + Data Scope

**Every protected operation must have:**

1. Frontend permission gating
2. Express middleware authorization
3. Supabase RLS/data isolation

**Unauthorized URL access:**
User manually entering `/executive`, `/fraud`, `/dark-stores`, `/cases/...` must not gain access merely by knowing the URL. Return proper access-denied experience.

---

## Executive Dashboard Requirements

**Answer:** "What is happening across the business right now, and what requires executive attention?"

**Populate from real database data:**

### Network KPIs

- Orders
- GMV/revenue
- Complaint rate
- SLA compliance
- Active cases
- Fraud exposure
- Healthy stores %

### Trends

- Orders over time
- Complaints over time
- SLA performance
- Fraud trend
- Store health trend

### Network Health

- Store health distribution
- Regional performance

### Critical Alerts

Only genuinely important events

**Every number must have a database query behind it.**

---

## Operations Dashboard Requirements

**Answer:** "What operational work needs attention right now?"

**Include:**

- Active cases
- Unassigned cases
- Assigned cases
- SLA risk
- Overdue cases
- Priority distribution
- Agent workload (managers only)
- Resolution rate
- Escalation rate
- Recent cases
- Filters
- Search

**For support agents:**
"My Cases" must actually mean their assigned cases. They should not see an empty generic dashboard.

**Every card/table/chart must be backed by API data.**

---

## Dark Stores Dashboard Requirements

**Network view:**

- Store list
- Geographic/map/heatmap visualization
- Health distribution
- PulseScore
- Order throughput
- Fulfillment time
- Cancellation rate
- Stock availability
- Equipment issues

**Store detail:**

- Store health
- PulseScore
- Historical trend
- Order volume
- Fulfillment SLA
- Cancellations
- Inventory signals
- Equipment/work orders
- Alerts
- Recent incidents

**Heatmap must use actual store coordinates and actual metrics.** Do not generate random positions or random values.

---

## Fraud Dashboard Requirements

**Answer:** "What fraud/risk needs investigation?"

**Include:**

- Fraud queue
- Risk score
- Transaction value
- Customer risk context
- Reason/factors
- Age of case
- Analyst assignment
- Status
- Decision actions
- History

**Actions must update the database:**

```
Pending Review
      ↓
Approved
Denied
Escalated
```

**Enforce valid transitions server-side.**

---

## Customer Portal Requirements

**Fix:** "Customer profile not found" problem properly. Do NOT use mock fallback data.

**Every seeded customer account must correspond to a real customer row.**

**Customer should be able to:**

1. Log in
2. See their real orders
3. Select an order
4. Submit a complaint
5. See complaint status
6. Receive support updates
7. Use chatbot/support
8. Manage profile/settings
9. Log out

**RLS must ensure customer A cannot access customer B's orders.** Test this explicitly.

---

## Profile + Settings

**Profile menu must be contextual and functional.**

**Every authenticated user should have:**

- Profile
- Account information
- Notification preferences
- Security/session controls
- Logout

**Do NOT show Executive-specific options to everyone.** Remove Executive Insights from all profile menus.

**Implement settings that persist to the database where appropriate.**

---

## Notification System

**Notifications must be:**

- Stored in database
- Tied to users/roles
- Read/unread
- Timestamped
- Categorized
- Prioritized
- Displayed through notification UI

**Examples:**

### Store Manager

```
Store Health Alert
DS-1462 PulseScore dropped below threshold.
```

### Executive

```
Critical Store Alert
3 stores entered critical health status.
```

### Operations

```
SLA Risk
27 complaints are approaching SLA breach.
```

### Fraud Analyst

```
High Risk Review
Transaction requires immediate review.
```

**Notifications must be generated based on actual database conditions.** Do not create fake random alerts.

---

## Date Filters / "Last 30 Days"

**Audit every date filter.**

**If it has real analytical purpose, make it functional:**

```
Today
7 days
30 days
90 days
Custom
```

**All charts must query/filter based on selected period.**

**If a date selector is meaningless for a particular page, remove it.** Do not leave decorative controls.

---

## Search

**Only expose search where it is useful.** Do not put "search store" on every role.

**Examples:**

- Operations → search cases/customers as permitted
- Store Manager → search assigned/authorized stores
- Fraud Analyst → search fraud cases
- Executive → optional high-level search
- Customer → search their own orders

**Respect authorization and RLS.**

---

## Chatbot

**Define its purpose.** For first production version, implement safe operational assistant.

**Examples:**

### Executive

"Why did SLA compliance drop?"
Assistant retrieves relevant aggregated metrics.

### Operations

"Show me high-priority cases approaching SLA breach."

### Store Manager

"Why is my PulseScore down?"
Assistant retrieves that store's metrics.

### Fraud Analyst

"Summarize the risk factors for this case."

### Customer

"Where is my order?"
Assistant can retrieve that customer's order information.

**Assistant must never bypass authorization.** It must only access data the logged-in user can access.

**If LLM integration is not yet required, create the architecture and implement deterministic responses based on real data rather than fake AI claims.**

---

## Database + Seed Data

**Schema must have relationships for:**

- profiles
- roles
- permissions
- stores
- store metrics
- pulse scores
- customers
- orders
- complaints/cases
- fraud reviews
- notifications
- work orders/incidents
- audit logs
- settings/preferences

**Seed enough realistic data to make every dashboard meaningful.**

**Seed enough variation to produce:**

- Healthy stores
- Warning stores
- Critical stores
- Different regions
- Different case priorities
- Different SLA states
- Different fraud risk levels
- Different order statuses
- Historical trends
- Notification-triggering conditions

**Every demo account must have meaningful data.**

---

## No Hardcoded Dashboard Data

**Search for every:**

```
42
73%
₹...
1234
0
Math.random()
```

**Determine whether each value should be:**

- Database-derived
- Calculated from API data
- Static UI configuration (only this category may remain static)

**For every KPI/chart:**

```
Database → Express API → TanStack Query → UI
```

---

## UX Quality

**Every page must have proper:**

- Loading state
- Empty state
- Error state
- Hover state
- Cursor behavior
- Clickable affordances
- Disabled state
- Confirmation where destructive
- Toast/success feedback
- Responsive layout

**Charts must have:**

- Tooltips
- Meaningful labels
- Correct units
- Correct dates
- Meaningful empty states

**Tables must have:**

- Sorting where useful
- Filtering
- Pagination where needed
- Clickable rows where appropriate

---

## Audit Logging

**Important actions should produce immutable audit events:**

- Login/security events where appropriate
- Role changes
- Case assignment
- Case escalation
- Case resolution
- Fraud decisions
- Store configuration changes
- Admin changes

**Audit logs must be server-generated.** Users must not be able to modify their own audit history.

---

## Security Verification

**Verify:**

- Service-role key never reaches client
- RLS enabled
- RLS tested
- JWT validation
- Role authorization
- Data-scope enforcement
- Zod validation
- Rate limiting
- Safe errors
- CORS
- Security headers
- No sensitive secrets in Git
- No sensitive data in frontend bundles

**Attempt unauthorized API calls manually.**

---

## Current Architecture Gap Analysis

### Issues Found:

1. **7 roles instead of max 5** - Need to consolidate (CUSTOMER_SUPPORT and DELIVERY_PARTNER in seed but not in enum)
2. **Executive Insights is separate page** - Should be removed per spec
3. **Math.random() in useStoreDetail.ts** - prevPulse and trend data are randomized
4. **Hardcoded agent counts in useCases.ts** - agentsOnShift: 12, agentsAvailable: 8
5. **Landing page has hardcoded metrics** - "14 stores", "47 cases", "74/100 pulse"
6. **Login page has hardcoded metrics** in branding panel
7. **Navigation includes Executive Insights** for EXECUTIVE role
8. **Date filter is decorative** - doesn't actually filter data
9. **Store detail page navigation broken** - clicking store doesn't load (reported by user)
10. **Customer profile not found** - needs investigation
11. **Notifications minimal** - only 2 seeded, no real generation logic
12. **Chatbot exists but not safe** - Executive Insights uses DeterministicInsightsProvider
13. **Mock data imports removed** but some hardcoded values remain
14. **Pulse scores and metrics** - seed data has static values, not correlated properly

### Strengths:

1. **Comprehensive database schema** - All necessary tables exist
2. **RLS policies in place** - Good data isolation foundation
3. **Express middleware auth** - requireAuth and requirePermission implemented
4. **TanStack Query hooks** - Good data fetching architecture
5. **Zod validation** - Request validation in place
6. **Rate limiting** - Implemented in routes
7. **Seed data exists** - Foundation for realistic data
8. **Role-based navigation** - NAV_BY_ROLE configured in app-shell

---

## Implementation Phases

### Phase 1: Repository Audit ✅ (COMPLETED)

- Inspected all routes, components, hooks, services, controllers
- Inspected migrations, RLS, seed data, auth, RBAC
- Identified hardcoded values, broken workflows, duplicated architecture
- Created this specification

### Phase 2: Role/Permission/Data-Scope Architecture

- Consolidate to 5 roles max
- Update RBAC permissions
- Update RLS policies
- Update navigation configuration

### Phase 3: Database Schema + Migrations + RLS

- Remove unnecessary roles
- Enhance seed data with realistic correlations
- Fix customer profile mapping
- Add historical data for trends

### Phase 4: Realistic Deterministic Seed Data

- Remove static metrics
- Correlate pulse scores with store metrics
- Generate realistic historical data
- Seed notification-triggering conditions

### Phase 5: Authentication + Session Lifecycle

- Test login/logout for all roles
- Test session switching
- Test role-based redirects
- Test expired sessions

### Phase 6: Express Authorization/Data-Scope Middleware

- Verify requireAuth works
- Verify requirePermission works
- Test unauthorized access
- Test data scoping

### Phase 7: Backend APIs

- Verify all endpoints return real data
- Remove hardcoded values
- Add missing endpoints
- Test role-based filtering

### Phase 8: Notification System

- Implement notification generation logic
- Seed realistic notifications
- Test notification delivery
- Test read/unread states

### Phase 9: Dashboard Data Pipelines

- Remove Math.random()
- Remove hardcoded KPIs
- Connect all charts to real data
- Implement date filtering

### Phase 10: Persona-Specific Navigation and Layouts

- Update NAV_BY_ROLE for 5 roles
- Remove Executive Insights from navigation
- Implement role-specific layouts
- Test navigation for each role

### Phase 11: Dashboard UI Integration

- Remove Executive Insights page
- Fix store detail navigation
- Fix customer profile
- Implement proper loading/error/empty states

### Phase 12: Customer Portal

- Fix customer profile not found
- Test customer data isolation
- Test complaint submission
- Test order tracking

### Phase 13: Chatbot Architecture + Safe Implementation

- Review DeterministicInsightsProvider
- Implement safe data access
- Test authorization bypass prevention
- Remove or integrate properly

### Phase 14: Profile/Settings/Logout

- Implement contextual profile menus
- Add settings persistence
- Test logout for all roles
- Test session cleanup

### Phase 15: End-to-End Workflows

- Test case assignment workflow
- Test fraud decision workflow
- Test store manager workflow
- Test customer complaint workflow

### Phase 16: Security Audit

- Test unauthorized API calls
- Verify RLS enforcement
- Check for secrets in frontend
- Test CORS and security headers

### Phase 17: Browser QA

- Test each persona independently
- Test direct URL access
- Test browser refresh
- Test mobile responsiveness

### Phase 18: Production/Demo Polish

- Remove all debug code
- Polish UI/UX
- Add proper error messages
- Final end-to-end testing
