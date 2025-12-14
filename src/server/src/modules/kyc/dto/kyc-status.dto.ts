import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, DocumentStatus } from '../entities/document.entity.js';
import { KycStatus } from '../../identity/entities/user.entity.js';

/**
 * Document status item in KYC status response
 */
export class DocumentStatusDto {
  @ApiProperty({ enum: DocumentType })
  type!: DocumentType;

  @ApiProperty({ enum: DocumentStatus })
  status!: DocumentStatus;

  @ApiPropertyOptional({ description: 'Rejection reason if rejected' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Document version' })
  version?: number;

  @ApiPropertyOptional({ description: 'Whether document has been uploaded' })
  uploaded!: boolean;

  @ApiPropertyOptional({ description: 'Label for display' })
  label!: string;
}

/**
 * Response DTO for KYC status
 * Per FEAT-KYC-003
 */
export class KycStatusResponseDto {
  @ApiProperty({
    enum: KycStatus,
    description: 'Overall KYC status',
  })
  status!: KycStatus;

  @ApiProperty({
    description: 'Last status update timestamp',
  })
  updatedAt!: Date;

  @ApiProperty({
    type: [DocumentStatusDto],
    description: 'Per-document status',
  })
  documents!: DocumentStatusDto[];

  @ApiProperty({
    description: 'Number of documents uploaded',
  })
  documentsUploaded!: number;

  @ApiProperty({
    description: 'Total documents required',
  })
  documentsRequired!: number;

  @ApiProperty({
    description: 'Completion percentage (0-100)',
  })
  completionPercentage!: number;

  @ApiPropertyOptional({
    description: 'Whether user can proceed to payment',
  })
  canProceedToPayment!: boolean;

  @ApiPropertyOptional({
    description: 'Next action message for user',
  })
  nextAction?: string;
}

/**
 * Summary for dashboard display
 */
export class KycSummaryDto {
  @ApiProperty({ enum: KycStatus })
  status!: KycStatus;

  @ApiProperty()
  completionPercentage!: number;

  @ApiProperty()
  documentsUploaded!: number;

  @ApiProperty()
  documentsRequired!: number;

  @ApiPropertyOptional()
  actionRequired?: boolean;

  @ApiPropertyOptional()
  rejectedCount?: number;
}
