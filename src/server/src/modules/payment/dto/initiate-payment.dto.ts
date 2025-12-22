import { IsString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for initiating a deposit payment
 * Per FEAT-PAY-001
 */
export class InitiateDepositDto {
  @ApiProperty({
    description: 'Phone number for M-Pesa payment (Kenyan format)',
    example: '0712345678',
  })
  @IsString()
  @Matches(/^(?:254|\+254|0)?(7[0-9]{8}|1[0-9]{8})$/, {
    message: 'Phone number must be a valid Kenyan mobile number',
  })
  phone!: string;

  @ApiProperty({
    description: 'Unique idempotency key to prevent duplicate payments',
    example: 'deposit-user123-1234567890',
  })
  @IsString()
  idempotencyKey!: string;
}

/**
 * DTO for initiating daily payment
 * Per FEAT-PAY-002
 */
export class InitiateDailyPaymentDto {
  @ApiProperty({
    description: 'Phone number for M-Pesa payment (Kenyan format)',
    example: '0712345678',
  })
  @IsString()
  @Matches(/^(?:254|\+254|0)?(7[0-9]{8}|1[0-9]{8})$/, {
    message: 'Phone number must be a valid Kenyan mobile number',
  })
  phone!: string;

  @ApiProperty({
    description: 'Unique idempotency key to prevent duplicate payments',
    example: 'daily-user123-1234567890',
  })
  @IsString()
  idempotencyKey!: string;

  @ApiPropertyOptional({
    description: 'Number of days to pay for (1-30)',
    minimum: 1,
    maximum: 30,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  daysCount?: number;
}

/**
 * Response DTO for payment initiation
 */
export class InitiatePaymentResponseDto {
  @ApiProperty({ description: 'Whether initiation was successful' })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Payment request ID' })
  paymentRequestId?: string;

  @ApiPropertyOptional({ description: 'M-Pesa checkout request ID' })
  checkoutRequestId?: string;

  @ApiPropertyOptional({ description: 'Amount to be paid in KES' })
  amount?: number;

  @ApiProperty({ description: 'Human-readable message' })
  message!: string;

  @ApiPropertyOptional({ description: 'Payment request status' })
  status?: string;
}

/**
 * Response DTO for payment status check
 */
export class PaymentStatusResponseDto {
  @ApiProperty({ description: 'Payment request ID' })
  paymentRequestId!: string;

  @ApiProperty({ description: 'Payment status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Transaction ID if completed' })
  transactionId?: string;

  @ApiPropertyOptional({ description: 'M-Pesa receipt number if completed' })
  mpesaReceiptNumber?: string;

  @ApiProperty({ description: 'Amount in KES' })
  amount!: number;

  @ApiProperty({ description: 'Payment type' })
  type!: string;

  @ApiPropertyOptional({ description: 'Failure reason if failed' })
  failureReason?: string;

  // GAP-007: Include M-Pesa result code for specific error messages
  @ApiPropertyOptional({ description: 'M-Pesa result code for specific error handling' })
  resultCode?: string;

  @ApiProperty({ description: 'Request creation time' })
  createdAt!: Date;
}
