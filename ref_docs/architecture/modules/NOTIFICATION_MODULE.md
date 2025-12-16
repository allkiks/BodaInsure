# Notification Module Architecture

## 1. Module Overview

### 1.1 Purpose and Scope

The Notification module is the communication hub of the BodaInsure platform, managing all outbound communications to riders through multiple channels. It implements a sophisticated multi-provider architecture with automatic failover, user preference management, quiet hours handling, and comprehensive delivery tracking.

### 1.2 Business Context

```
┌─────────────────────────────────────────────────────────────────┐
│                 NOTIFICATION CHANNELS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │       SMS       │  │    WHATSAPP     │  │      EMAIL      │ │
│  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │ │
│  │ • Africa's      │  │ • Meta Business │  │ • SMTP          │ │
│  │   Talking       │  │   API           │  │ • MailHog (dev) │ │
│  │ • Advantasms    │  │ • Templates     │  │ • HTML/Text     │ │
│  │   (fallback)    │  │ • Documents     │  │ • Attachments   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  Key Features:                                                  │
│  • Automatic provider failover                                 │
│  • User preference management                                  │
│  • Quiet hours (21:00-07:00 EAT default)                      │
│  • Template-based messaging                                    │
│  • Retry with exponential backoff                             │
│  • Multi-language support (English/Swahili)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Multi-Channel Delivery** | SMS, WhatsApp, Email, Push (future) |
| **Provider Management** | Primary/fallback SMS providers with health checks |
| **Template System** | Variable substitution, multi-language support |
| **User Preferences** | Channel selection, quiet hours, opt-out |
| **Delivery Tracking** | Status updates, retry logic, audit trail |
| **Scheduled Notifications** | Future delivery, batch processing |

---

## 2. Module Structure

### 2.1 File Organization

```
src/modules/notification/
├── notification.module.ts              # Module definition
├── controllers/
│   ├── index.ts                        # Controller exports
│   ├── notification.controller.ts      # User notification endpoints
│   └── notification-webhook.controller.ts  # Provider webhooks
├── services/
│   ├── index.ts                        # Service exports
│   ├── notification.service.ts         # Core orchestration
│   ├── sms.service.ts                  # Africa's Talking SMS
│   ├── sms-orchestrator.service.ts     # SMS provider failover
│   ├── whatsapp.service.ts             # WhatsApp Business API
│   ├── email.service.ts                # SMTP email service
│   └── reminder.service.ts             # Payment/expiry reminders
├── providers/
│   ├── index.ts                        # Provider exports
│   ├── africastalking.provider.ts      # Africa's Talking implementation
│   └── advantasms.provider.ts          # Advantasms implementation
├── entities/
│   ├── index.ts                        # Entity exports
│   ├── notification.entity.ts          # Notification record
│   ├── notification-template.entity.ts # Message templates
│   └── notification-preference.entity.ts # User preferences
├── interfaces/
│   ├── index.ts                        # Interface exports
│   └── sms-provider.interface.ts       # SMS provider contract
└── dto/
    ├── index.ts                        # DTO exports
    ├── notification-query.dto.ts       # Query parameters
    └── update-preferences.dto.ts       # Preference updates
```

### 2.2 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION MODULE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IMPORTS:                                                       │
│  ├── TypeOrmModule.forFeature([                                │
│  │     Notification, NotificationTemplate, NotificationPreference│
│  │   ])                                                        │
│  ├── ConfigModule                                              │
│  ├── HttpModule (provider API calls)                           │
│  └── CommonModule                                              │
│                                                                 │
│  EXPORTS:                                                       │
│  ├── NotificationService                                       │
│  ├── SmsService                                                │
│  ├── SmsOrchestratorService                                    │
│  ├── WhatsAppService                                           │
│  ├── EmailService                                              │
│  └── ReminderService                                           │
│                                                                 │
│  CONSUMERS:                                                     │
│  ├── IdentityModule (OTP delivery)                             │
│  ├── PaymentModule (payment confirmations)                     │
│  ├── PolicyModule (policy delivery)                            │
│  ├── QueueModule (async notification processing)               │
│  └── SchedulerModule (reminder triggers)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Entity Relationship Diagram

```
┌─────────────────────┐
│        User         │
│  (Identity Module)  │
└─────────┬───────────┘
          │
          │ 1:N                        1:1
          ▼                             │
┌─────────────────────┐    ┌───────────┴───────────┐
│    Notification     │    │NotificationPreference │
│  ─────────────────  │    │  ───────────────────  │
│  id (UUID, PK)      │    │  id (UUID, PK)        │
│  userId (UUID, FK)  │    │  userId (UUID, UK)    │
│  channel            │    │  otpChannel           │
│  notificationType   │    │  policyChannel        │
│  status             │    │  reminderChannel      │
│  recipient          │    │  quietHoursStart      │
│  content            │    │  quietHoursEnd        │
│  templateId (FK)    │    │  ...                  │
│  ...                │    └───────────────────────┘
└─────────┬───────────┘
          │
          │ N:1
          ▼
┌─────────────────────┐
│NotificationTemplate │
│  ─────────────────  │
│  id (UUID, PK)      │
│  code (unique)      │
│  channel            │
│  notificationType   │
│  body               │
│  requiredVariables  │
│  ...                │
└─────────────────────┘
```

### 3.2 Notification Entity

Tracks all sent notifications with delivery status.

```typescript
export enum NotificationChannel {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH'
}

export enum NotificationType {
  OTP = 'OTP',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  POLICY_ISSUED = 'POLICY_ISSUED',
  POLICY_EXPIRING = 'POLICY_EXPIRING',
  POLICY_EXPIRED = 'POLICY_EXPIRED',
  POLICY_DOCUMENT = 'POLICY_DOCUMENT',
  WELCOME = 'WELCOME',
  ACCOUNT_UPDATE = 'ACCOUNT_UPDATE',
  SUPPORT = 'SUPPORT'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationType })
  notificationType: NotificationType;

  @Column({ type: 'enum', enum: NotificationStatus, default: 'PENDING' })
  status: NotificationStatus;

  @Column({ type: 'enum', enum: NotificationPriority, default: 'NORMAL' })
  priority: NotificationPriority;

  // Message content
  @Column({ length: 100 })
  recipient: string;  // Phone or email

  @Column({ length: 255, nullable: true })
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid', nullable: true })
  templateId: string;

  @Column({ type: 'jsonb', nullable: true })
  templateVariables: Record<string, string>;

  // Reference tracking
  @Column({ type: 'uuid', nullable: true })
  referenceId: string;  // Policy, payment, etc.

  @Column({ length: 50, nullable: true })
  referenceType: string;

  // Delivery tracking
  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date;

  @Column({ length: 100, nullable: true })
  externalId: string;  // Provider's message ID

  @Column({ length: 50, nullable: true })
  provider: string;

  @Column({ type: 'int', nullable: true })
  cost: number;  // In cents

  // Error handling
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  canRetry(): boolean { return this.retryCount < this.maxRetries; }
  isPending(): boolean { return ['PENDING', 'QUEUED'].includes(this.status); }
  isDelivered(): boolean { return this.status === 'DELIVERED'; }
  markSent(externalId: string, provider: string): void;
  markDelivered(): void;
  markFailed(error: string): void;
}
```

**Database Indexes:**

```sql
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at);
CREATE INDEX idx_notifications_status_scheduled ON notifications(status, scheduled_for);
CREATE INDEX idx_notifications_channel_status ON notifications(channel, status);
```

### 3.3 NotificationTemplate Entity

Manages message templates with variable substitution.

```typescript
export enum TemplateStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED'
}

@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  code: string;  // e.g., 'OTP_SMS', 'POLICY_ISSUED_WHATSAPP'

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationType })
  notificationType: NotificationType;

  @Column({ type: 'enum', enum: TemplateStatus, default: 'DRAFT' })
  status: TemplateStatus;

  @Column({ length: 255, nullable: true })
  subject: string;

  @Column({ type: 'text' })
  body: string;  // With {{variable}} placeholders

  @Column({ type: 'jsonb', default: [] })
  requiredVariables: string[];

  // WhatsApp specific
  @Column({ length: 100, nullable: true })
  whatsappTemplateName: string;

  @Column({ length: 100, nullable: true })
  whatsappNamespace: string;

  // Metadata
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ length: 10, default: 'en' })
  locale: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  render(variables: Record<string, string>): string;
  renderSubject(variables: Record<string, string>): string;
  validateVariables(variables: Record<string, string>): boolean;
  isActive(): boolean;
}
```

**Default Templates:**

| Code | Channel | Type | Description |
|------|---------|------|-------------|
| OTP_SMS | SMS | OTP | OTP verification code |
| OTP_WHATSAPP | WHATSAPP | OTP | OTP via WhatsApp |
| WELCOME_SMS | SMS | WELCOME | Registration welcome |
| PAYMENT_REMINDER_SMS | SMS | PAYMENT_REMINDER | Daily payment reminder |
| PAYMENT_RECEIVED_SMS | SMS | PAYMENT_RECEIVED | Payment confirmation |
| POLICY_ISSUED_SMS | SMS | POLICY_ISSUED | Policy issuance |
| POLICY_ISSUED_WHATSAPP | WHATSAPP | POLICY_ISSUED | Policy with document |
| POLICY_EXPIRING_SMS | SMS | POLICY_EXPIRING | Expiry warning |
| POLICY_EXPIRED_SMS | SMS | POLICY_EXPIRED | Policy expired |

### 3.4 NotificationPreference Entity

User-specific notification settings.

```typescript
@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  // Channel preferences per notification type
  @Column({ type: 'enum', enum: NotificationChannel, default: 'SMS' })
  otpChannel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationChannel, default: 'WHATSAPP' })
  policyChannel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationChannel, default: 'WHATSAPP' })
  paymentChannel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationChannel, default: 'SMS' })
  reminderChannel: NotificationChannel;

  // Feature toggles
  @Column({ default: true })
  paymentRemindersEnabled: boolean;

  @Column({ default: true })
  expiryRemindersEnabled: boolean;

  @Column({ default: false })
  promotionsEnabled: boolean;

  // Timing preferences (in EAT timezone)
  @Column({ type: 'int', nullable: true })
  reminderHour: number;  // 0-23

  @Column({ type: 'int', default: 7 })
  expiryReminderDays: number;

  @Column({ type: 'int', default: 21 })
  quietHoursStart: number;  // 21:00 EAT

  @Column({ type: 'int', default: 7 })
  quietHoursEnd: number;    // 07:00 EAT

  // Alternate contact
  @Column({ length: 15, nullable: true })
  whatsappNumber: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 10, default: 'en' })
  locale: string;

  // Unsubscribe flags
  @Column({ default: false })
  smsUnsubscribed: boolean;

  @Column({ default: false })
  whatsappUnsubscribed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getChannelForType(type: NotificationType): NotificationChannel;
  isEnabledForType(type: NotificationType): boolean;
  isQuietHours(currentTime?: Date): boolean;
  isUnsubscribed(channel: NotificationChannel): boolean;
}
```

---

## 4. Service Layer

### 4.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               NotificationService                        │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  Core orchestration: send(), sendOtp(), sendPolicy()    │   │
│  │  Preference management: getPreferences(), update()      │   │
│  │  Batch processing: processScheduled(), retryFailed()    │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│        ┌──────────────────┼──────────────────┐                 │
│        │                  │                  │                 │
│        ▼                  ▼                  ▼                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│  │SmsOrchestrator│ │WhatsAppService│ │  EmailService │        │
│  │   Service     │ │               │ │               │        │
│  └───────┬───────┘ └───────────────┘ └───────────────┘        │
│          │                                                      │
│   ┌──────┴──────┐                                              │
│   │             │                                              │
│   ▼             ▼                                              │
│  ┌─────────┐  ┌─────────┐                                      │
│  │Africa's │  │Advanta  │                                      │
│  │Talking  │  │SMS      │                                      │
│  └─────────┘  └─────────┘                                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               ReminderService                            │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  Payment reminders, expiry alerts, scheduled reminders  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 NotificationService

The core orchestration service for all notifications.

```typescript
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(NotificationPreference)
    private preferenceRepo: Repository<NotificationPreference>,
    private smsOrchestrator: SmsOrchestratorService,
    private whatsappService: WhatsAppService,
    private emailService: EmailService
  ) {}

  // Core sending
  async send(request: SendNotificationRequest): Promise<SendNotificationResult>;
  async sendOtp(userId: string, phone: string, code: string): Promise<SendNotificationResult>;
  async sendPaymentReceived(userId: string, amount: number, receipt: string): Promise<SendNotificationResult>;
  async sendPolicyIssued(userId: string, policyNumber: string, pdfUrl?: string): Promise<SendNotificationResult>;
  async sendPolicyExpiring(userId: string, policyNumber: string, daysLeft: number): Promise<SendNotificationResult>;
  async sendPaymentReminder(userId: string, amount: number, daysOverdue: number): Promise<SendNotificationResult>;

  // Batch processing
  async processScheduledNotifications(): Promise<number>;
  async retryFailedNotifications(): Promise<number>;

  // User preferences
  async getOrCreatePreferences(userId: string): Promise<NotificationPreference>;
  async updatePreferences(userId: string, updates: UpdatePreferencesDto): Promise<NotificationPreference>;

  // History & stats
  async getUserNotifications(userId: string, query: NotificationQueryDto): Promise<PaginatedResult<Notification>>;
  async getStats(userId?: string): Promise<NotificationStats>;

  // Template management
  async getTemplate(channel: NotificationChannel, type: NotificationType): Promise<NotificationTemplate>;

  // Internal helpers
  private getNextMorning(quietHoursEnd: number): Date;
  private createSkippedResult(reason: string): SendNotificationResult;
}
```

**Notification Flow:**

```typescript
async send(request: SendNotificationRequest): Promise<SendNotificationResult> {
  // 1. Load user preferences
  const preferences = await this.getOrCreatePreferences(request.userId);

  // 2. Check if enabled for this type
  if (!preferences.isEnabledForType(request.type)) {
    return this.createSkippedResult('Notification type disabled');
  }

  // 3. Check if unsubscribed from channel
  const channel = preferences.getChannelForType(request.type);
  if (preferences.isUnsubscribed(channel)) {
    return this.createSkippedResult('User unsubscribed from channel');
  }

  // 4. Load template
  const template = await this.getTemplate(channel, request.type);
  if (!template.validateVariables(request.variables)) {
    throw new BadRequestException('Missing required template variables');
  }

  // 5. Render content
  const content = template.render(request.variables);
  const subject = template.renderSubject?.(request.variables);

  // 6. Create notification record
  const notification = await this.notificationRepo.save({
    userId: request.userId,
    channel,
    notificationType: request.type,
    status: NotificationStatus.QUEUED,
    priority: request.priority ?? NotificationPriority.NORMAL,
    recipient: request.recipient,
    subject,
    content,
    templateId: template.id,
    templateVariables: request.variables
  });

  // 7. Check quiet hours (except URGENT)
  if (request.priority !== NotificationPriority.URGENT) {
    if (preferences.isQuietHours()) {
      notification.scheduledFor = this.getNextMorning(preferences.quietHoursEnd);
      notification.status = NotificationStatus.PENDING;
      await this.notificationRepo.save(notification);
      return { success: true, scheduled: true, scheduledFor: notification.scheduledFor };
    }
  }

  // 8. Send via appropriate channel
  const result = await this.dispatchToChannel(channel, notification);

  // 9. Update status
  if (result.success) {
    notification.markSent(result.externalId, result.provider);
  } else {
    notification.markFailed(result.error);
  }
  await this.notificationRepo.save(notification);

  return result;
}
```

### 4.3 SmsOrchestratorService

Manages SMS provider failover and health.

```typescript
@Injectable()
export class SmsOrchestratorService {
  private providerHealth: Map<string, { healthy: boolean; lastCheck: Date }> = new Map();
  private readonly HEALTH_CACHE_TTL = 60000; // 1 minute

  constructor(
    @Inject(PRIMARY_SMS_PROVIDER)
    private primaryProvider: ISmsProvider,
    @Inject(FALLBACK_SMS_PROVIDER)
    private fallbackProvider: ISmsProvider,
    private configService: ConfigService
  ) {}

  // Smart routing with failover
  async send(request: ISendSmsRequest): Promise<ISendSmsResponse>;
  async sendBulk(request: IBulkSmsRequest): Promise<IBulkSmsResponse>;

  // Health management
  async getAllBalances(): Promise<Record<string, IProviderBalance>>;
  async getHealthStatus(): Promise<Record<string, boolean>>;

  // Provider selection
  private async getHealthyProvider(): Promise<ISmsProvider>;
  private isRetryableError(error: string): boolean;
  private async delay(ms: number): Promise<void>;
}
```

**Failover Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                   SMS FAILOVER LOGIC                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Check Primary Provider Health                              │
│     │                                                          │
│     ├─ Healthy? → Try Primary (Africa's Talking)              │
│     │              │                                           │
│     │              ├─ Success → Return result                  │
│     │              │                                           │
│     │              └─ Failed → Retry with backoff (1s,2s,4s)  │
│     │                          │                               │
│     │                          ├─ Success → Return result      │
│     │                          │                               │
│     │                          └─ Failed → Mark unhealthy     │
│     │                                       │                  │
│     │                                       ▼                  │
│     │                              Try Fallback Provider       │
│     │                                                          │
│     └─ Unhealthy? → Try Fallback (Advantasms)                 │
│                      │                                         │
│                      ├─ Success → Return result                │
│                      │                                         │
│                      └─ Failed → Return error                  │
│                                                                 │
│  Retry Backoff: 1000ms → 2000ms → 4000ms                       │
│  Max Retries: 3 (configurable)                                 │
│  Health Cache TTL: 60 seconds                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 WhatsAppService

Meta WhatsApp Business API integration.

```typescript
@Injectable()
export class WhatsAppService {
  private readonly apiVersion: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService, private httpService: HttpService) {
    this.apiVersion = configService.get('WHATSAPP_API_VERSION', 'v18.0');
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  // Generic sending
  async send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult>;
  async sendText(to: string, text: string): Promise<WhatsAppSendResult>;
  async sendTemplate(to: string, templateName: string, variables: string[]): Promise<WhatsAppSendResult>;
  async sendDocument(to: string, documentUrl: string, caption?: string): Promise<WhatsAppSendResult>;

  // BodaInsure-specific
  async sendWelcomeMessage(phone: string, name: string): Promise<WhatsAppSendResult>;
  async sendPaymentConfirmation(phone: string, amount: number, receipt: string): Promise<WhatsAppSendResult>;
  async sendPolicyCertificate(phone: string, policyNumber: string, pdfUrl: string): Promise<WhatsAppSendResult>;
  async sendPaymentReminder(phone: string, amount: number, daysOverdue: number): Promise<WhatsAppSendResult>;
  async sendPolicyExpiryWarning(phone: string, policyNumber: string, daysLeft: number): Promise<WhatsAppSendResult>;

  // Utilities
  formatPhoneNumber(phone: string): string;  // Output: 254XXXXXXXXX
  async markAsRead(messageId: string): Promise<void>;
  async getTemplates(): Promise<WhatsAppTemplate[]>;
  async validateCredentials(): Promise<boolean>;
}
```

### 4.5 EmailService

SMTP email with HTML templates.

```typescript
@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Development: MailHog (localhost:1025)
    // Production: SMTP with auth
  }

  // Generic sending
  async send(options: EmailOptions): Promise<EmailSendResult>;
  async sendEmail(to: string, template: string, variables: Record<string, string>): Promise<EmailSendResult>;

  // BodaInsure-specific
  async sendWelcomeEmail(to: string, name: string): Promise<EmailSendResult>;
  async sendPaymentConfirmation(to: string, amount: number, receipt: string): Promise<EmailSendResult>;
  async sendPolicyCertificate(to: string, policyNumber: string, pdfAttachment: Buffer): Promise<EmailSendResult>;
  async sendPaymentReminder(to: string, amount: number, daysOverdue: number): Promise<EmailSendResult>;
  async sendPolicyExpiryWarning(to: string, policyNumber: string, daysLeft: number): Promise<EmailSendResult>;
  async sendDataExport(to: string, exportUrl: string): Promise<EmailSendResult>;  // GDPR
  async sendOrganizationReport(to: string, reportData: any): Promise<EmailSendResult>;
}
```

### 4.6 ReminderService

Scheduled payment and policy reminders.

```typescript
@Injectable()
export class ReminderService {
  // Scheduled reminder processing
  async processPaymentReminders(): Promise<number>;
  async processPolicyExpiryReminders(): Promise<number>;

  // Immediate reminders
  async sendImmediatePaymentReminder(userId: string): Promise<SendNotificationResult>;
  async sendMissedPaymentAlert(userId: string, missedDays: number): Promise<SendNotificationResult>;
  async sendGracePeriodWarning(userId: string, daysRemaining: number): Promise<SendNotificationResult>;

  // Scheduling
  async scheduleReminder(userId: string, type: NotificationType, scheduledFor: Date): Promise<Notification>;
  async cancelScheduledReminder(notificationId: string): Promise<void>;

  // Analytics
  async getUserReminderStats(userId: string): Promise<ReminderStats>;
  async getNextReminderTime(userId: string): Promise<Date>;
}
```

---

## 5. SMS Providers

### 5.1 Provider Interface

```typescript
interface ISmsProvider {
  readonly name: string;

  send(request: ISendSmsRequest): Promise<ISendSmsResponse>;
  sendBulk(request: IBulkSmsRequest): Promise<IBulkSmsResponse>;
  getDeliveryReport(messageId: string): Promise<IDeliveryReport | null>;
  getBalance(): Promise<IProviderBalance | null>;
  validateCredentials(): Promise<boolean>;
  isHealthy(): Promise<boolean>;
}

interface ISendSmsRequest {
  to: string;           // Phone number
  message: string;      // Message content
  senderId?: string;    // Sender ID override
  scheduleTime?: Date;  // Future delivery
  clientId?: string;    // Your reference
}

interface ISendSmsResponse {
  success: boolean;
  messageId?: string;
  provider: string;
  cost?: number;        // In cents
  error?: string;
}
```

### 5.2 Africa's Talking Provider

```
┌─────────────────────────────────────────────────────────────────┐
│                 AFRICA'S TALKING PROVIDER                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Configuration:                                                │
│  ├── AT_API_KEY: API key                                       │
│  ├── AT_USERNAME: sandbox | production account                 │
│  └── AT_SENDER_ID: BodaInsure (default)                       │
│                                                                 │
│  Endpoints:                                                    │
│  ├── Sandbox: https://api.sandbox.africastalking.com          │
│  └── Production: https://api.africastalking.com               │
│                                                                 │
│  Phone Format: +254XXXXXXXXX                                   │
│                                                                 │
│  Response Codes:                                               │
│  ├── 101: Success                                              │
│  ├── 102: Invalid phone                                        │
│  └── Other: Various failures                                   │
│                                                                 │
│  Cost Format: "KES 0.8000" → parsed to 80 cents               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Advantasms Provider

```
┌─────────────────────────────────────────────────────────────────┐
│                   ADVANTASMS PROVIDER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Configuration:                                                │
│  ├── ADVANTASMS_API_KEY: API key                               │
│  ├── ADVANTASMS_PARTNER_ID: Partner identifier                 │
│  ├── ADVANTASMS_SENDER_ID: BodaInsure (default)               │
│  └── ADVANTASMS_BASE_URL: API base URL                         │
│                                                                 │
│  Endpoints:                                                    │
│  ├── Single: POST /sendsms/                                    │
│  ├── Bulk: POST /sendbulk/ (max 20 per request)               │
│  ├── Balance: GET /getbalance/                                 │
│  └── DLR: GET /getdlr/                                         │
│                                                                 │
│  Phone Format: 254XXXXXXXXX (no + prefix)                      │
│                                                                 │
│  Response Codes:                                               │
│  ├── 200: Success                                              │
│  ├── 1001-4093: Various errors                                 │
│  └── Note: API returns "respose-code" (typo handled)          │
│                                                                 │
│  Delivery Statuses:                                            │
│  ├── DELIVRD → Delivered                                       │
│  ├── SENT → Sent                                               │
│  └── FAILED/REJECTED/EXPIRED → Failed                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. API Endpoints

### 6.1 User Notification Endpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                  NOTIFICATION ENDPOINTS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/v1/notifications/preferences                          │
│  ├── Auth: JWT Required                                        │
│  ├── Response: NotificationPreference                          │
│  └── Purpose: Get user's notification settings                 │
│                                                                 │
│  PUT /api/v1/notifications/preferences                          │
│  ├── Auth: JWT Required                                        │
│  ├── Body: UpdatePreferencesDto                                │
│  ├── Response: NotificationPreference                          │
│  └── Purpose: Update notification settings                     │
│                                                                 │
│  GET /api/v1/notifications/history                              │
│  ├── Auth: JWT Required                                        │
│  ├── Query: page, limit, types[], channels[], statuses[]       │
│  ├── Response: { notifications[], pagination }                 │
│  └── Purpose: Get notification history                         │
│                                                                 │
│  GET /api/v1/notifications/stats                                │
│  ├── Auth: JWT Required                                        │
│  ├── Response: NotificationStats                               │
│  └── Purpose: Get delivery statistics                          │
│                                                                 │
│  POST /api/v1/notifications/unsubscribe/sms                     │
│  ├── Auth: JWT Required                                        │
│  └── Purpose: Opt out of SMS notifications                     │
│                                                                 │
│  POST /api/v1/notifications/unsubscribe/whatsapp                │
│  ├── Auth: JWT Required                                        │
│  └── Purpose: Opt out of WhatsApp notifications                │
│                                                                 │
│  POST /api/v1/notifications/resubscribe                         │
│  ├── Auth: JWT Required                                        │
│  └── Purpose: Re-enable all channels                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Webhook Endpoints (No Auth)

```
┌─────────────────────────────────────────────────────────────────┐
│                   WEBHOOK ENDPOINTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/notifications/webhooks/sms/delivery               │
│  ├── Body: { id, status, phoneNumber, failureReason? }         │
│  └── Purpose: Africa's Talking delivery callback               │
│                                                                 │
│  POST /api/v1/notifications/webhooks/whatsapp                   │
│  ├── Body: Meta webhook payload                                │
│  └── Purpose: WhatsApp status updates                          │
│                                                                 │
│  GET /api/v1/notifications/webhooks/whatsapp                    │
│  ├── Query: hub.mode, hub.verify_token, hub.challenge          │
│  └── Purpose: WhatsApp webhook verification                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Notification Flow

### 7.1 Complete Send Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│ Calling │     │Notification │     │   Channel   │     │Provider │
│ Module  │     │  Service    │     │  Service    │     │   API   │
└────┬────┘     └──────┬──────┘     └──────┬──────┘     └────┬────┘
     │                 │                   │                 │
     │ send(request)   │                   │                 │
     │────────────────>│                   │                 │
     │                 │                   │                 │
     │                 │ Load preferences  │                 │
     │                 │──────┐            │                 │
     │                 │      │            │                 │
     │                 │<─────┘            │                 │
     │                 │                   │                 │
     │                 │ Check enabled?    │                 │
     │                 │ Check unsubscribed?                 │
     │                 │                   │                 │
     │                 │ Load template     │                 │
     │                 │──────┐            │                 │
     │                 │      │            │                 │
     │                 │<─────┘            │                 │
     │                 │                   │                 │
     │                 │ Render content    │                 │
     │                 │──────┐            │                 │
     │                 │      │            │                 │
     │                 │<─────┘            │                 │
     │                 │                   │                 │
     │                 │ Create Notification record          │
     │                 │──────┐            │                 │
     │                 │      │            │                 │
     │                 │<─────┘            │                 │
     │                 │                   │                 │
     │                 │ Check quiet hours │                 │
     │                 │ (if not URGENT)   │                 │
     │                 │                   │                 │
     │                 │ dispatch()        │                 │
     │                 │──────────────────>│                 │
     │                 │                   │                 │
     │                 │                   │ API call        │
     │                 │                   │────────────────>│
     │                 │                   │                 │
     │                 │                   │<────────────────│
     │                 │                   │  { messageId }  │
     │                 │<──────────────────│                 │
     │                 │                   │                 │
     │                 │ Update status     │                 │
     │                 │ (SENT/FAILED)     │                 │
     │                 │                   │                 │
     │<────────────────│                   │                 │
     │ SendResult      │                   │                 │
     │                 │                   │                 │
```

### 7.2 Status Flow

```
                    ┌───────────────┐
                    │    PENDING    │
                    │ (created/     │
                    │  scheduled)   │
                    └───────┬───────┘
                            │
                            │ Picked up for sending
                            ▼
                    ┌───────────────┐
                    │    QUEUED     │
                    │ (in queue)    │
                    └───────┬───────┘
                            │
           ┌────────────────┴────────────────┐
           │                                 │
           ▼                                 ▼
   ┌───────────────┐                 ┌───────────────┐
   │     SENT      │                 │    FAILED     │
   │ (API accepted)│                 │ (API rejected)│
   └───────┬───────┘                 └───────┬───────┘
           │                                 │
           │ Delivery callback               │ retryCount < maxRetries?
           ▼                                 │
   ┌───────────────┐                 ┌───────┴───────┐
   │   DELIVERED   │                 │               │
   │ (confirmed)   │                 ▼               ▼
   └───────────────┘          ┌──────────┐   ┌──────────┐
                              │  QUEUED  │   │ EXPIRED  │
                              │ (retry)  │   │(max retry)│
                              └──────────┘   └──────────┘
```

---

## 8. Quiet Hours Handling

### 8.1 EAT Timezone Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUIET HOURS (EAT)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Default: 21:00 - 07:00 EAT (East Africa Time, UTC+3)          │
│                                                                 │
│  Timeline (EAT):                                               │
│  ──────────────────────────────────────────────────────────    │
│  |  07:00  |        SEND OK        |  21:00  | DEFER |         │
│  |  Start  |                       |  End    | Until |         │
│  |         |                       |         | 07:00 |         │
│  ──────────────────────────────────────────────────────────    │
│                                                                 │
│  Exceptions:                                                   │
│  • URGENT priority messages bypass quiet hours                 │
│  • OTP messages always sent immediately                        │
│                                                                 │
│  Scheduling:                                                   │
│  • Messages during quiet hours → scheduledFor = next 07:00 EAT │
│  • Status set to PENDING until scheduled time                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Implementation

```typescript
// In NotificationPreference entity
isQuietHours(currentTime?: Date): boolean {
  const now = currentTime ?? new Date();

  // Convert to EAT (UTC+3)
  const eatOffset = 3 * 60; // minutes
  const eatMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + eatOffset;
  const eatHour = Math.floor((eatMinutes % (24 * 60)) / 60);

  // Handle midnight-spanning quiet hours (e.g., 21:00-07:00)
  if (this.quietHoursStart > this.quietHoursEnd) {
    // Quiet hours span midnight
    return eatHour >= this.quietHoursStart || eatHour < this.quietHoursEnd;
  } else {
    // Quiet hours within same day
    return eatHour >= this.quietHoursStart && eatHour < this.quietHoursEnd;
  }
}
```

---

## 9. Configuration

### 9.1 Environment Variables

```bash
# SMS Providers
AT_API_KEY=your_api_key
AT_USERNAME=sandbox|production
AT_SENDER_ID=BodaInsure
AT_ENABLED=true

ADVANTASMS_API_KEY=your_api_key
ADVANTASMS_PARTNER_ID=partner_id
ADVANTASMS_SENDER_ID=BodaInsure
ADVANTASMS_BASE_URL=https://quicksms.advantasms.com/api/services
ADVANTASMS_ENABLED=true

# SMS Orchestration
SMS_PRIMARY_PROVIDER=africastalking
SMS_FALLBACK_PROVIDER=advantasms
SMS_MAX_RETRIES=3
SMS_RETRY_DELAY_MS=1000
SMS_ENABLED=true

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=business_account_id
WHATSAPP_API_VERSION=v18.0
WHATSAPP_ENABLED=true
WHATSAPP_VERIFY_TOKEN=bodainsure-verify

# Email (SMTP)
EMAIL_ENABLED=true
EMAIL_FROM=BodaInsure <noreply@bodainsure.co.ke>
EMAIL_REPLY_TO=support@bodainsure.co.ke
SMTP_HOST=localhost  # MailHog in dev
SMTP_PORT=1025       # 587 in production
SMTP_USER=username
SMTP_PASS=password
SMTP_SECURE=false    # true in production
```

### 9.2 Default Preferences

```typescript
const DEFAULT_PREFERENCES = {
  otpChannel: NotificationChannel.SMS,
  policyChannel: NotificationChannel.WHATSAPP,
  paymentChannel: NotificationChannel.WHATSAPP,
  reminderChannel: NotificationChannel.SMS,
  paymentRemindersEnabled: true,
  expiryRemindersEnabled: true,
  promotionsEnabled: false,
  expiryReminderDays: 7,
  quietHoursStart: 21,
  quietHoursEnd: 7,
  locale: 'en'
};
```

---

## 10. Integration Points

### 10.1 Module Consumers

```
Notification Module
    │
    ◄──── Identity Module
    │     └── sendOtp() for phone verification
    │
    ◄──── Payment Module
    │     ├── sendPaymentReceived() on successful payment
    │     └── sendPaymentReminder() for overdue payments
    │
    ◄──── Policy Module
    │     ├── sendPolicyIssued() with PDF document
    │     ├── sendPolicyExpiring() before expiry
    │     └── sendPolicyExpired() after expiry
    │
    ◄──── Queue Module
    │     └── Async notification processing jobs
    │
    ◄──── Scheduler Module
          ├── processScheduledNotifications() (batch)
          ├── retryFailedNotifications() (batch)
          └── processPolicyExpiryReminders()
```

### 10.2 External Integrations

| System | Purpose | Protocol |
|--------|---------|----------|
| Africa's Talking | SMS delivery | REST API |
| Advantasms | SMS delivery (fallback) | REST API |
| Meta WhatsApp API | WhatsApp messaging | Graph API |
| SMTP Server | Email delivery | SMTP |
| MailHog | Development email | SMTP |

---

## 11. Error Handling

### 11.1 Retry Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    RETRY STRATEGY                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Retryable Errors:                                             │
│  • Network timeout                                             │
│  • Provider temporary failure                                  │
│  • Rate limiting                                               │
│                                                                 │
│  Non-Retryable Errors:                                         │
│  • Invalid phone number                                        │
│  • Blacklisted number                                          │
│  • Invalid credentials                                         │
│  • Message content rejected                                    │
│                                                                 │
│  Backoff Schedule:                                             │
│  Attempt 1: Immediate                                          │
│  Attempt 2: 1000ms delay                                       │
│  Attempt 3: 2000ms delay                                       │
│  Attempt 4: 4000ms delay (final)                               │
│                                                                 │
│  After max retries:                                            │
│  • Status → EXPIRED                                            │
│  • Error message logged                                        │
│  • Admin alert (if critical)                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_ERROR",
    "message": "SMS delivery failed",
    "provider": "africastalking",
    "retryable": true,
    "details": {
      "providerCode": "102",
      "providerMessage": "Invalid phone number format"
    }
  }
}
```

---

## 12. Testing

### 12.1 Development Mode

- `SMS_ENABLED=false`: Mock SMS responses
- `WHATSAPP_ENABLED=false`: Mock WhatsApp responses
- `EMAIL_ENABLED=false`: Mock email responses
- MailHog: Capture all emails at `http://localhost:8025`

### 12.2 Critical Test Scenarios

- [ ] OTP delivery within 30 seconds
- [ ] Provider failover when primary fails
- [ ] Quiet hours scheduling
- [ ] Template variable substitution
- [ ] User preference enforcement
- [ ] Unsubscribe/resubscribe flow
- [ ] Delivery status webhook processing
- [ ] Bulk SMS with chunking
- [ ] Retry with exponential backoff
- [ ] WhatsApp document delivery

---

## 13. Appendix

### 13.1 Notification Type to Channel Mapping

| Type | Default Channel | Priority |
|------|-----------------|----------|
| OTP | SMS | URGENT |
| WELCOME | SMS | NORMAL |
| PAYMENT_REMINDER | SMS | HIGH |
| PAYMENT_RECEIVED | WHATSAPP | NORMAL |
| PAYMENT_FAILED | SMS | HIGH |
| POLICY_ISSUED | WHATSAPP | HIGH |
| POLICY_EXPIRING | SMS | HIGH |
| POLICY_EXPIRED | SMS | URGENT |
| POLICY_DOCUMENT | WHATSAPP | NORMAL |
| ACCOUNT_UPDATE | SMS | NORMAL |
| SUPPORT | EMAIL | NORMAL |

### 13.2 Phone Number Formats

| Provider | Input | Output |
|----------|-------|--------|
| Africa's Talking | 0712345678 | +254712345678 |
| Advantasms | 0712345678 | 254712345678 |
| WhatsApp | 0712345678 | 254712345678 |

### 13.3 Cost Tracking

| Provider | Cost Format | Example |
|----------|-------------|---------|
| Africa's Talking | "KES X.XXXX" | "KES 0.8000" → 80 cents |
| Advantasms | Numeric | 0.75 → 75 cents |
