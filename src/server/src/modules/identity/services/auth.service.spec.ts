import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { OtpService, GenerateOtpResult } from './otp.service';
import { SessionService, SessionTokens } from './session.service';
import { OtpPurpose } from '../entities/otp.entity';
import { DeviceType, Session } from '../entities/session.entity';
import {
  User,
  UserStatus,
  UserRole,
  KycStatus,
  Language,
} from '../entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let otpService: jest.Mocked<OtpService>;
  let sessionService: jest.Mocked<SessionService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPhone = '+254712345678';
  const mockUserId = 'user-uuid-123';
  const mockAccessToken = 'mock.jwt.token';
  const mockRefreshToken = 'mock-refresh-token';

  const createMockUser = (overrides: Partial<User> = {}): User =>
    ({
      id: mockUserId,
      phone: mockPhone,
      status: UserStatus.ACTIVE,
      role: UserRole.RIDER,
      kycStatus: KycStatus.PENDING,
      language: Language.ENGLISH,
      failedLoginAttempts: 0,
      ...overrides,
    }) as User;

  const createMockOtpResult = (overrides: Partial<GenerateOtpResult> = {}): GenerateOtpResult => ({
    success: true,
    otp: '123456',
    otpId: 'otp-uuid-123',
    message: 'OTP generated successfully',
    ...overrides,
  });

  const createMockSessionTokens = (): SessionTokens => ({
    refreshToken: mockRefreshToken,
    sessionId: 'session-uuid-123',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  beforeEach(async () => {
    const mockUserService = {
      createUser: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn(),
      activateUser: jest.fn(),
      updateLastLogin: jest.fn(),
      isAccountLocked: jest.fn(),
      recordFailedLogin: jest.fn(),
    };

    const mockOtpService = {
      generateOtp: jest.fn(),
      verifyOtp: jest.fn(),
    };

    const mockSessionService = {
      createSession: jest.fn(),
      validateRefreshToken: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllUserSessions: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue(mockAccessToken),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('30d'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    otpService = module.get(OtpService);
    sessionService = module.get(SessionService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and send OTP', async () => {
      userService.findByPhone.mockResolvedValue(null);
      userService.createUser.mockResolvedValue(createMockUser({ status: UserStatus.PENDING }));
      otpService.generateOtp.mockResolvedValue(createMockOtpResult());

      const result = await service.register({
        phone: '0712345678',
        termsAccepted: true,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.otpSent).toBe(true);
      expect(result.userId).toBe(mockUserId);
      expect(userService.createUser).toHaveBeenCalled();
      expect(otpService.generateOtp).toHaveBeenCalledWith(
        mockPhone,
        OtpPurpose.REGISTRATION,
        mockUserId,
        undefined,
        undefined,
      );
    });

    it('should throw BadRequestException if terms not accepted', async () => {
      await expect(
        service.register({
          phone: '0712345678',
          termsAccepted: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return DUPLICATE for already registered active user', async () => {
      userService.findByPhone.mockResolvedValue(createMockUser({ status: UserStatus.ACTIVE }));

      const result = await service.register({
        phone: '0712345678',
        termsAccepted: true,
      });

      expect(result.status).toBe('DUPLICATE');
      expect(result.otpSent).toBe(false);
    });

    it('should resend OTP for pending user', async () => {
      userService.findByPhone.mockResolvedValue(createMockUser({ status: UserStatus.PENDING }));
      otpService.generateOtp.mockResolvedValue(createMockOtpResult());

      const result = await service.register({
        phone: '0712345678',
        termsAccepted: true,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.otpSent).toBe(true);
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    it('should return RATE_LIMITED when OTP rate limited', async () => {
      userService.findByPhone.mockResolvedValue(createMockUser({ status: UserStatus.PENDING }));
      otpService.generateOtp.mockResolvedValue({
        success: false,
        message: 'Too many OTP requests. Please wait 300 seconds.',
        retryAfter: 300,
      });

      const result = await service.register({
        phone: '0712345678',
        termsAccepted: true,
      });

      expect(result.status).toBe('RATE_LIMITED');
      expect(result.otpSent).toBe(false);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and return tokens for registration', async () => {
      const pendingUser = createMockUser({ status: UserStatus.PENDING });
      otpService.verifyOtp.mockResolvedValueOnce({
        success: true,
        message: 'OTP verified successfully',
        userId: mockUserId,
      });
      userService.findByPhone.mockResolvedValue(pendingUser);
      userService.activateUser.mockResolvedValue(createMockUser());
      sessionService.createSession.mockResolvedValue(createMockSessionTokens());

      const result = await service.verifyOtp(
        { phone: '0712345678', otp: '123456' },
        DeviceType.MOBILE_APP,
      );

      expect(result.status).toBe('SUCCESS');
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.user).toBeDefined();
      expect(userService.activateUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should verify OTP for login without activating', async () => {
      const activeUser = createMockUser({ status: UserStatus.ACTIVE });
      otpService.verifyOtp
        .mockResolvedValueOnce({ success: false, message: 'No pending OTP found' })
        .mockResolvedValueOnce({
          success: true,
          message: 'OTP verified successfully',
          userId: mockUserId,
        });
      userService.findByPhone.mockResolvedValue(activeUser);
      sessionService.createSession.mockResolvedValue(createMockSessionTokens());

      const result = await service.verifyOtp(
        { phone: '0712345678', otp: '123456' },
        DeviceType.MOBILE_APP,
      );

      expect(result.status).toBe('SUCCESS');
      expect(userService.activateUser).not.toHaveBeenCalled();
    });

    it('should return INVALID_OTP for wrong code', async () => {
      otpService.verifyOtp.mockResolvedValue({
        success: false,
        message: 'Incorrect verification code. 4 attempt(s) remaining.',
        attemptsRemaining: 4,
      });

      const result = await service.verifyOtp(
        { phone: '0712345678', otp: '000000' },
        DeviceType.MOBILE_APP,
      );

      expect(result.status).toBe('INVALID_OTP');
      expect(result.attemptsRemaining).toBe(4);
    });

    it('should return EXPIRED_OTP for expired OTP', async () => {
      otpService.verifyOtp.mockResolvedValue({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });

      const result = await service.verifyOtp(
        { phone: '0712345678', otp: '123456' },
        DeviceType.MOBILE_APP,
      );

      expect(result.status).toBe('EXPIRED_OTP');
    });

    it('should return MAX_ATTEMPTS when attempts exhausted', async () => {
      otpService.verifyOtp.mockResolvedValue({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
        attemptsRemaining: 0,
      });

      const result = await service.verifyOtp(
        { phone: '0712345678', otp: '123456' },
        DeviceType.MOBILE_APP,
      );

      expect(result.status).toBe('MAX_ATTEMPTS');
    });
  });

  describe('login', () => {
    it('should send OTP for existing active user', async () => {
      userService.findByPhone.mockResolvedValue(createMockUser());
      userService.isAccountLocked.mockResolvedValue({ isLocked: false });
      otpService.generateOtp.mockResolvedValue(createMockOtpResult());

      const result = await service.login({ phone: '0712345678' });

      expect(result.status).toBe('OTP_SENT');
      expect(otpService.generateOtp).toHaveBeenCalledWith(
        mockPhone,
        OtpPurpose.LOGIN,
        mockUserId,
        undefined,
        undefined,
      );
    });

    it('should return USER_NOT_FOUND for non-existent user', async () => {
      userService.findByPhone.mockResolvedValue(null);

      const result = await service.login({ phone: '0712345678' });

      expect(result.status).toBe('USER_NOT_FOUND');
    });

    it('should return ACCOUNT_SUSPENDED for suspended user', async () => {
      userService.findByPhone.mockResolvedValue(
        createMockUser({ status: UserStatus.SUSPENDED }),
      );

      const result = await service.login({ phone: '0712345678' });

      expect(result.status).toBe('ACCOUNT_SUSPENDED');
    });

    it('should return USER_NOT_FOUND for deactivated user', async () => {
      userService.findByPhone.mockResolvedValue(
        createMockUser({ status: UserStatus.DEACTIVATED }),
      );

      const result = await service.login({ phone: '0712345678' });

      expect(result.status).toBe('USER_NOT_FOUND');
    });

    it('should return ACCOUNT_LOCKED for locked user', async () => {
      userService.findByPhone.mockResolvedValue(
        createMockUser({ status: UserStatus.LOCKED }),
      );
      userService.isAccountLocked.mockResolvedValue({
        isLocked: true,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      const result = await service.login({ phone: '0712345678' });

      expect(result.status).toBe('ACCOUNT_LOCKED');
      expect(result.lockedUntil).toBeDefined();
    });

    it('should return RATE_LIMITED when OTP rate limited', async () => {
      userService.findByPhone.mockResolvedValue(createMockUser());
      userService.isAccountLocked.mockResolvedValue({ isLocked: false });
      otpService.generateOtp.mockResolvedValue({
        success: false,
        message: 'Too many OTP requests',
      });

      const result = await service.login({ phone: '0712345678' });

      expect(result.status).toBe('RATE_LIMITED');
    });
  });

  describe('refreshToken', () => {
    it('should return new access token for valid refresh token', async () => {
      const mockSession = {
        id: 'session-123',
        user: createMockUser(),
      } as Session;
      sessionService.validateRefreshToken.mockResolvedValue(mockSession);

      const result = await service.refreshToken({ refreshToken: mockRefreshToken });

      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.expiresIn).toBeDefined();
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          phone: mockPhone,
          role: UserRole.RIDER,
        }),
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      sessionService.validateRefreshToken.mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for non-active user', async () => {
      const mockSession = {
        id: 'session-123',
        user: createMockUser({ status: UserStatus.SUSPENDED }),
      } as Session;
      sessionService.validateRefreshToken.mockResolvedValue(mockSession);

      await expect(
        service.refreshToken({ refreshToken: mockRefreshToken }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('should revoke session on logout', async () => {
      const mockSession = { id: 'session-123' } as Session;
      sessionService.validateRefreshToken.mockResolvedValue(mockSession);

      await service.logout(mockRefreshToken);

      expect(sessionService.revokeSession).toHaveBeenCalledWith(
        'session-123',
        'User logout',
      );
    });

    it('should not throw if session not found', async () => {
      sessionService.validateRefreshToken.mockResolvedValue(null);

      await expect(service.logout(mockRefreshToken)).resolves.not.toThrow();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all user sessions', async () => {
      sessionService.revokeAllUserSessions.mockResolvedValue(3);

      const result = await service.logoutAll(mockUserId);

      expect(result).toBe(3);
      expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserId,
        'User logout from all devices',
      );
    });
  });

  describe('validateJwtPayload', () => {
    it('should return user data for valid active user', async () => {
      userService.findById.mockResolvedValue(createMockUser());

      const result = await service.validateJwtPayload({
        sub: mockUserId,
        phone: mockPhone,
        role: UserRole.RIDER,
      });

      expect(result).toEqual({
        id: mockUserId,
        phone: mockPhone,
        role: UserRole.RIDER,
        organizationId: undefined,
      });
    });

    it('should return null for non-existent user', async () => {
      userService.findById.mockResolvedValue(null);

      const result = await service.validateJwtPayload({
        sub: 'non-existent',
        phone: mockPhone,
        role: UserRole.RIDER,
      });

      expect(result).toBeNull();
    });

    it('should return null for non-active user', async () => {
      userService.findById.mockResolvedValue(
        createMockUser({ status: UserStatus.SUSPENDED }),
      );

      const result = await service.validateJwtPayload({
        sub: mockUserId,
        phone: mockPhone,
        role: UserRole.RIDER,
      });

      expect(result).toBeNull();
    });
  });

  describe('getExpiresInSeconds', () => {
    it('should parse days correctly', async () => {
      configService.get.mockReturnValue('30d');

      // Access via refreshToken which uses getExpiresInSeconds internally
      const mockSession = {
        id: 'session-123',
        user: createMockUser(),
      } as Session;
      sessionService.validateRefreshToken.mockResolvedValue(mockSession);

      const result = await service.refreshToken({ refreshToken: mockRefreshToken });

      expect(result.expiresIn).toBe(30 * 24 * 60 * 60);
    });

    it('should parse hours correctly', async () => {
      configService.get.mockReturnValue('24h');

      const mockSession = {
        id: 'session-123',
        user: createMockUser(),
      } as Session;
      sessionService.validateRefreshToken.mockResolvedValue(mockSession);

      const result = await service.refreshToken({ refreshToken: mockRefreshToken });

      expect(result.expiresIn).toBe(24 * 60 * 60);
    });

    it('should parse minutes correctly', async () => {
      configService.get.mockReturnValue('30m');

      const mockSession = {
        id: 'session-123',
        user: createMockUser(),
      } as Session;
      sessionService.validateRefreshToken.mockResolvedValue(mockSession);

      const result = await service.refreshToken({ refreshToken: mockRefreshToken });

      expect(result.expiresIn).toBe(30 * 60);
    });

    it('should default to 30 days for invalid format', async () => {
      configService.get.mockReturnValue('invalid');

      const mockSession = {
        id: 'session-123',
        user: createMockUser(),
      } as Session;
      sessionService.validateRefreshToken.mockResolvedValue(mockSession);

      const result = await service.refreshToken({ refreshToken: mockRefreshToken });

      expect(result.expiresIn).toBe(30 * 24 * 60 * 60);
    });
  });
});
