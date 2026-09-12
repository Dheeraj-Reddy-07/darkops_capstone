# DarkOps Security Audit

**Date:** 2026-09-06  
**Auditor:** Security Engineering Team  
**Scope:** Complete application security review

---

## 1. Current Architecture

### Technology Stack

- **Frontend:** React 19.2.0 + Vite 8.1.5 + TanStack Router 1.170.18 + TanStack Query 5.101.1
- **Backend:** Express.js 5.2.1 (Node.js server on port 5000)
- **Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (for complaint attachments)
- **Validation:** Zod 3.25.76
- **Security Middleware:** Helmet 8.3.0, CORS 2.8.6, express-rate-limit 8.7.0

### Architecture Pattern

```
Browser (React + Vite)
    ↓ (Vite proxy)
Express API Server (port 5000)
    ↓ (Supabase clients)
Supabase (PostgreSQL + Auth + Storage)
```

**Note:** Existing documentation mentions TanStack Start/Nitro, but the actual implementation uses a separate Express server. This audit covers the actual implementation.

---

## 2. Authentication Flow

### Current Implementation

1. **Browser Client:** Uses `createSupabaseBrowserClient()` with anon key
2. **Login Flow:**
   - User submits email/password to Supabase Auth
   - Session stored via Supabase client with auto-refresh
   - React Query cache cleared on login
   - Role-based redirect after authentication
3. **API Authentication:**
   - Frontend includes JWT in `Authorization: Bearer <token>` header
   - Server validates token via `requireAuth` middleware
   - Server fetches user profile from database
   - Permissions resolved based on role

### Session Management

- **Persistence:** `persistSession: true`, `autoRefreshToken: true`
- **Storage:** Supabase handles session storage (cookies)
- **Token Refresh:** Automatic via Supabase client
- **Logout:** Clears React Query cache and Supabase session

### Security Controls

- ✅ JWT validation on every API request
- ✅ Profile fetch with `is_active` check
- ✅ Disabled account rejection (403)
- ✅ Session invalidation on logout

---

## 3. Authorization Flow

### RBAC Model

**Roles:** PLATFORM_ADMIN, EXECUTIVE, OPERATIONS, CUSTOMER_SUPPORT, STORE_MANAGER, CUSTOMER

**Permissions:** (defined in `server/lib/rbac.ts`)

- `cases.read.all`, `cases.read.assigned`, `cases.create`, `cases.assign`, `cases.escalate`, `cases.resolve`, `cases.comment`
- `stores.read.all`, `stores.read.own`, `stores.manage`
- `support.read`, `support.review`, `support.decide`
- `executive.read`
- `customers.read.own`, `customers.create_complaint`
- `orders.read.all`, `orders.read.own`
- `work_orders.read.all`, `work_orders.read.own`, `work_orders.manage`
- `audit.read`, `admin.users`

### Authorization Middleware

- `requireAuth`: Validates session, fetches profile, resolves permissions
- `requirePermission`: Checks specific permissions before allowing access

### Data Scope

- **Customer:** Own orders, own complaints, own attachments
- **Operations:** All cases (with assignment filtering), all stores
- **Store Manager:** Own store only, own work orders
- **Fraud Analyst:** Fraud reviews and related data
- **Executive:** Aggregated metrics, limited PII
- **Platform Admin:** Full access with audit logging

---

## 4. Database Access Flow

### Supabase Clients

1. **Browser Client:** Anon key only, subject to RLS
2. **Server Client (Auth):** Anon key with cookie-based session
3. **Server Client (Service Role):** Service role key, bypasses RLS

### Query Pattern

```typescript
// Most controllers use service role client for administrative operations
const adminClient = createSupabaseServiceRoleClient();
const { data } = await adminClient.from("table").select("*").eq("id", id);
```

### RLS Helper Functions

- `get_role()`: Returns authenticated user's role
- `get_customer_id()`: Returns customer ID for authenticated user
- `get_profile_store_id()`: Returns store ID for store managers

---

## 5. Storage/File Flow

### Current Implementation

- **Table:** `complaint_attachments` (migration 020)
- **Fields:** id, complaint_id, filename, storage_path, file_type, file_size_bytes, uploaded_by, uploaded_at
- **RLS:** Customer can see own attachments, elevated roles can see all
- **Upload:** Handled via customer complaint creation (metadata only, no actual file upload yet)

### Missing Controls

- ❌ No actual file upload implementation
- ❌ No signed URL generation
- ❌ No file size validation
- ❌ No MIME type validation
- ❌ No malicious file type blocking
- ❌ No private storage bucket configuration
- ❌ No malware scanning integration

---

## 6. Customer Data Flow

### Customer Isolation

- **Profile Lookup:** Tries `profile_id` first, falls back to email matching
- **Auto-Linking:** Updates `profile_id` on successful email match
- **Data Access:** All customer queries filtered by `customer_id`

### Data Exposed to Customers

- Own orders (with store details)
- Own complaints (with status history)
- Own attachments (metadata)
- Order tracking information
- Complaint status and timeline

---

## 7. Chatbot/Data Flow

### Current Implementation

- **Endpoint:** `/api/v1/customers/me/chat`
- **Authentication:** Required via `requireAuth`
- **Authorization:** `customers.read.own` permission
- **Logic:** Deterministic keyword matching (no LLM integration)
- **Data Access:** Uses service role client with customer filtering

### Chatbot Capabilities

- Order status tracking
- Recent orders history
- Complaint status checking
- Human agent escalation
- Account information
- General help

### Security Controls

- ✅ Authentication required
- ✅ Customer data filtering (customer.id)
- ✅ No direct database access to LLM
- ✅ Deterministic responses (no hallucination risk)

### Missing Controls

- ❌ No prompt injection protection (not applicable with deterministic logic)
- ❌ No rate limiting specific to chatbot (uses general rate limit)
- ❌ No audit logging for chatbot queries

---

## 8. Current Security Controls

### Implemented Controls

| Control          | Status          | Evidence                                  |
| ---------------- | --------------- | ----------------------------------------- |
| Authentication   | ✅ VERIFIED     | Supabase Auth with JWT validation         |
| RBAC             | ✅ VERIFIED     | Role-based permissions in middleware      |
| RLS              | ✅ VERIFIED     | Database-level policies on all tables     |
| Input Validation | ⚠️ PARTIAL      | Zod schemas on some endpoints             |
| Rate Limiting    | ⚠️ PARTIAL      | In-memory rate limiter                    |
| CORS             | ⚠️ PARTIAL      | Configured but could be stricter          |
| Security Headers | ⚠️ PARTIAL      | Helmet configured but not comprehensive   |
| Error Handling   | ✅ VERIFIED     | HTTPError class with safe error messages  |
| Audit Logging    | ✅ VERIFIED     | Audit service with important events       |
| Secret Isolation | ⚠️ NEEDS REVIEW | Service role key usage needs verification |

---

## 9. Missing Controls

### Critical Missing Controls

1. **File Upload Security:** No implementation for secure file handling
2. **Request Correlation:** No request ID tracking for observability
3. **Comprehensive Input Validation:** Missing on many endpoints
4. **Mass Assignment Protection:** Some endpoints accept arbitrary fields
5. **Data Minimization:** API responses return full database rows
6. **SQL Injection Protection:** Needs audit of dynamic queries
7. **XSS Protection:** No content sanitization for user-generated content
8. **Security Headers:** Missing CSP, HSTS, and other headers
9. **Rate Limiting:** In-memory only, not distributed
10. **IDOR Protection:** Some endpoints lack ownership verification

### Important Missing Controls

11. **Request Size Limits:** No body size limits configured
12. **Pagination Limits:** No maximum page size enforcement
13. **Privilege Escalation Tests:** No automated testing
14. **Security Test Suite:** No automated security tests
15. **Security Center UI:** No admin security dashboard
16. **Security Events UI:** No real-time security event display
17. **Dependency Scanning:** No automated dependency audit
18. **Secret Rotation:** No process for credential rotation
19. **Malware Scanning:** No integration for uploaded files
20. **Session Timeout:** No configurable session expiration

---

## 10. Vulnerability/Risk Table

| Vulnerability                                 | Severity | Likelihood | Impact   | Status                         |
| --------------------------------------------- | -------- | ---------- | -------- | ------------------------------ |
| IDOR - Customer accessing other customer data | HIGH     | MEDIUM     | HIGH     | NEEDS FIX                      |
| IDOR - User accessing unauthorized cases      | HIGH     | MEDIUM     | HIGH     | NEEDS FIX                      |
| Mass Assignment - Role manipulation           | HIGH     | LOW        | CRITICAL | NEEDS FIX                      |
| File Upload - No validation                   | HIGH     | MEDIUM     | HIGH     | NOT IMPLEMENTED                |
| SQL Injection - Dynamic queries               | MEDIUM   | LOW        | CRITICAL | NEEDS AUDIT                    |
| XSS - User-generated content                  | MEDIUM   | MEDIUM     | MEDIUM   | NEEDS FIX                      |
| Rate Limiting - In-memory only                | MEDIUM   | LOW        | MEDIUM   | DEPLOYMENT DEPENDENT           |
| Secret Exposure - Service role key            | CRITICAL | LOW        | CRITICAL | NEEDS VERIFICATION             |
| CORS - Overly permissive                      | LOW      | LOW        | MEDIUM   | NEEDS REVIEW                   |
| Missing Security Headers                      | MEDIUM   | LOW        | LOW      | NEEDS FIX                      |
| No Request Correlation                        | LOW      | N/A        | LOW      | NEEDS IMPLEMENTATION           |
| Chatbot - Prompt injection                    | LOW      | LOW        | MEDIUM   | NOT APPLICABLE (deterministic) |
| Privilege Escalation - Direct role change     | HIGH     | LOW        | CRITICAL | PARTIALLY PROTECTED            |
| Data Minimization - PII exposure              | MEDIUM   | N/A        | MEDIUM   | NEEDS FIX                      |
| Audit Logging - Incomplete coverage           | LOW      | N/A        | LOW      | NEEDS EXPANSION                |

---

## 11. Recommended Fixes

### Immediate (Critical)

1. **Verify service role key isolation** - Ensure no exposure in frontend
2. **Add IDOR protection** - Ownership checks on all customer endpoints
3. **Implement mass assignment protection** - Explicit field allowlists
4. **Add file upload security** - Validation, signed URLs, private storage
5. **Expand audit logging** - Cover all security-relevant events

### High Priority

6. **Implement comprehensive input validation** - Zod schemas on all endpoints
7. **Add request correlation IDs** - For observability and debugging
8. **Implement data minimization** - Response DTOs for sensitive data
9. **Audit SQL injection risks** - Review all dynamic queries
10. **Add XSS protection** - Content sanitization for user input

### Medium Priority

11. **Configure security headers** - CSP, HSTS, frame protection
12. **Strengthen CORS configuration** - Restrict to specific origins
13. **Add request size limits** - Prevent resource exhaustion
14. **Implement pagination limits** - Maximum page size enforcement
15. **Create security test suite** - Automated security tests

### Low Priority

16. **Create security center UI** - Admin security dashboard
17. **Implement distributed rate limiting** - Redis-based for production
18. **Add dependency scanning** - Automated vulnerability checks
19. **Implement malware scanning** - For uploaded files
20. **Add session timeout configuration** - Configurable expiration

---

## 12. Deployment-Dependent Controls

### Controls That Require Production Infrastructure

1. **Distributed Rate Limiting:** Current in-memory limiter needs Redis/store for production
2. **HTTPS/TLS:** Currently uses HTTP, production requires HTTPS
3. **HSTS Header:** Only applicable with HTTPS
4. **Malware Scanning:** Requires integration with scanning service
5. **Secret Rotation:** Requires secret management service (AWS Secrets Manager, etc.)
6. **IP-based Rate Limiting:** Requires reliable IP detection (behind proxy)
7. **Geographic Blocking:** Requires IP geolocation service
8. **DDoS Protection:** Requires cloudflare/AWS Shield integration

### Current Development Limitations

- No SSL/TLS termination (uses HTTP)
- No distributed cache (in-memory rate limiting)
- No secret management service (environment variables)
- No malware scanning infrastructure
- No DDoS protection layer

---

## 13. Specific Findings by Component

### Authentication

- ✅ Supabase Auth properly configured
- ✅ JWT validation on every request
- ✅ Session refresh automatic
- ⚠️ No configurable session timeout
- ⚠️ No multi-factor authentication

### Authorization

- ✅ RBAC properly implemented
- ✅ Permission middleware functional
- ⚠️ Some routes missing permission checks
- ⚠️ No scope-based authorization (store, region)

### Database Security

- ✅ RLS enabled on all sensitive tables
- ✅ Helper functions for role/scope resolution
- ⚠️ Some RLS policies overly permissive
- ⚠️ Audit logs have RLS disabled (API-level only)

### API Security

- ✅ Authentication middleware implemented
- ✅ Error handling with safe messages
- ⚠️ Inconsistent input validation
- ⚠️ Missing request size limits
- ⚠️ No request correlation IDs

### Frontend Security

- ✅ Route guards implemented
- ✅ No service role keys in frontend code
- ⚠️ Some sensitive data in API responses
- ⚠️ No CSP configured

### File Security

- ❌ No file upload implementation
- ❌ No file validation
- ❌ No signed URL generation
- ❌ No private storage configuration

### Chatbot Security

- ✅ Authentication required
- ✅ Customer data filtering
- ✅ Deterministic logic (no LLM risks)
- ⚠️ No chatbot-specific rate limiting
- ⚠️ No audit logging for queries

---

## 14. Compliance Considerations

### Data Protection

- ⚠️ Customer PII exposed in some API responses
- ⚠️ No data retention policy implemented
- ⚠️ No right-to-be-forgotten implementation

### Audit Trail

- ✅ Audit logging implemented for key events
- ⚠️ Not all security events logged
- ⚠️ Audit logs not tamper-evident (no append-only guarantee)

### Access Control

- ✅ Role-based access control
- ⚠️ No separation of duties enforcement
- ⚠️ No emergency access procedures

---

## 15. Testing Status

### Current Testing

- ❌ No automated security tests
- ❌ No penetration testing
- ❌ No dependency vulnerability scanning
- ⚠️ Manual testing only

### Recommended Testing

1. Automated security test suite
2. IDOR attack simulation
3. Privilege escalation testing
4. Input fuzzing
5. Dependency scanning (npm audit)
6. Penetration testing

---

## 16. Next Steps

### Phase 1: Critical Security Fixes

1. Verify service role key isolation
2. Add IDOR protection to all endpoints
3. Implement mass assignment protection
4. Expand audit logging coverage

### Phase 2: Security Hardening

5. Implement comprehensive input validation
6. Add request correlation IDs
7. Implement data minimization
8. Add XSS protection

### Phase 3: Infrastructure Security

9. Configure security headers
10. Strengthen CORS
11. Add request/pagination limits
12. Implement file upload security

### Phase 4: Security Observability

13. Create security center UI
14. Implement security events display
15. Create security test suite
16. Document security architecture

### Phase 5: Production Readiness

17. Implement distributed rate limiting
18. Add dependency scanning
19. Implement malware scanning
20. Configure production security headers

---

## Conclusion

The DarkOps application has a solid foundation with:

- ✅ Proper authentication via Supabase Auth
- ✅ RBAC implementation with role-based permissions
- ✅ RLS policies on database tables
- ✅ Basic security middleware (helmet, CORS, rate limiting)
- ✅ Audit logging for key events

However, critical security gaps exist:

- ❌ IDOR vulnerabilities in customer endpoints
- ❌ Missing file upload security
- ❌ Incomplete input validation
- ❌ Missing security headers
- ❌ No automated security testing

**Overall Risk Level:** MEDIUM-HIGH

**Recommendation:** Implement critical fixes immediately, then proceed with systematic security hardening phases.
