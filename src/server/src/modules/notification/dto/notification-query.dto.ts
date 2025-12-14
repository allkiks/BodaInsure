import { IsEnum, IsOptional, IsInt, Min, Max, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { NotificationType, NotificationChannel, NotificationStatus } from '../entities/notification.entity.js';

/**
 * DTO for querying notification history
 */
export class NotificationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: NotificationType,
    isArray: true,
    description: 'Filter by notification types',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  types?: NotificationType[];

  @ApiPropertyOptional({
    enum: NotificationChannel,
    isArray: true,
    description: 'Filter by channels',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  channels?: NotificationChannel[];

  @ApiPropertyOptional({
    enum: NotificationStatus,
    isArray: true,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  statuses?: NotificationStatus[];
}
