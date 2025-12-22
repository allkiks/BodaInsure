import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationModule } from '../notification/notification.module.js';

// Entities
import { User } from './entities/user.entity.js';
import { Otp } from './entities/otp.entity.js';
import { Session } from './entities/session.entity.js';
import { Organization } from '../organization/entities/organization.entity.js';
import { Membership } from '../organization/entities/membership.entity.js';

// Services
import { AuthService } from './services/auth.service.js';
import { UserService } from './services/user.service.js';
import { OtpService } from './services/otp.service.js';
import { SessionService } from './services/session.service.js';
import { DataExportService } from './services/data-export.service.js';
import { SeederService } from './services/seeder.service.js';

// Controllers
import { AuthController } from './controllers/auth.controller.js';
import { UserController } from './controllers/user.controller.js';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy.js';

// Guards
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@Module({
  imports: [
    // Register entities with TypeORM
    TypeOrmModule.forFeature([User, Otp, Session, Organization, Membership]),

    // Notification module for SMS sending
    forwardRef(() => NotificationModule),

    // Passport configuration
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT configuration
    // Per CLAUDE.md Section 6.1: JWT tokens with RS256 signing
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const algorithm = configService.get<string>('app.jwt.algorithm', 'HS256');
        const privateKey = configService.get<string>('app.jwt.privateKey');
        const publicKey = configService.get<string>('app.jwt.publicKey');
        const secret = configService.get<string>('app.jwt.secret');
        const expiresIn = configService.get<string>('app.jwt.expiresIn', '30d');

        // Use RS256 if keys are available, otherwise fall back to HS256
        if (algorithm === 'RS256' && privateKey && publicKey) {
          return {
            privateKey,
            publicKey,
            signOptions: {
              algorithm: 'RS256',
              expiresIn: expiresIn as unknown as undefined,
            },
            verifyOptions: {
              algorithms: ['RS256'],
            },
          } as JwtModuleOptions;
        }

        // Fallback to HS256
        if (!secret) {
          throw new Error('JWT_SECRET or RS256 keys must be configured');
        }
        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: expiresIn as unknown as undefined,
          },
        } as JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, UserController],
  providers: [
    // Services
    AuthService,
    UserService,
    OtpService,
    SessionService,
    DataExportService,
    SeederService,

    // Strategies
    JwtStrategy,

    // Guards
    JwtAuthGuard,
  ],
  exports: [
    // Export services for use in other modules
    AuthService,
    UserService,
    OtpService,
    SessionService,
    DataExportService,
    SeederService,
    JwtStrategy,
    PassportModule,
    JwtModule,

    // Export guards for use in other modules
    JwtAuthGuard,
  ],
})
export class IdentityModule {}
