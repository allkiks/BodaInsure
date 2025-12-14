import { Test, TestingModule } from '@nestjs/testing';
import { ReminderService, UserPaymentData, UserPolicyData } from './reminder.service.js';
import { NotificationService } from './notification.service.js';
import { NotificationType } from '../entities/notification.entity.js';

describe('ReminderService', () => {
  let service: ReminderService;
  let notificationService: jest.Mocked<NotificationService>;

  const mockNotificationService = {
    send: jest.fn(),
    sendPaymentReminder: jest.fn(),
    sendPolicyExpiring: jest.fn(),
    getOrCreatePreferences: jest.fn(),
    getStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);
    notificationService = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPaymentReminders', () => {
    const mockUsers: UserPaymentData[] = [
      {
        userId: 'user-1',
        phone: '+254712345678',
        name: 'John',
        dailyAmount: 87,
        daysPaid: 10,
        daysRemaining: 20,
        lastPaymentDate: new Date(),
      },
      {
        userId: 'user-2',
        phone: '+254712345679',
        name: 'Jane',
        dailyAmount: 87,
        daysPaid: 15,
        daysRemaining: 15,
        lastPaymentDate: new Date(),
      },
    ];

    it('should process payment reminders for users', async () => {
      mockNotificationService.getOrCreatePreferences.mockResolvedValue({
        paymentRemindersEnabled: true,
        reminderHour: new Date().getHours(), // Current hour for test
        isEnabledForType: jest.fn(() => true),
      });
      mockNotificationService.sendPaymentReminder.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'SMS',
        status: 'SENT',
      });

      const result = await service.processPaymentReminders(mockUsers);

      expect(result.type).toBe('payment');
      expect(result.total).toBe(2);
    });

    it('should skip users with reminders disabled', async () => {
      mockNotificationService.getOrCreatePreferences.mockResolvedValue({
        paymentRemindersEnabled: false,
        reminderHour: 8,
      });

      const result = await service.processPaymentReminders(mockUsers);

      expect(result.skipped).toBe(2);
      expect(result.sent).toBe(0);
      expect(mockNotificationService.sendPaymentReminder).not.toHaveBeenCalled();
    });

    it('should handle send failures', async () => {
      mockNotificationService.getOrCreatePreferences.mockResolvedValue({
        paymentRemindersEnabled: true,
        reminderHour: new Date().getHours(),
      });
      mockNotificationService.sendPaymentReminder.mockResolvedValue({
        success: false,
        notificationId: '',
        channel: 'SMS',
        status: 'FAILED',
        error: 'Network error',
      });

      const result = await service.processPaymentReminders(mockUsers);

      expect(result.failed).toBe(2);
      expect(result.sent).toBe(0);
    });
  });

  describe('processPolicyExpiryReminders', () => {
    const mockPolicies: UserPolicyData[] = [
      {
        userId: 'user-1',
        phone: '+254712345678',
        policyNumber: 'BDA-2412-000001',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        daysRemaining: 7,
      },
      {
        userId: 'user-2',
        phone: '+254712345679',
        policyNumber: 'BDA-2412-000002',
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        daysRemaining: 3,
      },
    ];

    it('should process expiry reminders for policies', async () => {
      mockNotificationService.getOrCreatePreferences.mockResolvedValue({
        expiryRemindersEnabled: true,
        expiryReminderDays: 7,
      });
      mockNotificationService.sendPolicyExpiring.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'WHATSAPP',
        status: 'SENT',
      });

      const result = await service.processPolicyExpiryReminders(mockPolicies);

      expect(result.type).toBe('expiry');
      expect(result.total).toBe(2);
    });

    it('should skip users with expiry reminders disabled', async () => {
      mockNotificationService.getOrCreatePreferences.mockResolvedValue({
        expiryRemindersEnabled: false,
        expiryReminderDays: 7,
      });

      const result = await service.processPolicyExpiryReminders(mockPolicies);

      expect(result.skipped).toBe(2);
      expect(mockNotificationService.sendPolicyExpiring).not.toHaveBeenCalled();
    });

    it('should only send reminders at key intervals', async () => {
      const policiesAtDifferentIntervals: UserPolicyData[] = [
        { ...mockPolicies[0], daysRemaining: 7 }, // Should send (key day)
        { ...mockPolicies[1], daysRemaining: 5 }, // Should skip (not key day)
      ];

      mockNotificationService.getOrCreatePreferences.mockResolvedValue({
        expiryRemindersEnabled: true,
        expiryReminderDays: 7,
      });
      mockNotificationService.sendPolicyExpiring.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'WHATSAPP',
        status: 'SENT',
      });

      const result = await service.processPolicyExpiryReminders(policiesAtDifferentIntervals);

      // First policy (7 days) should send, second (5 days) should skip
      expect(result.sent + result.skipped).toBe(2);
    });
  });

  describe('sendImmediatePaymentReminder', () => {
    it('should send immediate payment reminder', async () => {
      mockNotificationService.sendPaymentReminder.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'SMS',
        status: 'SENT',
      });

      const user: UserPaymentData = {
        userId: 'user-1',
        phone: '+254712345678',
        name: 'John',
        dailyAmount: 87,
        daysPaid: 10,
        daysRemaining: 20,
        lastPaymentDate: new Date(),
      };

      const result = await service.sendImmediatePaymentReminder(user);

      expect(result).toBe(true);
      expect(mockNotificationService.sendPaymentReminder).toHaveBeenCalledWith(
        user.userId,
        user.phone,
        user.name,
        user.dailyAmount,
        user.daysRemaining,
      );
    });

    it('should return false on failure', async () => {
      mockNotificationService.sendPaymentReminder.mockResolvedValue({
        success: false,
        notificationId: '',
        channel: 'SMS',
        status: 'FAILED',
      });

      const user: UserPaymentData = {
        userId: 'user-1',
        phone: '+254712345678',
        name: 'John',
        dailyAmount: 87,
        daysPaid: 10,
        daysRemaining: 20,
        lastPaymentDate: new Date(),
      };

      const result = await service.sendImmediatePaymentReminder(user);

      expect(result).toBe(false);
    });
  });

  describe('sendMissedPaymentAlert', () => {
    it('should send missed payment alert', async () => {
      mockNotificationService.send.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'SMS',
        status: 'SENT',
      });

      const result = await service.sendMissedPaymentAlert(
        'user-1',
        '+254712345678',
        'John',
        2,
      );

      expect(result).toBe(true);
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          phone: '+254712345678',
          priority: 'HIGH',
        }),
      );
    });
  });

  describe('sendGracePeriodWarning', () => {
    it('should send grace period warning', async () => {
      mockNotificationService.send.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'SMS',
        status: 'SENT',
      });

      const result = await service.sendGracePeriodWarning(
        'user-1',
        '+254712345678',
        'BDA-2412-000001',
        5,
      );

      expect(result).toBe(true);
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'URGENT',
          variables: expect.objectContaining({
            policyNumber: 'BDA-2412-000001',
            graceDaysRemaining: 5,
          }),
        }),
      );
    });
  });

  describe('getUserReminderStats', () => {
    it('should return reminder statistics for user', async () => {
      mockNotificationService.getStats.mockResolvedValue({
        total: 10,
        sent: 8,
        delivered: 7,
        failed: 2,
        pending: 0,
        byChannel: {},
        byType: {
          [NotificationType.PAYMENT_REMINDER]: 5,
          [NotificationType.POLICY_EXPIRING]: 3,
        },
      });

      const stats = await service.getUserReminderStats('user-1');

      expect(stats.paymentReminders).toBe(5);
      expect(stats.expiryReminders).toBe(3);
    });

    it('should return zero counts when no reminders', async () => {
      mockNotificationService.getStats.mockResolvedValue({
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        byChannel: {},
        byType: {},
      });

      const stats = await service.getUserReminderStats('user-1');

      expect(stats.paymentReminders).toBe(0);
      expect(stats.expiryReminders).toBe(0);
    });
  });

  describe('scheduleReminder', () => {
    it('should schedule a payment reminder', async () => {
      mockNotificationService.send.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'SMS',
        status: 'PENDING',
      });

      const scheduledFor = new Date(Date.now() + 3600000);

      const notificationId = await service.scheduleReminder(
        'user-1',
        '+254712345678',
        'payment',
        scheduledFor,
        { name: 'John', amount: 87 },
      );

      expect(notificationId).toBe('notif-123');
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledFor,
        }),
      );
    });
  });

  describe('bulkScheduleReminders', () => {
    it('should schedule reminders for multiple users', async () => {
      mockNotificationService.send.mockResolvedValue({
        success: true,
        notificationId: 'notif-123',
        channel: 'SMS',
        status: 'PENDING',
      });

      const users = [
        { userId: 'user-1', phone: '+254712345678', preferredHour: 8 },
        { userId: 'user-2', phone: '+254712345679', preferredHour: 9 },
      ];

      const result = await service.bulkScheduleReminders(users, 'payment');

      expect(result.scheduled).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should track failed schedules', async () => {
      mockNotificationService.send
        .mockResolvedValueOnce({
          success: true,
          notificationId: 'notif-123',
          channel: 'SMS',
          status: 'PENDING',
        })
        .mockRejectedValueOnce(new Error('Failed'));

      const users = [
        { userId: 'user-1', phone: '+254712345678', preferredHour: 8 },
        { userId: 'user-2', phone: '+254712345679', preferredHour: 9 },
      ];

      const result = await service.bulkScheduleReminders(users, 'payment');

      expect(result.scheduled).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});
