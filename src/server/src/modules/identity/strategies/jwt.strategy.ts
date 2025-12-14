import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service.js';
import type { JwtPayload } from '../services/auth.service.js';

/**
 * JWT Strategy for Passport
 * Validates JWT tokens and attaches user to request
 *
 * Per CLAUDE.md Section 6.1: JWT tokens with RS256 signing
 * Supports both RS256 (preferred) and HS256 (fallback)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const algorithm = configService.get<string>('app.jwt.algorithm', 'HS256');
    const publicKey = configService.get<string>('app.jwt.publicKey');
    const secret = configService.get<string>('app.jwt.secret');

    // Build strategy options based on available configuration
    let strategyOptions: StrategyOptionsWithoutRequest;

    if (algorithm === 'RS256' && publicKey) {
      // RS256 configuration (preferred per CLAUDE.md)
      strategyOptions = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: publicKey,
        algorithms: ['RS256'],
      };
    } else if (secret) {
      // HS256 fallback configuration
      strategyOptions = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: secret,
        algorithms: ['HS256'],
      };
    } else {
      throw new Error('JWT configuration missing: provide RS256 keys or JWT_SECRET');
    }

    super(strategyOptions);
  }

  /**
   * Validate JWT payload and return user object
   * This is called after token signature is verified
   */
  async validate(payload: JwtPayload) {
    const user = await this.authService.validateJwtPayload(payload);

    if (!user) {
      throw new UnauthorizedException('Invalid token or inactive user');
    }

    return user;
  }
}
