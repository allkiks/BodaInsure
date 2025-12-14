import { IsEnum, IsBoolean, IsOptional, IsInt, Min, Max, IsString, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '../entities/notification.entity.js';

/**
 * DTO for updating notification preferences
 */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Preferred channel for OTP messages',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  otpChannel?: NotificationChannel;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Preferred channel for policy notifications',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  policyChannel?: NotificationChannel;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Preferred channel for payment notifications',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  paymentChannel?: NotificationChannel;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Preferred channel for reminders',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  reminderChannel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Enable payment reminders',
  })
  @IsOptional()
  @IsBoolean()
  paymentRemindersEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable policy expiry reminders',
  })
  @IsOptional()
  @IsBoolean()
  expiryRemindersEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable promotional messages',
  })
  @IsOptional()
  @IsBoolean()
  promotionsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred reminder hour (0-23 in EAT)',
    minimum: 0,
    maximum: 23,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  reminderHour?: number;

  @ApiPropertyOptional({
    description: 'Days before expiry to start reminders',
    minimum: 1,
    maximum: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiryReminderDays?: number;

  @ApiPropertyOptional({
    description: 'Quiet hours start (0-23 in EAT)',
    minimum: 0,
    maximum: 23,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursStart?: number;

  @ApiPropertyOptional({
    description: 'Quiet hours end (0-23 in EAT)',
    minimum: 0,
    maximum: 23,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursEnd?: number;

  @ApiPropertyOptional({
    description: 'WhatsApp number (if different from registered phone)',
  })
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional({
    description: 'Email address for notifications',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Language preference',
  })
  @IsOptional()
  @IsString()
  locale?: string;
}
