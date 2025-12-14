import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import {
  Session,
  DeviceType,
  SessionStatus,
} from '../entities/session.entity.js';
import { SESSION_CONFIG } from '../../../common/constants/index.js';

export interface CreateSessionData {
  userId: string;
  deviceType: DeviceType;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
}

export interface SessionTokens {
  refreshToken: string;
  sessionId: string;
  expiresAt: Date;
}

/**
 * Session Service
 * Manages user sessions and refresh tokens
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  /**
   * Create a new session
   */
  async createSession(data: CreateSessionData): Promise<SessionTokens> {
    // Generate refresh token
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashToken(refreshToken);

    // Calculate expiry based on device type
    const expiresAt = this.calculateExpiry(data.deviceType);

    const session = this.sessionRepository.create({
      userId: data.userId,
      refreshTokenHash,
      deviceType: data.deviceType,
      status: SessionStatus.ACTIVE,
      expiresAt,
      lastActivityAt: new Date(),
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
    });

    await this.sessionRepository.save(session);

    this.logger.log(
      `Session created for user ${data.userId.slice(0, 8)}... device=${data.deviceType}`,
    );

    return {
      refreshToken,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Validate refresh token and return session
   */
  async validateRefreshToken(refreshToken: string): Promise<Session | null> {
    const refreshTokenHash = this.hashToken(refreshToken);

    const session = await this.sessionRepository.findOne({
      where: {
        refreshTokenHash,
        status: SessionStatus.ACTIVE,
      },
      relations: ['user'],
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      session.status = SessionStatus.EXPIRED;
      await this.sessionRepository.save(session);
      return null;
    }

    // Check idle timeout for web sessions
    if (session.deviceType === DeviceType.WEB) {
      if (session.isIdleExpired(SESSION_CONFIG.WEB_EXPIRY_MINUTES)) {
        session.status = SessionStatus.EXPIRED;
        await this.sessionRepository.save(session);
        return null;
      }
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return session;
  }

  /**
   * Revoke a session
   */
  async revokeSession(
    sessionId: string,
    reason: string = 'User logout',
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (session) {
      session.status = SessionStatus.REVOKED;
      session.revokedReason = reason;
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);

      this.logger.log(`Session revoked: ${sessionId.slice(0, 8)}...`);
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(
    userId: string,
    reason: string = 'User logout from all devices',
  ): Promise<number> {
    const result = await this.sessionRepository.update(
      {
        userId,
        status: SessionStatus.ACTIVE,
      },
      {
        status: SessionStatus.REVOKED,
        revokedReason: reason,
        revokedAt: new Date(),
      },
    );

    this.logger.log(
      `All sessions revoked for user ${userId.slice(0, 8)}... count=${result.affected}`,
    );

    return result.affected ?? 0;
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
      },
      order: {
        lastActivityAt: 'DESC',
      },
    });
  }

  /**
   * Rotate refresh token (for security)
   */
  async rotateRefreshToken(sessionId: string): Promise<SessionTokens | null> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session || session.status !== SessionStatus.ACTIVE) {
      return null;
    }

    // Generate new refresh token
    const newRefreshToken = this.generateRefreshToken();
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    // Update session with new token
    session.refreshTokenHash = newRefreshTokenHash;
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return {
      refreshToken: newRefreshToken,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Clean up expired sessions (for scheduled job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    // Delete sessions that expired more than 90 days ago
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await this.sessionRepository.delete({
      expiresAt: LessThan(cutoffDate),
    });

    return result.affected ?? 0;
  }

  /**
   * Generate a cryptographically secure refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('base64url');
  }

  /**
   * Hash token using SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Calculate session expiry based on device type
   */
  private calculateExpiry(deviceType: DeviceType): Date {
    switch (deviceType) {
      case DeviceType.MOBILE_APP:
        return new Date(
          Date.now() + SESSION_CONFIG.MOBILE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        );
      case DeviceType.WEB:
        // Web sessions expire after 90 days but have idle timeout
        return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      case DeviceType.USSD:
        return new Date(
          Date.now() + SESSION_CONFIG.USSD_TIMEOUT_SECONDS * 1000,
        );
      default:
        return new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day default
    }
  }
}
