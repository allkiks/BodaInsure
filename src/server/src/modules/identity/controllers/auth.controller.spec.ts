import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { OtpService } from '../services/otp.service';
import { DeviceType } from '../entities/session.entity';
import { OtpPurpose } from '../entities/otp.entity';
import { UserStatus, KycStatus } from '../entities/user.entity';
import type { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let otpService: jest.Mocked<OtpService>;

  const createMockRequest = (ip: string = '192.168.1.1', forwardedFor?: string): Request => ({
    get: jest.fn((header: string) => {
      if (header === 'x-forwarded-for') return forwardedFor;
      if (header === 'user-agent') return 'Mozilla/5.0';
      return undefined;
    }),
    ip,
  }) as unknown as Request;

  let mockRequest: Request;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      verifyOtp: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
    };

    const mockOtpService = {
      canResendOtp: jest.fn(),
      generateOtp: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: OtpService, useValue: mockOtpService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    otpService = module.get(OtpService);
    mockRequest = createMockRequest();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should call authService.register with correct parameters', async () => {
      const dto = { phone: '0712345678', termsAccepted: true };
      authService.register.mockResolvedValue({
        status: 'SUCCESS',
        userId: 'user-123',
        otpSent: true,
        message: 'OTP sent',
      });

      await controller.register(dto, mockRequest);

      expect(authService.register).toHaveBeenCalledWith(
        dto,
        '192.168.1.1',
        'Mozilla/5.0',
      );
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const reqWithProxy = createMockRequest('127.0.0.1', '10.0.0.1, 192.168.1.1');

      authService.register.mockResolvedValue({
        status: 'SUCCESS',
        otpSent: true,
        message: 'OTP sent',
      });

      await controller.register(
        { phone: '0712345678', termsAccepted: true },
        reqWithProxy,
      );

      expect(authService.register).toHaveBeenCalledWith(
        expect.anything(),
        '10.0.0.1',
        'Mozilla/5.0',
      );
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp with default device type', async () => {
      const dto = { phone: '0712345678', otp: '123456' };
      authService.verifyOtp.mockResolvedValue({
        status: 'SUCCESS',
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 3600,
        user: {
          id: 'user-123',
          phone: '+254712345678',
          status: UserStatus.ACTIVE,
          kycStatus: KycStatus.PENDING,
        },
        message: 'Verified',
      });

      await controller.verifyOtp(dto, mockRequest, undefined);

      expect(authService.verifyOtp).toHaveBeenCalledWith(
        dto,
        DeviceType.MOBILE_APP,
        '192.168.1.1',
        'Mozilla/5.0',
      );
    });

    it('should parse web device type from header', async () => {
      const dto = { phone: '0712345678', otp: '123456' };
      authService.verifyOtp.mockResolvedValue({
        status: 'SUCCESS',
        message: 'Verified',
      });

      await controller.verifyOtp(dto, mockRequest, 'web');

      expect(authService.verifyOtp).toHaveBeenCalledWith(
        dto,
        DeviceType.WEB,
        expect.any(String),
        expect.any(String),
      );
    });

    it('should parse ussd device type from header', async () => {
      const dto = { phone: '0712345678', otp: '123456' };
      authService.verifyOtp.mockResolvedValue({
        status: 'SUCCESS',
        message: 'Verified',
      });

      await controller.verifyOtp(dto, mockRequest, 'USSD');

      expect(authService.verifyOtp).toHaveBeenCalledWith(
        dto,
        DeviceType.USSD,
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('login', () => {
    it('should call authService.login with correct parameters', async () => {
      const dto = { phone: '0712345678' };
      authService.login.mockResolvedValue({
        status: 'OTP_SENT',
        message: 'OTP sent',
      });

      await controller.login(dto, mockRequest);

      expect(authService.login).toHaveBeenCalledWith(
        dto,
        '192.168.1.1',
        'Mozilla/5.0',
      );
    });
  });

  describe('resendOtp', () => {
    it('should check cooldown and generate new OTP', async () => {
      const dto = { phone: '0712345678', purpose: OtpPurpose.LOGIN };
      otpService.canResendOtp.mockResolvedValue({ allowed: true });
      otpService.generateOtp.mockResolvedValue({
        success: true,
        otp: '123456',
        otpId: 'otp-123',
        message: 'Generated',
      });

      const result = await controller.resendOtp(dto, mockRequest);

      expect(result.success).toBe(true);
      expect(result.message).toContain('sent');
      expect(otpService.canResendOtp).toHaveBeenCalledWith(
        dto.phone,
        dto.purpose,
      );
      expect(otpService.generateOtp).toHaveBeenCalledWith(
        dto.phone,
        dto.purpose,
        undefined,
        '192.168.1.1',
        'Mozilla/5.0',
      );
    });

    it('should return cooldown message when rate limited', async () => {
      const dto = { phone: '0712345678', purpose: OtpPurpose.LOGIN };
      otpService.canResendOtp.mockResolvedValue({ allowed: false, retryAfter: 30 });

      const result = await controller.resendOtp(dto, mockRequest);

      expect(result.success).toBe(false);
      expect(result.message).toContain('30 seconds');
      expect(result.retryAfter).toBe(30);
      expect(otpService.generateOtp).not.toHaveBeenCalled();
    });

    it('should return error when OTP generation fails', async () => {
      const dto = { phone: '0712345678', purpose: OtpPurpose.LOGIN };
      otpService.canResendOtp.mockResolvedValue({ allowed: true });
      otpService.generateOtp.mockResolvedValue({
        success: false,
        message: 'Too many requests',
        retryAfter: 300,
      });

      const result = await controller.resendOtp(dto, mockRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Too many requests');
    });
  });

  describe('refreshToken', () => {
    it('should call authService.refreshToken', async () => {
      const dto = { refreshToken: 'valid-refresh-token' };
      authService.refreshToken.mockResolvedValue({
        accessToken: 'new-token',
        expiresIn: 3600,
      });

      const result = await controller.refreshToken(dto);

      expect(result.accessToken).toBe('new-token');
      expect(authService.refreshToken).toHaveBeenCalledWith(dto);
    });
  });

  describe('logout', () => {
    it('should call authService.logout', async () => {
      const dto = { refreshToken: 'valid-refresh-token' };
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith('valid-refresh-token');
    });
  });

  describe('logoutAll', () => {
    it('should call authService.logoutAll and return count', async () => {
      const user = { id: 'user-123', phone: '+254712345678', role: 'rider' };
      authService.logoutAll.mockResolvedValue(3);

      const result = await controller.logoutAll(user);

      expect(result.sessionsRevoked).toBe(3);
      expect(authService.logoutAll).toHaveBeenCalledWith('user-123');
    });
  });
});
