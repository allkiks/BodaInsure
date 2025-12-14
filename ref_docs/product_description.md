# BodaInsure Platform — Product Description

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Document Owner:** Product Management  
**Status:** Draft  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Product Goals & Objectives](#4-product-goals--objectives)
5. [Target Users & Personas](#5-target-users--personas)
6. [User Journeys](#6-user-journeys)
7. [High-Level Product Specifications](#7-high-level-product-specifications)
8. [Success Metrics](#8-success-metrics)
9. [Assumptions & Constraints](#9-assumptions--constraints)
10. [Related Documents](#10-related-documents)

---

## 1. Executive Summary

**BodaInsure** is a digital insurance platform designed to provide affordable, accessible third-party insurance to Kenya Bodaboda Association's (KBA) 700,000+ motorcycle taxi riders. The platform transforms the traditional lump-sum insurance payment model into a flexible micropayment system, enabling riders to pay **87 KES daily** for 30 days after an initial deposit of **1,048 KES** to access comprehensive annual coverage worth 3,500 KES.

### Key Value Propositions

| Stakeholder | Value Delivered |
|-------------|-----------------|
| **Riders** | Affordable daily payments, digital policy access, multi-channel convenience |
| **KBA/SACCOs** | Member tracking, compliance visibility, engagement tools |
| **Insurance Agent (Robs)** | Scalable distribution, automated commission tracking, compliance reporting |
| **Underwriter (Definite Assurance)** | Access to 700K+ customer base, reduced acquisition costs, digital policy management |
| **Platform Owner (Atronach)** | Recurring revenue, platform fees, data insights |

### Stakeholder Consortium

| Entity | Role |
|--------|------|
| Atronach K Ltd | Platform Owner/Developer |
| Robs Insurance Agency | Insurance Agent (JV Partner) |
| Definite Assurance Company | Underwriter |
| Kenya Bodaboda Association (KBA) | Launch Client/Association |

---

## 2. Problem Statement

### 2.1 Context

Bodaboda (motorcycle taxi) riders form a critical part of Kenya's informal transportation economy. Kenyan law mandates Third-Party Only (TPO) insurance for all motor vehicles, yet a significant portion of bodaboda riders operate without valid coverage due to systemic barriers.

### 2.2 Core Problems

#### Problem 1: Financial Barrier
> **The annual premium of 3,500 KES requires lump-sum payment, which is prohibitive for daily-wage earners.**

- Riders earn income daily, often 500-1,500 KES per day
- No financial products exist to match insurance costs to income patterns
- Competing daily expenses (fuel, maintenance, family needs) take priority

#### Problem 2: Access Barrier
> **Limited physical insurance access points and exclusion from formal financial services.**

- Insurance offices concentrated in urban centers
- Riders geographically dispersed across counties
- Many riders lack bank accounts or formal credit history
- Traditional agents don't target this market segment

#### Problem 3: Complexity Barrier
> **Cumbersome documentation requirements and low digital literacy.**

- Multiple documents required (ID, license, logbook, KRA PIN, photo)
- Complex application forms designed for formal sector
- Low digital literacy among some rider segments
- Language barriers (English-only documentation)

#### Problem 4: Trust Barrier
> **Historical mistrust of insurance products and providers.**

- Perception that claims are never paid
- No peer validation or community endorsement
- Unfamiliar with insurance concepts and benefits

### 2.3 Impact of Unsolved Problem

| Impact Area | Consequence |
|-------------|-------------|
| **Legal** | Riders face fines, vehicle impoundment, license suspension |
| **Financial** | Catastrophic out-of-pocket costs in accidents |
| **Economic** | Reduced ridership due to fear of enforcement |
| **Social** | Families left without support after accidents |
| **Industry** | Insurers miss 700K+ potential customers |

---

## 3. Solution Overview

### 3.1 Platform Concept

BodaInsure is a **cloud-based, multi-channel digital insurance platform** that bridges traditional insurance requirements with the financial realities of bodaboda riders.

### 3.2 Core Solution Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    BodaInsure Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Digital   │  │  Flexible   │  │    Multi    │             │
│  │  Onboarding │  │  Payments   │  │   Channel   │             │
│  │    (KYC)    │  │  (M-Pesa)   │  │   Access    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Automated  │  │   SACCO     │  │  Real-time  │             │
│  │   Policy    │  │ Management  │  │  Analytics  │             │
│  │ Generation  │  │    Tools    │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Payment Model Innovation

**Traditional Model:**
```
Annual Premium: 3,500 KES (one-time payment)
         │
         ▼
    [BARRIER: Unaffordable lump sum]
         │
         ▼
    Rider remains uninsured
```

**BodaInsure Model:**
```
Initial Deposit: 1,048 KES ──▶ [1-Month Policy Issued]
         │
         ▼
Daily Payments: 87 KES × 30 days = 2,610 KES
         │
         ▼
    [11-Month Policy Issued]
         │
         ▼
Total Annual Coverage: 3,500 KES + 158 KES platform fee
```

### 3.4 Two-Policy System

Per regulatory requirements, the platform issues two sequential policies:

| Policy | Trigger | Duration | Premium Allocation |
|--------|---------|----------|-------------------|
| **Policy 1** | Initial deposit (1,048 KES) | 1 month | Covers first month |
| **Policy 2** | Completion of 30 daily payments | 11 months | Covers remaining year |

### 3.5 Channel Strategy

| Channel | Target Users | Primary Use Cases |
|---------|--------------|-------------------|
| **Mobile App** (Android/iOS) | Smartphone users | Full registration, document upload, payment history, policy access |
| **USSD** (*xxx*xxx#) | Feature phone users | Balance check, daily payment, policy status |
| **Web Portal** | Administrators, SACCOs | Management, reporting, bulk operations |
| **WhatsApp** | All users | Policy delivery, reminders, support |
| **SMS** | All users | Payment confirmations, alerts |

---

## 4. Product Goals & Objectives

### 4.1 Primary Objectives (Year 1)

| # | Objective | Target | Measurement |
|---|-----------|--------|-------------|
| **PO-1** | Mass enrollment | 700,000 KBA members enrolled | Registered users with completed KYC |
| **PO-2** | Policy activation | 80% deposit conversion | Users who pay initial 1,048 KES |
| **PO-3** | Payment compliance | 70% complete 30-day cycle | Users who complete daily payments |
| **PO-4** | Operational efficiency | Policy issued within 6 hours | Time from payment to policy number |
| **PO-5** | Regulatory compliance | 100% IRA & Data Commissioner adherence | Audit findings, certifications |

### 4.2 Secondary Objectives (Year 2+)

| # | Objective | Target |
|---|-----------|--------|
| **SO-1** | Market expansion | 3 additional umbrella bodies onboarded |
| **SO-2** | Product expansion | Launch comprehensive, health, and life insurance |
| **SO-3** | Financial sustainability | Operational breakeven within 24 months |
| **SO-4** | Renewal rate | 60% annual policy renewal |

### 4.3 Anti-Goals (Explicit Non-Objectives)

- **Not** building a general-purpose insurance platform for other vehicle types (Phase 1)
- **Not** handling claims processing directly (underwriter responsibility)
- **Not** providing credit or loan products
- **Not** replacing existing SACCO management systems

---

## 5. Target Users & Personas

### 5.1 Primary Persona: The Bodaboda Rider

```
┌─────────────────────────────────────────────────────────────┐
│  PERSONA: JAMES OCHIENG                                     │
│  "The Daily Hustler"                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Demographics:                                              │
│  • Age: 25-40 years                                         │
│  • Location: Peri-urban Kenya (Kisumu, Nakuru, Nairobi)     │
│  • Income: 500-1,500 KES/day (variable)                     │
│  • Education: Secondary school                              │
│  • Phone: Android smartphone or feature phone               │
│                                                             │
│  Behaviors:                                                 │
│  • Uses M-Pesa daily for all transactions                   │
│  • Active on WhatsApp for communication                     │
│  • Member of local SACCO or rider stage                     │
│  • Avoids police checkpoints when uninsured                 │
│                                                             │
│  Pain Points:                                               │
│  • Cannot afford 3,500 KES at once                          │
│  • Fears impoundment and fines                              │
│  • Doesn't understand insurance jargon                      │
│  • Previous bad experience with insurance claims            │
│                                                             │
│  Goals:                                                     │
│  • Stay legal on the road                                   │
│  • Protect family from accident liability                   │
│  • Build trust with formal institutions                     │
│                                                             │
│  Quote: "I can pay 100 bob a day, but not 3,500 at once."   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Secondary Persona: SACCO Administrator

```
┌─────────────────────────────────────────────────────────────┐
│  PERSONA: MARY WANJIKU                                      │
│  "The Community Organizer"                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Demographics:                                              │
│  • Age: 35-50 years                                         │
│  • Role: SACCO Secretary/Chairperson                        │
│  • Education: Diploma/Degree level                          │
│  • Tech comfort: Moderate (uses smartphone, Excel)          │
│                                                             │
│  Responsibilities:                                          │
│  • Manage 50-500 SACCO members                              │
│  • Track member contributions and compliance                │
│  • Report to umbrella body (KBA)                            │
│  • Resolve member disputes                                  │
│                                                             │
│  Pain Points:                                               │
│  • Manual record-keeping is error-prone                     │
│  • Cannot track who has valid insurance                     │
│  • Members default without visibility                       │
│  • No tools for bulk communication                          │
│                                                             │
│  Goals:                                                     │
│  • 100% member compliance                                   │
│  • Reduce administrative burden                             │
│  • Build SACCO reputation with KBA                          │
│                                                             │
│  Quote: "I need to know who's covered and who's not."       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Tertiary Persona: KBA Regional Administrator

```
┌─────────────────────────────────────────────────────────────┐
│  PERSONA: PETER MUTUA                                       │
│  "The Regional Coordinator"                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Demographics:                                              │
│  • Age: 40-55 years                                         │
│  • Role: KBA County/Regional Coordinator                    │
│  • Scope: 10,000-50,000 riders                              │
│  • Tech comfort: Basic to moderate                          │
│                                                             │
│  Responsibilities:                                          │
│  • Coordinate SACCOs in region                              │
│  • Drive policy uptake campaigns                            │
│  • Represent riders to county government                    │
│  • Report to national KBA office                            │
│                                                             │
│  Pain Points:                                               │
│  • No visibility into regional compliance                   │
│  • Cannot identify high/low performing areas                │
│  • Manual data collection from SACCOs                       │
│  • Pressure from government on compliance rates             │
│                                                             │
│  Goals:                                                     │
│  • Highest regional enrollment numbers                      │
│  • Recognition from KBA national                            │
│  • Reduced rider harassment by authorities                  │
│                                                             │
│  Quote: "Show me the dashboard for Nakuru County."          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Platform Administrators

| Persona | Organization | Key Functions |
|---------|--------------|---------------|
| **Platform Admin** | Atronach K Ltd | System configuration, user support, payment reconciliation, API management |
| **Insurance Admin** | Robs Insurance Agency | Policy oversight, commission tracking, compliance reporting, claims interface |

---

## 6. User Journeys

### 6.1 Rider Journey: New Registration to Policy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RIDER JOURNEY: FIRST-TIME ENROLLMENT                     │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1: AWARENESS
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ SACCO meeting, WhatsApp group, fellow rider, KBA campaign   │
│ Action        │ Learns about BodaInsure and 87 KES/day model                │
│ Emotion       │ Curious, skeptical                                          │
│ System        │ N/A                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Phase 2: REGISTRATION
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ Mobile app download OR USSD dial (*xxx*xxx#)                │
│ Action        │ Enter phone number, receive OTP, create account             │
│ Emotion       │ Cautious but willing                                        │
│ System        │ Identity Service → OTP verification → User profile created  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Phase 3: KYC DOCUMENT UPLOAD
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ Mobile app camera interface                                 │
│ Action        │ Upload: National ID, License, Logbook, KRA PIN, Photo       │
│ Emotion       │ Tedious but necessary                                       │
│ System        │ Document Service → Validation → KYC status updated          │
│ Duration      │ 5-10 minutes                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Phase 4: INITIAL DEPOSIT
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ M-Pesa STK push prompt on phone                             │
│ Action        │ Pay 1,048 KES deposit                                       │
│ Emotion       │ Commitment anxiety, then relief                             │
│ System        │ Payment Service → M-Pesa → Wallet credited → Policy trigger │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Phase 5: FIRST POLICY ISSUANCE
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ WhatsApp message with policy PDF                            │
│ Action        │ Receive 1-month policy document                             │
│ Emotion       │ Validated, proud, relieved                                  │
│ System        │ Policy Service → Batch process → Notification Service       │
│ SLA           │ Within 6 hours of payment confirmation                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Phase 6: DAILY PAYMENT CYCLE (30 days)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ Daily SMS/WhatsApp reminder → USSD or App payment           │
│ Action        │ Pay 87 KES daily via M-Pesa                                 │
│ Emotion       │ Routine, occasionally forgetful                             │
│ System        │ Scheduler → Notification → Payment → Wallet update          │
│ Flexibility   │ Grace period for missed days, catch-up payments allowed     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Phase 7: ANNUAL POLICY ISSUANCE
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ WhatsApp message with 11-month policy PDF                   │
│ Action        │ Receive full annual coverage document                       │
│ Emotion       │ Accomplishment, security                                    │
│ System        │ Policy Service (upon 30th payment) → Underwriter → Notify   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
Phase 8: RENEWAL (11 months later)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Touchpoint    │ 30-day advance reminder sequence                            │
│ Action        │ Repeat deposit + daily payment cycle                        │
│ Emotion       │ Familiar, confident                                         │
│ System        │ Scheduler → Renewal notifications → New policy cycle        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 SACCO Admin Journey: Member Management

```
Step 1: LOGIN
    │   Access web portal with credentials
    ▼
Step 2: DASHBOARD VIEW
    │   See SACCO summary: total members, active policies, defaulters
    ▼
Step 3: BULK ONBOARDING
    │   Upload CSV of member details for pre-registration
    ▼
Step 4: MONITOR COMPLIANCE
    │   View list of members with payment status
    │   Filter by: active, pending, lapsed, expired
    ▼
Step 5: COMMUNICATE
    │   Send targeted SMS/WhatsApp to specific member segments
    ▼
Step 6: EXPORT REPORTS
    │   Download PDF/Excel reports for committee meetings
```

### 6.3 KBA Admin Journey: Regional Oversight

```
Step 1: LOGIN
    │   Access web portal with regional admin credentials
    ▼
Step 2: REGIONAL DASHBOARD
    │   See county/subcounty breakdown of enrollment
    │   Heatmap of coverage rates
    ▼
Step 3: DRILL DOWN
    │   Click into specific SACCO or ward for details
    ▼
Step 4: CAMPAIGN TARGETING
    │   Identify low-performing areas
    │   Plan mobilization activities
    ▼
Step 5: STAKEHOLDER REPORTING
    │   Generate quarterly reports for KBA national
```

---

## 7. High-Level Product Specifications

### 7.1 Platform Channels

| Channel | Technology | Audience | Features |
|---------|------------|----------|----------|
| **Mobile App** | React Native (Android/iOS) | Riders with smartphones | Full functionality |
| **Web Portal** | React.js SPA | Admins, SACCOs | Management & reporting |
| **USSD** | Gateway integration | Feature phone users | Core transactions |
| **WhatsApp** | Business API | All users | Notifications, policy delivery |
| **SMS** | Safaricom gateway | All users | Alerts, OTP |
| **Email** | SMTP service | Users with email | Policy documents |

### 7.2 Core Functional Modules

| Module | Description | Cross-Reference |
|--------|-------------|-----------------|
| **Identity & Access** | User registration, authentication, RBAC | [module_architecture.md#identity-service](module_architecture.md#31-identity--access-management-module) |
| **KYC & Documents** | Document upload, validation, storage | [module_architecture.md#kyc-service](module_architecture.md#32-kyc--document-management-module) |
| **Payments** | M-Pesa integration, wallet, transactions | [module_architecture.md#payment-service](module_architecture.md#33-payment--wallet-module) |
| **Policy Management** | Policy lifecycle, batch processing | [module_architecture.md#policy-service](module_architecture.md#34-policy-management-module) |
| **Organizations** | SACCO/KBA hierarchy, membership | [module_architecture.md#org-service](module_architecture.md#35-organization-management-module) |
| **Notifications** | Multi-channel messaging | [module_architecture.md#notification-service](module_architecture.md#36-notification-module) |
| **Reporting** | Dashboards, scheduled reports | [module_architecture.md#reporting-service](module_architecture.md#37-reporting--analytics-module) |

### 7.3 Integration Landscape

```
┌─────────────────────────────────────────────────────────────────┐
│                      BodaInsure Platform                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    M-Pesa     │   │   WhatsApp    │   │  SMS Gateway  │
│  (Daraja 2.0) │   │ Business API  │   │  (Safaricom)  │
│               │   │               │   │               │
│ • STK Push    │   │ • Templates   │   │ • OTP         │
│ • B2C         │   │ • Media       │   │ • Alerts      │
│ • Callbacks   │   │ • Webhooks    │   │ • USSD        │
└───────────────┘   └───────────────┘   └───────────────┘

┌───────────────┐   ┌───────────────┐
│   Definite    │   │    Email      │
│  Assurance    │   │   Service     │
│               │   │               │
│ • Policy API* │   │ • SMTP        │
│ • Excel/SFTP  │   │ • Templates   │
└───────────────┘   └───────────────┘

* API in development; Excel via email for Phase 1
```

### 7.4 User Segmentation Model

**Option A: Geographical Hierarchy**
```
Country (Kenya)
    └── County (47 counties)
        └── Subcounty
            └── Ward
                └── Stage (physical rider location)
                    └── Member (individual rider)
```

**Option B: Membership Hierarchy**
```
Umbrella Body (KBA)
    └── Registered SACCO
        └── Member (individual rider)
```

*Platform supports both models concurrently with configurable admin permissions at each level.*

---

## 8. Success Metrics

### 8.1 Key Performance Indicators (KPIs)

| Category | Metric | Target | Measurement Frequency |
|----------|--------|--------|----------------------|
| **Acquisition** | New registrations | 700,000 in Year 1 | Daily |
| **Activation** | KYC completion rate | >85% | Weekly |
| **Activation** | Deposit conversion | >80% | Weekly |
| **Engagement** | Daily payment compliance | >70% | Daily |
| **Retention** | Policy renewal rate | >60% | Annually |
| **Operations** | Policy issuance SLA | <6 hours | Per batch |
| **Operations** | System uptime | 99.5% | Monthly |
| **Finance** | Revenue per user | 3,658 KES | Monthly |
| **Finance** | Customer acquisition cost | <200 KES | Quarterly |

### 8.2 North Star Metric

> **Active Covered Riders**: Number of riders with a valid, non-expired policy at any given time.

### 8.3 Health Metrics

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Daily payment rate | >70% | 50-70% | <50% |
| App crash rate | <1% | 1-3% | >3% |
| USSD timeout rate | <5% | 5-10% | >10% |
| Support ticket volume | <100/day | 100-500/day | >500/day |

---

## 9. Assumptions & Constraints

### 9.1 Assumptions

| ID | Assumption | Risk if Invalid |
|----|------------|-----------------|
| A1 | Riders have access to M-Pesa | High - payment model fails |
| A2 | KBA can mobilize members effectively | High - enrollment targets missed |
| A3 | Riders trust digital policy documents | Medium - adoption friction |
| A4 | USSD provides sufficient functionality for feature phones | Medium - user drop-off |
| A5 | Definite Assurance can process 3x daily batch volumes | Medium - SLA breach |
| A6 | Regulatory framework remains stable | Low - compliance rework |

### 9.2 Constraints

| ID | Constraint | Impact |
|----|------------|--------|
| C1 | Two-policy maximum per year (IRA regulation) | Product design must accommodate |
| C2 | 30-day free look period required | Cancellation/refund logic needed |
| C3 | Definite Assurance API not ready | Excel/SFTP integration for Phase 1 |
| C4 | Data residency in Kenya | Cloud region selection |
| C5 | M-Pesa transaction limits | Payment flow design |

### 9.3 Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| M-Pesa Daraja API credentials | Atronach | Pending |
| WhatsApp Business API approval | Atronach | Pending |
| USSD shortcode allocation | Atronach | Pending |
| Underwriter policy template | Definite Assurance | In progress |
| KBA member database | KBA | Available |

---

## 10. Related Documents

| Document | Description | Link |
|----------|-------------|------|
| Module Architecture | Technical module design and interactions | [module_architecture.md](module_architecture.md) |
| Requirements Specification | Functional and non-functional requirements | [requirements_specification.md](requirements_specification.md) |
| Feature Specification | Detailed feature definitions | [feature_specification.md](feature_specification.md) |
| API Specification | Integration endpoints (future) | TBD |
| Data Dictionary | Entity and field definitions (future) | TBD |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | Product Team | Initial draft |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Bodaboda** | Motorcycle taxi, common transportation in East Africa |
| **KBA** | Kenya Bodaboda Association, umbrella body for riders |
| **SACCO** | Savings and Credit Cooperative Organization |
| **TPO** | Third-Party Only insurance (mandatory coverage) |
| **IRA** | Insurance Regulatory Authority of Kenya |
| **KYC** | Know Your Customer (identity verification) |
| **STK Push** | SIM Toolkit push prompt for M-Pesa payment |
| **Stage** | Physical location where bodaboda riders congregate |

---

*End of Document*
