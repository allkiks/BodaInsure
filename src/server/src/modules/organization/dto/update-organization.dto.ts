import { IsString, IsOptional, IsNumber, IsEmail, Matches, MaxLength, Min, Max, IsUrl } from 'class-validator';

/**
 * Update organization DTO
 */
export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

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
  @IsString()
  @MaxLength(100)
  secretaryName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, {
    message: 'Phone must be valid Kenya format',
  })
  secretaryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  treasurerName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, {
    message: 'Phone must be valid Kenya format',
  })
  treasurerPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100000)
  estimatedMembers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankBranch?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, {
    message: 'M-Pesa number must be valid Kenya format',
  })
  mpesaNumber?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}
