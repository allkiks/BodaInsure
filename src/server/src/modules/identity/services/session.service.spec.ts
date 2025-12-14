import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  SessionService,
  CreateSessionData,
  SessionTokens,
} from './session.service';
import {
  Session,
  DeviceType,
  SessionStatus,
} from '../entities/session.entity';
import { User, UserStatus, UserRole, KycStatus, Language } from '../entities/user.entity';
import { SESSION_CONFIG } from '../../../common/constants';

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<Repository<Session>>;

  const mockUserId = 'user-uuid-123';
  const mockSessionId = 'session-uuid-123';
  const mockRefreshToken = 'mock-refresh-token-base64url';

  const createMockUser = (): User =>
    ({
      id: mockUserId,
      phone: '+254712345678',
      status: UserStatus.ACTIVE,
      role: UserRole.RIDER,
      kycStatus: KycStatus.PENDING,
      language: Language.ENGLISH,
    }) as User;

  const createMockSession = (overrides: Partial<Session> = {}): Session =>
    ({
      id: mockSessionId,
      userId: mockUserId,
      refreshTokenHash: crypto.createHash('sha256').update(mockRefreshToken).digest('hex'),
      deviceType: DeviceType.MOBILE_APP,
      status: SessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: createMockUser(),
      isIdleExpired: jest.fn().mockReturnValue(false),
      ...overrides,
    }) as unknown as Session;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(Session),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    sessionRepository = module.get(getRepositoryToken(Session));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    const createSessionData: CreateSessionData = {
      userId: mockUserId,
      deviceType: DeviceType.MOBILE_APP,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should create a new session with refresh token', async () => {
      sessionRepository.create.mockImplementation((data) => ({
        id: mockSessionId,
        ...data,
      }) as Session);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.createSession(createSessionData);

      expect(result.sessionId).toBe(mockSessionId);
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBeGreaterThan(20);
      expect(result.expiresAt).toBeDefined();
    });

    it('should hash refresh token before storing', async () => {
      let storedSession: Partial<Session> | null = null;
      sessionRepository.create.mockImplementation((data) => {
        storedSession = { id: mockSessionId, ...data };
        return storedSession as Session;
      });
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.createSession(createSessionData);

      // Verify the stored hash matches the returned token
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.refreshToken)
        .digest('hex');
      expect(storedSession!.refreshTokenHash).toBe(expectedHash);
    });

    it('should set correct expiry for mobile app (30 days)', async () => {
      sessionRepository.create.mockImplementation((data) => ({
        id: mockSessionId,
        ...data,
      }) as Session);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.createSession({
        ...createSessionData,
        deviceType: DeviceType.MOBILE_APP,
      });

      const expectedExpiry = Date.now() + SESSION_CONFIG.MOBILE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      expect(Math.abs(result.expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);
    });

    it('should set correct expiry for USSD (3 minutes)', async () => {
      sessionRepository.create.mockImplementation((data) => ({
        id: mockSessionId,
        ...data,
      }) as Session);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.createSession({
        ...createSessionData,
        deviceType: DeviceType.USSD,
      });

      const expectedExpiry = Date.now() + SESSION_CONFIG.USSD_TIMEOUT_SECONDS * 1000;
      expect(Math.abs(result.expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate correct refresh token and return session', async () => {
      const mockSession = createMockSession();
      sessionRepository.findOne.mockResolvedValue(mockSession);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.validateRefreshToken(mockRefreshToken);

      expect(result).toBeDefined();
      expect(result!.id).toBe(mockSessionId);
    });

    it('should return null for invalid token', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      const result = await service.validateRefreshToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null and mark expired if session has expired', async () => {
      const expiredSession = createMockSession({
        expiresAt: new Date(Date.now() - 1000),
      });
      sessionRepository.findOne.mockResolvedValue(expiredSession);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.validateRefreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(expiredSession.status).toBe(SessionStatus.EXPIRED);
    });

    it('should check idle timeout for web sessions', async () => {
      const idleExpiredMock = jest.fn().mockReturnValue(true);
      const webSession = createMockSession({
        deviceType: DeviceType.WEB,
        isIdleExpired: idleExpiredMock,
      } as any);
      sessionRepository.findOne.mockResolvedValue(webSession);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.validateRefreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(idleExpiredMock).toHaveBeenCalledWith(SESSION_CONFIG.WEB_EXPIRY_MINUTES);
    });

    it('should update last activity on successful validation', async () => {
      const mockSession = createMockSession();
      const originalLastActivity = mockSession.lastActivityAt;
      sessionRepository.findOne.mockResolvedValue(mockSession);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      await service.validateRefreshToken(mockRefreshToken);

      expect(mockSession.lastActivityAt.getTime()).toBeGreaterThanOrEqual(
        originalLastActivity.getTime(),
      );
      expect(sessionRepository.save).toHaveBeenCalled();
    });
  });

  describe('revokeSession', () => {
    it('should revoke an active session', async () => {
      const mockSession = createMockSession();
      sessionRepository.findOne.mockResolvedValue(mockSession);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      await service.revokeSession(mockSessionId, 'User logout');

      expect(mockSession.status).toBe(SessionStatus.REVOKED);
      expect(mockSession.revokedReason).toBe('User logout');
      expect(mockSession.revokedAt).toBeDefined();
    });

    it('should not throw if session not found', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.revokeSession('non-existent', 'Test'),
      ).resolves.not.toThrow();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all active sessions for a user', async () => {
      sessionRepository.update.mockResolvedValue({ affected: 3 } as any);

      const result = await service.revokeAllUserSessions(mockUserId);

      expect(result).toBe(3);
      expect(sessionRepository.update).toHaveBeenCalledWith(
        {
          userId: mockUserId,
          status: SessionStatus.ACTIVE,
        },
        expect.objectContaining({
          status: SessionStatus.REVOKED,
          revokedReason: 'User logout from all devices',
          revokedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions for a user', async () => {
      const sessions = [
        createMockSession({ id: 'session-1' }),
        createMockSession({ id: 'session-2' }),
      ];
      sessionRepository.find.mockResolvedValue(sessions);

      const result = await service.getActiveSessions(mockUserId);

      expect(result).toHaveLength(2);
      expect(sessionRepository.find).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          status: SessionStatus.ACTIVE,
        },
        order: {
          lastActivityAt: 'DESC',
        },
      });
    });
  });

  describe('rotateRefreshToken', () => {
    it('should generate new refresh token and update session', async () => {
      const mockSession = createMockSession();
      const originalHash = mockSession.refreshTokenHash;
      sessionRepository.findOne.mockResolvedValue(mockSession);
      sessionRepository.save.mockImplementation((session) =>
        Promise.resolve(session as Session),
      );

      const result = await service.rotateRefreshToken(mockSessionId);

      expect(result).toBeDefined();
      expect(result!.refreshToken).toBeDefined();
      expect(mockSession.refreshTokenHash).not.toBe(originalHash);
    });

    it('should return null for non-existent session', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      const result = await service.rotateRefreshToken('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for non-active session', async () => {
      const revokedSession = createMockSession({ status: SessionStatus.REVOKED });
      sessionRepository.findOne.mockResolvedValue(revokedSession);

      const result = await service.rotateRefreshToken(mockSessionId);

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete sessions expired more than 90 days ago', async () => {
      sessionRepository.delete.mockResolvedValue({ affected: 15 } as any);

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(15);
      expect(sessionRepository.delete).toHaveBeenCalled();
    });
  });
});
