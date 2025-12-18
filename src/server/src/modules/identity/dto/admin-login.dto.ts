import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Password Login Request DTO
 * For username/password authentication
 *
 * This flow supports any user with a password set.
 * Username can be:
 * - A traditional username (e.g., 'SUPERUSER')
 * - A phone number in local format (e.g., '0722000000')
 * - A phone number in international format (e.g., '+254722000000')
 *
 * This flow coexists with the phone/OTP flow for users who prefer that method.
 */
export class AdminLoginDto {
  @ApiProperty({
    description: 'Username or phone number',
    examples: {
      username: { value: 'SUPERUSER', summary: 'Traditional username' },
      localPhone: { value: '0722000000', summary: 'Phone (local format)' },
      e164Phone: { value: '+254722000000', summary: 'Phone (E.164 format)' },
    },
  })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(50, { message: 'Username must not exceed 50 characters' })
  username!: string;

  @ApiProperty({
    description: 'User password',
    example: 'ChangeMe123!',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;
}

/**
 * Password Login Response DTO
 */
export class AdminLoginResponseDto {
  @ApiProperty({
    description: 'Login status',
    enum: ['SUCCESS', 'INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_INACTIVE'],
  })
  status!: string;

  @ApiProperty({
    description: 'Message for the user',
    example: 'Login successful',
  })
  message!: string;

  @ApiProperty({
    description: 'JWT access token (only on success)',
    required: false,
  })
  accessToken?: string;

  @ApiProperty({
    description: 'Refresh token for session management (only on success)',
    required: false,
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Token expiration time in seconds (only on success)',
    required: false,
  })
  expiresIn?: number;

  @ApiProperty({
    description: 'User information (only on success)',
    required: false,
  })
  user?: {
    id: string;
    username: string;
    phone?: string;
    role: string;
    status: string;
  };

  @ApiProperty({
    description: 'Lockout end time (only if locked)',
    required: false,
  })
  lockedUntil?: Date;
}
