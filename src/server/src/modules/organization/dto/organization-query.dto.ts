import { IsString, IsEnum, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationType, OrganizationStatus } from '../entities/organization.entity.js';

/**
 * Organization list query DTO
 */
export class OrganizationQueryDto {
  @ApiProperty({ description: 'Filter by organization type', enum: OrganizationType, required: false })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @ApiProperty({ description: 'Filter by status', enum: OrganizationStatus, required: false })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiProperty({ description: 'Filter by county code', required: false })
  @IsOptional()
  @IsString()
  countyCode?: string;

  @ApiProperty({ description: 'Filter by parent organization ID', required: false })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ description: 'Search query', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Search query (alias for search)', required: false })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
