import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: { sendMail: jest.Mock; verify: jest.Mock };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        EMAIL_ENABLED: true,
        EMAIL_FROM: 'BodaInsure <noreply@bodainsure.co.ke>',
        EMAIL_REPLY_TO: 'support@bodainsure.co.ke',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'testuser',
        SMTP_PASS: 'testpass',
        SMTP_SECURE: false,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    // Mock nodemailer transport
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'email-123' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    jest.mock('nodemailer', () => ({
      createTransport: () => mockTransporter,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    // Manually set the transporter for testing
    (service as unknown as { transporter: typeof mockTransporter }).transporter =
      mockTransporter;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      const result = await service.send({
        to: 'john.kamau@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john.kamau@example.com',
          subject: 'Test Email',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('email-123');
    });

    it('should handle multiple recipients', async () => {
      await service.send({
        to: ['admin@example.com', 'support@example.com'],
        subject: 'Multi-recipient Email',
        text: 'Test',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com, support@example.com',
        }),
      );
    });

    it('should include CC and BCC recipients', async () => {
      await service.send({
        to: 'primary@example.com',
        subject: 'Test',
        text: 'Test',
        cc: 'cc@example.com',
        bcc: ['bcc1@example.com', 'bcc2@example.com'],
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: 'cc@example.com',
          bcc: 'bcc1@example.com, bcc2@example.com',
        }),
      );
    });

    it('should include attachments', async () => {
      const attachments = [
        {
          filename: 'policy.pdf',
          content: Buffer.from('PDF content'),
          contentType: 'application/pdf',
        },
      ];

      await service.send({
        to: 'test@example.com',
        subject: 'Policy Document',
        text: 'Attached is your policy.',
        attachments,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments,
        }),
      );
    });

    it('should handle send failure gracefully', async () => {
      // Reject all attempts including retries
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.send({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP error');

      // Reset mock to default behavior for subsequent tests
      mockTransporter.sendMail.mockReset();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    }, 30000); // Increased timeout to account for retry delays
  });

  describe('BodaInsure-specific email methods', () => {
    describe('sendWelcomeEmail', () => {
      it('should send welcome email with user name', async () => {
        const result = await service.sendWelcomeEmail(
          'john.kamau@example.com',
          'John Kamau',
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'john.kamau@example.com',
            subject: 'Welcome to BodaInsure!',
          }),
        );
        expect(result.success).toBe(true);
      });
    });

    describe('sendPaymentConfirmation', () => {
      it('should send payment confirmation with transaction details', async () => {
        const result = await service.sendPaymentConfirmation(
          'john.kamau@example.com',
          {
            name: 'John Kamau',
            amount: 87,
            transactionId: 'TXN123456',
            paymentDate: new Date('2024-12-14'),
            walletBalance: 2610,
            daysRemaining: 25,
          },
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'john.kamau@example.com',
            subject: 'Payment Received - KES 87',
          }),
        );
        expect(result.success).toBe(true);
      });
    });

    describe('sendPolicyCertificate', () => {
      it('should send policy certificate with PDF attachment', async () => {
        const pdfBuffer = Buffer.from('PDF content');

        const result = await service.sendPolicyCertificate(
          'john.kamau@example.com',
          {
            name: 'John Kamau',
            policyNumber: 'BDA-2412-000001',
            vehicleReg: 'KAA 123B',
            validFrom: new Date('2024-12-01'),
            validTo: new Date('2025-01-01'),
          },
          pdfBuffer,
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'john.kamau@example.com',
            attachments: expect.arrayContaining([
              expect.objectContaining({
                filename: expect.stringContaining('BDA-2412-000001'),
                content: pdfBuffer,
              }),
            ]),
          }),
        );
        expect(result.success).toBe(true);
      });
    });

    describe('sendPaymentReminder', () => {
      it('should send payment reminder with urgency details', async () => {
        const result = await service.sendPaymentReminder(
          'john.kamau@example.com',
          {
            name: 'John Kamau',
            daysOverdue: 3,
            amountDue: 261,
            graceDaysRemaining: 4,
          },
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'john.kamau@example.com',
            subject: 'Payment Reminder - BodaInsure',
          }),
        );
        expect(result.success).toBe(true);
      });
    });

    describe('sendPolicyExpiryWarning', () => {
      it('should send policy expiry warning', async () => {
        const result = await service.sendPolicyExpiryWarning(
          'john.kamau@example.com',
          {
            name: 'John Kamau',
            policyNumber: 'BDA-2412-000001',
            expiryDate: new Date('2025-01-01'),
            daysUntilExpiry: 7,
          },
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'john.kamau@example.com',
            subject: expect.stringContaining('Expiring Soon'),
          }),
        );
        expect(result.success).toBe(true);
      });
    });

    describe('sendDataExport', () => {
      it('should send data export with JSON attachment', async () => {
        const exportData = Buffer.from(JSON.stringify({ user: 'data' }));

        const result = await service.sendDataExport(
          'john.kamau@example.com',
          'John Kamau',
          exportData,
          'json',
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Your BodaInsure Data Export',
            attachments: expect.arrayContaining([
              expect.objectContaining({
                filename: 'bodainsure_data_export.json',
                contentType: 'application/json',
              }),
            ]),
          }),
        );
        expect(result.success).toBe(true);
      });

      it('should send data export with CSV attachment', async () => {
        const exportData = Buffer.from('name,phone\nJohn,0712345678');

        await service.sendDataExport(
          'john.kamau@example.com',
          'John Kamau',
          exportData,
          'csv',
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                filename: 'bodainsure_data_export.csv',
                contentType: 'text/csv',
              }),
            ]),
          }),
        );
      });
    });

    describe('sendOrganizationReport', () => {
      it('should send organization report with attachment', async () => {
        const reportBuffer = Buffer.from('Report content');

        const result = await service.sendOrganizationReport(
          'admin@kba.co.ke',
          {
            organizationName: 'Kenya Bodaboda Association',
            reportType: 'Monthly Enrollment',
            reportDate: new Date('2024-12-01'),
          },
          reportBuffer,
          'kba_enrollment_2024-12.pdf',
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Monthly Enrollment Report - Kenya Bodaboda Association',
            attachments: expect.arrayContaining([
              expect.objectContaining({
                filename: 'kba_enrollment_2024-12.pdf',
              }),
            ]),
          }),
        );
        expect(result.success).toBe(true);
      });

      it('should handle multiple recipients for organization reports', async () => {
        const reportBuffer = Buffer.from('Report');

        await service.sendOrganizationReport(
          ['admin@kba.co.ke', 'finance@kba.co.ke'],
          {
            organizationName: 'KBA',
            reportType: 'Financial',
            reportDate: new Date(),
          },
          reportBuffer,
          'report.pdf',
        );

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'admin@kba.co.ke, finance@kba.co.ke',
          }),
        );
      });
    });
  });

  describe('sendEmail (queue processor method)', () => {
    it('should send template-based email', async () => {
      const result = await service.sendEmail(
        'john.kamau@example.com',
        'Welcome',
        'welcome',
        { name: 'John Kamau' },
      );

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should include attachments when provided', async () => {
      const attachments = [
        {
          filename: 'doc.pdf',
          content: Buffer.from('PDF'),
        },
      ];

      await service.sendEmail(
        'test@example.com',
        'Document',
        'policy_certificate',
        {},
        attachments,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments,
        }),
      );
    });
  });

  describe('verifyConnection', () => {
    it('should return true when SMTP connection is valid', async () => {
      const result = await service.verifyConnection();

      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when SMTP connection fails', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.verifyConnection();

      expect(result).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return enabled status', () => {
      const result = service.isEnabled();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getStatus', () => {
    it('should return service status', async () => {
      const status = await service.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('connected');
    });
  });
});

describe('EmailService - Recipient Verification Tests', () => {
  let service: EmailService;
  let mockTransporter: { sendMail: jest.Mock; verify: jest.Mock };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        EMAIL_ENABLED: true,
        EMAIL_FROM: 'BodaInsure <noreply@bodainsure.co.ke>',
        EMAIL_REPLY_TO: 'support@bodainsure.co.ke',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'testuser',
        SMTP_PASS: 'testpass',
        SMTP_SECURE: false,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-email-id-456' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    (service as unknown as { transporter: typeof mockTransporter }).transporter =
      mockTransporter;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test: Verify email request is issued to recipient allan.kkoech@gmail.com
   * This test uses mocks - no real emails are sent in CI/test environments
   */
  it('should verify email request is issued to recipient allan.kkoech@gmail.com', async () => {
    const recipientEmail = 'allan.kkoech@gmail.com';
    const testSubject = 'Test Email Verification';
    const testContent = 'This is a test email to verify recipient address handling';

    const result = await service.send({
      to: recipientEmail,
      subject: testSubject,
      text: testContent,
      html: `<p>${testContent}</p>`,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipientEmail,
        subject: testSubject,
        text: testContent,
        html: `<p>${testContent}</p>`,
        from: 'BodaInsure <noreply@bodainsure.co.ke>',
        replyTo: 'support@bodainsure.co.ke',
      }),
    );
  });

  it('should send welcome email to allan.kkoech@gmail.com with correct template', async () => {
    const recipientEmail = 'allan.kkoech@gmail.com';
    const recipientName = 'Allan Kkoech';

    const result = await service.sendWelcomeEmail(recipientEmail, recipientName);

    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipientEmail,
        subject: 'Welcome to BodaInsure!',
      }),
    );

    // Verify HTML contains the recipient name
    const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
    expect(sentEmail.html).toContain(recipientName);
    expect(sentEmail.text).toContain(recipientName);
  });

  it('should send payment confirmation to allan.kkoech@gmail.com with transaction details', async () => {
    const recipientEmail = 'allan.kkoech@gmail.com';
    const paymentData = {
      name: 'Allan Kkoech',
      amount: 87,
      transactionId: 'TXN-AUDIT-TEST-001',
      paymentDate: new Date('2024-12-15'),
      walletBalance: 2610,
      daysRemaining: 25,
    };

    const result = await service.sendPaymentConfirmation(recipientEmail, paymentData);

    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipientEmail,
        subject: 'Payment Received - KES 87',
      }),
    );

    // Verify transaction ID is included
    const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
    expect(sentEmail.html).toContain(paymentData.transactionId);
    expect(sentEmail.text).toContain(paymentData.transactionId);
  });

  it('should include allan.kkoech@gmail.com as CC recipient', async () => {
    const primaryRecipient = 'primary@example.com';
    const ccRecipient = 'allan.kkoech@gmail.com';

    await service.send({
      to: primaryRecipient,
      subject: 'Test with CC',
      text: 'Testing CC functionality',
      cc: ccRecipient,
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: primaryRecipient,
        cc: ccRecipient,
      }),
    );
  });

  it('should correctly construct email payload with all fields', async () => {
    const emailRequest = {
      to: 'allan.kkoech@gmail.com',
      subject: 'Complete Email Payload Test',
      text: 'Plain text version',
      html: '<h1>HTML version</h1>',
      from: 'Custom Sender <custom@bodainsure.co.ke>',
      replyTo: 'custom-reply@bodainsure.co.ke',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
      attachments: [
        {
          filename: 'test-document.pdf',
          content: Buffer.from('PDF test content'),
          contentType: 'application/pdf',
        },
      ],
    };

    await service.send(emailRequest);

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: emailRequest.to,
        subject: emailRequest.subject,
        text: emailRequest.text,
        html: emailRequest.html,
        from: emailRequest.from,
        replyTo: emailRequest.replyTo,
        cc: emailRequest.cc,
        bcc: emailRequest.bcc,
        attachments: emailRequest.attachments,
      }),
    );
  });
});

describe('EmailService (disabled mode)', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'EMAIL_ENABLED') return false;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should return dev mode result when email is disabled', async () => {
    const result = await service.send({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^dev-email-/);
  });

  it('should skip actual sending when disabled', async () => {
    const result = await service.sendWelcomeEmail(
      'test@example.com',
      'Test User',
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^dev-email-/);
  });
});
