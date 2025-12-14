import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/**
 * Login Request DTO
 * Per FEAT-AUTH-003 User Login
 */
export class LoginDto {
  @ApiProperty({
    description: 'Registered phone number',
    example: '0712345678',
  })
  @IsString()
  @Matches(/^(?:\+?254|0)(7|1)\d{8}$/, {
    message: 'Phone must be a valid Kenyan mobile number',
  })
  phone!: string;
}

/**
 * Login Response DTO
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'Login status',
    enum: ['OTP_SENT', 'USER_NOT_FOUND', 'ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED'],
  })
  status!: string;

  @ApiProperty({
    description: 'Message for the user',
    example: 'Verification code sent to your phone',
  })
  message!: string;

  @ApiProperty({
    description: 'Lockout end time (only if locked)',
    required: false,
  })
  lockedUntil?: Date;
}
