import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

/**
 * OTP Verification Request DTO
 * Per FEAT-AUTH-002 OTP Verification
 */
export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number the OTP was sent to',
    example: '+254712345678',
  })
  @IsString()
  @Matches(/^(?:\+?254|0)(7|1)\d{8}$/, {
    message: 'Phone must be a valid Kenyan mobile number',
  })
  phone!: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits' })
  otp!: string;
}

/**
 * OTP Verification Response DTO
 */
export class VerifyOtpResponseDto {
  @ApiProperty({
    description: 'Verification status',
    enum: ['SUCCESS', 'INVALID_OTP', 'EXPIRED_OTP', 'MAX_ATTEMPTS'],
  })
  status!: string;

  @ApiProperty({
    description: 'JWT access token (only on success)',
    required: false,
  })
  accessToken?: string;

  @ApiProperty({
    description: 'Refresh token for session extension (only on success)',
    required: false,
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 2592000,
    required: false,
  })
  expiresIn?: number;

  @ApiProperty({
    description: 'User information (only on success)',
    required: false,
  })
  user?: {
    id: string;
    phone: string;
    status: string;
    kycStatus: string;
  };

  @ApiProperty({
    description: 'Remaining verification attempts (only on failure)',
    required: false,
  })
  attemptsRemaining?: number;

  @ApiProperty({
    description: 'Message for the user',
  })
  message!: string;
}
