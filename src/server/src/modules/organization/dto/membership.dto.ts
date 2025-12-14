import { IsString, IsEnum, IsOptional, IsUUID, IsBoolean, IsDate, IsArray, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MemberRole, MembershipStatus } from '../entities/membership.entity.js';

/**
 * Create membership DTO
 */
export class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @IsOptional()
  @IsString()
  memberNumber?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

/**
 * Update membership DTO
 */
export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @IsOptional()
  @IsString()
  memberNumber?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

/**
 * Member list query DTO
 */
export class MemberQueryDto {
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Bulk add members DTO
 */
export class BulkAddMembersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds!: string[];

  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;
}

/**
 * Suspend membership DTO
 */
export class SuspendMembershipDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
