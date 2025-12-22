# BodaInsure Role-Based Response Handling Audit Report

**Document Version:** 1.0
**Audit Date:** December 2024
**Auditor:** System Audit
**Scope:** Client-side response handling across all user roles

---

## Executive Summary

This audit evaluates how the BodaInsure frontend handles server responses for each user role: `platform_admin`, `sacco_admin`, `kba_admin`, `insurance_admin`, and `rider`. The audit covers API endpoints accessed, response handling patterns, error handling, and UI behavior.

### Key Findings

- **Strengths:** Centralized API client with global 401 handling, consistent response envelope (`{ data: T }`), role-based route protection
- **Concerns:** Missing 403 handling differentiation, inconsistent error message display, no role-specific error messages
- **Risks:** Generic error messages may confuse users; missing validation field extraction

---

## 1. Platform Admin (`platform_admin`)

### 1.1 Role Access Summary

| Access Area | Permission Level |
|-------------|-----------------|
| Dashboard (all views) | Full access |
| User Management | Full CRUD |
| Organization Management | Full CRUD + verify/suspend |
| KYC Review Queue | Full access |
| Settings & Policy Terms | Full access |
| Reports | Full access |
| Rider Routes (/my/*) | Impersonation access |

### 1.2 API Endpoints Accessed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | Platform overview metrics |
| `/dashboard/enrollment` | GET | Enrollment metrics |
| `/dashboard/payments` | GET | Payment metrics |
| `/dashboard/policies` | GET | Policy metrics |
| `/admin/users/search` | GET | User search |
| `/admin/users/:id` | GET | User detail |
| `/admin/users/:id/activate` | PUT | Activate user |
| `/admin/users/:id/deactivate` | PUT | Deactivate user |
| `/admin/users/:id/reset-kyc` | POST | Reset KYC status |
| `/admin/users/:id/resend-otp` | POST | Resend OTP |
| `/organizations` | GET/POST | List/Create organizations |
| `/organizations/:id` | GET/PUT/DELETE | Organization CRUD |
| `/organizations/:id/verify` | POST | Verify organization |
| `/organizations/:id/suspend` | POST | Suspend organization |
| `/organizations/:id/members` | GET | List members |
| `/kyc/admin/pending` | GET | Pending KYC queue |
| `/kyc/admin/documents/:id/review` | PATCH | Review document |
| `/settings/policy-terms` | GET/POST/PUT | Policy terms management |

### 1.3 Response Handling Analysis

#### Success Responses
- **Pattern:** All API responses extracted via `response.data.data`
- **Dashboard:** Uses `useQuery` with `dashboardApi.getOverview`, transforms server data to client format
- **User Search:** Returns `{ users: [], total: number }`, properly handled
- **Organizations:** Proper pagination via `PaginatedResponse<T>` transformation

#### Error Handling
- **401 Unauthorized:** Global interceptor logs out and redirects to `/login`
- **403 Forbidden:** No specific handling - falls through to generic error
- **Validation Errors:** Displayed via toast with `variant: 'destructive'`
- **Business Errors:** Caught in mutation `onError`, displayed in toast

#### Issues Found
1. **GAP-001:** No differentiation between 403 (forbidden) and other errors
2. **GAP-002:** Generic "Failed to verify organization" messages don't include server reason
3. **GAP-003:** Admin actions (activate/deactivate) don't show detailed error reasons

### 1.4 UI Behavior

| Server Response | UI Behavior |
|-----------------|-------------|
| Success | Toast notification + cache invalidation |
| Loading | `LoadingSpinner` component |
| Empty data | "No results found" placeholder |
| Network error | "Failed to load..." generic message |
| 401 | Auto-logout, redirect to `/login` |
| 403 | Generic error toast (no role indication) |

---

## 2. SACCO Admin (`sacco_admin`)

### 2.1 Role Access Summary

| Access Area | Permission Level |
|-------------|-----------------|
| Dashboard | View only |
| User Management | No access |
| Organization Management | View + Edit own SACCO |
| KYC Review | No access |
| Settings | No access |
| Reports | View access |

### 2.2 API Endpoints Accessed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | Dashboard metrics |
| `/dashboard/enrollment` | GET | Enrollment metrics |
| `/dashboard/payments` | GET | Payment metrics |
| `/dashboard/policies` | GET | Policy metrics |
| `/organizations` | GET | List organizations |
| `/organizations/:id` | GET/PUT | View/Edit organization |
| `/organizations/:id/members` | GET | List members |
| `/reports` | GET | View reports |

### 2.3 Response Handling Analysis

#### Success Responses
- Dashboard metrics properly displayed
- Organization list filtered (should filter by parent organization)
- Member list with pagination working

#### Error Handling
- **403 on Admin endpoints:** Not explicitly handled - user sees generic error
- **Organization not found:** Returns to list with error toast

#### Issues Found
1. **GAP-004:** No organization-scoped filtering implemented - SACCO admin sees all orgs
2. **GAP-005:** "Create Organization" button shown in UI despite no permission (router blocks)
3. **GAP-006:** No indication when viewing data outside SACCO scope

### 2.4 UI Behavior

| Server Response | UI Behavior |
|-----------------|-------------|
| Success | Data rendered normally |
| No organizations | "No organizations found" |
| 403 on create | Redirect to dashboard (silent) |
| Edit own SACCO | Form loads, save works |
| Edit other SACCO | 403 - generic error |

---

## 3. KBA Admin (`kba_admin`)

### 3.1 Role Access Summary

| Access Area | Permission Level |
|-------------|-----------------|
| Dashboard | Full access |
| User Management | No access |
| Organization Management | Full CRUD (within KBA hierarchy) |
| KYC Review | No access |
| Settings | No access |
| Reports | View access |

### 3.2 API Endpoints Accessed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | Dashboard metrics |
| `/dashboard/*` | GET | Sub-dashboards |
| `/organizations` | GET/POST | List/Create organizations |
| `/organizations/:id` | GET/PUT | View/Edit organization |
| `/organizations/:id/verify` | POST | Verify SACCOs |
| `/organizations/:id/children` | GET | Get child organizations |
| `/organizations/:id/members` | GET | List members |
| `/reports` | GET | View reports |

### 3.3 Response Handling Analysis

#### Success Responses
- Dashboard properly displays KBA-scope data
- Organization hierarchy (parent-child) properly rendered
- Verification actions work with appropriate feedback

#### Error Handling
- 403 errors for admin-only features silently redirect
- Verification errors show generic messages

#### Issues Found
1. **GAP-007:** KBA admin can attempt to edit umbrella body settings (backend blocks, frontend allows)
2. **GAP-008:** Organization type filter shows all types, not just KBA-manageable ones
3. **GAP-009:** No visual indicator of organization hierarchy depth

### 3.4 UI Behavior

| Server Response | UI Behavior |
|-----------------|-------------|
| Successful verification | Toast + status badge update |
| Verify non-child org | 403 error (generic message) |
| Create SACCO | Success with redirect to detail |
| Create Umbrella Body | Should be blocked but isn't in UI |

---

## 4. Insurance Admin (`insurance_admin`)

### 4.1 Role Access Summary

| Access Area | Permission Level |
|-------------|-----------------|
| Dashboard | Full access |
| User Management | No access |
| Organization Management | No access |
| KYC Review | No access |
| Settings (Policy Terms) | Full CRUD |
| Reports | Full access |

### 4.2 API Endpoints Accessed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | Dashboard metrics |
| `/dashboard/*` | GET | Sub-dashboards |
| `/settings/policy-terms` | GET/POST/PUT | Policy terms management |
| `/reports` | GET | View reports |
| `/reports/generate` | POST | Generate reports |

### 4.3 Response Handling Analysis

#### Success Responses
- Dashboard access works correctly
- Policy terms CRUD operations function properly
- Report generation with proper status feedback

#### Error Handling
- Policy terms validation errors displayed in form
- Save failures show toast notifications

#### Issues Found
1. **GAP-010:** No preview functionality for policy terms before publishing
2. **GAP-011:** Policy terms delete has no confirmation of active policy impact
3. **GAP-012:** Sidebar shows "Organizations" which returns 403 on click

### 4.4 UI Behavior

| Server Response | UI Behavior |
|-----------------|-------------|
| Policy terms saved | Toast + list refresh |
| Validation error | Field-level error display |
| Terms conflict | Error toast (version conflict) |
| Report generated | Download link provided |

---

## 5. Rider (`rider`)

### 5.1 Role Access Summary

| Access Area | Permission Level |
|-------------|-----------------|
| Wallet | Own data only |
| Payments | Initiate own payments |
| Policies | View own policies |
| KYC | Upload/resubmit own documents |
| Profile | View/Edit own profile |

### 5.2 API Endpoints Accessed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/wallet` | GET | Wallet balance |
| `/wallet/transactions` | GET | Transaction history |
| `/payments/stk-push` | POST | Initiate M-Pesa payment |
| `/payments/status/:id` | GET | Check payment status |
| `/policies/my` | GET | List own policies |
| `/policies/:id` | GET | Policy detail |
| `/policies/:id/document` | GET | Download policy PDF |
| `/kyc/status` | GET | KYC status |
| `/kyc/documents` | GET/POST | Upload KYC documents |
| `/users/me` | GET/PATCH | Profile |

### 5.3 Response Handling Analysis

#### Success Responses
- Wallet balance displays correctly with currency formatting
- Payment progress (days completed) accurately shown
- Policy list with status badges
- KYC status with document-by-document breakdown

#### Error Handling
- **M-Pesa timeout:** 60-second polling with timeout message
- **Payment failed:** Step-based UI shows failure state with retry option
- **KYC rejected:** Shows rejection reason from server
- **Document upload failed:** Error message with retry

#### Issues Found
1. **GAP-013:** M-Pesa callback failure doesn't show specific reason (PIN/balance/timeout)
2. **GAP-014:** No offline handling - network errors show generic message
3. **GAP-015:** Policy document download failure doesn't indicate if PDF not ready

### 5.4 UI Behavior

| Server Response | UI Behavior |
|-----------------|-------------|
| Payment initiated | STK push prompt message |
| Payment pending | Polling with spinner |
| Payment completed | Success state + wallet refresh |
| Payment failed | Failure state with "Try Again" |
| Payment timeout | Timeout message + M-Pesa check suggestion |
| KYC approved | Green checkmark badge |
| KYC rejected | Red badge + reason |
| Document upload success | Success toast + status update |

---

## 6. Cross-Role Comparison Matrix

| Feature | platform_admin | sacco_admin | kba_admin | insurance_admin | rider |
|---------|---------------|-------------|-----------|-----------------|-------|
| Dashboard access | Full | View | Full | Full | None |
| User management | Full | None | None | None | Own only |
| Org management | Full | Own SACCO | KBA hierarchy | None | None |
| KYC review | Full | None | None | None | Own only |
| Policy terms | Full | None | None | Full | View only |
| Reports | Full | View | View | Full | None |
| 401 handling | Logout+redirect | Logout+redirect | Logout+redirect | Logout+redirect | Logout+redirect |
| 403 handling | Generic error | Silent redirect | Silent redirect | Silent redirect | N/A |
| Validation display | Toast | Toast | Toast | Toast | Inline+toast |
| Loading states | Spinner | Spinner | Spinner | Spinner | Spinner |
| Empty states | Placeholder | Placeholder | Placeholder | Placeholder | Placeholder |

---

## 7. Summary of Findings

### 7.1 Consistent Patterns (Strengths)
1. Global 401 handling via axios interceptor
2. Consistent `{ data: T }` response envelope
3. Role-based route protection in router
4. Loading states with `LoadingSpinner`
5. Success notifications via toast system
6. React Query for server state management

### 7.2 Inconsistent Patterns (Weaknesses)
1. 403 handling varies by role (silent vs. generic error)
2. Error messages don't extract server-side validation details
3. Role-specific UI elements shown before permission check
4. No standardized empty state messages
5. Business error reasons not displayed to users

### 7.3 Critical Issues
1. **Security:** UI shows buttons/links for unauthorized actions
2. **UX:** Generic errors don't help users understand failures
3. **Data:** No organization-scoped filtering for SACCO/KBA admins

---

## 8. Recommendations Summary

### Immediate (P0 - Security)
1. Hide UI elements based on role permissions
2. Add 403 handling with role-aware messaging
3. Implement organization-scope filtering

### Short-term (P1 - UX)
4. Extract and display validation field errors
5. Add specific error messages for common failures
6. Improve M-Pesa failure messaging

### Medium-term (P2 - Enhancement)
7. Add offline handling for rider app
8. Implement role-based empty state messages
9. Add policy terms preview functionality

---

*End of Role Audit Report*
