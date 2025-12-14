import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for wallet balance
 * Per FEAT-PAY-003
 */
export class WalletBalanceResponseDto {
  @ApiProperty({ description: 'Current balance in KES' })
  balance!: number;

  @ApiProperty({ description: 'Currency code' })
  currency!: string;

  @ApiProperty({ description: 'Whether initial deposit has been made' })
  depositCompleted!: boolean;

  @ApiProperty({ description: 'Number of daily payments made (0-30)' })
  dailyPaymentsCount!: number;

  @ApiProperty({ description: 'Remaining daily payments needed' })
  dailyPaymentsRemaining!: number;

  @ApiProperty({ description: 'Whether all 30 daily payments are complete' })
  dailyPaymentsCompleted!: boolean;
}

/**
 * Response DTO for payment progress
 */
export class PaymentProgressResponseDto {
  @ApiProperty({ description: 'Whether initial deposit has been made' })
  depositCompleted!: boolean;

  @ApiProperty({ description: 'Deposit amount required in KES' })
  depositAmount!: number;

  @ApiProperty({ description: 'Number of daily payments made (0-30)' })
  dailyPaymentsCount!: number;

  @ApiProperty({ description: 'Remaining daily payments needed' })
  dailyPaymentsRemaining!: number;

  @ApiProperty({ description: 'Whether all 30 daily payments are complete' })
  dailyPaymentsCompleted!: boolean;

  @ApiProperty({ description: 'Daily payment amount in KES' })
  dailyAmount!: number;

  @ApiProperty({ description: 'Total amount paid so far in KES' })
  totalPaid!: number;

  @ApiProperty({ description: 'Total amount required in KES' })
  totalRequired!: number;

  @ApiProperty({ description: 'Payment completion percentage (0-100)' })
  progressPercentage!: number;

  @ApiProperty({ description: 'Whether eligible for Policy 1 (deposit made)' })
  policy1Eligible!: boolean;

  @ApiProperty({ description: 'Whether eligible for Policy 2 (all payments made)' })
  policy2Eligible!: boolean;
}

/**
 * Response DTO for payment eligibility check
 */
export class PaymentEligibilityResponseDto {
  @ApiProperty({ description: 'Whether user can make this payment' })
  allowed!: boolean;

  @ApiPropertyOptional({ description: 'Reason if not allowed' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Remaining days for daily payments' })
  remainingDays?: number;

  @ApiPropertyOptional({ description: 'Amount for next payment in KES' })
  nextPaymentAmount?: number;
}
