import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../entities/document.entity.js';

/**
 * DTO for document review (admin action)
 */
export class ReviewDocumentDto {
  @ApiProperty({
    enum: [DocumentStatus.APPROVED, DocumentStatus.REJECTED],
    description: 'New status for the document',
  })
  @IsEnum([DocumentStatus.APPROVED, DocumentStatus.REJECTED])
  status!: DocumentStatus.APPROVED | DocumentStatus.REJECTED;

  @ApiPropertyOptional({
    description: 'Reason for rejection (required if rejecting)',
    example: 'Image is too blurry to read',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({
    description: 'Internal reviewer notes',
  })
  @IsOptional()
  @IsString()
  reviewerNotes?: string;
}

/**
 * Response DTO for document review
 */
export class ReviewDocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  documentId!: string;

  @ApiProperty({ enum: DocumentStatus })
  status!: DocumentStatus;

  @ApiProperty({ description: 'User ID of document owner' })
  userId!: string;

  @ApiPropertyOptional({ description: 'Updated KYC status if all documents reviewed' })
  kycStatus?: string;

  @ApiProperty({ description: 'Human-readable message' })
  message!: string;
}

/**
 * DTO for getting documents pending review
 */
export class GetPendingDocumentsDto {
  @ApiPropertyOptional({
    description: 'Filter by document type',
  })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  limit?: number;
}
