import { IsEnum, IsOptional, IsNumber, Min, Max, IsDateString, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../entities/document.entity.js';

/**
 * DTO for document upload
 * Per FEAT-KYC-002
 */
export class UploadDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    description: 'Type of document being uploaded',
    example: DocumentType.ID_FRONT,
  })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiPropertyOptional({
    description: 'Quality score from client-side processing (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @ApiPropertyOptional({
    description: 'Device used to capture the document',
    example: 'Samsung A52',
  })
  @IsOptional()
  @IsString()
  device?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the image was captured on device',
    example: '2024-12-01T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}

/**
 * Response DTO for document upload
 */
export class UploadDocumentResponseDto {
  @ApiProperty({ description: 'Unique document ID' })
  documentId!: string;

  @ApiProperty({ description: 'Upload status', enum: ['SUCCESS', 'PROCESSING', 'FAILED'] })
  status!: string;

  @ApiProperty({ description: 'Version number of the document' })
  version!: number;

  @ApiPropertyOptional({
    description: 'Preliminary validation feedback',
  })
  validation?: {
    quality: string;
    typeMatch: string;
  };

  @ApiProperty({ description: 'Human-readable message' })
  message!: string;
}
