import { IsString, IsEnum, IsOptional, IsUUID, IsDate, IsNumber, ValidateNested, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GlAccountType, GlAccountStatus, NormalBalance } from '../entities/gl-account.entity.js';
import { JournalEntryType, JournalEntryStatus } from '../entities/journal-entry.entity.js';

/**
 * GL Account response DTO
 */
export class GlAccountDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  accountCode!: string;

  @ApiProperty()
  accountName!: string;

  @ApiProperty({ enum: GlAccountType })
  accountType!: GlAccountType;

  @ApiPropertyOptional()
  parentId?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ description: 'Balance in cents' })
  balance!: number;

  @ApiProperty({ description: 'Balance in KES' })
  balanceInKes!: number;

  @ApiProperty({ enum: GlAccountStatus })
  status!: GlAccountStatus;

  @ApiProperty()
  isSystemAccount!: boolean;

  @ApiProperty({ enum: NormalBalance })
  normalBalance!: NormalBalance;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/**
 * Trial Balance account DTO
 */
export class TrialBalanceAccountDto {
  @ApiProperty()
  accountCode!: string;

  @ApiProperty()
  accountName!: string;

  @ApiProperty({ enum: GlAccountType })
  accountType!: GlAccountType;

  @ApiProperty({ description: 'Debit balance in cents' })
  debitBalance!: number;

  @ApiProperty({ description: 'Credit balance in cents' })
  creditBalance!: number;
}

/**
 * Trial Balance response DTO
 */
export class TrialBalanceResponseDto {
  @ApiProperty({ type: [TrialBalanceAccountDto] })
  accounts!: TrialBalanceAccountDto[];

  @ApiProperty({ description: 'Total debits in cents' })
  totalDebits!: number;

  @ApiProperty({ description: 'Total credits in cents' })
  totalCredits!: number;

  @ApiProperty()
  isBalanced!: boolean;
}

/**
 * Balance Summary response DTO
 */
export class BalanceSummaryDto {
  @ApiProperty({ description: 'Total assets in cents' })
  assets!: number;

  @ApiProperty({ description: 'Total liabilities in cents' })
  liabilities!: number;

  @ApiProperty({ description: 'Total equity in cents' })
  equity!: number;

  @ApiProperty({ description: 'Total income in cents' })
  income!: number;

  @ApiProperty({ description: 'Total expenses in cents' })
  expenses!: number;
}

/**
 * Journal Entry Line DTO
 */
export class JournalEntryLineDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  journalEntryId!: string;

  @ApiProperty()
  glAccountId!: string;

  @ApiProperty()
  lineNumber!: number;

  @ApiProperty({ description: 'Debit amount in cents' })
  debitAmount!: number;

  @ApiProperty({ description: 'Credit amount in cents' })
  creditAmount!: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  glAccount?: GlAccountDto;
}

/**
 * Journal Entry response DTO
 */
export class JournalEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  entryNumber!: string;

  @ApiProperty()
  entryDate!: Date;

  @ApiProperty({ enum: JournalEntryType })
  entryType!: JournalEntryType;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: JournalEntryStatus })
  status!: JournalEntryStatus;

  @ApiProperty({ description: 'Total debit in cents' })
  totalDebit!: number;

  @ApiProperty({ description: 'Total credit in cents' })
  totalCredit!: number;

  @ApiPropertyOptional()
  sourceTransactionId?: string;

  @ApiPropertyOptional()
  riderId?: string;

  @ApiPropertyOptional()
  postedAt?: Date;

  @ApiPropertyOptional({ type: [JournalEntryLineDto] })
  lines?: JournalEntryLineDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/**
 * Create Journal Entry Line Input
 */
export class CreateJournalEntryLineDto {
  @ApiProperty({ description: 'GL Account code' })
  @IsString()
  accountCode!: string;

  @ApiPropertyOptional({ description: 'Debit amount in cents' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debitAmount?: number;

  @ApiPropertyOptional({ description: 'Credit amount in cents' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Create Journal Entry Input
 */
export class CreateJournalEntryDto {
  @ApiProperty({ enum: JournalEntryType })
  @IsEnum(JournalEntryType)
  entryType!: JournalEntryType;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  entryDate!: Date;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ type: [CreateJournalEntryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines!: CreateJournalEntryLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceEntityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  riderId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  autoPost?: boolean;
}

/**
 * Reverse Journal Entry Input
 */
export class ReverseJournalEntryDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

/**
 * Date Range Query DTO
 */
export class DateRangeQueryDto {
  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  endDate!: Date;
}
