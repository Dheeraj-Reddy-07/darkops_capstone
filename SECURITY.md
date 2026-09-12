# DarkOps Security Architecture

## Overview

DarkOps implements a defense-in-depth security model across all layers of the application. This document describes the security controls, architecture, and best practices implemented to protect customer data and ensure system integrity.

## Security Principles

1. **Defense in Depth**: Multiple layers of security controls at authentication, authorization, data access, and transport layers
2. **Least Privilege**: Users and systems have only the minimum access required
3. **Zero Trust**: All requests are authenticated and authorized, regardless of source
4. **Fail Secure**: System defaults to secure state; errors don't bypass security
5. **Audit Everything**: All security-relevant actions are logged for investigation

## Authentication & Authorization

### Authentication

- **Provider**: Supabase Auth (JWT-based)
- **Session Management**: Cookie-based sessions with HttpOnly, Secure, SameSite flags
- **Token Validation**: Every request validates JWT signature and expiration
- **Account Status**: Disabled accounts are blocked at authentication layer

### Authorization Model

**Roles** (Authoritative - no FRAUD_ANALYST role):

- `PLATFORM_ADMIN`: Full system access
- `EXECUTIVE`: Strategic oversight, read-only access to all data
- `OPERATIONS`: Case management, complaint handling
- `CUSTOMER_SUPPORT`: Customer interactions, support tickets
- `STORE_MANAGER`: Store-level operations
- `CUSTOMER`: Own orders and complaints only

**Permission System**:

- Role-based access control (RBAC) with granular permissions
- Permissions defined in `server/lib/rbac.ts`
- Server-side enforcement on all endpoints
- Frontend route guards for UX (not security)

### Implementation

```typescript
// Authentication middleware
requireAuth: Validates JWT, fetches profile, checks account status

// Authorization middleware
requirePermission: Checks specific permissions against user role

// Example permissions
orders.read.own
customers.create_complaint
cases.assign
```

## Data Access Control

### Row Level Security (RLS)

**Database-Level Protection**:

- RLS policies on all sensitive tables
- Policies enforce data scoping based on user role
- Service role key bypasses RLS (server-side only)

**Key RLS Policies**:

- `orders`: Customers see only their own orders
- `complaints`: Customers see only their own complaints
- `profiles`: Users can only update their own profile
- `support_tickets`: Scoped by role and assignment

### IDOR Protection

**Implementation**:

- All customer endpoints verify resource ownership before access
- Ownership checks performed before data retrieval
- Security events logged on IDOR attempts

```typescript
// Example from customers.controller.ts
if (order.customer_id !== customer.id) {
  await logSecurityEvent({
    action: "IDOR_ATTEMPT",
    resourceType: "order",
    resourceId: id,
    metadata: { reason: "ownership_violation" },
  });
  throw new HTTPError(403, "FORBIDDEN", "Access denied");
}
```

## Input Validation & Sanitization

### Validation Layer

**Zod Schemas**:

- All request bodies validated against Zod schemas
- Type coercion, length limits, format validation
- Allowlisted values for enums (categories, statuses, priorities)

**Key Schemas** (`server/schemas/`):

- `customer.schemas.ts`: Complaint creation, chatbot messages
- `case.schemas.ts`: Case assignment, filtering
- `store.schemas.ts`: Store queries

### Mass Assignment Protection

**Field Allowlisting**:

- `filterAllowedFields()` function in `server/lib/validation.ts`
- Only explicitly allowed fields are processed from request bodies
- Prevents overwriting sensitive fields

```typescript
const allowedFields = ["order_id", "category", "details", "attachments"] as const;
const filteredInput = filterAllowedFields(req.body, allowedFields);
```

### XSS Protection

**Sanitization Functions** (`server/lib/validation.ts`):

- `sanitizeString()`: Removes control characters
- `escapeHTML()`: Escapes HTML entities
- `sanitizeUserContent()`: Removes dangerous patterns (javascript:, on*=, data:)

**Frontend Protection**:

- React automatically escapes JSX content
- Helmet CSP headers restrict inline scripts

## Data Minimization

### Response DTOs

**Purpose**: Return only necessary data to clients

**Implementation** (`server/lib/dto.ts`):

- `toOrderDTO()`: Order data with sensitive fields removed
- `toComplaintDTO()`: Complaint data with internal fields removed
- `toCustomerDTO()`: Customer profile with sensitive fields removed
- `toSupportTicketDTO()`: Support ticket data

**Benefits**:

- Reduces attack surface
- Prevents accidental data leakage
- Improves performance

## Transport Security

### HTTPS/TLS

- All API endpoints require HTTPS in production
- HSTS header with 1-year max age, includeSubDomains, preload
- TLS 1.2+ required

### Security Headers

**Helmet Configuration** (`server/index.ts`):

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});
```

### CORS Configuration

**Policy**:

- Origin allowlist via `ALLOWED_ORIGINS` environment variable
- Credentials allowed for cookie-based auth
- Specific allowed headers: Content-Type, Authorization, X-Request-ID
- Preflight cache: 24 hours

## Rate Limiting

**Implementation** (`server/middleware/rateLimit.ts`):

- Per-endpoint rate limits
- Customer endpoints: 50 requests/minute (read), 5 requests/minute (write)
- Chatbot: 20 requests/minute
- Support requests: 10 requests/minute

**Benefits**:

- Prevents brute force attacks
- Mitigates DoS attempts
- Protects resource-intensive operations

## Request Size Limits

**Configuration** (`server/index.ts`):

- JSON body: 1MB max
- URL-encoded body: 1MB max
- Prevents resource exhaustion attacks

## Pagination Limits

**Implementation**:

- Default page size: 20
- Maximum page size: 100
- Maximum page number: 1000
- Enforced via Zod schemas and validation utilities

## Audit Logging

### Audit Events

**Logged Actions** (`server/services/audit.service.ts`):

- Authentication: Login success/failure, logout
- Authorization: Access denied, permission denied
- Data operations: Create, update, delete
- Security events: IDOR attempts, privilege escalation
- Fraud operations: Reviews, decisions

**Event Types**:

- `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`, `AUTH_LOGOUT`
- `ACCESS_DENIED`, `PERMISSION_DENIED`
- `IDOR_ATTEMPT`, `PRIVILEGE_ESCALATION_ATTEMPT`
- `COMPLAINT_CREATED`, `COMPLAINT_ESCALATED`
- `FRAUD_REVIEW_CREATED`, `FRAUD_DECISION_MADE`
- And more...

### Metadata Sanitization

**Sensitive Data Redaction**:

- Passwords, tokens, secrets, keys automatically redacted
- Credit card numbers, SSNs, API keys redacted
- Prevents sensitive data leakage in logs

### Request Correlation

**Implementation**:

- Unique request ID generated for each request
- ID included in all audit logs
- Response header `X-Request-ID` for client-side tracing
- Enables log aggregation and debugging

## Service Role Key Isolation

**Policy**:

- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) used only server-side
- Never exposed to frontend code
- Used only for operations requiring RLS bypass
- Verified via grep: no occurrences in `src/` directory

**Usage**:

- Admin operations that need full data access
- Background jobs and automation
- Audit logging (bypasses RLS for security events)

## Error Handling

**Security-Focused Error Handling**:

- Generic error messages in production
- Detailed errors only in development
- No stack traces exposed to clients
- Request ID included in all error responses

```typescript
res.status(statusCode).json({
  error: {
    code: errorCode,
    message: err.message || "An unexpected error occurred.",
    requestId,
    ...(isDevelopment && err.details ? { details: err.details } : {}),
    ...(isDevelopment ? { stack: err.stack } : {}),
  },
});
```

## File Upload Security

**Current Implementation**:

- Attachment metadata stored in database
- File size validation: Max 10MB per file
- Filename validation: Alphanumeric, dots, underscores, hyphens only
- File type validation: Restricted to image types
- Max 10 attachments per complaint

**Future Enhancements**:

- Private Supabase Storage bucket
- Signed URLs for temporary access
- Virus scanning integration
- File content validation (magic bytes)

## Database Security

**Connection Security**:

- Connection string via environment variables
- SSL required in production
- Connection pooling via Supabase

**Schema Security**:

- Sensitive tables have RLS enabled
- No direct database access from frontend
- All access via API layer

## Environment Variables

**Security-Sensitive Variables**:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server only)
- `VITE_SUPABASE_ANON_KEY`: Anonymous key (frontend only)
- `ALLOWED_ORIGINS`: CORS allowlist
- `NODE_ENV`: Environment (development/production)

**Best Practices**:

- Never commit `.env` files
- Use different keys for development and production
- Rotate keys periodically
- Use secrets management in production

## Dependency Security

**Package Management**:

- Regular dependency updates
- `npm audit` for vulnerability scanning
- Lock file committed for reproducibility

**Recommended Actions**:

- Run `npm audit` regularly
- Update dependencies with security patches
- Review new dependencies before adding

## Monitoring & Alerting

**Current Monitoring**:

- Console logging for all requests
- Error logging with request IDs
- Security event logging to database

**Recommended Enhancements**:

- Structured logging (JSON format)
- Log aggregation service (e.g., Datadog, ELK)
- Alerting on security events
- Performance monitoring

## Testing Security

**Security Test Suite** (To Be Created):

- IDOR attack simulation
- Privilege escalation testing
- Input fuzzing
- Authentication bypass attempts
- Rate limit testing

**Manual Testing**:

- Test as different roles
- Verify data isolation
- Test error conditions
- Verify audit logs

## Compliance Considerations

**Data Protection**:

- Customer data access restricted to own data
- Audit trail for all data access
- Data minimization in responses
- Sensitive data redaction in logs

**Availability**:

- Rate limiting prevents abuse
- Error handling prevents cascading failures
- Request size limits prevent resource exhaustion

## Security Checklist

### Authentication & Authorization

- [x] JWT validation on all protected endpoints
- [x] Role-based access control implemented
- [x] Account status checks (disabled accounts blocked)
- [x] Permission checks on all operations
- [x] No FRAUD_ANALYST role (deprecated)

### Data Protection

- [x] RLS policies on sensitive tables
- [x] IDOR protection on customer endpoints
- [x] Data minimization via DTOs
- [x] Sensitive data redaction in logs
- [x] Service role key isolated server-side

### Input Validation

- [x] Zod schemas for all request bodies
- [x] Mass assignment protection
- [x] XSS sanitization functions
- [x] Field allowlisting
- [x] Length and format validation

### Transport Security

- [x] HTTPS required in production
- [x] HSTS header configured
- [x] Security headers (Helmet)
- [x] CORS configuration
- [x] CSP configured

### Rate Limiting & Resource Protection

- [x] Per-endpoint rate limits
- [x] Request size limits
- [x] Pagination limits
- [x] Connection timeouts

### Audit & Monitoring

- [x] Audit logging for security events
- [x] Request correlation IDs
- [x] Security event logging
- [x] Error logging with context
- [ ] Structured logging (enhancement)

### Error Handling

- [x] Generic errors in production
- [x] Request IDs in error responses
- [x] No stack traces exposed
- [x] Secure error handling

## Known Limitations

1. **File Upload**: Currently stores metadata only; actual file storage to be implemented
2. **Real-time Monitoring**: No centralized log aggregation or alerting
3. **Automated Security Testing**: Security test suite to be created
4. **Secrets Management**: Environment variables; consider secrets manager for production

## Security Contacts

For security concerns or vulnerabilities:

- Report via responsible disclosure
- Do not publicly disclose vulnerabilities
- Allow time for remediation before disclosure

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Zod Validation](https://zod.dev/)

## Version History

- **v1.0** (2026-09-06): Initial security documentation
  - Documented authentication, authorization, RLS
  - Documented input validation, XSS protection
  - Documented security headers, CORS, rate limiting
  - Documented audit logging, error handling
  - Documented service role key isolation
