import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Refresh Token Request DTO
 * Per FEAT-AUTH-004 Session Management
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token received during login/registration',
  })
  @IsString()
  refreshToken!: string;
}

/**
 * Refresh Token Response DTO
 */
export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'New JWT access token',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 2592000,
  })
  expiresIn!: number;
}
