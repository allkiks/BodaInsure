import { IsString, IsEnum, IsOptional, IsUUID, IsDate, IsObject, IsArray, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType, ReportFormat, ReportFrequency } from '../entities/report-definition.entity.js';
import { ReportStatus } from '../entities/generated-report.entity.js';

/**
 * Create report definition DTO
 */
export class CreateReportDefinitionDto {
  @IsString()
  name!: string;

  @IsEnum(ReportType)
  type!: ReportType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ReportFormat)
  defaultFormat?: ReportFormat;

  @IsOptional()
  @IsArray()
  @IsEnum(ReportFormat, { each: true })
  availableFormats?: ReportFormat[];

  @IsOptional()
  @IsEnum(ReportFrequency)
  frequency?: ReportFrequency;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredRoles?: string[];

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

/**
 * Update report definition DTO
 */
export class UpdateReportDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ReportFormat)
  defaultFormat?: ReportFormat;

  @IsOptional()
  @IsArray()
  @IsEnum(ReportFormat, { each: true })
  availableFormats?: ReportFormat[];

  @IsOptional()
  @IsEnum(ReportFrequency)
  frequency?: ReportFrequency;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredRoles?: string[];
}

/**
 * Generate report DTO
 */
export class GenerateReportDto {
  @IsUUID()
  reportDefinitionId!: string;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

/**
 * Report query DTO
 */
export class ReportQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

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
 * Dashboard query DTO
 */
export class DashboardQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}
