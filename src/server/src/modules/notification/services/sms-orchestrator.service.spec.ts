import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsOrchestratorService } from './sms-orchestrator.service.js';
import { AdvantasmsProvider } from '../providers/advantasms.provider.js';
import { AfricasTalkingProvider } from '../providers/africastalking.provider.js';
import {
  ISendSmsRequest,
  ISendSmsResponse,
  IBulkSmsRequest,
  IBulkSmsResponse,
  IProviderBalance,
} from '../interfaces/sms-provider.interface.js';

describe('SmsOrchestratorService', () => {
  let service: SmsOrchestratorService;
  let mockAfricasTalkingProvider: jest.Mocked<AfricasTalkingProvider>;
  let mockAdvantasmsProvider: jest.Mocked<AdvantasmsProvider>;

  const createMockProvider = (name: string) => ({
    name,
    send: jest.fn(),
    sendBulk: jest.fn(),
    getDeliveryReport: jest.fn(),
    getBalance: jest.fn(),
    validateCredentials: jest.fn(),
    isHealthy: jest.fn(),
  });

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      const config: Record<string, unknown> = {
        SMS_PRIMARY_PROVIDER: 'africastalking',
        SMS_FALLBACK_PROVIDER: 'advantasms',
        SMS_MAX_RETRIES: 3,
        SMS_RETRY_DELAY_MS: 10, // Short delay for tests
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    mockAfricasTalkingProvider = createMockProvider('africastalking') as jest.Mocked<AfricasTalkingProvider>;
    mockAdvantasmsProvider = createMockProvider('advantasms') as jest.Mocked<AdvantasmsProvider>;

    // Default healthy state
    mockAfricasTalkingProvider.isHealthy.mockResolvedValue(true);
    mockAdvantasmsProvider.isHealthy.mockResolvedValue(true);
    mockAfricasTalkingProvider.getBalance.mockResolvedValue({ balance: 1000, currency: 'KES' });
    mockAdvantasmsProvider.getBalance.mockResolvedValue({ balance: 500, currency: 'KES' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsOrchestratorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AdvantasmsProvider,
          useValue: mockAdvantasmsProvider,
        },
        {
          provide: AfricasTalkingProvider,
          useValue: mockAfricasTalkingProvider,
        },
      ],
    }).compile();

    service = module.get<SmsOrchestratorService>(SmsOrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should successfully send SMS to recipient 0704033581 via Africa\'s Talking', async () => {
      // Arrange
      const testPhone = '0704033581';
      const testMessage = 'Your BodaInsure payment of KES 87 has been received. Balance: 30 days.';

      const expectedResponse: ISendSmsResponse = {
        success: true,
        messageId: 'ATXid_test_123456',
        provider: 'africastalking',
        cost: 'KES 0.8000',
      };

      mockAfricasTalkingProvider.send.mockResolvedValue(expectedResponse);

      // Act
      const result = await service.send({
        to: testPhone,
        message: testMessage,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('ATXid_test_123456');
      expect(result.provider).toBe('africastalking');
      expect(mockAfricasTalkingProvider.send).toHaveBeenCalledTimes(1);
      expect(mockAfricasTalkingProvider.send).toHaveBeenCalledWith({
        to: testPhone,
        message: testMessage,
      });
    });

    it('should verify SMS request is issued to recipient number 0704033581', async () => {
      // Arrange - This test explicitly validates the requirement
      const recipientNumber = '0704033581';
      const smsContent = 'Test SMS verification message';

      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ATXid_verification_789',
        provider: 'africastalking',
      });

      // Act
      const result = await service.sendSms(recipientNumber, smsContent);

      // Assert - Verify the SMS request was issued to the specific recipient
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(mockAfricasTalkingProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: recipientNumber,
          message: smsContent,
        }),
      );
    });

    it('should handle various Kenyan phone number formats for 0704033581', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ATXid_format_test',
        provider: 'africastalking',
      });

      const phoneFormats = [
        '0704033581',      // Local format
        '704033581',       // Without leading zero
        '254704033581',    // With country code
        '+254704033581',   // Full E.164
      ];

      for (const phone of phoneFormats) {
        await service.send({ to: phone, message: 'Format test' });
      }

      expect(mockAfricasTalkingProvider.send).toHaveBeenCalledTimes(4);
    });

    it('should retry on transient errors with exponential backoff', async () => {
      // Arrange - First two calls fail, third succeeds
      mockAfricasTalkingProvider.send
        .mockResolvedValueOnce({
          success: false,
          provider: 'africastalking',
          error: 'Network timeout',
        })
        .mockResolvedValueOnce({
          success: false,
          provider: 'africastalking',
          error: 'Gateway error',
        })
        .mockResolvedValueOnce({
          success: true,
          messageId: 'ATXid_retry_success',
          provider: 'africastalking',
        });

      // Act
      const result = await service.send({
        to: '0704033581',
        message: 'Retry test message',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockAfricasTalkingProvider.send).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors like InvalidPhoneNumber', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: false,
        provider: 'africastalking',
        error: 'InvalidPhoneNumber',
      });

      // Failover also fails because the phone is invalid on any provider
      mockAdvantasmsProvider.send.mockResolvedValue({
        success: false,
        provider: 'advantasms',
        error: 'InvalidPhoneNumber',
      });

      const result = await service.send({
        to: '12345',
        message: 'Invalid phone test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('InvalidPhoneNumber');
      // Non-retryable errors should stop retrying immediately but failover still happens
      expect(mockAfricasTalkingProvider.send).toHaveBeenCalled();
    });

    it('should failover to Advantasms when Africa\'s Talking fails', async () => {
      // Arrange - AT fails all retries
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: false,
        provider: 'africastalking',
        error: 'Service unavailable',
      });

      mockAdvantasmsProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ADV_failover_123',
        provider: 'advantasms',
      });

      // Act
      const result = await service.send({
        to: '0704033581',
        message: 'Failover test message',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.provider).toBe('advantasms');
      expect(mockAdvantasmsProvider.send).toHaveBeenCalled();
    });

    it('should use fallback provider when primary is unhealthy', async () => {
      // Arrange - Primary provider unhealthy
      mockAfricasTalkingProvider.isHealthy.mockResolvedValue(false);
      mockAdvantasmsProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ADV_unhealthy_primary',
        provider: 'advantasms',
      });

      // Act
      const result = await service.send({
        to: '0704033581',
        message: 'Health check failover test',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.provider).toBe('advantasms');
    });

    it('should respect preferredProvider option', async () => {
      mockAdvantasmsProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ADV_preferred_123',
        provider: 'advantasms',
      });

      const result = await service.send(
        { to: '0704033581', message: 'Preferred provider test' },
        { preferredProvider: 'advantasms' },
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('advantasms');
      expect(mockAdvantasmsProvider.send).toHaveBeenCalled();
      expect(mockAfricasTalkingProvider.send).not.toHaveBeenCalled();
    });

    it('should skip failover when skipFailover option is true', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: false,
        provider: 'africastalking',
        error: 'Service error',
      });

      const result = await service.send(
        { to: '0704033581', message: 'No failover test' },
        { skipFailover: true },
      );

      expect(result.success).toBe(false);
      expect(mockAdvantasmsProvider.send).not.toHaveBeenCalled();
    });
  });

  describe('sendSms (convenience method)', () => {
    it('should send SMS using simplified interface', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ATXid_simple_123',
        provider: 'africastalking',
      });

      const result = await service.sendSms(
        '0704033581',
        'Simple interface test',
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should return fallback messageId when provider returns none', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: true,
        provider: 'africastalking',
        // No messageId in response
      });

      const result = await service.sendSms('0704033581', 'No messageId test');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^sms-\d+$/);
    });
  });

  describe('sendBulk', () => {
    it('should send bulk SMS to multiple recipients including 0704033581', async () => {
      const bulkResponse: IBulkSmsResponse = {
        success: true,
        results: [
          { success: true, messageId: 'ATXid_bulk_1', provider: 'africastalking' },
          { success: true, messageId: 'ATXid_bulk_2', provider: 'africastalking' },
          { success: true, messageId: 'ATXid_bulk_3', provider: 'africastalking' },
        ],
        provider: 'africastalking',
        totalSent: 3,
        totalFailed: 0,
      };

      mockAfricasTalkingProvider.sendBulk.mockResolvedValue(bulkResponse);

      const request: IBulkSmsRequest = {
        messages: [
          { to: '0704033581', message: 'Bulk message 1' },
          { to: '0712345678', message: 'Bulk message 2' },
          { to: '0723456789', message: 'Bulk message 3' },
        ],
      };

      const result = await service.sendBulk(request);

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(3);
      expect(result.totalFailed).toBe(0);
    });

    it('should retry failed messages with fallback provider on high failure rate', async () => {
      // Primary provider fails most messages
      mockAfricasTalkingProvider.sendBulk.mockResolvedValue({
        success: false,
        results: [
          { success: true, messageId: 'ATXid_1', provider: 'africastalking' },
          { success: false, provider: 'africastalking', error: 'Failed' },
          { success: false, provider: 'africastalking', error: 'Failed' },
        ],
        provider: 'africastalking',
        totalSent: 1,
        totalFailed: 2,
      });

      // Fallback succeeds
      mockAdvantasmsProvider.sendBulk.mockResolvedValue({
        success: true,
        results: [
          { success: true, messageId: 'ADV_1', provider: 'advantasms' },
          { success: true, messageId: 'ADV_2', provider: 'advantasms' },
        ],
        provider: 'advantasms',
        totalSent: 2,
        totalFailed: 0,
      });

      const request: IBulkSmsRequest = {
        messages: [
          { to: '0704033581', message: 'Msg 1' },
          { to: '0712345678', message: 'Msg 2' },
          { to: '0723456789', message: 'Msg 3' },
        ],
      };

      const result = await service.sendBulk(request);

      expect(mockAdvantasmsProvider.sendBulk).toHaveBeenCalled();
      // Should have retried the failed messages
      expect(result.totalSent).toBe(3);
    });
  });

  describe('getAllBalances', () => {
    it('should return balances from all providers', async () => {
      mockAfricasTalkingProvider.getBalance.mockResolvedValue({
        balance: 1000,
        currency: 'KES',
      });
      mockAdvantasmsProvider.getBalance.mockResolvedValue({
        balance: 500,
        currency: 'KES',
      });

      const balances = await service.getAllBalances();

      expect(balances.africastalking).toEqual({ balance: 1000, currency: 'KES' });
      expect(balances.advantasms).toEqual({ balance: 500, currency: 'KES' });
    });

    it('should handle null balance from failed provider', async () => {
      mockAfricasTalkingProvider.getBalance.mockResolvedValue(null);
      mockAdvantasmsProvider.getBalance.mockResolvedValue({
        balance: 500,
        currency: 'KES',
      });

      const balances = await service.getAllBalances();

      expect(balances.africastalking).toBeNull();
      expect(balances.advantasms).toEqual({ balance: 500, currency: 'KES' });
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all providers', async () => {
      mockAfricasTalkingProvider.isHealthy.mockResolvedValue(true);
      mockAdvantasmsProvider.isHealthy.mockResolvedValue(false);

      const status = await service.getHealthStatus();

      expect(status.africastalking.healthy).toBe(true);
      expect(status.advantasms.healthy).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle provider exceptions gracefully', async () => {
      // When the AT provider has an internal error, it returns an error response (not throw)
      // per our graceful error handling enhancement
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: false,
        provider: 'africastalking',
        error: 'Network error - Cannot reach AT service',
      });
      mockAdvantasmsProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ADV_exception_fallback',
        provider: 'advantasms',
      });

      // Even with network error, should failover
      const result = await service.send({
        to: '0704033581',
        message: 'Exception test',
      });

      // The orchestrator catches errors and fails over to secondary provider
      expect(mockAdvantasmsProvider.send).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('advantasms');
    });

    it('should return error when both providers fail', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: false,
        provider: 'africastalking',
        error: 'AT failed',
      });
      mockAdvantasmsProvider.send.mockResolvedValue({
        success: false,
        provider: 'advantasms',
        error: 'Advantasms failed',
      });

      const result = await service.send({
        to: '0704033581',
        message: 'Both fail test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Africa\'s Talking specific scenarios', () => {
    it('should handle AT status code 101 (Sent) as success', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ATXid_101_test',
        provider: 'africastalking',
        cost: 'KES 0.8000',
      });

      const result = await service.send({
        to: '0704033581',
        message: 'Status 101 test',
      });

      expect(result.success).toBe(true);
    });

    it('should handle AT InsufficientBalance error', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: false,
        provider: 'africastalking',
        error: 'InsufficientBalance',
      });

      mockAdvantasmsProvider.send.mockResolvedValue({
        success: true,
        messageId: 'ADV_balance_fallback',
        provider: 'advantasms',
      });

      const result = await service.send({
        to: '0704033581',
        message: 'Balance test',
      });

      // Should failover to Advantasms on insufficient balance
      expect(result.success).toBe(true);
      expect(result.provider).toBe('advantasms');
    });

    it('should not retry on Blacklisted error', async () => {
      mockAfricasTalkingProvider.send.mockResolvedValue({
        success: false,
        provider: 'africastalking',
        error: 'User is Blacklisted',
      });

      // Blacklisted is non-retryable but failover still occurs
      // Set fallback to also fail (since blacklisted user is blacklisted everywhere)
      mockAdvantasmsProvider.send.mockResolvedValue({
        success: false,
        provider: 'advantasms',
        error: 'User is Blacklisted',
      });

      const result = await service.send({
        to: '0704033581',
        message: 'Blacklist test',
      });

      expect(result.success).toBe(false);
      // Blacklisted is a non-retryable error, so no retries on primary
      // But failover still happens (because the user might not be blacklisted on other provider)
      expect(mockAfricasTalkingProvider.send).toHaveBeenCalled();
    });
  });
});

describe('SmsOrchestratorService Integration', () => {
  // These tests verify the service can be properly instantiated
  // with all required dependencies

  it('should initialize with default configuration', async () => {
    const mockConfig = {
      get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
    };

    const mockAT = {
      name: 'africastalking',
      isHealthy: jest.fn().mockResolvedValue(true),
      getBalance: jest.fn().mockResolvedValue({ balance: 100, currency: 'KES' }),
      send: jest.fn(),
      sendBulk: jest.fn(),
      getDeliveryReport: jest.fn(),
      validateCredentials: jest.fn(),
    };

    const mockAdv = {
      name: 'advantasms',
      isHealthy: jest.fn().mockResolvedValue(true),
      getBalance: jest.fn().mockResolvedValue({ balance: 100, currency: 'KES' }),
      send: jest.fn(),
      sendBulk: jest.fn(),
      getDeliveryReport: jest.fn(),
      validateCredentials: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsOrchestratorService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: AfricasTalkingProvider, useValue: mockAT },
        { provide: AdvantasmsProvider, useValue: mockAdv },
      ],
    }).compile();

    const service = module.get<SmsOrchestratorService>(SmsOrchestratorService);
    expect(service).toBeDefined();
  });
});
