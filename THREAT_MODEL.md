# DarkOps Threat Model

## Document Information

- **Version**: 1.0
- **Date**: 2026-09-06
- **Scope**: DarkOps Operational Intelligence Platform
- **Methodology**: STRIDE + DREAD

## Executive Summary

This threat model identifies potential security threats to the DarkOps platform and documents the mitigations in place. The platform handles sensitive customer data, operational intelligence, and fraud detection, making security critical.

## System Overview

### Architecture Components

1. **Frontend**: React + Vite + TanStack Router (customer portal, internal dashboards)
2. **Backend**: Node.js + Express API
3. **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
4. **Authentication**: Supabase Auth (JWT-based)
5. **Storage**: Supabase Storage (for file attachments)

### Data Flows

1. **Customer Data Flow**: Customer → Frontend → API → Supabase (with RLS)
2. **Internal User Flow**: Internal User → Frontend → API → Supabase (service role for admin ops)
3. **Chatbot Flow**: Customer → Frontend → API → AI Service → Supabase (filtered by customer ID)

### Trust Boundaries

1. **Internet to Frontend**: Untrusted network to client-side application
2. **Frontend to API**: Client application to server API (HTTPS)
3. **API to Database**: Server to Supabase (service role for admin, anon key for user operations)
4. **API to AI Service**: Server to external AI service

## Threat Modeling Methodology

### STRIDE Categories

- **S**poofing: Impersonating users or systems
- **T**ampering: Modifying data or code
- **R**epudiation: Denying actions
- **I**nformation Disclosure: Unauthorized data access
- **D**enial of Service: Disrupting service availability
- **E**levation of Privilege: Gaining unauthorized access

### DREAD Risk Assessment

- **D**amage: How bad is the impact?
- **R**eproducibility: How easy is it to reproduce?
- **E**xploitability: How easy is it to exploit?
- **A**ffected Users: How many users are affected?
- **D**iscoverability: How easy is it to discover?

Risk Score = (D + R + E + A + D) / 5

## Threat Analysis

### 1. Authentication Threats

#### Threat 1.1: Credential Stuffing

- **Category**: Spoofing
- **Description**: Attacker uses leaked credentials to gain unauthorized access
- **Affected Component**: Authentication endpoint
- **Mitigations**:
  - Rate limiting on auth endpoints
  - Account lockout after failed attempts
  - MFA recommended for production
- **Risk Level**: Medium (DREAD: 6/10)
- **Status**: Partially mitigated (rate limiting implemented, MFA not implemented)

#### Threat 1.2: Session Hijacking

- **Category**: Spoofing, Tampering
- **Description**: Attacker steals session token to impersonate user
- **Affected Component**: Session management
- **Mitigations**:
  - HttpOnly, Secure, SameSite cookies
  - Short token expiration
  - Token validation on every request
- **Risk Level**: Low (DREAD: 4/10)
- **Status**: Mitigated

#### Threat 1.3: JWT Token Forgery

- **Category**: Spoofing
- **Description**: Attacker forges JWT token to impersonate user
- **Affected Component**: JWT validation
- **Mitigations**:
  - Strong signing algorithm (RS256)
  - Signature validation on every request
  - Token expiration checks
- **Risk Level**: Low (DREAD: 3/10)
- **Status**: Mitigated (Supabase handles JWT signing)

### 2. Authorization Threats

#### Threat 2.1: IDOR (Insecure Direct Object Reference)

- **Category**: Information Disclosure, Elevation of Privilege
- **Description**: Customer accesses another customer's orders/complaints by changing ID
- **Affected Component**: Customer endpoints
- **Mitigations**:
  - Ownership verification before data access
  - RLS policies on database
  - Security event logging on IDOR attempts
- **Risk Level**: High (DREAD: 8/10)
- **Status**: Mitigated

#### Threat 2.2: Privilege Escalation

- **Category**: Elevation of Privilege
- **Description**: User escalates to higher role (e.g., CUSTOMER to PLATFORM_ADMIN)
- **Affected Component**: Role management, permission checks
- **Mitigations**:
  - Server-side permission checks on all endpoints
  - Role changes require admin privileges
  - Audit logging for role changes
- **Risk Level**: Medium (DREAD: 6/10)
- **Status**: Mitigated

#### Threat 2.3: Horizontal Privilege Escalation

- **Category**: Information Disclosure
- **Description**: Customer accesses other customers' data
- **Affected Component**: Customer data access
- **Mitigations**:
  - RLS policies enforce data scoping
  - Customer resolution via profile_id or email
  - Data minimization via DTOs
- **Risk Level**: High (DREAD: 8/10)
- **Status**: Mitigated

### 3. Input Validation Threats

#### Threat 3.1: SQL Injection

- **Category**: Tampering, Information Disclosure
- **Description**: Attacker injects SQL to manipulate database queries
- **Affected Component**: Database queries
- **Mitigations**:
  - Parameterized queries via Supabase client
  - Input validation via Zod schemas
  - No raw SQL construction
- **Risk Level**: Low (DREAD: 3/10)
- **Status**: Mitigated

#### Threat 3.2: XSS (Cross-Site Scripting)

- **Category**: Tampering, Information Disclosure
- **Description**: Attacker injects malicious scripts into user-generated content
- **Affected Component**: Complaint details, chatbot messages
- **Mitigations**:
  - Input sanitization (escapeHTML, sanitizeUserContent)
  - React auto-escapes JSX content
  - CSP headers restrict inline scripts
- **Risk Level**: Medium (DREAD: 5/10)
- **Status**: Mitigated

#### Threat 3.3: Mass Assignment

- **Category**: Tampering, Elevation of Privilege
- **Description**: Attacker overwrites sensitive fields via request body
- **Affected Component**: All update/create endpoints
- **Mitigations**:
  - Field allowlisting (filterAllowedFields)
  - Explicit field validation
  - DTOs for response data
- **Risk Level**: Medium (DREAD: 6/10)
- **Status**: Mitigated

### 4. Data Protection Threats

#### Threat 4.1: Sensitive Data Exposure

- **Category**: Information Disclosure
- **Description**: Sensitive data leaked in logs, errors, or responses
- **Affected Component**: Logging, error handling, API responses
- **Mitigations**:
  - Sensitive data redaction in logs
  - Generic error messages in production
  - Data minimization via DTOs
  - No stack traces in production errors
- **Risk Level**: Medium (DREAD: 6/10)
- **Status**: Mitigated

#### Threat 4.2: Service Role Key Exposure

- **Category**: Elevation of Privilege
- **Description**: Service role key exposed to frontend or logs
- **Affected Component**: Environment variables, code
- **Mitigations**:
  - Service role key used only server-side
  - No occurrences in frontend code
  - Environment variables not committed
  - Verified via grep
- **Risk Level**: High (DREAD: 9/10)
- **Status**: Mitigated

#### Threat 4.3: Unauthorized Data Access via RLS Bypass

- **Category**: Information Disclosure
- **Description**: Attacker bypasses RLS to access all data
- **Affected Component**: Database RLS policies
- **Mitigations**:
  - Service role key isolated server-side
  - Anon key used for user operations (subject to RLS)
  - Regular RLS policy audits
- **Risk Level**: Medium (DREAD: 6/10)
- **Status**: Mitigated

### 5. Transport Security Threats

#### Threat 5.1: Man-in-the-Middle (MITM)

- **Category**: Spoofing, Tampering, Information Disclosure
- **Description**: Attacker intercepts and modifies traffic
- **Affected Component**: All network communication
- **Mitigations**:
  - HTTPS required in production
  - HSTS header with preload
  - TLS 1.2+ required
  - Secure cookies
- **Risk Level**: Low (DREAD: 3/10)
- **Status**: Mitigated

#### Threat 5.2: CORS Misconfiguration

- **Category**: Information Disclosure
- **Description**: Attacker exploits CORS to access data from unauthorized origins
- **Affected Component**: CORS configuration
- **Mitigations**:
  - Origin allowlist via environment variable
  - Credentials allowed only for allowed origins
  - Specific allowed headers
- **Risk Level**: Medium (DREAD: 5/10)
- **Status**: Mitigated

### 6. Availability Threats

#### Threat 6.1: DoS (Denial of Service)

- **Category**: Denial of Service
- **Description**: Attacker overwhelms system with requests
- **Affected Component**: API endpoints
- **Mitigations**:
  - Rate limiting per endpoint
  - Request size limits
  - Pagination limits
  - Connection timeouts
- **Risk Level**: Medium (DREAD: 6/10)
- **Status**: Partially mitigated (rate limiting implemented, no DDoS protection service)

#### Threat 6.2: Resource Exhaustion

- **Category**: Denial of Service
- **Description**: Attacker sends large requests to exhaust resources
- **Affected Component**: Request parsing, database
- **Mitigations**:
  - Request size limits (1MB)
  - Pagination limits (max 100 items)
  - Query complexity limits
- **Risk Level**: Low (DREAD: 4/10)
- **Status**: Mitigated

### 7. File Upload Threats

#### Threat 7.1: Malicious File Upload

- **Category**: Tampering
- **Description**: Attacker uploads malicious files (malware, scripts)
- **Affected Component**: File upload functionality
- **Mitigations**:
  - File type validation (images only)
  - File size limits (10MB max)
  - Filename validation
  - Private storage bucket (to be implemented)
- **Risk Level**: Medium (DREAD: 6/10)
- **Status**: Partially mitigated (validation implemented, storage not yet implemented)

#### Threat 7.2: File Path Traversal

- **Category**: Information Disclosure, Tampering
- **Description**: Attacker accesses files outside intended directory
- **Affected Component**: File storage
- **Mitigations**:
  - Supabase Storage (abstracts file system)
  - Signed URLs for access
  - No direct file system access
- **Risk Level**: Low (DREAD: 3/10)
- **Status**: Mitigated (when storage implemented)

### 8. Audit & Logging Threats

#### Threat 8.1: Log Tampering

- **Category**: Tampering, Repudiation
- **Description**: Attacker modifies or deletes audit logs
- **Affected Component**: Audit logging system
- **Mitigations**:
  - Logs stored in database (RLS protected)
  - Service role required for log modification
  - Log aggregation recommended for production
- **Risk Level**: Medium (DREAD: 5/10)
- **Status**: Partially mitigated (database storage, no log aggregation)

#### Threat 8.2: Insufficient Logging

- **Category**: Repudiation
- **Description**: Security events not logged, preventing investigation
- **Affected Component**: All endpoints
- **Mitigations**:
  - Comprehensive audit logging
  - Security event logging
  - Request correlation IDs
  - Sensitive data redaction
- **Risk Level**: Low (DREAD: 4/10)
- **Status**: Mitigated

### 9. Third-Party Threats

#### Threat 9.1: Compromised Dependencies

- **Category**: Tampering, Information Disclosure
- **Description**: Malicious code in third-party packages
- **Affected Component**: npm dependencies
- **Mitigations**:
  - Regular dependency updates
  - npm audit for vulnerability scanning
  - Lock file committed
  - Review new dependencies
- **Risk Level**: Medium (DREAD: 5/10)
- **Status**: Partially mitigated (audit available, no automated scanning)

#### Threat 9.2: AI Service Compromise

- **Category**: Information Disclosure
- **Description**: AI service leaks customer data
- **Affected Component**: Chatbot integration
- **Mitigations**:
  - Server-side authorization before AI call
  - Customer data filtering before sending to AI
  - No sensitive data sent to AI
- **Risk Level**: Medium (DREAD: 5/10)
- **Status**: Mitigated

## Threat Summary

### High Priority Threats (DREAD 7+)

| Threat                          | Risk | Status    | Remaining Actions |
| ------------------------------- | ---- | --------- | ----------------- |
| IDOR                            | 8/10 | Mitigated | Regular testing   |
| Horizontal Privilege Escalation | 8/10 | Mitigated | Regular testing   |
| Service Role Key Exposure       | 9/10 | Mitigated | Regular audits    |

### Medium Priority Threats (DREAD 5-6)

| Threat                   | Risk | Status    | Remaining Actions   |
| ------------------------ | ---- | --------- | ------------------- |
| Credential Stuffing      | 6/10 | Partial   | Implement MFA       |
| Privilege Escalation     | 6/10 | Mitigated | Regular audits      |
| Mass Assignment          | 6/10 | Mitigated | Regular testing     |
| Sensitive Data Exposure  | 6/10 | Mitigated | Regular audits      |
| RLS Bypass               | 6/10 | Mitigated | Regular audits      |
| DoS                      | 6/10 | Partial   | Add DDoS protection |
| Malicious File Upload    | 6/10 | Partial   | Implement storage   |
| Log Tampering            | 5/10 | Partial   | Add log aggregation |
| Compromised Dependencies | 5/10 | Partial   | Automated scanning  |
| AI Service Compromise    | 5/10 | Mitigated | Monitor AI provider |

### Low Priority Threats (DREAD <5)

| Threat               | Risk | Status    |
| -------------------- | ---- | --------- |
| Session Hijacking    | 4/10 | Mitigated |
| JWT Forgery          | 3/10 | Mitigated |
| SQL Injection        | 3/10 | Mitigated |
| MITM                 | 3/10 | Mitigated |
| Resource Exhaustion  | 4/10 | Mitigated |
| File Path Traversal  | 3/10 | Mitigated |
| Insufficient Logging | 4/10 | Mitigated |

## Security Controls Summary

### Preventive Controls

- **Authentication**: JWT validation, session management, rate limiting
- **Authorization**: RBAC, permission checks, RLS policies
- **Input Validation**: Zod schemas, field allowlisting, sanitization
- **Data Protection**: DTOs, sensitive data redaction, service role isolation
- **Transport Security**: HTTPS, HSTS, TLS, secure cookies
- **Rate Limiting**: Per-endpoint limits, request size limits
- **File Security**: Type validation, size limits, private storage

### Detective Controls

| Control             | Implementation                   |
| ------------------- | -------------------------------- |
| Audit Logging       | Database-backed audit logs       |
| Security Events     | Dedicated security event logging |
| Request Correlation | Unique request IDs               |
| Error Logging       | Contextual error logging         |
| Access Monitoring   | Permission denied logging        |

### Corrective Controls

- **Account Lockout**: After failed auth attempts (to be implemented)
- **Session Termination**: On logout or token expiration
- **Data Restoration**: Via database backups (Supabase managed)
- **Incident Response**: Via audit logs and security events

## Remaining Security Gaps

### High Priority

1. **Multi-Factor Authentication (MFA)**
   - Current: Password-only authentication
   - Recommendation: Implement MFA for all roles
   - Effort: Medium
   - Impact: High

2. **DDoS Protection**
   - Current: Rate limiting only
   - Recommendation: Add DDoS protection service (Cloudflare, AWS Shield)
   - Effort: Low
   - Impact: High

### Medium Priority

3. **Automated Dependency Scanning**
   - Current: Manual npm audit
   - Recommendation: CI/CD integration with Snyk or Dependabot
   - Effort: Low
   - Impact: Medium

4. **Log Aggregation**
   - Current: Console logging + database
   - Recommendation: Centralized log service (Datadog, ELK)
   - Effort: Medium
   - Impact: Medium

5. **File Storage Implementation**
   - Current: Metadata only
   - Recommendation: Implement Supabase Storage with signed URLs
   - Effort: Medium
   - Impact: Medium

### Low Priority

6. **Security Test Suite**
   - Current: Manual testing
   - Recommendation: Automated security tests (IDOR, auth bypass)
   - Effort: High
   - Impact: Medium

7. **Security Center UI**
   - Current: No UI for security monitoring
   - Recommendation: Admin dashboard for security events
   - Effort: High
   - Impact: Low

## Testing Recommendations

### Security Testing

1. **IDOR Testing**
   - Test customer accessing other customers' resources
   - Test role-based access boundaries
   - Frequency: Quarterly

2. **Authentication Testing**
   - Test session hijacking scenarios
   - Test JWT token expiration
   - Test credential stuffing
   - Frequency: Quarterly

3. **Input Validation Testing**
   - SQL injection attempts
   - XSS payloads
   - Mass assignment attempts
   - Frequency: Quarterly

4. **Penetration Testing**
   - Full application penetration test
   - Third-party security assessment
   - Frequency: Annually

### Automated Testing

1. **Dependency Scanning**: Weekly via CI/CD
2. **Static Analysis**: On every commit
3. **Dynamic Analysis**: On every deployment
4. **Security Unit Tests**: On every commit

## Incident Response Plan

### Detection

- Monitor audit logs for suspicious activity
- Alert on security events (IDOR attempts, privilege escalation)
- Monitor rate limit triggers

### Response

1. **Containment**: Disable affected accounts, block IPs
2. **Investigation**: Review audit logs, identify scope
3. **Remediation**: Patch vulnerabilities, reset credentials
4. **Recovery**: Restore from backups if needed
5. **Post-Mortem**: Document lessons learned

### Communication

- Internal: Security team, engineering, management
- External: Affected users (if data breach)
- Regulatory: As required by law (GDPR, etc.)

## Compliance Considerations

### Data Protection

- **Customer Data**: Access restricted to own data
- **Audit Trail**: All access logged
- **Data Minimization**: Only necessary data returned
- **Right to Deletion**: Via account deletion (to be implemented)

### Availability

- **Rate Limiting**: Prevents abuse
- **Error Handling**: Prevents cascading failures
- **Backups**: Supabase managed backups

## Conclusion

The DarkOps platform implements comprehensive security controls across authentication, authorization, input validation, data protection, and transport security. The primary threats are mitigated through defense-in-depth measures.

**Key Strengths**:

- Strong authentication and authorization
- Comprehensive input validation
- IDOR protection on customer endpoints
- Service role key isolation
- Audit logging and security event tracking

**Areas for Improvement**:

- Implement MFA for enhanced authentication
- Add DDoS protection service
- Implement centralized log aggregation
- Complete file storage implementation
- Create automated security test suite

**Overall Security Posture**: Strong with room for enhancement in operational security and monitoring.

## References

- [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling)
- [STRIDE Methodology](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [DREAD Risk Assessment](<https://en.wikipedia.org/wiki/DREAD_(risk_assessment_model)>)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Version History

- **v1.0** (2026-09-06): Initial threat model
  - Identified 20+ threats across 9 categories
  - Documented mitigations for all threats
  - Prioritized remaining security gaps
  - Created testing recommendations
