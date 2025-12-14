# BodaInsure — USSD & SMS Integration Specification

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Document Owner:** Engineering  
**Status:** Draft  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Provider Configuration](#2-provider-configuration)
3. [SMS Integration Specification](#3-sms-integration-specification)
4. [USSD Integration Specification](#4-ussd-integration-specification)
5. [Provider Abstraction Layer](#5-provider-abstraction-layer)
6. [Feature-to-Provider Mapping](#6-feature-to-provider-mapping)
7. [Failover Strategy](#7-failover-strategy)
8. [Configuration Management](#8-configuration-management)
9. [Testing Strategy](#9-testing-strategy)
10. [Monitoring & Alerting](#10-monitoring--alerting)
11. [Related Documents](#11-related-documents)

---

## 1. Overview

### 1.1 Purpose

This document specifies the integration of USSD and SMS services using two providers:
1. **Advantasms** (Primary for SMS, Secondary for USSD)
2. **Africa's Talking** (Primary for USSD, Secondary for SMS)

### 1.2 Multi-Provider Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROVIDER STRATEGY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SMS Traffic:                                                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Primary   │ ──▶ │  Failover   │ ──▶ │   Queue     │       │
│  │ Advantasms  │     │Africa'sTalk │     │  (Retry)    │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                 │
│  USSD Traffic:                                                  │
│  ┌─────────────┐     ┌─────────────┐                           │
│  │   Primary   │ ──▶ │  Failover   │                           │
│  │Africa'sTalk │     │ Advantasms  │                           │
│  └─────────────┘     └─────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Provider Comparison

| Feature | Advantasms | Africa's Talking |
|---------|------------|------------------|
| SMS API | REST (GET/POST) | REST + SDK |
| USSD API | Callback-based | Callback-based |
| Bulk SMS | Up to 20 per call | Unlimited (async) |
| Delivery Reports | Yes | Yes |
| Sandbox Testing | No | Yes |
| Node.js SDK | No (HTTP only) | Yes (official) |
| Scheduling | Yes | Via SDK |
| Kenya Coverage | Yes | Yes |

---

## 2. Provider Configuration

### 2.1 Environment Variables

```bash
# =============================================================================
# ADVANTASMS CONFIGURATION
# =============================================================================
ADVANTASMS_API_KEY=your_api_key_here
ADVANTASMS_PARTNER_ID=your_partner_id_here
ADVANTASMS_SENDER_ID=BodaInsure
ADVANTASMS_BASE_URL=https://quicksms.advantasms.com/api/services

# USSD Callback (Advantasms will call this URL)
ADVANTASMS_USSD_CALLBACK_URL=https://api.bodainsure.com/ussd/advantasms/callback

# =============================================================================
# AFRICA'S TALKING CONFIGURATION
# =============================================================================
AT_USERNAME=your_username_here          # Use 'sandbox' for testing
AT_API_KEY=your_api_key_here
AT_SENDER_ID=BodaInsure
AT_ENVIRONMENT=sandbox                   # 'sandbox' or 'production'

# API Endpoints
AT_SMS_ENDPOINT_LIVE=https://api.africastalking.com/version1/messaging
AT_SMS_ENDPOINT_SANDBOX=https://api.sandbox.africastalking.com/version1/messaging

# USSD Callback (Africa's Talking will call this URL)
AT_USSD_CALLBACK_URL=https://api.bodainsure.com/ussd/africastalking/callback

# =============================================================================
# PROVIDER PRIORITY CONFIGURATION
# =============================================================================
SMS_PRIMARY_PROVIDER=advantasms          # advantasms | africastalking
SMS_FAILOVER_PROVIDER=africastalking
USSD_PRIMARY_PROVIDER=africastalking     # advantasms | africastalking
USSD_FAILOVER_PROVIDER=advantasms

# =============================================================================
# RETRY CONFIGURATION
# =============================================================================
SMS_MAX_RETRIES=3
SMS_RETRY_DELAY_MS=1000
USSD_SESSION_TIMEOUT_MS=180000           # 180 seconds
```

### 2.2 Credentials Storage

```typescript
// config/providers.config.ts

export const providersConfig = {
  advantasms: {
    apiKey: process.env.ADVANTASMS_API_KEY,
    partnerId: process.env.ADVANTASMS_PARTNER_ID,
    senderId: process.env.ADVANTASMS_SENDER_ID,
    baseUrl: process.env.ADVANTASMS_BASE_URL,
    endpoints: {
      sendSms: '/sendsms/',
      sendBulk: '/sendbulk/',
      getBalance: '/getbalance/',
      getDeliveryReport: '/getdlr/',
    },
  },
  africastalking: {
    username: process.env.AT_USERNAME,
    apiKey: process.env.AT_API_KEY,
    senderId: process.env.AT_SENDER_ID,
    environment: process.env.AT_ENVIRONMENT,
    endpoints: {
      sms: {
        live: 'https://api.africastalking.com/version1/messaging',
        sandbox: 'https://api.sandbox.africastalking.com/version1/messaging',
      },
    },
  },
};
```

---

## 3. SMS Integration Specification

### 3.1 Advantasms SMS API

#### 3.1.1 Send Single SMS

**Endpoint:** `POST https://quicksms.advantasms.com/api/services/sendsms/`

**Request:**
```json
{
  "apikey": "your_api_key",
  "partnerID": "your_partner_id",
  "message": "Your OTP is 123456. Valid for 5 minutes.",
  "shortcode": "BodaInsure",
  "mobile": "254712345678"
}
```

**Response (Success):**
```json
{
  "responses": [
    {
      "respose-code": 200,
      "response-description": "Success",
      "mobile": "254712345678",
      "messageid": 8290842,
      "networkid": "1"
    }
  ]
}
```

**Response Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 1001 | Invalid sender ID |
| 1002 | Network not allowed |
| 1003 | Invalid mobile number |
| 1004 | Low bulk credits |
| 1005 | System error |
| 1006 | Invalid credentials |

#### 3.1.2 Send Bulk SMS (Up to 20)

**Endpoint:** `POST https://quicksms.advantasms.com/api/services/sendbulk/`

**Request:**
```json
{
  "count": 3,
  "smslist": [
    {
      "partnerID": "12345",
      "apikey": "your_api_key",
      "pass_type": "plain",
      "clientsmsid": "unique_id_1",
      "mobile": "254712345678",
      "message": "Payment reminder: KES 87 due today.",
      "shortcode": "BodaInsure"
    },
    {
      "partnerID": "12345",
      "apikey": "your_api_key",
      "pass_type": "plain",
      "clientsmsid": "unique_id_2",
      "mobile": "254723456789",
      "message": "Payment reminder: KES 87 due today.",
      "shortcode": "BodaInsure"
    }
  ]
}
```

#### 3.1.3 Schedule SMS

**Request (with scheduling):**
```json
{
  "apikey": "your_api_key",
  "partnerID": "your_partner_id",
  "message": "Your policy expires tomorrow!",
  "shortcode": "BodaInsure",
  "mobile": "254712345678",
  "timeToSend": "2024-12-15 07:00"
}
```

#### 3.1.4 Get Delivery Report

**Endpoint:** `POST https://quicksms.advantasms.com/api/services/getdlr/`

**Request:**
```json
{
  "apikey": "your_api_key",
  "partnerID": "your_partner_id",
  "messageID": "8290842"
}
```

#### 3.1.5 Get Account Balance

**Endpoint:** `POST https://quicksms.advantasms.com/api/services/getbalance/`

**Request:**
```json
{
  "apikey": "your_api_key",
  "partnerID": "your_partner_id"
}
```

---

### 3.2 Africa's Talking SMS API

#### 3.2.1 SDK Installation

```bash
npm install africastalking
```

#### 3.2.2 SDK Initialization

```typescript
// services/africastalking.service.ts

import AfricasTalking from 'africastalking';

const credentials = {
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME, // 'sandbox' for testing
};

const africasTalking = AfricasTalking(credentials);
const sms = africasTalking.SMS;

export { sms, africasTalking };
```

#### 3.2.3 Send Single SMS

```typescript
const options = {
  to: ['+254712345678'],
  message: 'Your OTP is 123456. Valid for 5 minutes.',
  from: 'BodaInsure', // Optional sender ID
};

const response = await sms.send(options);
```

**Response:**
```json
{
  "SMSMessageData": {
    "Message": "Sent to 1/1 Total Cost: KES 0.8000",
    "Recipients": [
      {
        "statusCode": 101,
        "number": "+254712345678",
        "status": "Success",
        "cost": "KES 0.8000",
        "messageId": "ATXid_123456789"
      }
    ]
  }
}
```

#### 3.2.4 Send Bulk SMS

```typescript
const options = {
  to: ['+254712345678', '+254723456789', '+254734567890'],
  message: 'Payment reminder: KES 87 due today. Dial *xxx*xxx# to pay.',
  from: 'BodaInsure',
  enqueue: true, // For large batches
};

const response = await sms.send(options);
```

#### 3.2.5 Send Premium SMS

```typescript
const options = {
  to: '+254712345678',
  from: '12345', // Premium shortcode
  message: 'Premium service message',
  keyword: 'keyword',
  linkId: 'link_id_from_subscription',
  retryDurationInHours: 24,
};

const response = await sms.sendPremium(options);
```

#### 3.2.6 Fetch Messages (Inbox)

```typescript
const response = await sms.fetchMessages({ lastReceivedId: 0 });
```

#### 3.2.7 Direct HTTP API (Alternative)

**Endpoint:** 
- Live: `POST https://api.africastalking.com/version1/messaging`
- Sandbox: `POST https://api.sandbox.africastalking.com/version1/messaging`

**Headers:**
```
Accept: application/json
Content-Type: application/x-www-form-urlencoded
apiKey: your_api_key
```

**Body (form-urlencoded):**
```
username=your_username&to=+254712345678&message=Hello&from=BodaInsure
```

---

## 4. USSD Integration Specification

### 4.1 USSD Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │     │   Provider   │     │  BodaInsure  │
│   (Phone)    │     │   Gateway    │     │     API      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Dial *xxx*xxx#     │                    │
       │───────────────────▶│                    │
       │                    │  HTTP POST         │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  "CON Menu..."     │
       │                    │◀───────────────────│
       │  Display Menu      │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │  Select Option 1   │                    │
       │───────────────────▶│                    │
       │                    │  HTTP POST         │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  "END Balance..."  │
       │                    │◀───────────────────│
       │  Display & Close   │                    │
       │◀───────────────────│                    │
```

### 4.2 Advantasms USSD API

#### 4.2.1 Callback URL Configuration

Register your callback URL with Advantasms in format:
```
https://api.bodainsure.com/ussd/advantasms/callback?SESSIONID=$SESSIONID&USSDCODE=$USSDCODE&MSISDN=$MSISDN&INPUT=$INPUT
```

#### 4.2.2 Callback Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `SESSIONID` | Unique session identifier | `233443` |
| `USSDCODE` | USSD code dialed | `*415*33#` |
| `MSISDN` | User's phone number | `254712345678` |
| `INPUT` | User's input (cumulative) | `33*1*87` |

#### 4.2.3 Response Format

**Continue Session (CON):**
```
CON Welcome to BodaInsure
1. Check Balance
2. Make Payment
3. Policy Status
4. Help
```

**End Session (END):**
```
END Your balance is KES 2,179
Daily payments: 15/30
Thank you for using BodaInsure.
```

#### 4.2.4 Input Parsing

```typescript
// The INPUT parameter contains cumulative selections separated by *
// Example: "33*1*87" means:
// - 33: Initial shortcode identifier
// - 1: Selected menu option 1
// - 87: Entered value 87

function parseInput(input: string): string[] {
  return input.split('*');
}

function getLastInput(input: string): string {
  const parts = parseInput(input);
  return parts[parts.length - 1];
}

function getInputLevel(input: string): number {
  return parseInput(input).length;
}
```

#### 4.2.5 Advantasms Callback Handler

```typescript
// controllers/ussd-advantasms.controller.ts

import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('ussd/advantasms')
export class UssdAdvantasmsController {
  
  @Get('callback')
  async handleCallback(
    @Query('SESSIONID') sessionId: string,
    @Query('USSDCODE') ussdCode: string,
    @Query('MSISDN') msisdn: string,
    @Query('INPUT') input: string,
    @Res() res: Response,
  ) {
    const decodedInput = decodeURIComponent(input || '');
    const inputArray = decodedInput.split('*');
    const lastInput = inputArray[inputArray.length - 1];
    const level = inputArray.length;
    
    let response = '';
    
    // Level 1: Main Menu (initial dial or shortcode identifier)
    if (level === 1) {
      response = `CON Welcome to BodaInsure
1. Check Balance
2. Make Payment
3. Policy Status
4. Help`;
    }
    // Level 2: Handle main menu selection
    else if (level === 2) {
      switch (lastInput) {
        case '1':
          // Fetch balance from database
          const balance = await this.walletService.getBalance(msisdn);
          response = `END Your Balance:
Total Paid: KES ${balance.totalPaid}
Daily Payments: ${balance.dailyCount}/30
Remaining: KES ${balance.remaining}`;
          break;
          
        case '2':
          response = `CON Make Payment
Pay for how many days?
1. 1 day (KES 87)
2. 7 days (KES 609)
3. All remaining
0. Back`;
          break;
          
        case '3':
          const policy = await this.policyService.getActivePolicy(msisdn);
          response = `END Policy Status: ${policy.status}
Policy: ${policy.policyNumber}
Expires: ${policy.expiryDate}
Days Left: ${policy.daysRemaining}`;
          break;
          
        case '4':
          response = `END BodaInsure Support
Call: 0800-XXX-XXX
WhatsApp: 0712-XXX-XXX
Email: support@bodainsure.com`;
          break;
          
        default:
          response = 'END Invalid option. Please try again.';
      }
    }
    // Level 3: Handle payment submenu
    else if (level === 3 && inputArray[1] === '2') {
      switch (lastInput) {
        case '1':
          response = `CON Pay KES 87 for 1 day?
1. Confirm
0. Cancel`;
          break;
        case '2':
          response = `CON Pay KES 609 for 7 days?
1. Confirm
0. Cancel`;
          break;
        case '3':
          const remaining = await this.walletService.getRemainingAmount(msisdn);
          response = `CON Pay KES ${remaining} for all remaining days?
1. Confirm
0. Cancel`;
          break;
        case '0':
          response = `CON Welcome to BodaInsure
1. Check Balance
2. Make Payment
3. Policy Status
4. Help`;
          break;
        default:
          response = 'END Invalid option.';
      }
    }
    // Level 4: Payment confirmation
    else if (level === 4 && inputArray[1] === '2') {
      if (lastInput === '1') {
        // Trigger M-Pesa STK Push
        await this.paymentService.initiateUssdPayment(msisdn, inputArray[2]);
        response = `END Payment initiated!
Check your phone for M-Pesa prompt.
Enter your PIN to complete.`;
      } else {
        response = 'END Payment cancelled.';
      }
    }
    else {
      response = 'END Session expired. Please dial again.';
    }
    
    // Return plain text response
    res.setHeader('Content-Type', 'text/plain');
    res.send(response);
  }
}
```

---

### 4.3 Africa's Talking USSD API

#### 4.3.1 Callback URL Configuration

Configure callback URL in Africa's Talking dashboard under USSD > Service Codes:
```
https://api.bodainsure.com/ussd/africastalking/callback
```

#### 4.3.2 Callback Parameters (POST body)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `sessionId` | Unique session identifier | `ATUid_xxx` |
| `serviceCode` | USSD code dialed | `*384*1234#` |
| `phoneNumber` | User's phone number | `+254712345678` |
| `text` | User's input (cumulative) | `1*87` |

#### 4.3.3 Response Format

Same as Advantasms:
- `CON` prefix: Continue session
- `END` prefix: End session

#### 4.3.4 Africa's Talking Callback Handler

```typescript
// controllers/ussd-africastalking.controller.ts

import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';

interface ATUssdRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

@Controller('ussd/africastalking')
export class UssdAfricasTalkingController {
  
  @Post('callback')
  async handleCallback(
    @Body() body: ATUssdRequest,
    @Res() res: Response,
  ) {
    const { sessionId, serviceCode, phoneNumber, text } = body;
    
    // Normalize phone number (AT sends with +254)
    const msisdn = phoneNumber.replace('+', '');
    
    // Parse input - empty string means initial dial
    const inputArray = text === '' ? [] : text.split('*');
    const lastInput = inputArray[inputArray.length - 1] || '';
    const level = inputArray.length;
    
    let response = '';
    
    // Level 0: Initial dial (empty text)
    if (level === 0) {
      response = `CON Welcome to BodaInsure
1. Check Balance
2. Make Payment
3. Policy Status
4. Help`;
    }
    // Level 1: Main menu selection
    else if (level === 1) {
      switch (lastInput) {
        case '1':
          const balance = await this.walletService.getBalance(msisdn);
          response = `END Your Balance:
Total Paid: KES ${balance.totalPaid}
Daily Payments: ${balance.dailyCount}/30
Remaining: KES ${balance.remaining}`;
          break;
          
        case '2':
          response = `CON Make Payment
Pay for how many days?
1. 1 day (KES 87)
2. 7 days (KES 609)
3. All remaining
0. Back`;
          break;
          
        case '3':
          const policy = await this.policyService.getActivePolicy(msisdn);
          if (policy) {
            response = `END Policy Status: ${policy.status}
Policy: ${policy.policyNumber}
Expires: ${policy.expiryDate}
Days Left: ${policy.daysRemaining}`;
          } else {
            response = `END No active policy found.
Dial again and select option 2 to make a payment.`;
          }
          break;
          
        case '4':
          response = `END BodaInsure Support
Call: 0800-XXX-XXX
WhatsApp: 0712-XXX-XXX`;
          break;
          
        default:
          response = 'END Invalid option. Please dial again.';
      }
    }
    // Level 2: Payment submenu
    else if (level === 2 && inputArray[0] === '2') {
      // ... similar to Advantasms handler
    }
    // Level 3: Payment confirmation
    else if (level === 3 && inputArray[0] === '2') {
      // ... similar to Advantasms handler
    }
    else {
      response = 'END Invalid input. Please dial again.';
    }
    
    // Return plain text response
    res.setHeader('Content-Type', 'text/plain');
    res.send(response);
  }
}
```

---

## 5. Provider Abstraction Layer

### 5.1 SMS Provider Interface

```typescript
// interfaces/sms-provider.interface.ts

export interface SendSmsRequest {
  to: string;
  message: string;
  senderId?: string;
  clientId?: string; // For tracking
  scheduleTime?: Date;
}

export interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  provider: 'advantasms' | 'africastalking';
  cost?: string;
  error?: string;
}

export interface BulkSmsRequest {
  messages: SendSmsRequest[];
}

export interface BulkSmsResponse {
  success: boolean;
  results: SendSmsResponse[];
  provider: 'advantasms' | 'africastalking';
}

export interface DeliveryReport {
  messageId: string;
  status: 'delivered' | 'failed' | 'pending' | 'rejected';
  deliveredAt?: Date;
  failureReason?: string;
}

export interface ISmsProvider {
  send(request: SendSmsRequest): Promise<SendSmsResponse>;
  sendBulk(request: BulkSmsRequest): Promise<BulkSmsResponse>;
  getDeliveryReport(messageId: string): Promise<DeliveryReport>;
  getBalance(): Promise<{ balance: number; currency: string }>;
}
```

### 5.2 Advantasms Provider Implementation

```typescript
// providers/advantasms.provider.ts

import { Injectable, HttpService } from '@nestjs/common';
import { ISmsProvider, SendSmsRequest, SendSmsResponse } from '../interfaces/sms-provider.interface';

@Injectable()
export class AdvantasmsProvider implements ISmsProvider {
  private readonly baseUrl = process.env.ADVANTASMS_BASE_URL;
  private readonly apiKey = process.env.ADVANTASMS_API_KEY;
  private readonly partnerId = process.env.ADVANTASMS_PARTNER_ID;
  private readonly senderId = process.env.ADVANTASMS_SENDER_ID;

  constructor(private readonly httpService: HttpService) {}

  async send(request: SendSmsRequest): Promise<SendSmsResponse> {
    try {
      const payload = {
        apikey: this.apiKey,
        partnerID: this.partnerId,
        message: request.message,
        shortcode: request.senderId || this.senderId,
        mobile: this.formatPhoneNumber(request.to),
        ...(request.scheduleTime && { 
          timeToSend: this.formatScheduleTime(request.scheduleTime) 
        }),
      };

      const response = await this.httpService.post(
        `${this.baseUrl}/sendsms/`,
        payload
      ).toPromise();

      const result = response.data.responses[0];
      
      if (result['respose-code'] === 200) {
        return {
          success: true,
          messageId: String(result.messageid),
          provider: 'advantasms',
        };
      } else {
        return {
          success: false,
          provider: 'advantasms',
          error: result['response-description'],
        };
      }
    } catch (error) {
      return {
        success: false,
        provider: 'advantasms',
        error: error.message,
      };
    }
  }

  async sendBulk(request: BulkSmsRequest): Promise<BulkSmsResponse> {
    // Advantasms supports max 20 per request
    const batches = this.chunkArray(request.messages, 20);
    const allResults: SendSmsResponse[] = [];

    for (const batch of batches) {
      const smslist = batch.map((msg, index) => ({
        partnerID: this.partnerId,
        apikey: this.apiKey,
        pass_type: 'plain',
        clientsmsid: msg.clientId || `batch_${Date.now()}_${index}`,
        mobile: this.formatPhoneNumber(msg.to),
        message: msg.message,
        shortcode: msg.senderId || this.senderId,
      }));

      try {
        const response = await this.httpService.post(
          `${this.baseUrl}/sendbulk/`,
          { count: smslist.length, smslist }
        ).toPromise();

        for (const result of response.data.responses) {
          allResults.push({
            success: result['respose-code'] === 200,
            messageId: String(result.messageid),
            provider: 'advantasms',
            error: result['respose-code'] !== 200 ? result['response-description'] : undefined,
          });
        }
      } catch (error) {
        // Mark all in batch as failed
        batch.forEach(() => {
          allResults.push({
            success: false,
            provider: 'advantasms',
            error: error.message,
          });
        });
      }
    }

    return {
      success: allResults.every(r => r.success),
      results: allResults,
      provider: 'advantasms',
    };
  }

  async getDeliveryReport(messageId: string): Promise<DeliveryReport> {
    const response = await this.httpService.post(
      `${this.baseUrl}/getdlr/`,
      {
        apikey: this.apiKey,
        partnerID: this.partnerId,
        messageID: messageId,
      }
    ).toPromise();

    // Parse response and return delivery report
    return {
      messageId,
      status: this.mapDeliveryStatus(response.data),
    };
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    const response = await this.httpService.post(
      `${this.baseUrl}/getbalance/`,
      {
        apikey: this.apiKey,
        partnerID: this.partnerId,
      }
    ).toPromise();

    return {
      balance: parseFloat(response.data.balance || '0'),
      currency: 'KES',
    };
  }

  private formatPhoneNumber(phone: string): string {
    // Ensure format: 254XXXXXXXXX
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  }

  private formatScheduleTime(date: Date): string {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private mapDeliveryStatus(data: any): DeliveryReport['status'] {
    // Map Advantasms status codes to our standard
    return 'pending';
  }
}
```

### 5.3 Africa's Talking Provider Implementation

```typescript
// providers/africastalking.provider.ts

import { Injectable } from '@nestjs/common';
import AfricasTalking from 'africastalking';
import { ISmsProvider, SendSmsRequest, SendSmsResponse } from '../interfaces/sms-provider.interface';

@Injectable()
export class AfricasTalkingProvider implements ISmsProvider {
  private sms: any;

  constructor() {
    const credentials = {
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
    };
    const at = AfricasTalking(credentials);
    this.sms = at.SMS;
  }

  async send(request: SendSmsRequest): Promise<SendSmsResponse> {
    try {
      const options = {
        to: [this.formatPhoneNumber(request.to)],
        message: request.message,
        from: request.senderId || process.env.AT_SENDER_ID,
      };

      const response = await this.sms.send(options);
      const recipient = response.SMSMessageData.Recipients[0];

      if (recipient.statusCode === 101) {
        return {
          success: true,
          messageId: recipient.messageId,
          provider: 'africastalking',
          cost: recipient.cost,
        };
      } else {
        return {
          success: false,
          provider: 'africastalking',
          error: recipient.status,
        };
      }
    } catch (error) {
      return {
        success: false,
        provider: 'africastalking',
        error: error.message,
      };
    }
  }

  async sendBulk(request: BulkSmsRequest): Promise<BulkSmsResponse> {
    // Group by message content for efficiency
    const messageGroups = this.groupByMessage(request.messages);
    const allResults: SendSmsResponse[] = [];

    for (const [message, recipients] of Object.entries(messageGroups)) {
      try {
        const options = {
          to: recipients.map(r => this.formatPhoneNumber(r.to)),
          message,
          from: process.env.AT_SENDER_ID,
          enqueue: true, // Use async delivery for bulk
        };

        const response = await this.sms.send(options);

        for (const recipient of response.SMSMessageData.Recipients) {
          allResults.push({
            success: recipient.statusCode === 101,
            messageId: recipient.messageId,
            provider: 'africastalking',
            cost: recipient.cost,
            error: recipient.statusCode !== 101 ? recipient.status : undefined,
          });
        }
      } catch (error) {
        recipients.forEach(() => {
          allResults.push({
            success: false,
            provider: 'africastalking',
            error: error.message,
          });
        });
      }
    }

    return {
      success: allResults.every(r => r.success),
      results: allResults,
      provider: 'africastalking',
    };
  }

  async getDeliveryReport(messageId: string): Promise<DeliveryReport> {
    // Africa's Talking uses webhooks for delivery reports
    // This would query our stored delivery reports
    return {
      messageId,
      status: 'pending',
    };
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
    });
    
    const response = await at.APPLICATION.fetchApplicationData();
    
    return {
      balance: parseFloat(response.UserData.balance.replace('KES ', '')),
      currency: 'KES',
    };
  }

  private formatPhoneNumber(phone: string): string {
    // Ensure format: +254XXXXXXXXX
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  private groupByMessage(messages: SendSmsRequest[]): Record<string, SendSmsRequest[]> {
    return messages.reduce((acc, msg) => {
      if (!acc[msg.message]) {
        acc[msg.message] = [];
      }
      acc[msg.message].push(msg);
      return acc;
    }, {} as Record<string, SendSmsRequest[]>);
  }
}
```

### 5.4 SMS Service with Failover

```typescript
// services/sms.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { AdvantasmsProvider } from '../providers/advantasms.provider';
import { AfricasTalkingProvider } from '../providers/africastalking.provider';
import { ISmsProvider, SendSmsRequest, SendSmsResponse } from '../interfaces/sms-provider.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly primaryProvider: ISmsProvider;
  private readonly failoverProvider: ISmsProvider;
  private readonly maxRetries = parseInt(process.env.SMS_MAX_RETRIES || '3');
  private readonly retryDelay = parseInt(process.env.SMS_RETRY_DELAY_MS || '1000');

  constructor(
    private readonly advantasms: AdvantasmsProvider,
    private readonly africastalking: AfricasTalkingProvider,
  ) {
    // Configure primary/failover based on environment
    const primaryName = process.env.SMS_PRIMARY_PROVIDER || 'advantasms';
    this.primaryProvider = primaryName === 'advantasms' ? advantasms : africastalking;
    this.failoverProvider = primaryName === 'advantasms' ? africastalking : advantasms;
  }

  async send(request: SendSmsRequest): Promise<SendSmsResponse> {
    let lastError: string;

    // Try primary provider
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.primaryProvider.send(request);
      if (result.success) {
        this.logger.log(`SMS sent via primary provider: ${result.messageId}`);
        return result;
      }
      lastError = result.error;
      this.logger.warn(`Primary provider attempt ${attempt} failed: ${lastError}`);
      
      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelay * attempt);
      }
    }

    // Failover to secondary provider
    this.logger.warn('Failing over to secondary SMS provider');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.failoverProvider.send(request);
      if (result.success) {
        this.logger.log(`SMS sent via failover provider: ${result.messageId}`);
        return result;
      }
      lastError = result.error;
      this.logger.warn(`Failover provider attempt ${attempt} failed: ${lastError}`);
      
      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelay * attempt);
      }
    }

    // All attempts failed
    this.logger.error(`SMS delivery failed after all retries: ${request.to}`);
    return {
      success: false,
      provider: 'africastalking', // Last attempted
      error: `All providers failed. Last error: ${lastError}`,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 6. Feature-to-Provider Mapping

### 6.1 SMS Features

| Feature ID | Feature Name | Primary Provider | Message Type |
|------------|--------------|------------------|--------------|
| FEAT-AUTH-002 | OTP Verification | Advantasms | Transactional |
| FEAT-AUTH-003 | User Login OTP | Advantasms | Transactional |
| FEAT-KYC-003 | KYC Status Notification | Advantasms | Transactional |
| FEAT-KYC-004 | Document Rejection Alert | Advantasms | Transactional |
| FEAT-PAY-001 | Deposit Confirmation | Advantasms | Transactional |
| FEAT-PAY-002 | Daily Payment Confirmation | Advantasms | Transactional |
| FEAT-PAY-005 | Payment Reminders | Africa's Talking | Bulk/Scheduled |
| FEAT-POL-002 | Policy Delivery (SMS backup) | Advantasms | Transactional |
| FEAT-POL-003 | Policy Expiry Notifications | Africa's Talking | Bulk/Scheduled |
| FEAT-ORG-002 | Bulk Import Invitations | Africa's Talking | Bulk |
| FEAT-ORG-004 | SACCO Broadcasts | Africa's Talking | Bulk |

### 6.2 USSD Features

| Feature ID | Feature Name | Primary Provider |
|------------|--------------|------------------|
| FEAT-USSD-001 | Balance Check | Africa's Talking |
| FEAT-USSD-002 | Make Payment | Africa's Talking |
| FEAT-USSD-003 | Policy Status | Africa's Talking |

---

## 7. Failover Strategy

### 7.1 SMS Failover Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                    SMS FAILOVER LOGIC                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Try PRIMARY provider (Advantasms)                          │
│     └── Retry up to 3 times with exponential backoff           │
│                                                                 │
│  2. If PRIMARY fails:                                          │
│     └── Switch to FAILOVER provider (Africa's Talking)         │
│         └── Retry up to 3 times                                │
│                                                                 │
│  3. If FAILOVER fails:                                         │
│     └── Queue message for later retry (Redis queue)            │
│     └── Alert operations team                                  │
│     └── Log failure for audit                                  │
│                                                                 │
│  4. Critical OTP messages:                                      │
│     └── No queueing - immediate failure response               │
│     └── User shown "Please try again" message                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 USSD Failover

USSD doesn't support failover mid-session. Strategy:
1. Configure both providers with same callback URL
2. Only one provider active at a time
3. Switch provider via config if primary has extended outage

---

## 8. Configuration Management

### 8.1 SMS Templates Registry

```typescript
// config/sms-templates.config.ts

export const SMS_TEMPLATES = {
  // Authentication
  OTP_VERIFICATION: {
    en: 'BodaInsure: Your verification code is {otp}. Valid for 5 minutes. Do not share.',
    sw: 'BodaInsure: Nambari yako ya uthibitisho ni {otp}. Halali kwa dakika 5. Usishiriki.',
  },
  
  // Payments
  PAYMENT_CONFIRMATION: {
    en: 'BodaInsure: Payment received! KES {amount} (Day {current}/{total}). Ref: {ref}. Balance: KES {balance}.',
    sw: 'BodaInsure: Malipo yamepokelewa! KES {amount} (Siku {current}/{total}). Ref: {ref}. Salio: KES {balance}.',
  },
  
  PAYMENT_REMINDER: {
    en: 'BodaInsure: Time for your daily payment! Pay KES 87 to stay on track. Progress: {current}/30 days. Dial *xxx*xxx# to pay.',
    sw: 'BodaInsure: Wakati wa malipo ya kila siku! Lipa KES 87. Maendeleo: siku {current}/30. Piga *xxx*xxx# kulipa.',
  },
  
  // Policy
  POLICY_ISSUED: {
    en: 'BodaInsure: Your policy is ready! Policy: {policyNumber}. Valid: {startDate} - {endDate}. Check WhatsApp for document.',
    sw: 'BodaInsure: Bima yako iko tayari! Bima: {policyNumber}. Halali: {startDate} - {endDate}. Angalia WhatsApp.',
  },
  
  POLICY_EXPIRY_30: {
    en: 'BodaInsure: Your policy {policyNumber} expires in 30 days ({expiryDate}). Renew early to stay covered.',
    sw: 'BodaInsure: Bima yako {policyNumber} itaisha baada ya siku 30 ({expiryDate}). Fanya upya mapema.',
  },
  
  POLICY_EXPIRY_1: {
    en: '⚠️ BodaInsure: Your policy expires TOMORROW! Ride uninsured = fines + impoundment. Renew NOW: dial *xxx*xxx#',
    sw: '⚠️ BodaInsure: Bima yako inaisha KESHO! Endesha bila bima = faini + kunyang\'anywa. Fanya upya SASA: piga *xxx*xxx#',
  },
  
  // KYC
  KYC_APPROVED: {
    en: 'BodaInsure: Your documents verified! ✓ You can now make your first payment. Open app or dial *xxx*xxx#.',
    sw: 'BodaInsure: Nyaraka zako zimethibitishwa! ✓ Sasa unaweza kulipa. Fungua app au piga *xxx*xxx#.',
  },
  
  KYC_REJECTED: {
    en: 'BodaInsure: Action needed - {documentType} was not clear. Please re-upload in the app.',
    sw: 'BodaInsure: Hatua inahitajika - {documentType} haikuwa wazi. Tafadhali pakia tena kwenye app.',
  },
};

export function renderTemplate(
  templateKey: keyof typeof SMS_TEMPLATES,
  language: 'en' | 'sw',
  variables: Record<string, string | number>
): string {
  let template = SMS_TEMPLATES[templateKey][language];
  
  for (const [key, value] of Object.entries(variables)) {
    template = template.replace(new RegExp(`{${key}}`, 'g'), String(value));
  }
  
  return template;
}
```

---

## 9. Testing Strategy

### 9.1 Sandbox Testing

| Provider | Sandbox Available | Test Numbers |
|----------|-------------------|--------------|
| Advantasms | No | Use low-cost live API |
| Africa's Talking | Yes | Use simulator |

### 9.2 Africa's Talking Sandbox Setup

```typescript
// Use sandbox environment for testing
const credentials = {
  apiKey: process.env.AT_API_KEY,
  username: 'sandbox', // Always 'sandbox' for testing
};

// Test phone numbers in simulator:
// +254700000000 to +254799999999
```

### 9.3 Integration Tests

```typescript
// tests/sms.integration.spec.ts

describe('SMS Integration', () => {
  describe('Advantasms', () => {
    it('should send single SMS', async () => {
      const result = await advantasmsProvider.send({
        to: '254712345678',
        message: 'Test message',
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
    
    it('should handle invalid phone number', async () => {
      const result = await advantasmsProvider.send({
        to: 'invalid',
        message: 'Test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid mobile number');
    });
  });
  
  describe('Africa\'s Talking', () => {
    it('should send SMS via sandbox', async () => {
      const result = await atProvider.send({
        to: '+254712345678',
        message: 'Test message',
      });
      expect(result.success).toBe(true);
    });
  });
  
  describe('Failover', () => {
    it('should failover to secondary provider', async () => {
      // Mock primary provider failure
      jest.spyOn(advantasmsProvider, 'send').mockResolvedValue({
        success: false,
        provider: 'advantasms',
        error: 'Service unavailable',
      });
      
      const result = await smsService.send({
        to: '254712345678',
        message: 'Test',
      });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('africastalking');
    });
  });
});
```

---

## 10. Monitoring & Alerting

### 10.1 Metrics to Track

| Metric | Alert Threshold |
|--------|-----------------|
| SMS delivery rate | < 95% |
| SMS latency (p95) | > 5 seconds |
| Provider error rate | > 5% |
| USSD response time | > 2 seconds |
| USSD session completion rate | < 80% |
| Provider balance | < KES 10,000 |

### 10.2 Alerting Rules

```yaml
# prometheus/alerts/sms.yml

groups:
  - name: sms_alerts
    rules:
      - alert: SmsDeliveryRateLow
        expr: rate(sms_delivered_total[5m]) / rate(sms_sent_total[5m]) < 0.95
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: SMS delivery rate below 95%
          
      - alert: SmsProviderDown
        expr: sms_provider_errors_total > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: SMS provider experiencing errors
          
      - alert: UssdResponseSlow
        expr: histogram_quantile(0.95, ussd_response_duration_seconds) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: USSD response time exceeding 2 seconds
```

---

## 11. Related Documents

| Document | Link |
|----------|------|
| Product Description | [product_description.md](product_description.md) |
| Module Architecture | [module_architecture.md](module_architecture.md) |
| Requirements Specification | [requirements_specification.md](requirements_specification.md) |
| Feature Specification | [feature_specification.md](feature_specification.md) |
| CLAUDE.md Governance | [CLAUDE.md](CLAUDE.md) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | Engineering | Initial draft |

---

*End of Document*
