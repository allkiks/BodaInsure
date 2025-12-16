import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { NotificationProcessor } from './notification.processor.js';
import { SmsOrchestratorService } from '../../notification/services/sms-orchestrator.service.js';
import { EmailService } from '../../notification/services/email.service.js';
import { WhatsAppService } from '../../notification/services/whatsapp.service.js';
import {
  NotificationJobType,
  SmsJobData,
  BulkSmsJobData,
  EmailJobData,
  WhatsAppJobData,
  PaymentReminderJobData,
} from '../interfaces/job.interface.js';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let smsService: jest.Mocked<SmsOrchestratorService>;
  let emailService: jest.Mocked<EmailService>;
  let whatsAppService: jest.Mocked<WhatsAppService>;

  const mockSmsService = {
    sendSms: jest.fn().mockResolvedValue({
      messageId: 'sms-123',
      success: true,
    }),
  };

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'email-123',
    }),
  };

  const mockWhatsAppService = {
    sendTemplate: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'wa-123',
      status: 'sent',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        {
          provide: SmsOrchestratorService,
          useValue: mockSmsService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    smsService = module.get(SmsOrchestratorService);
    emailService = module.get(EmailService);
    whatsAppService = module.get(WhatsAppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockJob = <T>(data: T): Job<T> =>
    ({
      id: 'job-123',
      data,
      attemptsMade: 0,
    }) as unknown as Job<T>;

  describe('SMS Processing', () => {
    it('should process SMS job successfully', async () => {
      const jobData: SmsJobData = {
        type: NotificationJobType.SEND_SMS,
        phone: '+254712345678',
        message: 'Your OTP is 123456',
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(smsService.sendSms).toHaveBeenCalledWith(
        '+254712345678',
        'Your OTP is 123456',
        undefined,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ messageId: 'sms-123' });
    });

    it('should pass preferred provider to SMS service', async () => {
      const jobData: SmsJobData = {
        type: NotificationJobType.SEND_SMS,
        phone: '+254712345678',
        message: 'Test message',
        provider: 'africastalking',
        createdAt: new Date(),
      };

      await processor.process(createMockJob(jobData));

      expect(smsService.sendSms).toHaveBeenCalledWith(
        '+254712345678',
        'Test message',
        'africastalking',
      );
    });

    it('should handle SMS failure gracefully', async () => {
      mockSmsService.sendSms.mockRejectedValueOnce(new Error('SMS gateway error'));

      const jobData: SmsJobData = {
        type: NotificationJobType.SEND_SMS,
        phone: '+254712345678',
        message: 'Test',
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS gateway error');
    });
  });

  describe('Bulk SMS Processing', () => {
    it('should process bulk SMS job', async () => {
      const jobData: BulkSmsJobData = {
        type: NotificationJobType.SEND_BULK_SMS,
        recipients: [
          { phone: '+254712345678', message: 'Hello John' },
          { phone: '+254712345679', message: 'Hello Jane' },
        ],
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(smsService.sendSms).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ sent: 2, failed: 0 });
    });

    it('should count failures in bulk SMS', async () => {
      mockSmsService.sendSms
        .mockResolvedValueOnce({ messageId: 'sms-1', success: true })
        .mockRejectedValueOnce(new Error('Failed'));

      const jobData: BulkSmsJobData = {
        type: NotificationJobType.SEND_BULK_SMS,
        recipients: [
          { phone: '+254712345678', message: 'Hello' },
          { phone: '+254712345679', message: 'Hello' },
        ],
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ sent: 1, failed: 1 });
    });
  });

  describe('Email Processing', () => {
    it('should process email job successfully', async () => {
      const jobData: EmailJobData = {
        type: NotificationJobType.SEND_EMAIL,
        to: 'john.kamau@example.com',
        subject: 'Welcome to BodaInsure',
        template: 'welcome',
        context: { name: 'John Kamau' },
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'john.kamau@example.com',
        'Welcome to BodaInsure',
        'welcome',
        { name: 'John Kamau' },
        undefined,
      );
      expect(result.success).toBe(true);
    });

    it('should include attachments when provided', async () => {
      const attachments = [
        {
          filename: 'policy.pdf',
          content: Buffer.from('PDF'),
          contentType: 'application/pdf',
        },
      ];

      const jobData: EmailJobData = {
        type: NotificationJobType.SEND_EMAIL,
        to: 'test@example.com',
        subject: 'Your Policy',
        template: 'policy_certificate',
        context: {},
        attachments,
        createdAt: new Date(),
      };

      await processor.process(createMockJob(jobData));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Your Policy',
        'policy_certificate',
        {},
        attachments,
      );
    });
  });

  describe('WhatsApp Processing', () => {
    it('should process WhatsApp job successfully', async () => {
      const jobData: WhatsAppJobData = {
        type: NotificationJobType.SEND_WHATSAPP,
        phone: '+254712345678',
        template: 'bodainsure_welcome',
        parameters: ['John Kamau'],
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        '+254712345678',
        'bodainsure_welcome',
        [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'John Kamau' }],
          },
        ],
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ messageId: 'wa-123' });
    });

    it('should handle empty parameters', async () => {
      const jobData: WhatsAppJobData = {
        type: NotificationJobType.SEND_WHATSAPP,
        phone: '+254712345678',
        template: 'simple_template',
        parameters: [],
        createdAt: new Date(),
      };

      await processor.process(createMockJob(jobData));

      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        '+254712345678',
        'simple_template',
        undefined,
      );
    });

    it('should handle multiple parameters', async () => {
      const jobData: WhatsAppJobData = {
        type: NotificationJobType.SEND_WHATSAPP,
        phone: '+254712345678',
        template: 'payment_confirmed',
        parameters: ['KES 87', 'TXN123', '29'],
        createdAt: new Date(),
      };

      await processor.process(createMockJob(jobData));

      expect(whatsAppService.sendTemplate).toHaveBeenCalledWith(
        '+254712345678',
        'payment_confirmed',
        [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'KES 87' },
              { type: 'text', text: 'TXN123' },
              { type: 'text', text: '29' },
            ],
          },
        ],
      );
    });
  });

  describe('Payment Reminder Processing', () => {
    it('should process payment reminder job', async () => {
      const jobData: PaymentReminderJobData = {
        type: NotificationJobType.SEND_PAYMENT_REMINDER,
        userIds: ['user-1', 'user-2', 'user-3'],
        reminderType: 'daily',
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ sent: 3, failed: 0 });
    });

    it('should handle different reminder types', async () => {
      const reminderTypes: Array<'daily' | 'weekly' | 'final'> = [
        'daily',
        'weekly',
        'final',
      ];

      for (const reminderType of reminderTypes) {
        const jobData: PaymentReminderJobData = {
          type: NotificationJobType.SEND_PAYMENT_REMINDER,
          userIds: ['user-1'],
          reminderType,
          createdAt: new Date(),
        };

        const result = await processor.process(createMockJob(jobData));
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown job type', async () => {
      // Intentionally invalid job data to test error handling
      const jobData = {
        type: 'unknown_type' as NotificationJobType,
        createdAt: new Date(),
      } as unknown as SmsJobData;

      const result = await processor.process(createMockJob(jobData));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown notification job type');
    });

    it('should include processing duration in result', async () => {
      const jobData: SmsJobData = {
        type: NotificationJobType.SEND_SMS,
        phone: '+254712345678',
        message: 'Test',
        createdAt: new Date(),
      };

      const result = await processor.process(createMockJob(jobData));

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.processedAt).toBeInstanceOf(Date);
    });
  });
});
