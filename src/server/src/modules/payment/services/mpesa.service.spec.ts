import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MpesaService } from './mpesa.service.js';
import { RedisService } from '../../../common/services/redis.service.js';

describe('MpesaService', () => {
  let service: MpesaService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        MPESA_ENVIRONMENT: 'sandbox',
        MPESA_USE_MOCK: 'true', // Enable mock mode for testing
        MPESA_CONSUMER_KEY: '',
        MPESA_CONSUMER_SECRET: '',
        MPESA_SHORTCODE: '174379',
        MPESA_PASSKEY: 'test-passkey',
        MPESA_CALLBACK_URL: 'https://example.com/callback',
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpesaService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<MpesaService>(MpesaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('formatPhoneNumber', () => {
    it('should format phone starting with 07 to 254 format', () => {
      expect(service.formatPhoneNumber('0712345678')).toBe('254712345678');
    });

    it('should format phone starting with 01 to 254 format', () => {
      expect(service.formatPhoneNumber('0112345678')).toBe('254112345678');
    });

    it('should format phone starting with +254 to 254 format', () => {
      expect(service.formatPhoneNumber('+254712345678')).toBe('254712345678');
    });

    it('should keep phone already in 254 format', () => {
      expect(service.formatPhoneNumber('254712345678')).toBe('254712345678');
    });

    it('should handle phone with spaces and dashes', () => {
      expect(service.formatPhoneNumber('07 1234-5678')).toBe('254712345678');
    });

    it('should add 254 prefix to raw numbers', () => {
      expect(service.formatPhoneNumber('712345678')).toBe('254712345678');
    });
  });

  describe('initiateSTKPush', () => {
    it('should simulate STK Push when credentials not configured', async () => {
      const result = await service.initiateSTKPush({
        phone: '0712345678',
        amount: 1048,
        accountReference: 'BODA-DEPOSIT',
        transactionDesc: 'BodaInsure Dep',
      });

      expect(result.success).toBe(true);
      expect(result.checkoutRequestId).toBeDefined();
      expect(result.merchantRequestId).toBeDefined();
      expect(result.responseCode).toBe('0');
    });
  });

  describe('parseCallback', () => {
    it('should parse successful callback correctly', () => {
      const callbackBody = {
        stkCallback: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1048 },
              { Name: 'MpesaReceiptNumber', Value: 'ABC123XYZ' },
              { Name: 'TransactionDate', Value: '20241214121500' },
              { Name: 'PhoneNumber', Value: '254712345678' },
            ],
          },
        },
      };

      const result = service.parseCallback(callbackBody);

      expect(result.merchantRequestId).toBe('merchant-123');
      expect(result.checkoutRequestId).toBe('checkout-456');
      expect(result.resultCode).toBe(0);
      expect(result.isSuccessful).toBe(true);
      expect(result.mpesaReceiptNumber).toBe('ABC123XYZ');
      expect(result.amount).toBe(1048);
      expect(result.phoneNumber).toBe('254712345678');
    });

    it('should parse failed callback correctly', () => {
      const callbackBody = {
        stkCallback: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      };

      const result = service.parseCallback(callbackBody);

      expect(result.isSuccessful).toBe(false);
      expect(result.resultCode).toBe(1032);
      expect(result.resultDesc).toBe('Request cancelled by user');
      expect(result.mpesaReceiptNumber).toBeUndefined();
    });

    it('should handle callback without metadata', () => {
      const callbackBody = {
        stkCallback: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResultCode: 1037,
          ResultDesc: 'DS timeout user cannot be reached',
        },
      };

      const result = service.parseCallback(callbackBody);

      expect(result.isSuccessful).toBe(false);
      expect(result.amount).toBeUndefined();
    });
  });

  describe('isConfigured', () => {
    it('should return false when credentials are not set', () => {
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('querySTKStatus', () => {
    it('should return error when not configured', async () => {
      const result = await service.querySTKStatus('checkout-123');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('M-Pesa not configured');
    });
  });
});
