import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MaxLength, IsBoolean, IsIn } from 'class-validator';

/**
 * DTO for updating user profile
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Full name',
    example: 'John Kamau',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.kamau@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

/**
 * DTO for updating user preferences
 */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Opt out of payment reminders',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  reminderOptOut?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred language',
    example: 'en',
    enum: ['en', 'sw'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'sw'])
  language?: string;
}

/**
 * Response DTO for user profile
 */
export class UserProfileResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Phone number (E.164 format)',
    example: '+254712345678',
  })
  phone!: string;

  @ApiPropertyOptional({
    description: 'Full name',
    example: 'John Kamau',
  })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.kamau@example.com',
  })
  email?: string;

  @ApiProperty({
    description: 'Account status',
    example: 'ACTIVE',
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'],
  })
  status!: string;

  @ApiProperty({
    description: 'User role',
    example: 'rider',
    enum: ['rider', 'sacco_admin', 'kba_admin', 'insurance_admin', 'platform_admin'],
  })
  role!: string;

  @ApiProperty({
    description: 'KYC verification status',
    example: 'PENDING',
    enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'INCOMPLETE'],
  })
  kycStatus!: string;

  @ApiProperty({
    description: 'Preferred language',
    example: 'en',
    enum: ['en', 'sw'],
  })
  language!: string;

  @ApiPropertyOptional({
    description: 'Organization ID (if member of SACCO/KBA)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  organizationId?: string;

  @ApiProperty({
    description: 'Whether user has opted out of payment reminders',
    example: false,
  })
  reminderOptOut!: boolean;

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;
}
