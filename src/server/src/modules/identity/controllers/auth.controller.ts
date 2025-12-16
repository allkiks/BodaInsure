import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service.js';
import { OtpService } from '../services/otp.service.js';
import {
  RegisterDto,
  RegisterResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  ResendOtpDto,
  ResendOtpResponseDto,
  AdminLoginDto,
  AdminLoginResponseDto,
} from '../dto/index.js';
import { DeviceType } from '../entities/session.entity.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ICurrentUser } from '../../../common/decorators/current-user.decorator.js';

/**
 * Auth Controller
 * Handles authentication endpoints per FEAT-AUTH-001 through FEAT-AUTH-004
 *
 * All endpoints under /auth are public (no JWT required)
 * except for logout which requires valid token
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register new user',
    description: 'Register with phone number. OTP will be sent for verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration initiated',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<RegisterResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('user-agent');

    return this.authService.register(dto, ipAddress, userAgent);
  }

  /**
   * Verify OTP code
   * POST /api/v1/auth/otp/verify
   */
  @Post('otp/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Verify OTP code sent to phone. Returns JWT on success.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verification result',
    type: VerifyOtpResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Headers('x-device-type') deviceTypeHeader?: string,
  ): Promise<VerifyOtpResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('user-agent');
    const deviceType = this.parseDeviceType(deviceTypeHeader);

    return this.authService.verifyOtp(dto, deviceType, ipAddress, userAgent);
  }

  /**
   * Login existing user
   * POST /api/v1/auth/login
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description: 'Login with phone number. OTP will be sent for verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login initiated',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('user-agent');

    return this.authService.login(dto, ipAddress, userAgent);
  }

  /**
   * Admin login with username/password
   * POST /api/v1/auth/admin/login
   *
   * This endpoint is specifically for admin accounts:
   * - PLATFORM_ADMIN
   * - INSURANCE_ADMIN
   * - KBA_ADMIN
   * - SACCO_ADMIN
   *
   * Regular riders should use the phone/OTP login flow instead.
   */
  @Post('admin/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin login',
    description: 'Login with username and password. For admin accounts only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin login result',
    type: AdminLoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async adminLogin(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Headers('x-device-type') deviceTypeHeader?: string,
  ): Promise<AdminLoginResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('user-agent');
    const deviceType = this.parseDeviceType(deviceTypeHeader);

    return this.authService.adminLogin(dto, deviceType, ipAddress, userAgent);
  }

  /**
   * Resend OTP code
   * POST /api/v1/auth/otp/resend
   */
  @Post('otp/resend')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Request a new OTP code. Rate limited to prevent abuse.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resend result',
    type: ResendOtpResponseDto,
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resendOtp(
    @Body() dto: ResendOtpDto,
    @Req() req: Request,
  ): Promise<ResendOtpResponseDto> {
    // Check cooldown
    const canResend = await this.otpService.canResendOtp(dto.phone, dto.purpose);
    if (!canResend.allowed) {
      return {
        success: false,
        message: `Please wait ${canResend.retryAfter} seconds before requesting a new code`,
        retryAfter: canResend.retryAfter,
      };
    }

    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('user-agent');

    const result = await this.otpService.generateOtp(
      dto.phone,
      dto.purpose,
      undefined,
      ipAddress,
      userAgent,
    );

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        retryAfter: result.retryAfter,
      };
    }

    // TODO: Send SMS with OTP
    console.log(`Resend OTP: ${result.otp} (DEV ONLY)`);

    return {
      success: true,
      message: 'Verification code sent to your phone',
    };
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/token/refresh
   */
  @Post('token/refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh token',
    description: 'Get new access token using refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'New access token',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refreshToken(dto);
  }

  /**
   * Logout current session
   * POST /api/v1/auth/logout
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke current session',
  })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /**
   * Logout from all devices
   * POST /api/v1/auth/logout/all
   */
  @Post('logout/all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout all devices',
    description: 'Revoke all sessions for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions revoked',
    schema: {
      type: 'object',
      properties: {
        sessionsRevoked: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAll(
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ sessionsRevoked: number }> {
    const count = await this.authService.logoutAll(user.id);
    return { sessionsRevoked: count };
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(req: Request): string {
    const forwardedFor = req.get('x-forwarded-for');
    if (forwardedFor) {
      const ips = forwardedFor.split(',');
      return ips[0]?.trim() ?? req.ip ?? 'unknown';
    }
    return req.ip ?? 'unknown';
  }

  /**
   * Parse device type from header
   */
  private parseDeviceType(header?: string): DeviceType {
    if (!header) {
      return DeviceType.MOBILE_APP;
    }

    const normalized = header.toLowerCase();
    if (normalized === 'web') {
      return DeviceType.WEB;
    }
    if (normalized === 'ussd') {
      return DeviceType.USSD;
    }
    return DeviceType.MOBILE_APP;
  }
}
