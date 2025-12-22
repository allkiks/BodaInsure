import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { Language, UserRole } from '../entities/user.entity.js';

/**
 * Registration Request DTO
 * Per FEAT-AUTH-001 Phone Number Registration
 * GAP-004: All riders must belong to a SACCO organization
 */
export class RegisterDto {
  @ApiProperty({
    description: 'Kenyan phone number (07xx/01xx format or +254)',
    example: '0712345678',
  })
  @IsString()
  @Matches(/^(?:\+?254|0)(7|1)\d{8}$/, {
    message: 'Phone must be a valid Kenyan mobile number (07xx or 01xx format)',
  })
  phone!: string;

  @ApiProperty({
    description: 'User must accept terms of service',
    example: true,
  })
  @IsBoolean()
  termsAccepted!: boolean;

  @ApiProperty({
    description: 'Organization (SACCO) ID the rider belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({
    description: 'Preferred language',
    enum: Language,
    default: Language.ENGLISH,
    required: false,
  })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiProperty({
    description: 'User role (defaults to rider)',
    enum: UserRole,
    default: UserRole.RIDER,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    description: 'Skip OTP and use default password (for admin-created users when SMS is unavailable)',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  useDefaultPassword?: boolean;
}

/**
 * Registration Response DTO
 */
export class RegisterResponseDto {
  @ApiProperty({
    description: 'Registration status',
    enum: ['SUCCESS', 'DUPLICATE', 'INVALID_PHONE', 'TERMS_NOT_ACCEPTED'],
  })
  status!: string;

  @ApiProperty({
    description: 'User ID (only on success)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  userId?: string;

  @ApiProperty({
    description: 'Indicates if OTP was sent',
    example: true,
  })
  otpSent!: boolean;

  @ApiProperty({
    description: 'Message for the user',
    example: 'Verification code sent to your phone',
  })
  message!: string;
}
