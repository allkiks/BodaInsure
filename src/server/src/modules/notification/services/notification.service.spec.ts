import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service.js';
import { SmsService } from './sms.service.js';
import { WhatsAppService } from './whatsapp.service.js';
import {
  Notification,
  NotificationChannel,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
} from '../entities/notification.entity.js';
import { NotificationTemplate, TemplateStatus } from '../entities/notification-template.entity.js';
import { NotificationPreference } from '../entities/notification-preference.entity.js';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepository: jest.Mocked<Repository<Notification>>;
  let templateRepository: jest.Mocked<Repository<NotificationTemplate>>;
  let preferenceRepository: jest.Mocked<Repository<NotificationPreference>>;
  let smsService: jest.Mocked<SmsService>;
  let whatsAppService: jest.Mocked<WhatsAppService>;

  const mockNotificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockTemplateRepository = {
    findOne: jest.fn(),
  };

  const mockPreferenceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSmsService = {
    send: jest.fn(),
  };

  const mockWhatsAppService = {
    sendText: jest.fn(),
    sendDocument: jest.fn(),
  };

  const mockPreference: Partial<NotificationPreference> = {
    userId: 'user-uuid-123',
    otpChannel: NotificationChannel.SMS,
    policyChannel: NotificationChannel.WHATSAPP,
    paymentChannel: NotificationChannel.WHATSAPP,
    reminderChannel: NotificationChannel.SMS,
    paymentRemindersEnabled: true,
    expiryRemindersEnabled: true,
    quietHoursStart: 21,
    quietHoursEnd: 7,
    getChannelForType: jest.fn((type) => {
      if (type === NotificationType.OTP) return NotificationChannel.SMS;
      return NotificationChannel.WHATSAPP;
    }),
    isEnabledForType: jest.fn(() => true),
    isUnsubscribed: jest.fn(() => false),
    isQuietHours: jest.fn(() => false),
  };

  const mockTemplate: Partial<NotificationTemplate> = {
    id: 'template-uuid-123',
    code: 'OTP_SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.OTP,
    status: TemplateStatus.ACTIVE,
    body: 'Your code is {{otp}}',
    requiredVariables: ['otp'],
    render: jest.fn((vars) => `Your code is ${vars.otp}`),
    renderSubject: jest.fn(() => undefined),
    validateVariables: jest.fn(() => []),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(NotificationTemplate),
          useValue: mockTemplateRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockPreferenceRepository,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepository = module.get(getRepositoryToken(Notification));
    templateRepository = module.get(getRepositoryToken(NotificationTemplate));
    preferenceRepository = module.get(getRepositoryToken(NotificationPreference));
    smsService = module.get(SmsService);
    whatsAppService = module.get(WhatsAppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send SMS notification successfully', async () => {
      const mockNotification = {
        id: 'notif-uuid-123',
        channel: NotificationChannel.SMS,
        status: NotificationStatus.PENDING,
        markSent: jest.fn(),
        markFailed: jest.fn(),
      };

      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);
      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate as NotificationTemplate);
      mockNotificationRepository.create.mockReturnValue(mockNotification as unknown as Notification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification as unknown as Notification);
      mockSmsService.send.mockResolvedValue({
        success: true,
        messageId: 'sms-123',
        status: 'Success',
      });

      const result = await service.send({
        userId: 'user-uuid-123',
        phone: '+254712345678',
        type: NotificationType.OTP,
        variables: { otp: '123456' },
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.SMS);
      expect(mockSmsService.send).toHaveBeenCalled();
    });

    it('should send WhatsApp notification successfully', async () => {
      const whatsappTemplate = {
        ...mockTemplate,
        channel: NotificationChannel.WHATSAPP,
        notificationType: NotificationType.PAYMENT_RECEIVED,
      };

      const mockNotification = {
        id: 'notif-uuid-123',
        channel: NotificationChannel.WHATSAPP,
        recipient: '+254712345678',
        content: 'Payment received',
        notificationType: NotificationType.PAYMENT_RECEIVED,
        status: NotificationStatus.PENDING,
        markSent: jest.fn(),
        markFailed: jest.fn(),
      };

      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);
      mockTemplateRepository.findOne.mockResolvedValue(whatsappTemplate as NotificationTemplate);
      mockNotificationRepository.create.mockReturnValue(mockNotification as unknown as Notification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification as unknown as Notification);
      mockWhatsAppService.sendText.mockResolvedValue({
        success: true,
        messageId: 'wa-123',
        status: 'Sent',
      });

      const result = await service.send({
        userId: 'user-uuid-123',
        phone: '+254712345678',
        type: NotificationType.PAYMENT_RECEIVED,
        variables: { amount: '100', reference: 'REF123', balance: '500' },
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.WHATSAPP);
    });

    it('should skip notification when user disabled it', async () => {
      const disabledPreference = {
        ...mockPreference,
        isEnabledForType: jest.fn(() => false),
      };

      mockPreferenceRepository.findOne.mockResolvedValue(disabledPreference as unknown as NotificationPreference);

      const result = await service.send({
        userId: 'user-uuid-123',
        phone: '+254712345678',
        type: NotificationType.PAYMENT_REMINDER,
        variables: { name: 'John', amount: 87, daysRemaining: 15 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Disabled');
      expect(mockSmsService.send).not.toHaveBeenCalled();
    });

    it('should skip notification when user unsubscribed from channel', async () => {
      const unsubscribedPreference = {
        ...mockPreference,
        isUnsubscribed: jest.fn(() => true),
      };

      mockPreferenceRepository.findOne.mockResolvedValue(unsubscribedPreference as unknown as NotificationPreference);

      const result = await service.send({
        userId: 'user-uuid-123',
        phone: '+254712345678',
        type: NotificationType.OTP,
        variables: { otp: '123456' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsubscribed');
    });

    it('should handle missing template', async () => {
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);
      mockTemplateRepository.findOne.mockResolvedValue(null);

      const result = await service.send({
        userId: 'user-uuid-123',
        phone: '+254712345678',
        type: NotificationType.OTP,
        variables: { otp: '123456' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No template');
    });

    it('should handle missing required variables', async () => {
      const templateWithMissing = {
        ...mockTemplate,
        validateVariables: jest.fn(() => ['otp']),
      };

      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);
      mockTemplateRepository.findOne.mockResolvedValue(templateWithMissing as NotificationTemplate);

      const result = await service.send({
        userId: 'user-uuid-123',
        phone: '+254712345678',
        type: NotificationType.OTP,
        variables: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing variables');
    });

    it('should schedule notification for future delivery', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      const mockNotification = {
        id: 'notif-uuid-123',
        channel: NotificationChannel.SMS,
        status: NotificationStatus.PENDING,
        scheduledFor: futureDate,
      };

      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);
      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate as NotificationTemplate);
      mockNotificationRepository.create.mockReturnValue(mockNotification as unknown as Notification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification as unknown as Notification);

      const result = await service.send({
        userId: 'user-uuid-123',
        phone: '+254712345678',
        type: NotificationType.OTP,
        variables: { otp: '123456' },
        scheduledFor: futureDate,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(NotificationStatus.PENDING);
      expect(mockSmsService.send).not.toHaveBeenCalled();
    });
  });

  describe('sendOtp', () => {
    it('should send OTP with urgent priority', async () => {
      const mockNotification = {
        id: 'notif-uuid-123',
        channel: NotificationChannel.SMS,
        status: NotificationStatus.SENT,
        markSent: jest.fn(),
      };

      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);
      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate as NotificationTemplate);
      mockNotificationRepository.create.mockReturnValue(mockNotification as unknown as Notification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification as unknown as Notification);
      mockSmsService.send.mockResolvedValue({
        success: true,
        messageId: 'sms-123',
        status: 'Success',
      });

      const result = await service.sendOtp('user-uuid-123', '+254712345678', '123456');

      expect(result.success).toBe(true);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: NotificationPriority.URGENT,
        }),
      );
    });
  });

  describe('getOrCreatePreferences', () => {
    it('should return existing preferences', async () => {
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);

      const result = await service.getOrCreatePreferences('user-uuid-123');

      expect(result).toEqual(mockPreference);
      expect(mockPreferenceRepository.create).not.toHaveBeenCalled();
    });

    it('should create new preferences if not exist', async () => {
      mockPreferenceRepository.findOne.mockResolvedValue(null);
      mockPreferenceRepository.create.mockReturnValue(mockPreference as NotificationPreference);
      mockPreferenceRepository.save.mockResolvedValue(mockPreference as NotificationPreference);

      const result = await service.getOrCreatePreferences('user-uuid-123');

      expect(mockPreferenceRepository.create).toHaveBeenCalledWith({
        userId: 'user-uuid-123',
      });
      expect(mockPreferenceRepository.save).toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference as NotificationPreference);
      mockPreferenceRepository.save.mockResolvedValue({
        ...mockPreference,
        paymentRemindersEnabled: false,
      } as NotificationPreference);

      const result = await service.updatePreferences('user-uuid-123', {
        paymentRemindersEnabled: false,
      });

      expect(mockPreferenceRepository.save).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notification history', async () => {
      const mockNotifications = [
        { id: 'notif-1', notificationType: NotificationType.OTP },
        { id: 'notif-2', notificationType: NotificationType.PAYMENT_RECEIVED },
      ];

      mockNotificationRepository.findAndCount.mockResolvedValue([
        mockNotifications as Notification[],
        2,
      ]);

      const result = await service.getUserNotifications('user-uuid-123', {
        limit: 10,
        offset: 0,
      });

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by notification types', async () => {
      mockNotificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.getUserNotifications('user-uuid-123', {
        types: [NotificationType.OTP, NotificationType.PAYMENT_RECEIVED],
      });

      expect(mockNotificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            notificationType: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return notification statistics', async () => {
      const mockNotifications = [
        { status: NotificationStatus.SENT, channel: NotificationChannel.SMS, notificationType: NotificationType.OTP },
        { status: NotificationStatus.DELIVERED, channel: NotificationChannel.WHATSAPP, notificationType: NotificationType.PAYMENT_RECEIVED },
        { status: NotificationStatus.FAILED, channel: NotificationChannel.SMS, notificationType: NotificationType.OTP },
      ];

      mockNotificationRepository.find.mockResolvedValue(mockNotifications as Notification[]);

      const stats = await service.getStats('user-uuid-123');

      expect(stats.total).toBe(3);
      expect(stats.sent).toBe(1);
      expect(stats.delivered).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.byChannel[NotificationChannel.SMS]).toBe(2);
      expect(stats.byChannel[NotificationChannel.WHATSAPP]).toBe(1);
    });
  });

  describe('processScheduledNotifications', () => {
    it('should process pending scheduled notifications', async () => {
      const mockScheduledNotification = {
        id: 'notif-uuid-123',
        channel: NotificationChannel.SMS,
        recipient: '+254712345678',
        content: 'Test message',
        status: NotificationStatus.PENDING,
        markSent: jest.fn(),
      };

      mockNotificationRepository.find.mockResolvedValue([mockScheduledNotification as unknown as Notification]);
      mockNotificationRepository.save.mockResolvedValue(mockScheduledNotification as unknown as Notification);
      mockSmsService.send.mockResolvedValue({
        success: true,
        messageId: 'sms-123',
        status: 'Success',
      });

      const processed = await service.processScheduledNotifications();

      expect(processed).toBe(1);
      expect(mockSmsService.send).toHaveBeenCalled();
    });
  });

  describe('retryFailedNotifications', () => {
    it('should retry failed notifications that can be retried', async () => {
      const mockFailedNotification = {
        id: 'notif-uuid-123',
        channel: NotificationChannel.SMS,
        recipient: '+254712345678',
        content: 'Test message',
        status: NotificationStatus.FAILED,
        retryCount: 1,
        maxRetries: 3,
        canRetry: jest.fn(() => true),
        markSent: jest.fn(),
      };

      mockNotificationRepository.find.mockResolvedValue([mockFailedNotification as unknown as Notification]);
      mockNotificationRepository.save.mockResolvedValue(mockFailedNotification as unknown as Notification);
      mockSmsService.send.mockResolvedValue({
        success: true,
        messageId: 'sms-123',
        status: 'Success',
      });

      const retried = await service.retryFailedNotifications();

      expect(retried).toBe(1);
    });

    it('should skip notifications that cannot be retried', async () => {
      const mockFailedNotification = {
        id: 'notif-uuid-123',
        status: NotificationStatus.FAILED,
        retryCount: 3,
        maxRetries: 3,
        canRetry: jest.fn(() => false),
      };

      mockNotificationRepository.find.mockResolvedValue([mockFailedNotification as unknown as Notification]);

      const retried = await service.retryFailedNotifications();

      expect(retried).toBe(0);
      expect(mockSmsService.send).not.toHaveBeenCalled();
    });
  });
});
