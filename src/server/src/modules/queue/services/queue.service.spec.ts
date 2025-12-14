import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueService } from './queue.service.js';
import {
  QueueName,
  NotificationJobType,
  PolicyJobType,
  ReportJobType,
} from '../interfaces/job.interface.js';

describe('QueueService', () => {
  let service: QueueService;
  let notificationQueue: jest.Mocked<Queue>;
  let policyQueue: jest.Mocked<Queue>;
  let reportQueue: jest.Mocked<Queue>;

  const mockQueue = () => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 10,
      failed: 1,
    }),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue(['job-1', 'job-2']),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: mockQueue(),
        },
        {
          provide: getQueueToken(QueueName.POLICY),
          useValue: mockQueue(),
        },
        {
          provide: getQueueToken(QueueName.REPORT),
          useValue: mockQueue(),
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    notificationQueue = module.get(getQueueToken(QueueName.NOTIFICATION));
    policyQueue = module.get(getQueueToken(QueueName.POLICY));
    reportQueue = module.get(getQueueToken(QueueName.REPORT));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should log queue status on initialization', async () => {
      await service.onModuleInit();

      expect(notificationQueue.getJobCounts).toHaveBeenCalled();
      expect(policyQueue.getJobCounts).toHaveBeenCalled();
      expect(reportQueue.getJobCounts).toHaveBeenCalled();
    });
  });

  describe('Notification Queue Methods', () => {
    describe('queueSms', () => {
      it('should queue an SMS job with correct data', async () => {
        const phone = '+254712345678';
        const message = 'Your OTP is 123456';

        const jobId = await service.queueSms(phone, message);

        expect(notificationQueue.add).toHaveBeenCalledWith(
          NotificationJobType.SEND_SMS,
          expect.objectContaining({
            type: NotificationJobType.SEND_SMS,
            phone,
            message,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });

      it('should include optional parameters when provided', async () => {
        await service.queueSms('+254712345678', 'Test', {
          userId: 'user-123',
          organizationId: 'org-456',
          provider: 'africastalking',
          priority: 1,
          delay: 5000,
        });

        expect(notificationQueue.add).toHaveBeenCalledWith(
          NotificationJobType.SEND_SMS,
          expect.objectContaining({
            userId: 'user-123',
            organizationId: 'org-456',
            provider: 'africastalking',
          }),
          expect.objectContaining({
            priority: 1,
            delay: 5000,
          }),
        );
      });
    });

    describe('queueBulkSms', () => {
      it('should queue bulk SMS job', async () => {
        const recipients = [
          { phone: '+254712345678', message: 'Hello John' },
          { phone: '+254712345679', message: 'Hello Jane' },
        ];

        const jobId = await service.queueBulkSms(recipients);

        expect(notificationQueue.add).toHaveBeenCalledWith(
          NotificationJobType.SEND_BULK_SMS,
          expect.objectContaining({
            type: NotificationJobType.SEND_BULK_SMS,
            recipients,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });
    });

    describe('queueEmail', () => {
      it('should queue an email job', async () => {
        const to = 'john.kamau@example.com';
        const subject = 'Welcome to BodaInsure';
        const template = 'welcome';
        const context = { name: 'John Kamau' };

        const jobId = await service.queueEmail(to, subject, template, context);

        expect(notificationQueue.add).toHaveBeenCalledWith(
          NotificationJobType.SEND_EMAIL,
          expect.objectContaining({
            type: NotificationJobType.SEND_EMAIL,
            to,
            subject,
            template,
            context,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });

      it('should include attachments when provided', async () => {
        const attachments = [
          {
            filename: 'policy.pdf',
            content: Buffer.from('PDF content'),
            contentType: 'application/pdf',
          },
        ];

        await service.queueEmail(
          'test@example.com',
          'Subject',
          'template',
          {},
          { attachments },
        );

        expect(notificationQueue.add).toHaveBeenCalledWith(
          NotificationJobType.SEND_EMAIL,
          expect.objectContaining({
            attachments,
          }),
          expect.any(Object),
        );
      });
    });

    describe('queueWhatsApp', () => {
      it('should queue a WhatsApp job', async () => {
        const phone = '+254712345678';
        const template = 'bodainsure_welcome';
        const parameters = ['John Kamau'];

        const jobId = await service.queueWhatsApp(phone, template, parameters);

        expect(notificationQueue.add).toHaveBeenCalledWith(
          NotificationJobType.SEND_WHATSAPP,
          expect.objectContaining({
            type: NotificationJobType.SEND_WHATSAPP,
            phone,
            template,
            parameters,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });
    });

    describe('queuePaymentReminders', () => {
      it('should queue payment reminders for multiple users', async () => {
        const userIds = ['user-1', 'user-2', 'user-3'];
        const reminderType = 'daily';

        const jobId = await service.queuePaymentReminders(userIds, reminderType);

        expect(notificationQueue.add).toHaveBeenCalledWith(
          NotificationJobType.SEND_PAYMENT_REMINDER,
          expect.objectContaining({
            type: NotificationJobType.SEND_PAYMENT_REMINDER,
            userIds,
            reminderType,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });
    });
  });

  describe('Policy Queue Methods', () => {
    describe('queueCertificateGeneration', () => {
      it('should queue certificate generation job', async () => {
        const policyId = 'policy-123';
        const deliveryMethod = 'whatsapp' as const;
        const deliveryAddress = '+254712345678';

        const jobId = await service.queueCertificateGeneration(
          policyId,
          deliveryMethod,
          deliveryAddress,
        );

        expect(policyQueue.add).toHaveBeenCalledWith(
          PolicyJobType.GENERATE_CERTIFICATE,
          expect.objectContaining({
            type: PolicyJobType.GENERATE_CERTIFICATE,
            policyId,
            deliveryMethod,
            deliveryAddress,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });
    });

    describe('queueBatchProcessing', () => {
      it('should queue batch processing job with high priority', async () => {
        const batchId = 'batch-123';
        const policyType = '1_month' as const;

        const jobId = await service.queueBatchProcessing(batchId, policyType);

        expect(policyQueue.add).toHaveBeenCalledWith(
          PolicyJobType.PROCESS_BATCH,
          expect.objectContaining({
            type: PolicyJobType.PROCESS_BATCH,
            batchId,
            policyType,
          }),
          expect.objectContaining({
            priority: 1,
          }),
        );
        expect(jobId).toBe('job-123');
      });
    });

    describe('queuePolicyExpiration', () => {
      it('should queue policy expiration job', async () => {
        const policyIds = ['policy-1', 'policy-2', 'policy-3'];

        const jobId = await service.queuePolicyExpiration(policyIds);

        expect(policyQueue.add).toHaveBeenCalledWith(
          PolicyJobType.EXPIRE_POLICY,
          expect.objectContaining({
            type: PolicyJobType.EXPIRE_POLICY,
            policyIds,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });
    });

    describe('queuePolicyLapse', () => {
      it('should queue policy lapse job', async () => {
        const policyIds = ['policy-1', 'policy-2'];

        const jobId = await service.queuePolicyLapse(policyIds);

        expect(policyQueue.add).toHaveBeenCalledWith(
          PolicyJobType.LAPSE_POLICY,
          expect.objectContaining({
            type: PolicyJobType.LAPSE_POLICY,
            policyIds,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });
    });
  });

  describe('Report Queue Methods', () => {
    describe('queueReportGeneration', () => {
      it('should queue report generation job', async () => {
        const reportDefinitionId = 'def-123';
        const startDate = new Date('2024-12-01');
        const endDate = new Date('2024-12-31');

        const jobId = await service.queueReportGeneration(
          reportDefinitionId,
          startDate,
          endDate,
        );

        expect(reportQueue.add).toHaveBeenCalledWith(
          ReportJobType.GENERATE_REPORT,
          expect.objectContaining({
            type: ReportJobType.GENERATE_REPORT,
            reportDefinitionId,
            startDate,
            endDate,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });

      it('should include optional parameters', async () => {
        await service.queueReportGeneration(
          'def-123',
          new Date(),
          new Date(),
          {
            userId: 'user-123',
            organizationId: 'org-456',
            parameters: { region: 'Nairobi' },
            deliverTo: ['admin@example.com'],
          },
        );

        expect(reportQueue.add).toHaveBeenCalledWith(
          ReportJobType.GENERATE_REPORT,
          expect.objectContaining({
            userId: 'user-123',
            organizationId: 'org-456',
            parameters: { region: 'Nairobi' },
            deliverTo: ['admin@example.com'],
          }),
          expect.any(Object),
        );
      });
    });

    describe('queueReportExport', () => {
      it('should queue report export job', async () => {
        const reportId = 'report-123';
        const format = 'pdf' as const;

        const jobId = await service.queueReportExport(reportId, format);

        expect(reportQueue.add).toHaveBeenCalledWith(
          ReportJobType.EXPORT_REPORT,
          expect.objectContaining({
            type: ReportJobType.EXPORT_REPORT,
            reportId,
            format,
          }),
          expect.any(Object),
        );
        expect(jobId).toBe('job-123');
      });
    });
  });

  describe('Queue Management Methods', () => {
    describe('getQueueStatus', () => {
      it('should return status of all queues', async () => {
        const status = await service.getQueueStatus();

        expect(status).toEqual({
          notification: expect.objectContaining({
            waiting: 0,
            active: 0,
            completed: 10,
            failed: 1,
          }),
          policy: expect.objectContaining({
            waiting: 0,
            active: 0,
          }),
          report: expect.objectContaining({
            waiting: 0,
            active: 0,
          }),
        });
      });
    });

    describe('pauseAllQueues', () => {
      it('should pause all queues', async () => {
        await service.pauseAllQueues();

        expect(notificationQueue.pause).toHaveBeenCalled();
        expect(policyQueue.pause).toHaveBeenCalled();
        expect(reportQueue.pause).toHaveBeenCalled();
      });
    });

    describe('resumeAllQueues', () => {
      it('should resume all queues', async () => {
        await service.resumeAllQueues();

        expect(notificationQueue.resume).toHaveBeenCalled();
        expect(policyQueue.resume).toHaveBeenCalled();
        expect(reportQueue.resume).toHaveBeenCalled();
      });
    });

    describe('cleanQueues', () => {
      it('should clean completed and failed jobs from all queues', async () => {
        const result = await service.cleanQueues();

        expect(notificationQueue.clean).toHaveBeenCalledTimes(2);
        expect(policyQueue.clean).toHaveBeenCalledTimes(2);
        expect(reportQueue.clean).toHaveBeenCalledTimes(2);
        expect(result.cleaned).toBeGreaterThan(0);
      });

      it('should accept custom grace period', async () => {
        const gracePeriod = 48 * 60 * 60 * 1000; // 48 hours
        await service.cleanQueues(gracePeriod);

        expect(notificationQueue.clean).toHaveBeenCalledWith(
          gracePeriod,
          1000,
          'completed',
        );
      });
    });
  });
});
