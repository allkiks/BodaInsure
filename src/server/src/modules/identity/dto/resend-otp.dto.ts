import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, Matches } from 'class-validator';
import { OtpPurpose } from '../entities/otp.entity.js';

/**
 * Resend OTP Request DTO
 */
export class ResendOtpDto {
  @ApiProperty({
    description: 'Phone number to resend OTP to',
    example: '0712345678',
  })
  @IsString()
  @Matches(/^(?:\+?254|0)(7|1)\d{8}$/, {
    message: 'Phone must be a valid Kenyan mobile number',
  })
  phone!: string;

  @ApiProperty({
    description: 'Purpose of the OTP',
    enum: OtpPurpose,
  })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}

/**
 * Resend OTP Response DTO
 */
export class ResendOtpResponseDto {
  @ApiProperty({
    description: 'Whether OTP was sent successfully',
  })
  success!: boolean;

  @ApiProperty({
    description: 'Message for the user',
  })
  message!: string;

  @ApiProperty({
    description: 'Seconds until resend is allowed again',
    required: false,
  })
  retryAfter?: number;
}
