import { IsString, IsEnum, IsOptional, IsUUID, IsNumber, IsEmail, Matches, MaxLength, MinLength, Min, Max } from 'class-validator';
import { OrganizationType } from '../entities/organization.entity.js';

/**
 * Create organization DTO
 */
export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'Code must be uppercase alphanumeric with hyphens only',
  })
  code!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, {
    message: 'Phone must be valid Kenya format',
  })
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subCounty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  leaderName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, {
    message: 'Phone must be valid Kenya format',
  })
  leaderPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100000)
  estimatedMembers?: number;
}
