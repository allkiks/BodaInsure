import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { SmsService } from './sms.service.js';

describe('SmsService', () => {
  let service: SmsService;
  let httpService: jest.Mocked<HttpService>;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      const config: Record<string, unknown> = {
        AT_API_KEY: 'test-api-key',
        AT_USERNAME: 'sandbox',
        AT_SENDER_ID: 'BodaInsure',
        SMS_ENABLED: true,
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    httpService = module.get(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send SMS successfully', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            SMSMessageData: {
              Recipients: [
                {
                  status: 'Success',
                  statusCode: 101,
                  messageId: 'ATXid_123',
                  cost: 'KES 0.8000',
                },
              ],
            },
          },
        }),
      );

      const result = await service.send({
        to: '+254712345678',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('ATXid_123');
      expect(result.status).toBe('Success');
      expect(result.cost).toBe(80); // 0.8 KES in cents
    });

    it('should format Kenyan phone numbers correctly', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            SMSMessageData: {
              Recipients: [{ status: 'Success', messageId: 'ATXid_123' }],
            },
          },
        }),
      );

      // Test various formats - phone is URL-encoded in the body (%2B = +)
      await service.send({ to: '0712345678', message: 'Test' });
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('%2B254712345678'), // URL-encoded +254712345678
        expect.any(Object),
      );

      await service.send({ to: '712345678', message: 'Test' });
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('%2B254712345678'),
        expect.any(Object),
      );

      await service.send({ to: '254712345678', message: 'Test' });
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('%2B254712345678'),
        expect.any(Object),
      );
    });

    it('should reject invalid phone numbers', async () => {
      const result = await service.send({
        to: '12345',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('InvalidPhoneNumber');
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const result = await service.send({
        to: '+254712345678',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('SendFailed');
      expect(result.error).toBe('Network error');
    });

    it('should handle failed delivery status', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            SMSMessageData: {
              Recipients: [
                {
                  status: 'InvalidPhoneNumber',
                  statusCode: 403,
                  messageId: '',
                },
              ],
            },
          },
        }),
      );

      const result = await service.send({
        to: '+254712345678',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('InvalidPhoneNumber');
    });
  });

  describe('sendBulk', () => {
    it('should send multiple SMS messages', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            SMSMessageData: {
              Recipients: [{ status: 'Success', messageId: 'ATXid_123' }],
            },
          },
        }),
      );

      const requests = [
        { to: '+254712345678', message: 'Test 1' },
        { to: '+254712345679', message: 'Test 2' },
      ];

      const results = await service.sendBulk(requests);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('getBalance', () => {
    it('should return balance information', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            UserData: {
              balance: 'KES 1000.00',
            },
          },
        }),
      );

      const balance = await service.getBalance();

      expect(balance).toEqual({
        currency: 'KES',
        balance: '1000.00',
      });
    });

    it('should handle balance fetch errors', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const balance = await service.getBalance();

      expect(balance).toBeNull();
    });
  });

  describe('validateCredentials', () => {
    it('should return true when credentials are valid', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            UserData: {
              balance: 'KES 1000.00',
            },
          },
        }),
      );

      const isValid = await service.validateCredentials();

      expect(isValid).toBe(true);
    });

    it('should return false when credentials are invalid', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Unauthorized')),
      );

      const isValid = await service.validateCredentials();

      expect(isValid).toBe(false);
    });
  });
});

describe('SmsService (disabled mode)', () => {
  let service: SmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: unknown) => {
              if (key === 'SMS_ENABLED') return false;
              return defaultValue;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: { post: jest.fn(), get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  it('should return dev mode result when SMS is disabled', async () => {
    const result = await service.send({
      to: '+254712345678',
      message: 'Test',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('DevMode');
    expect(result.messageId).toMatch(/^dev-/);
  });
});
