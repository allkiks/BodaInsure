import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ICurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { DocumentService } from '../services/document.service.js';
import { KycService } from '../services/kyc.service.js';
import { StorageService } from '../../storage/services/storage.service.js';
import { DocumentType, DocumentStatus } from '../entities/document.entity.js';
import {
  UploadDocumentDto,
  UploadDocumentResponseDto,
  KycStatusResponseDto,
  ReviewDocumentDto,
  ReviewDocumentResponseDto,
} from '../dto/index.js';
import { UserRole } from '../../identity/entities/user.entity.js';

/**
 * KYC Controller
 * Handles document upload, KYC status, and document review
 */
@ApiTags('kyc')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class KycController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly kycService: KycService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Get KYC status
   * GET /api/v1/kyc/status
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get KYC status',
    description: 'Returns current KYC verification status and document statuses',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC status retrieved',
    type: KycStatusResponseDto,
  })
  async getKycStatus(
    @CurrentUser() user: ICurrentUser,
  ): Promise<KycStatusResponseDto> {
    return this.kycService.getKycStatus(user.userId);
  }

  /**
   * Upload a document
   * POST /api/v1/kyc/documents
   */
  @Post('documents')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload KYC document',
    description: 'Upload a document for KYC verification',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document image file (JPEG or PNG, max 10MB)',
        },
        documentType: {
          type: 'string',
          enum: Object.values(DocumentType),
          description: 'Type of document',
        },
        qualityScore: {
          type: 'number',
          description: 'Quality score from client-side processing (0-100)',
        },
        device: {
          type: 'string',
          description: 'Device used to capture the document',
        },
        capturedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp when image was captured',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Document uploaded successfully',
    type: UploadDocumentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file or document type' })
  @ApiResponse({ status: 409, description: 'Maximum re-submissions reached' })
  async uploadDocument(
    @CurrentUser() user: ICurrentUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ): Promise<UploadDocumentResponseDto> {
    const result = await this.documentService.uploadDocument({
      userId: user.userId,
      documentType: dto.documentType,
      file: file.buffer,
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      qualityScore: dto.qualityScore,
      device: dto.device,
      capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : undefined,
    });

    // Update overall KYC status
    await this.kycService.updateKycStatus(user.userId);

    return {
      documentId: result.documentId ?? '',
      status: result.success ? 'SUCCESS' : 'FAILED',
      version: result.version ?? 1,
      validation: result.validation,
      message: result.message,
    };
  }

  /**
   * Get user's documents
   * GET /api/v1/kyc/documents
   */
  @Get('documents')
  @ApiOperation({
    summary: 'Get my documents',
    description: 'Returns all current documents uploaded by the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Documents retrieved',
  })
  async getMyDocuments(@CurrentUser() user: ICurrentUser) {
    const documents = await this.documentService.getUserDocuments(user.userId);
    return documents.map(doc => ({
      id: doc.id,
      type: doc.documentType,
      label: this.documentService.getDocumentTypeLabel(doc.documentType),
      status: doc.status,
      version: doc.version,
      rejectionReason: doc.rejectionReason,
      uploadedAt: doc.createdAt,
    }));
  }

  /**
   * Submit KYC for review
   * POST /api/v1/kyc/submit
   */
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit KYC for review',
    description: 'Submit all documents for verification review',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC submitted for review',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or rejected documents',
  })
  async submitForReview(@CurrentUser() user: ICurrentUser) {
    return this.kycService.submitForReview(user.userId);
  }

  /**
   * Get document completion summary
   * GET /api/v1/kyc/summary
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Get KYC summary',
    description: 'Returns a brief summary of KYC status for dashboard display',
  })
  async getKycSummary(@CurrentUser() user: ICurrentUser) {
    return this.kycService.getKycSummary(user.userId);
  }

  // ============== Admin Endpoints ==============

  /**
   * Get KYC queue statistics (Admin)
   * GET /api/v1/kyc/admin/pending/stats
   */
  @Get('admin/pending/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiOperation({
    summary: 'Get KYC queue statistics (Admin)',
    description: 'Returns statistics for the KYC review queue',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved',
    schema: {
      type: 'object',
      properties: {
        pending: { type: 'number', description: 'Number of documents pending review' },
        approvedToday: { type: 'number', description: 'Number of documents approved today' },
        rejectedToday: { type: 'number', description: 'Number of documents rejected today' },
        averageProcessingTime: { type: 'number', description: 'Average processing time in minutes' },
      },
    },
  })
  async getQueueStats() {
    return this.documentService.getQueueStats();
  }

  /**
   * Get documents pending review (Admin)
   * GET /api/v1/kyc/admin/pending
   */
  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiOperation({
    summary: 'Get pending documents (Admin)',
    description: 'Returns documents awaiting review',
  })
  @ApiQuery({ name: 'documentType', required: false, enum: DocumentType })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPendingDocuments(
    @Query('documentType') documentType?: DocumentType,
    @Query('userId') userId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.documentService.getPendingDocuments({
      documentType,
      userId,
      page,
      limit,
    });
  }

  /**
   * Review a document (Admin)
   * PATCH /api/v1/kyc/admin/documents/:id/review
   */
  @Patch('admin/documents/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiOperation({
    summary: 'Review document (Admin)',
    description: 'Approve or reject a document',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document reviewed',
    type: ReviewDocumentResponseDto,
  })
  async reviewDocument(
    @Param('id') documentId: string,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() reviewer: ICurrentUser,
  ): Promise<ReviewDocumentResponseDto> {
    const document = await this.documentService.reviewDocument(
      documentId,
      reviewer.userId,
      dto.status,
      dto.rejectionReason,
      dto.reviewerNotes,
    );

    // Update overall KYC status for the user
    const newKycStatus = await this.kycService.updateKycStatus(document.userId);

    // Check rejection threshold
    await this.kycService.checkRejectionThreshold(document.userId);

    return {
      documentId: document.id,
      status: document.status,
      userId: document.userId,
      kycStatus: newKycStatus,
      message: `Document ${dto.status === DocumentStatus.APPROVED ? 'approved' : 'rejected'}`,
    };
  }

  /**
   * Get document details (Admin)
   * GET /api/v1/kyc/admin/documents/:id
   */
  @Get('admin/documents/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiOperation({
    summary: 'Get document details (Admin)',
    description: 'Returns detailed information about a document',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async getDocumentDetails(@Param('id') documentId: string) {
    const document = await this.documentService.getDocumentById(documentId);
    if (!document) {
      return { error: 'Document not found' };
    }
    return document;
  }

  /**
   * Get document URL for viewing (Admin)
   * GET /api/v1/kyc/admin/documents/:id/url
   */
  @Get('admin/documents/:id/url')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiOperation({
    summary: 'Get document URL (Admin)',
    description: 'Returns a URL for viewing the document',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document URL retrieved',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL for document access' },
        expiresAt: { type: 'string', format: 'date-time', description: 'URL expiration time' },
      },
    },
  })
  async getDocumentUrl(@Param('id') documentId: string) {
    const document = await this.documentService.getDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Return URL to the download endpoint
    const baseUrl = process.env['API_BASE_URL'] || 'http://localhost:3000';
    const url = `${baseUrl}/api/v1/kyc/admin/documents/${documentId}/download`;

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return { url, expiresAt };
  }

  /**
   * Download document file (Admin)
   * GET /api/v1/kyc/admin/documents/:id/download
   */
  @Get('admin/documents/:id/download')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiOperation({
    summary: 'Download document file (Admin)',
    description: 'Returns the actual document file for viewing',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document file',
  })
  async downloadDocument(
    @Param('id') documentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const document = await this.documentService.getDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Extract userId and fileName from storageKey
    // AWS/MinIO format: "{userId}/{fileName}"
    // Local format: "{bucket}/{userId}/{fileName}"
    const keyParts = document.storageKey.split('/');
    let userId: string | undefined;
    let fileName: string | undefined;

    if (keyParts.length === 2) {
      // AWS/MinIO format
      userId = keyParts[0];
      fileName = keyParts[1];
    } else if (keyParts.length >= 3) {
      // Local format (bucket/userId/fileName)
      userId = keyParts[1];
      fileName = keyParts[2];
    }

    if (!userId || !fileName) {
      throw new NotFoundException('Invalid storage key format');
    }

    // Download from storage service
    const downloadResult = await this.storageService.downloadKycDocument(userId, fileName);

    if (!downloadResult.success || !downloadResult.data) {
      throw new NotFoundException('Document file not found in storage');
    }

    // Set response headers
    res.set({
      'Content-Type': downloadResult.contentType || document.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${document.originalFilename || fileName}"`,
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(downloadResult.data);
  }
}
