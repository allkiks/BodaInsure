import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { WhatsAppService, WhatsAppMessageType } from './whatsapp.service.js';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let httpService: jest.Mocked<HttpService>;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      const config: Record<string, unknown> = {
        WHATSAPP_ACCESS_TOKEN: 'test-token',
        WHATSAPP_PHONE_NUMBER_ID: '123456789',
        WHATSAPP_BUSINESS_ACCOUNT_ID: '987654321',
        WHATSAPP_API_VERSION: 'v18.0',
        WHATSAPP_ENABLED: true,
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
        WhatsAppService,
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

    service = module.get<WhatsAppService>(WhatsAppService);
    httpService = module.get(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send text message successfully', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            messages: [{ id: 'wamid.123456' }],
          },
        }),
      );

      const result = await service.send({
        to: '+254712345678',
        type: WhatsAppMessageType.TEXT,
        text: 'Hello from BodaInsure!',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.123456');
      expect(result.status).toBe('Sent');
    });

    it('should format Kenyan phone numbers correctly', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            messages: [{ id: 'wamid.123456' }],
          },
        }),
      );

      await service.send({
        to: '0712345678',
        type: WhatsAppMessageType.TEXT,
        text: 'Test',
      });

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ to: '254712345678' }),
        expect.any(Object),
      );
    });

    it('should reject invalid phone numbers', async () => {
      const result = await service.send({
        to: '12345',
        type: WhatsAppMessageType.TEXT,
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('InvalidPhoneNumber');
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({
          response: {
            data: {
              error: {
                message: 'Invalid access token',
              },
            },
          },
        })),
      );

      const result = await service.send({
        to: '+254712345678',
        type: WhatsAppMessageType.TEXT,
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('SendFailed');
      expect(result.error).toBe('Invalid access token');
    });
  });

  describe('sendText', () => {
    it('should send text message', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            messages: [{ id: 'wamid.123456' }],
          },
        }),
      );

      const result = await service.sendText('+254712345678', 'Hello!');

      expect(result.success).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'text',
          text: { preview_url: false, body: 'Hello!' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendTemplate', () => {
    it('should send template message', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            messages: [{ id: 'wamid.123456' }],
          },
        }),
      );

      const result = await service.sendTemplate(
        '+254712345678',
        'payment_reminder',
        [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'John' }],
          },
        ],
        'en',
      );

      expect(result.success).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'template',
          template: {
            name: 'payment_reminder',
            language: { code: 'en' },
            components: expect.any(Array),
          },
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendDocument', () => {
    it('should send document message', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            messages: [{ id: 'wamid.123456' }],
          },
        }),
      );

      const result = await service.sendDocument(
        '+254712345678',
        'https://example.com/policy.pdf',
        'policy.pdf',
        'Your policy certificate',
      );

      expect(result.success).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'document',
          document: {
            link: 'https://example.com/policy.pdf',
            filename: 'policy.pdf',
            caption: 'Your policy certificate',
          },
        }),
        expect.any(Object),
      );
    });
  });

  describe('sendPolicyDocument', () => {
    it('should send policy document with correct filename', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            messages: [{ id: 'wamid.123456' }],
          },
        }),
      );

      await service.sendPolicyDocument(
        '+254712345678',
        'BDA-2412-000001',
        'https://example.com/policy.pdf',
      );

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          document: expect.objectContaining({
            filename: 'BodaInsure_Policy_BDA-2412-000001.pdf',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read', async () => {
      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      const result = await service.markAsRead('wamid.123456');

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: 'wamid.123456',
        },
        expect.any(Object),
      );
    });

    it('should handle mark as read errors', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const result = await service.markAsRead('wamid.123456');

      expect(result).toBe(false);
    });
  });

  describe('getTemplates', () => {
    it('should return list of templates', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            data: [
              { name: 'payment_reminder', status: 'APPROVED', language: 'en' },
              { name: 'policy_issued', status: 'APPROVED', language: 'en' },
            ],
          },
        }),
      );

      const templates = await service.getTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('payment_reminder');
    });

    it('should return empty array on error', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const templates = await service.getTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('validateCredentials', () => {
    it('should return true when credentials are valid', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: { id: '123456789' },
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

describe('WhatsAppService (disabled mode)', () => {
  let service: WhatsAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: unknown) => {
              if (key === 'WHATSAPP_ENABLED') return false;
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

    service = module.get<WhatsAppService>(WhatsAppService);
  });

  it('should return dev mode result when WhatsApp is disabled', async () => {
    const result = await service.send({
      to: '+254712345678',
      type: WhatsAppMessageType.TEXT,
      text: 'Test',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('DevMode');
    expect(result.messageId).toMatch(/^dev-wa-/);
  });
});
