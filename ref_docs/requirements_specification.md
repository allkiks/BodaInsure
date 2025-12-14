# BodaInsure Platform — Requirements Specification

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Document Owner:** Product & Engineering  
**Status:** Draft  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [Regulatory & Compliance Requirements](#4-regulatory--compliance-requirements)
5. [Interface Requirements](#5-interface-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Acceptance Criteria Summary](#7-acceptance-criteria-summary)
8. [Requirements Traceability](#8-requirements-traceability)
9. [Gaps & Assumptions](#9-gaps--assumptions)
10. [Related Documents](#10-related-documents)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the BodaInsure platform, a digital insurance solution for Kenya's bodaboda (motorcycle taxi) riders. Requirements are derived from the business requirements document and stakeholder consultations.

### 1.2 Scope

This specification covers:
- User registration and KYC
- Payment processing and wallet management
- Policy lifecycle management
- Organization and membership management
- Notifications and communications
- Reporting and analytics
- Administrative functions

### 1.3 Requirement Notation

| Prefix | Category |
|--------|----------|
| **FR** | Functional Requirement |
| **NFR** | Non-Functional Requirement |
| **CR** | Compliance Requirement |
| **IR** | Interface Requirement |
| **DR** | Data Requirement |

**Priority Levels**:
- **P1 (Must Have)**: Critical for MVP launch
- **P2 (Should Have)**: Important but not blocking
- **P3 (Nice to Have)**: Future enhancement

### 1.4 Reference Documents

| Document | Reference |
|----------|-----------|
| Product Description | [product_description.md](product_description.md) |
| Module Architecture | [module_architecture.md](module_architecture.md) |
| Feature Specification | [feature_specification.md](feature_specification.md) |

---

## 2. Functional Requirements

### 2.1 User Registration & Authentication

#### FR-AUTH-001: Phone Number Registration
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall allow users to register using their mobile phone number as the primary identifier. |
| **Rationale** | Phone numbers are universal among target users; enables M-Pesa integration. |
| **Acceptance Criteria** | <ul><li>AC1: User can enter a valid Kenyan phone number (07xx or 01xx format)</li><li>AC2: System validates phone number format before proceeding</li><li>AC3: System prevents duplicate registrations with same phone number</li><li>AC4: Registration available via Mobile App and USSD</li></ul> |
| **Dependencies** | SMS Gateway for OTP |

#### FR-AUTH-002: OTP Verification
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall verify user phone ownership via One-Time Password sent via SMS. |
| **Rationale** | Ensures phone number authenticity; prevents fraudulent registrations. |
| **Acceptance Criteria** | <ul><li>AC1: 6-digit OTP sent within 10 seconds of request</li><li>AC2: OTP valid for 5 minutes</li><li>AC3: Maximum 3 OTP requests per phone number per hour</li><li>AC4: Maximum 5 verification attempts per OTP</li><li>AC5: User can request new OTP after expiry</li></ul> |
| **Dependencies** | FR-AUTH-001 |

#### FR-AUTH-003: User Authentication
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall authenticate returning users via phone number and OTP or PIN. |
| **Rationale** | Secure access without password complexity for low-literacy users. |
| **Acceptance Criteria** | <ul><li>AC1: User can log in with phone number + OTP</li><li>AC2: Session remains active for 30 days on mobile app</li><li>AC3: USSD sessions timeout after 180 seconds of inactivity</li><li>AC4: Web portal sessions timeout after 30 minutes of inactivity</li></ul> |
| **Dependencies** | FR-AUTH-002 |

#### FR-AUTH-004: Role-Based Access Control
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall enforce role-based permissions for all user actions. |
| **Rationale** | Ensures users can only access authorized functions and data. |
| **Acceptance Criteria** | <ul><li>AC1: System supports roles: rider, sacco_admin, kba_admin, insurance_admin, platform_admin</li><li>AC2: Each role has defined permission set</li><li>AC3: Unauthorized access attempts are blocked and logged</li><li>AC4: Admin users can be assigned to specific organizational scopes</li></ul> |
| **Dependencies** | Organization management |

---

### 2.2 KYC & Document Management

#### FR-KYC-001: Document Upload
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall allow users to upload required KYC documents via mobile camera. |
| **Rationale** | Eliminates need for physical office visits; enables remote onboarding. |
| **Acceptance Criteria** | <ul><li>AC1: Supported formats: JPEG, PNG (max 10MB per file)</li><li>AC2: Camera capture directly in app</li><li>AC3: Image quality guidance provided (lighting, focus)</li><li>AC4: Upload progress indicator shown</li><li>AC5: Offline upload queue for poor connectivity</li></ul> |
| **Dependencies** | Object storage |

#### FR-KYC-002: Required Documents
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall collect the following mandatory documents: National ID (front and back), Driver's License, Motorcycle Logbook, KRA PIN Certificate, Passport Photo. |
| **Rationale** | Regulatory compliance and policy underwriting requirements. |
| **Acceptance Criteria** | <ul><li>AC1: User cannot proceed to payment without all mandatory documents</li><li>AC2: Each document type clearly labeled in upload interface</li><li>AC3: System tracks upload status per document type</li><li>AC4: User can replace previously uploaded documents</li></ul> |
| **Dependencies** | FR-KYC-001 |

#### FR-KYC-003: Document Validation
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall validate uploaded documents for quality and completeness. |
| **Rationale** | Ensures documents are usable for underwriting; reduces manual review. |
| **Acceptance Criteria** | <ul><li>AC1: Image quality check (blur, lighting, resolution)</li><li>AC2: Document type detection (is it actually an ID?)</li><li>AC3: Validation results returned within 30 seconds</li><li>AC4: Clear rejection reasons provided to user</li><li>AC5: Manual review queue for edge cases</li></ul> |
| **Dependencies** | FR-KYC-001, FR-KYC-002 |

#### FR-KYC-004: KYC Status Tracking
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall maintain and display KYC status for each user. |
| **Rationale** | Transparency for users; workflow management for admins. |
| **Acceptance Criteria** | <ul><li>AC1: Status values: PENDING, IN_REVIEW, APPROVED, REJECTED, INCOMPLETE</li><li>AC2: User can view current status and missing items</li><li>AC3: Status change triggers notification to user</li><li>AC4: Admins can view KYC queue and update status</li></ul> |
| **Dependencies** | FR-KYC-003 |

---

### 2.3 Payment & Wallet Management

#### FR-PAY-001: M-Pesa STK Push Integration
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall initiate payments via M-Pesa STK Push to the user's registered phone number. |
| **Rationale** | STK Push provides seamless payment experience without manual paybill entry. |
| **Acceptance Criteria** | <ul><li>AC1: STK push prompt appears on user's phone within 5 seconds</li><li>AC2: User can complete payment by entering M-Pesa PIN</li><li>AC3: Payment confirmation received via callback within 60 seconds</li><li>AC4: Failed payments trigger appropriate error message</li><li>AC5: Transaction timeout after 120 seconds</li></ul> |
| **Dependencies** | M-Pesa Daraja API credentials |

#### FR-PAY-002: Initial Deposit Processing
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall process the initial deposit of 1,048 KES to activate the first policy. |
| **Rationale** | Deposit triggers 1-month policy issuance per business model. |
| **Acceptance Criteria** | <ul><li>AC1: Deposit amount fixed at 1,048 KES</li><li>AC2: Successful deposit credits user wallet</li><li>AC3: Deposit triggers 1-month policy request to underwriter</li><li>AC4: User receives confirmation SMS/WhatsApp</li><li>AC5: Deposit recorded with M-Pesa reference number</li></ul> |
| **Dependencies** | FR-PAY-001, FR-KYC-004 (KYC must be APPROVED) |

#### FR-PAY-003: Daily Payment Processing
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall process daily payments of 87 KES towards annual premium completion. |
| **Rationale** | Core micropayment model enabling affordable coverage. |
| **Acceptance Criteria** | <ul><li>AC1: Daily payment amount fixed at 87 KES</li><li>AC2: User can make payment via App, USSD, or direct M-Pesa</li><li>AC3: Payment count tracked (X of 30)</li><li>AC4: User can pay multiple days at once</li><li>AC5: 30th payment triggers 11-month policy request</li></ul> |
| **Dependencies** | FR-PAY-002 |

#### FR-PAY-004: Digital Wallet
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall maintain a digital wallet for each user to track balance and payment progress. |
| **Rationale** | Central ledger for financial tracking; enables flexible payment patterns. |
| **Acceptance Criteria** | <ul><li>AC1: Wallet shows current balance</li><li>AC2: Wallet shows daily payment count (X/30)</li><li>AC3: Wallet shows total amount paid</li><li>AC4: Transaction history available with dates and amounts</li><li>AC5: Balance viewable via App and USSD</li></ul> |
| **Dependencies** | FR-PAY-001 |

#### FR-PAY-005: Payment Reminders
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall send daily payment reminders to users who have not completed their 30-day cycle. |
| **Rationale** | Improves payment compliance; reduces policy lapse. |
| **Acceptance Criteria** | <ul><li>AC1: Reminder sent daily at configurable time (default 07:00 EAT)</li><li>AC2: Reminder includes current payment count and amount due</li><li>AC3: Channels: SMS and/or WhatsApp based on preference</li><li>AC4: No reminder sent if payment already made that day</li><li>AC5: User can opt out of reminders</li></ul> |
| **Dependencies** | FR-PAY-003, Notification module |

#### FR-PAY-006: Payment Grace Period
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | The system shall allow a grace period for missed daily payments before policy lapse. |
| **Rationale** | Accommodates irregular income patterns; improves retention. |
| **Acceptance Criteria** | <ul><li>AC1: Grace period of 7 days after 1-month policy expiry</li><li>AC2: User notified of grace period status</li><li>AC3: Catch-up payments accepted during grace period</li><li>AC4: Policy lapses if grace period exceeded</li></ul> |
| **Dependencies** | FR-PAY-003 |
| **Note** | *Exact grace period rules to be confirmed with business* |

#### FR-PAY-007: Refund Processing
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | The system shall support refund processing for eligible cases via M-Pesa B2C. |
| **Rationale** | Regulatory requirement for 30-day free look period; customer service. |
| **Acceptance Criteria** | <ul><li>AC1: Admin can initiate refund with reason</li><li>AC2: Refund disbursed to user's M-Pesa within 48 hours</li><li>AC3: Refund amount cannot exceed total payments made</li><li>AC4: Refund triggers policy cancellation</li><li>AC5: Full audit trail maintained</li></ul> |
| **Dependencies** | FR-PAY-001 (B2C capability) |

---

### 2.4 Policy Management

#### FR-POL-001: Two-Policy Model
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall support the regulatory two-policy model: 1-month initial policy and 11-month subsequent policy. |
| **Rationale** | IRA regulatory compliance; maximum two TPO policies per year. |
| **Acceptance Criteria** | <ul><li>AC1: Policy 1 (1-month) issued upon deposit</li><li>AC2: Policy 2 (11-month) issued upon 30th daily payment</li><li>AC3: Each policy has unique policy number</li><li>AC4: Policies linked to same user and motorcycle</li><li>AC5: System prevents third policy in same year</li></ul> |
| **Dependencies** | FR-PAY-002, FR-PAY-003 |

#### FR-POL-002: Batch Policy Generation
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall process policy requests in batches, three times daily. |
| **Rationale** | Efficient bulk processing with underwriter; meets 6-hour SLA. |
| **Acceptance Criteria** | <ul><li>AC1: Batch runs at 08:00, 14:00, 20:00 EAT</li><li>AC2: Each batch includes all pending policy requests</li><li>AC3: Batch completion within 30 minutes</li><li>AC4: Batch results (success/failure) logged</li><li>AC5: Failed policies queued for retry</li></ul> |
| **Dependencies** | Underwriter integration |

#### FR-POL-003: Policy Number Assignment
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall assign and track unique policy numbers from the underwriter. |
| **Rationale** | Policy number required for legal compliance and claims. |
| **Acceptance Criteria** | <ul><li>AC1: Policy number received from underwriter</li><li>AC2: Policy number stored and linked to user</li><li>AC3: Policy number visible to user in app and documents</li><li>AC4: Policy number searchable by admins</li></ul> |
| **Dependencies** | FR-POL-002 |

#### FR-POL-004: Policy Document Distribution
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall distribute policy documents to users via WhatsApp and email. |
| **Rationale** | Users need accessible proof of insurance for traffic enforcement. |
| **Acceptance Criteria** | <ul><li>AC1: PDF policy document sent via WhatsApp</li><li>AC2: PDF also sent via email if email provided</li><li>AC3: Document accessible in app under "My Policies"</li><li>AC4: Distribution within 1 hour of policy issuance</li><li>AC5: User can request document re-send</li></ul> |
| **Dependencies** | FR-POL-003, WhatsApp Business API |

#### FR-POL-005: Policy Expiry Notifications
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall send policy expiry reminders at 30, 15, 7, 3, and 1 day(s) before expiration. |
| **Rationale** | Drives renewal; prevents coverage gaps. |
| **Acceptance Criteria** | <ul><li>AC1: Notifications sent at specified intervals</li><li>AC2: Message includes expiry date and renewal instructions</li><li>AC3: Channels: SMS and WhatsApp</li><li>AC4: Final reminder (1 day) more urgent in tone</li></ul> |
| **Dependencies** | FR-POL-001, Scheduler module |

#### FR-POL-006: Policy Status Inquiry
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall allow users to check their policy status via App and USSD. |
| **Rationale** | Users need quick access to coverage status, especially during traffic stops. |
| **Acceptance Criteria** | <ul><li>AC1: Status shows: Active/Expired/Pending</li><li>AC2: Shows policy number</li><li>AC3: Shows expiry date</li><li>AC4: USSD response within 2 seconds</li></ul> |
| **Dependencies** | FR-POL-001 |

---

### 2.5 Organization Management

#### FR-ORG-001: Hierarchical Organization Structure
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall support hierarchical organization structures for KBA, SACCOs, and geographical units. |
| **Rationale** | Reflects real-world association structure; enables scoped administration. |
| **Acceptance Criteria** | <ul><li>AC1: Umbrella body (KBA) at top level</li><li>AC2: SACCOs as member organizations</li><li>AC3: Geographical hierarchy: County → Subcounty → Ward → Stage</li><li>AC4: Users can belong to SACCO and geographical unit</li><li>AC5: Admins have scoped access based on assignment</li></ul> |
| **Dependencies** | FR-AUTH-004 |

#### FR-ORG-002: SACCO Member Management
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall allow SACCO admins to view and manage their members. |
| **Rationale** | SACCOs are key distribution channel; need visibility into member status. |
| **Acceptance Criteria** | <ul><li>AC1: SACCO admin can view list of members</li><li>AC2: Member list shows: name, phone, KYC status, policy status, payment status</li><li>AC3: Filtering by status (active, pending, lapsed)</li><li>AC4: Search by name or phone number</li><li>AC5: Export to CSV/Excel</li></ul> |
| **Dependencies** | FR-ORG-001 |

#### FR-ORG-003: Bulk Member Onboarding
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | The system shall allow SACCO admins to pre-register members in bulk via CSV upload. |
| **Rationale** | Accelerates onboarding; reduces individual registration friction. |
| **Acceptance Criteria** | <ul><li>AC1: CSV template downloadable</li><li>AC2: Upload validates required fields</li><li>AC3: System creates pending user accounts</li><li>AC4: SMS sent to pre-registered members with download link</li><li>AC5: Import results report (success/failed rows)</li></ul> |
| **Dependencies** | FR-ORG-002 |

#### FR-ORG-004: SACCO Communication Tools
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | The system shall allow SACCO admins to send messages to their members. |
| **Rationale** | Enables targeted communication to drive compliance and engagement. |
| **Acceptance Criteria** | <ul><li>AC1: Send SMS to all members</li><li>AC2: Send SMS to filtered segment (e.g., defaulters)</li><li>AC3: Message templates available</li><li>AC4: Delivery report provided</li><li>AC5: Rate limiting to prevent abuse</li></ul> |
| **Dependencies** | FR-ORG-002, Notification module |

---

### 2.6 Reporting & Analytics

#### FR-RPT-001: Enrollment Dashboard
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall provide real-time enrollment metrics dashboard. |
| **Rationale** | Track progress toward 700K enrollment target. |
| **Acceptance Criteria** | <ul><li>AC1: Total registered users</li><li>AC2: KYC completion rate</li><li>AC3: Deposit conversion rate</li><li>AC4: Breakdown by region/SACCO</li><li>AC5: Trend over time (daily/weekly/monthly)</li></ul> |
| **Dependencies** | All modules (read access) |

#### FR-RPT-002: Payment Compliance Dashboard
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall provide payment compliance metrics dashboard. |
| **Rationale** | Monitor daily payment behavior; identify at-risk users. |
| **Acceptance Criteria** | <ul><li>AC1: Daily payment completion rate</li><li>AC2: Average days to 30-payment completion</li><li>AC3: Defaulter count and trends</li><li>AC4: Revenue collected (daily/weekly/monthly)</li><li>AC5: Drill-down by region/SACCO</li></ul> |
| **Dependencies** | Payment module |

#### FR-RPT-003: Policy Status Dashboard
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall provide policy status overview dashboard. |
| **Rationale** | Track active coverage; monitor policy lifecycle. |
| **Acceptance Criteria** | <ul><li>AC1: Total active policies</li><li>AC2: Policies expiring in 30 days</li><li>AC3: Lapsed policies</li><li>AC4: Renewal rate</li><li>AC5: Policy type distribution (1-month vs 11-month)</li></ul> |
| **Dependencies** | Policy module |

#### FR-RPT-004: Scheduled Report Generation
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall generate and distribute scheduled reports. |
| **Rationale** | Stakeholder reporting requirements; regulatory compliance. |
| **Acceptance Criteria** | <ul><li>AC1: Daily reconciliation report (finance team)</li><li>AC2: Weekly enrollment summary (KBA leadership)</li><li>AC3: Monthly IRA compliance report</li><li>AC4: Quarterly performance report (all stakeholders)</li><li>AC5: Reports delivered via email in PDF/Excel format</li></ul> |
| **Dependencies** | All modules, Email service |

#### FR-RPT-005: Data Export
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | The system shall allow authorized users to export data in standard formats. |
| **Rationale** | Ad-hoc analysis; integration with external tools. |
| **Acceptance Criteria** | <ul><li>AC1: Export formats: CSV, Excel</li><li>AC2: Configurable columns</li><li>AC3: Date range filtering</li><li>AC4: Export size limits (max 100K rows)</li><li>AC5: Audit trail for exports</li></ul> |
| **Dependencies** | FR-AUTH-004 |

---

### 2.7 Administrative Functions

#### FR-ADM-001: User Support Interface
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall provide admin interface for user lookup and support. |
| **Rationale** | Customer service operations; issue resolution. |
| **Acceptance Criteria** | <ul><li>AC1: Search user by phone, name, ID number, policy number</li><li>AC2: View user profile, KYC status, payment history, policies</li><li>AC3: View audit trail for user</li><li>AC4: Add notes to user record</li><li>AC5: Trigger password/OTP reset</li></ul> |
| **Dependencies** | FR-AUTH-004 |

#### FR-ADM-002: Payment Reconciliation
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall provide payment reconciliation tools for finance team. |
| **Rationale** | Financial control; M-Pesa settlement matching. |
| **Acceptance Criteria** | <ul><li>AC1: Daily transaction summary</li><li>AC2: Unmatched transaction identification</li><li>AC3: Manual adjustment capability (with approval)</li><li>AC4: Settlement report generation</li><li>AC5: Discrepancy alerts</li></ul> |
| **Dependencies** | Payment module |

#### FR-ADM-003: System Configuration
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | The system shall allow platform admins to configure system parameters. |
| **Rationale** | Operational flexibility; reduce code changes for business rules. |
| **Acceptance Criteria** | <ul><li>AC1: Configure payment amounts (deposit, daily)</li><li>AC2: Configure notification schedules</li><li>AC3: Configure batch processing times</li><li>AC4: Enable/disable features</li><li>AC5: All changes logged with admin ID</li></ul> |
| **Dependencies** | FR-AUTH-004 (platform_admin role) |

---

## 3. Non-Functional Requirements

### 3.1 Performance Requirements

#### NFR-PERF-001: USSD Response Time
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | USSD menu responses shall be delivered within 2 seconds (95th percentile). |
| **Rationale** | USSD sessions timeout; poor response degrades experience. |
| **Measurement** | Server-side response time logging |
| **Acceptance Criteria** | <ul><li>AC1: 95% of USSD requests complete in <2s</li><li>AC2: 99% complete in <5s</li><li>AC3: Timeout handling for slower responses</li></ul> |

#### NFR-PERF-002: App/Web Response Time
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | Mobile app and web portal page loads shall complete within 3 seconds (95th percentile). |
| **Rationale** | User experience; prevents abandonment. |
| **Measurement** | APM monitoring (client-side and server-side) |
| **Acceptance Criteria** | <ul><li>AC1: Initial page load <3s on 3G connection</li><li>AC2: API responses <500ms (server-side)</li><li>AC3: Time to interactive <5s</li></ul> |

#### NFR-PERF-003: Batch Processing Time
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | Policy batch processing shall complete within 30 minutes. |
| **Rationale** | Ensures 6-hour SLA from payment to policy number. |
| **Measurement** | Job completion logging |
| **Acceptance Criteria** | <ul><li>AC1: Batch of up to 10,000 policies completes in <30 min</li><li>AC2: Alert triggered if batch exceeds 25 minutes</li></ul> |

#### NFR-PERF-004: Concurrent Users
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall support 10,000+ concurrent users without degradation. |
| **Rationale** | Scale requirement for 700K user base with peak usage patterns. |
| **Measurement** | Load testing; production monitoring |
| **Acceptance Criteria** | <ul><li>AC1: No performance degradation at 10,000 concurrent sessions</li><li>AC2: Graceful degradation at 2x peak load</li><li>AC3: Auto-scaling triggered at 70% capacity</li></ul> |

#### NFR-PERF-005: Payment Processing Throughput
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall process at least 100 payment transactions per second. |
| **Rationale** | Peak payment times (morning, evening) require high throughput. |
| **Measurement** | Transaction rate monitoring |
| **Acceptance Criteria** | <ul><li>AC1: Sustained 100 TPS during peak</li><li>AC2: Burst capacity of 200 TPS for 5 minutes</li></ul> |

---

### 3.2 Security Requirements

#### NFR-SEC-001: Data Encryption at Rest
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | All stored data shall be encrypted using AES-256. |
| **Rationale** | Data protection compliance; prevent data breach impact. |
| **Acceptance Criteria** | <ul><li>AC1: Database encryption enabled</li><li>AC2: Object storage encryption enabled</li><li>AC3: Backup encryption enabled</li><li>AC4: Encryption keys managed via KMS</li></ul> |

#### NFR-SEC-002: Data Encryption in Transit
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | All data transmission shall use TLS 1.2 or higher. |
| **Rationale** | Prevent man-in-the-middle attacks; compliance requirement. |
| **Acceptance Criteria** | <ul><li>AC1: HTTPS enforced for all endpoints</li><li>AC2: TLS 1.2 minimum (prefer 1.3)</li><li>AC3: Strong cipher suites only</li><li>AC4: Certificate validity monitoring</li></ul> |

#### NFR-SEC-003: PII Protection
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | Personally Identifiable Information shall be protected with additional controls. |
| **Rationale** | Data Protection Act 2019 compliance; user privacy. |
| **Acceptance Criteria** | <ul><li>AC1: PII fields identified and classified</li><li>AC2: Access to PII logged</li><li>AC3: PII masked in logs and non-production environments</li><li>AC4: PII field-level encryption for national ID, KRA PIN</li></ul> |

#### NFR-SEC-004: Authentication Security
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | Authentication mechanisms shall prevent common attacks. |
| **Rationale** | Prevent unauthorized access; protect user accounts. |
| **Acceptance Criteria** | <ul><li>AC1: Rate limiting on login attempts</li><li>AC2: OTP brute force protection</li><li>AC3: Session token rotation</li><li>AC4: Secure token storage</li><li>AC5: No sensitive data in URLs</li></ul> |

#### NFR-SEC-005: API Security
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | APIs shall be protected against common vulnerabilities. |
| **Rationale** | Prevent injection, CSRF, and other API attacks. |
| **Acceptance Criteria** | <ul><li>AC1: Input validation on all endpoints</li><li>AC2: SQL injection prevention</li><li>AC3: Request size limits</li><li>AC4: Rate limiting per client</li><li>AC5: CORS properly configured</li></ul> |

#### NFR-SEC-006: Audit Logging
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | All security-relevant events shall be logged immutably. |
| **Rationale** | Compliance requirement; forensic capability. |
| **Acceptance Criteria** | <ul><li>AC1: Authentication events logged</li><li>AC2: Authorization failures logged</li><li>AC3: Payment transactions logged</li><li>AC4: Admin actions logged</li><li>AC5: Logs retained for 7 years</li></ul> |

---

### 3.3 Reliability Requirements

#### NFR-REL-001: System Availability
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The platform shall maintain 99.5% availability. |
| **Rationale** | Business continuity; user trust. |
| **Measurement** | Uptime monitoring |
| **Acceptance Criteria** | <ul><li>AC1: Monthly uptime ≥99.5%</li><li>AC2: Maximum unplanned downtime: 3.6 hours/month</li><li>AC3: Maintenance windows scheduled and communicated</li></ul> |

#### NFR-REL-002: Disaster Recovery
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall recover from disaster within 4 hours (RTO). |
| **Rationale** | Business continuity; minimize data loss. |
| **Acceptance Criteria** | <ul><li>AC1: Recovery Time Objective (RTO): 4 hours</li><li>AC2: Recovery Point Objective (RPO): 1 hour</li><li>AC3: DR plan documented and tested quarterly</li><li>AC4: Cross-region backup replication</li></ul> |

#### NFR-REL-003: Data Backup
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall perform automated backups. |
| **Rationale** | Data protection; recovery capability. |
| **Acceptance Criteria** | <ul><li>AC1: Daily incremental backups</li><li>AC2: Weekly full backups</li><li>AC3: Backups encrypted and stored off-site</li><li>AC4: Backup restoration tested monthly</li><li>AC5: 90-day retention minimum</li></ul> |

#### NFR-REL-004: Payment Processing Redundancy
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | Payment processing shall have redundancy to prevent transaction loss. |
| **Rationale** | Financial integrity; user trust. |
| **Acceptance Criteria** | <ul><li>AC1: Idempotent payment processing</li><li>AC2: Transaction journaling before processing</li><li>AC3: Automatic retry for transient failures</li><li>AC4: No duplicate charges to user</li></ul> |

---

### 3.4 Usability Requirements

#### NFR-USA-001: Multi-Language Support
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The platform shall support English and Swahili languages. |
| **Rationale** | Accessibility for diverse user base. |
| **Acceptance Criteria** | <ul><li>AC1: All UI text translatable</li><li>AC2: Language selectable by user</li><li>AC3: Default language based on phone locale</li><li>AC4: Notifications in user's preferred language</li></ul> |

#### NFR-USA-002: Low-Literacy Design
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The interface shall be usable by users with limited literacy. |
| **Rationale** | Significant portion of target users have limited education. |
| **Acceptance Criteria** | <ul><li>AC1: Visual cues and icons supplement text</li><li>AC2: Simple, clear language (no jargon)</li><li>AC3: Large touch targets (min 48px)</li><li>AC4: Progress indicators for multi-step flows</li><li>AC5: Voice-assisted navigation (future phase)</li></ul> |

#### NFR-USA-003: Offline Capability
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Requirement** | The mobile app shall support key functions offline. |
| **Rationale** | Intermittent connectivity in rural areas. |
| **Acceptance Criteria** | <ul><li>AC1: Document capture and queuing offline</li><li>AC2: Policy document viewable offline</li><li>AC3: Sync when connectivity restored</li><li>AC4: Clear offline mode indicator</li></ul> |

#### NFR-USA-004: Accessibility
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Requirement** | The web portal shall meet WCAG 2.1 Level AA. |
| **Rationale** | Accessibility compliance; inclusive design. |
| **Acceptance Criteria** | <ul><li>AC1: Keyboard navigation supported</li><li>AC2: Screen reader compatible</li><li>AC3: Sufficient color contrast</li><li>AC4: Form labels and error messages clear</li></ul> |

---

### 3.5 Scalability Requirements

#### NFR-SCA-001: Horizontal Scalability
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The application layer shall scale horizontally to handle load increases. |
| **Rationale** | Support growth to 700K+ users; handle traffic spikes. |
| **Acceptance Criteria** | <ul><li>AC1: Stateless application design</li><li>AC2: Auto-scaling based on CPU/memory thresholds</li><li>AC3: Load balancing across instances</li><li>AC4: Scale from 3 to 20 instances without configuration change</li></ul> |

#### NFR-SCA-002: Database Scalability
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The database shall scale to support 700K+ users and transaction volume. |
| **Rationale** | Data growth projection; query performance. |
| **Acceptance Criteria** | <ul><li>AC1: Support 10M+ transactions per month</li><li>AC2: Read replicas for reporting queries</li><li>AC3: Connection pooling implemented</li><li>AC4: Query performance monitoring</li></ul> |

---

### 3.6 Observability Requirements

#### NFR-OBS-001: Application Monitoring
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall expose metrics for monitoring system health. |
| **Rationale** | Proactive issue detection; capacity planning. |
| **Acceptance Criteria** | <ul><li>AC1: Request rate, latency, error rate metrics</li><li>AC2: Resource utilization metrics (CPU, memory, disk)</li><li>AC3: Business metrics (registrations, payments)</li><li>AC4: Metrics dashboards in Grafana or equivalent</li></ul> |

#### NFR-OBS-002: Centralized Logging
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | All application logs shall be centralized and searchable. |
| **Rationale** | Debugging; audit trail; incident investigation. |
| **Acceptance Criteria** | <ul><li>AC1: Structured JSON logging</li><li>AC2: Correlation IDs across services</li><li>AC3: Log retention per compliance requirements</li><li>AC4: Search capability across all logs</li></ul> |

#### NFR-OBS-003: Alerting
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall alert operations team on critical issues. |
| **Rationale** | Rapid incident response; SLA maintenance. |
| **Acceptance Criteria** | <ul><li>AC1: Alerts for error rate spikes</li><li>AC2: Alerts for latency degradation</li><li>AC3: Alerts for availability issues</li><li>AC4: Alerts for security events</li><li>AC5: Escalation paths defined</li></ul> |

---

## 4. Regulatory & Compliance Requirements

### 4.1 Data Protection (Office of the Data Commissioner)

#### CR-DPA-001: Consent Management
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall obtain and record explicit consent for data collection. |
| **Reference** | Data Protection Act 2019, Section 30 |
| **Acceptance Criteria** | <ul><li>AC1: Consent captured during registration</li><li>AC2: Consent text clear and comprehensive</li><li>AC3: Consent record stored with timestamp</li><li>AC4: Consent withdrawal mechanism available</li></ul> |

#### CR-DPA-002: Data Subject Rights
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall support data subject rights: access, correction, deletion. |
| **Reference** | Data Protection Act 2019, Sections 26-29 |
| **Acceptance Criteria** | <ul><li>AC1: User can view all their personal data</li><li>AC2: User can request correction of inaccurate data</li><li>AC3: User can request deletion (subject to retention requirements)</li><li>AC4: Requests processed within 30 days</li></ul> |

#### CR-DPA-003: Data Breach Notification
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall support data breach detection and notification within 72 hours. |
| **Reference** | Data Protection Act 2019, Section 43 |
| **Acceptance Criteria** | <ul><li>AC1: Breach detection mechanisms in place</li><li>AC2: Breach notification workflow documented</li><li>AC3: Affected user notification capability</li><li>AC4: Regulatory notification template ready</li></ul> |

#### CR-DPA-004: Data Protection Impact Assessment
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | A Data Protection Impact Assessment shall be conducted and documented. |
| **Reference** | Data Protection Act 2019, Section 31 |
| **Acceptance Criteria** | <ul><li>AC1: DPIA document completed</li><li>AC2: Risks identified and mitigated</li><li>AC3: DPIA reviewed annually</li></ul> |

---

### 4.2 Insurance Regulations (IRA)

#### CR-IRA-001: Two-Policy Limit
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall enforce maximum two TPO policies per vehicle per year. |
| **Reference** | IRA Guidelines |
| **Acceptance Criteria** | <ul><li>AC1: System prevents third policy issuance</li><li>AC2: Policy count tracked per vehicle registration</li><li>AC3: Clear error message if limit exceeded</li></ul> |

#### CR-IRA-002: Free Look Period
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall support 30-day free look period with full refund capability. |
| **Reference** | IRA Guidelines |
| **Acceptance Criteria** | <ul><li>AC1: Cancellation allowed within 30 days of policy start</li><li>AC2: Full premium refund processed</li><li>AC3: Policy cancelled upon refund</li></ul> |

#### CR-IRA-003: Policy Terms Communication
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall clearly communicate policy terms, conditions, and exclusions. |
| **Reference** | IRA Guidelines |
| **Acceptance Criteria** | <ul><li>AC1: Terms displayed before purchase confirmation</li><li>AC2: Terms in English and Swahili</li><li>AC3: User acknowledgment recorded</li></ul> |

---

### 4.3 Financial Regulations

#### CR-FIN-001: Anti-Money Laundering
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | The system shall implement AML checks as required by regulations. |
| **Reference** | Proceeds of Crime and Anti-Money Laundering Act |
| **Acceptance Criteria** | <ul><li>AC1: KYC verification before large transactions</li><li>AC2: Transaction monitoring for suspicious patterns</li><li>AC3: Suspicious transaction reporting capability</li></ul> |

#### CR-FIN-002: PCI DSS Compliance
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Requirement** | Payment processing shall comply with PCI DSS requirements. |
| **Reference** | PCI DSS v4.0 |
| **Acceptance Criteria** | <ul><li>AC1: No storage of sensitive payment data (M-Pesa handles)</li><li>AC2: Secure API communication</li><li>AC3: Access controls implemented</li><li>AC4: Regular security assessments</li></ul> |

---

## 5. Interface Requirements

### 5.1 User Interfaces

#### IR-UI-001: Mobile Application
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Platforms** | Android (5.0+), iOS (12.0+) |
| **Features** | Registration, KYC upload, payment, policy view, profile management |
| **Design** | Native feel, offline support, camera integration |

#### IR-UI-002: Web Portal
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Browsers** | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| **Features** | Admin functions, SACCO management, reporting, user support |
| **Design** | Responsive (desktop-first), dashboard-oriented |

#### IR-UI-003: USSD Interface
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Shortcode** | *xxx*xxx# (TBD) |
| **Features** | Balance check, payment initiation, policy status, help |
| **Constraints** | 182-character limit per screen, 180-second session timeout |

### 5.2 System Interfaces

#### IR-SYS-001: M-Pesa Daraja API
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Endpoints** | STK Push, B2C, Transaction Status |
| **Authentication** | OAuth 2.0 |
| **Protocol** | REST/HTTPS |

#### IR-SYS-002: WhatsApp Business API
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Features** | Template messages, media messages, webhooks |
| **Protocol** | REST/HTTPS |

#### IR-SYS-003: SMS Gateway
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Provider** | Safaricom / Africa's Talking |
| **Features** | OTP delivery, notifications, bulk messaging |

#### IR-SYS-004: Underwriter Integration
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Phase 1** | SFTP file exchange (Excel) |
| **Phase 2** | REST API (TBD) |
| **Data** | Policy requests, policy confirmations |

---

## 6. Data Requirements

### 6.1 Data Entities

#### DR-DATA-001: User Profile Data
| Field | Type | Required | Sensitivity |
|-------|------|----------|-------------|
| user_id | UUID | Yes | Low |
| phone_number | String | Yes | Medium |
| national_id | String | Yes | High |
| full_name | String | Yes | Medium |
| email | String | No | Medium |
| kra_pin | String | Yes | High |
| date_of_birth | Date | Yes | Medium |
| gender | Enum | No | Low |
| created_at | Timestamp | Yes | Low |

#### DR-DATA-002: Policy Data
| Field | Type | Required | Sensitivity |
|-------|------|----------|-------------|
| policy_id | UUID | Yes | Low |
| policy_number | String | Yes | Low |
| user_id | UUID | Yes | Low |
| type | Enum (1-month, 11-month) | Yes | Low |
| start_date | Date | Yes | Low |
| end_date | Date | Yes | Low |
| premium | Decimal | Yes | Low |
| status | Enum | Yes | Low |
| motorcycle_reg | String | Yes | Low |

#### DR-DATA-003: Transaction Data
| Field | Type | Required | Sensitivity |
|-------|------|----------|-------------|
| transaction_id | UUID | Yes | Low |
| wallet_id | UUID | Yes | Low |
| amount | Decimal | Yes | Medium |
| type | Enum | Yes | Low |
| mpesa_ref | String | Yes | Medium |
| status | Enum | Yes | Low |
| created_at | Timestamp | Yes | Low |

### 6.2 Data Retention

| Data Type | Retention Period | Rationale |
|-----------|-----------------|-----------|
| User profiles | Duration of account + 7 years | Tax/regulatory |
| KYC documents | Duration of account + 7 years | Compliance |
| Transactions | 7 years | Financial regulations |
| Policies | 7 years after expiry | Insurance regulations |
| Audit logs | 7 years | Compliance |
| Session logs | 90 days | Security analysis |

---

## 7. Acceptance Criteria Summary

### 7.1 MVP Launch Criteria

| Category | Criteria | Target |
|----------|----------|--------|
| **Functional** | All P1 requirements implemented | 100% |
| **Performance** | NFR-PERF targets met | All pass |
| **Security** | Security audit passed | Zero critical/high findings |
| **Compliance** | DPA and IRA requirements met | 100% |
| **Quality** | Production bugs | <10 P2, Zero P1 |
| **Documentation** | User guides, admin guides complete | 100% |

### 7.2 Test Coverage Requirements

| Type | Coverage Target |
|------|-----------------|
| Unit tests | 80% code coverage |
| Integration tests | All API endpoints |
| E2E tests | Critical user journeys |
| Performance tests | All NFR-PERF requirements |
| Security tests | OWASP Top 10 |

---

## 8. Requirements Traceability

### 8.1 Business Objective to Requirement Mapping

| Business Objective | Related Requirements |
|--------------------|---------------------|
| Enroll 700K members | FR-AUTH-*, FR-KYC-*, NFR-SCA-* |
| Full policy renewal | FR-POL-005, FR-PAY-005, FR-PAY-006 |
| Policy within 6 hours | FR-POL-002, NFR-PERF-003 |
| IRA compliance | CR-IRA-*, FR-POL-001 |
| Data protection compliance | CR-DPA-*, NFR-SEC-003 |

### 8.2 Module to Requirement Mapping

| Module | Requirements |
|--------|--------------|
| Identity | FR-AUTH-001 to FR-AUTH-004 |
| KYC | FR-KYC-001 to FR-KYC-004 |
| Payment | FR-PAY-001 to FR-PAY-007 |
| Policy | FR-POL-001 to FR-POL-006 |
| Organization | FR-ORG-001 to FR-ORG-004 |
| Reporting | FR-RPT-001 to FR-RPT-005 |
| Admin | FR-ADM-001 to FR-ADM-003 |

---

## 9. Gaps & Assumptions

### 9.1 Information Gaps

| Gap | Impact | Required From |
|-----|--------|---------------|
| Exact grace period rules | FR-PAY-006 incomplete | Business decision |
| Claims process workflow | No claims requirements defined | Definite Assurance |
| Commission calculation rules | No commission tracking requirements | Business/Legal |
| USSD shortcode | IR-UI-003 blocked | Telco allocation |
| M-Pesa credentials | IR-SYS-001 blocked | Safaricom |

### 9.2 Assumptions

| # | Assumption | Impact if Invalid |
|---|------------|-------------------|
| 1 | All riders have M-Pesa accounts | Payment model fails |
| 2 | 87 KES and 1,048 KES amounts are fixed | Payment logic changes |
| 3 | Three batches per day sufficient | SLA risk |
| 4 | English and Swahili sufficient | Additional translation needed |

---

## 10. Related Documents

| Document | Description | Link |
|----------|-------------|------|
| Product Description | Business context | [product_description.md](product_description.md) |
| Module Architecture | Technical design | [module_architecture.md](module_architecture.md) |
| Feature Specification | Feature details | [feature_specification.md](feature_specification.md) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | Product & Engineering | Initial draft |

---

*End of Document*
