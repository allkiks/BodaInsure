import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import type { ICurrentUser } from '../../../common/decorators/current-user.decorator.js';
import * as crypto from 'crypto';
import {
  Document,
  DocumentType,
  DocumentStatus,
  REQUIRED_DOCUMENTS,
  DOCUMENT_TYPE_LABELS,
} from '../entities/document.entity.js';
import {
  KycValidation,
  ValidationType,
  ValidationResult,
} from '../entities/kyc-validation.entity.js';
import { StorageService } from '../../storage/services/storage.service.js';

/**
 * Maximum file size for document upload (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed MIME types for document upload
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

/**
 * Maximum re-submissions per document type per BR-004
 */
const MAX_RESUBMISSIONS = 5;

export interface UploadDocumentData {
  userId: string;
  documentType: DocumentType;
  file: Buffer;
  mimeType: string;
  originalFilename?: string;
  qualityScore?: number;
  device?: string;
  capturedAt?: Date;
}

export interface DocumentUploadResult {
  success: boolean;
  documentId?: string;
  version?: number;
  status?: DocumentStatus;
  message: string;
  validation?: {
    quality: string;
    typeMatch: string;
  };
}

/**
 * Document Service
 * Handles document upload, storage, and validation
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(KycValidation)
    private readonly validationRepository: Repository<KycValidation>,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get user IDs that the current user can access based on their role
   * GAP-004: Role-based scoping for KYC access
   */
  private async getAccessibleUserIds(user: ICurrentUser): Promise<string[] | null> {
    if (user.role === 'platform_admin' || user.role === 'insurance_admin') {
      // Full access - return null to indicate no filtering needed
      return null;
    }

    if (user.role === 'sacco_admin') {
      // SACCO admin can only access users in their own organization
      if (!user.organizationId) {
        return []; // No organization = no access
      }

      const result = await this.dataSource.query(
        `SELECT user_id FROM memberships
         WHERE organization_id = $1 AND status = 'ACTIVE'`,
        [user.organizationId],
      );
      return result.map((r: { user_id: string }) => r.user_id);
    }

    if (user.role === 'kba_admin') {
      // KBA admin can access users in their org and child SACCOs
      if (!user.organizationId) {
        return [];
      }

      const result = await this.dataSource.query(
        `SELECT DISTINCT m.user_id FROM memberships m
         JOIN organizations o ON o.id = m.organization_id
         WHERE (m.organization_id = $1 OR o.parent_id = $1)
           AND m.status = 'ACTIVE'`,
        [user.organizationId],
      );
      return result.map((r: { user_id: string }) => r.user_id);
    }

    // Riders and unknown roles - no admin access
    return [];
  }

  /**
   * Check if user can access a specific document
   * GAP-004: Role-based access control for documents
   */
  private async canAccessDocument(user: ICurrentUser, document: Document): Promise<boolean> {
    const accessibleUserIds = await this.getAccessibleUserIds(user);

    // null means full access (platform_admin, insurance_admin)
    if (accessibleUserIds === null) {
      return true;
    }

    return accessibleUserIds.includes(document.userId);
  }

  /**
   * Upload a new document
   * Per FEAT-KYC-002
   */
  async uploadDocument(data: UploadDocumentData): Promise<DocumentUploadResult> {
    // Validate file
    if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (data.file.length > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Check submission count
    const submissionCount = await this.getSubmissionCount(
      data.userId,
      data.documentType,
    );

    if (submissionCount >= MAX_RESUBMISSIONS) {
      throw new ConflictException(
        'Maximum re-submissions reached for this document type. Please contact support.',
      );
    }

    // Calculate content hash for deduplication
    const contentHash = crypto.createHash('sha256').update(data.file).digest('hex');

    // Check for duplicate content
    const duplicateDoc = await this.documentRepository.findOne({
      where: {
        userId: data.userId,
        contentHash,
        isCurrent: true,
      },
    });

    if (duplicateDoc) {
      return {
        success: false,
        documentId: duplicateDoc.id,
        message: 'This document has already been uploaded',
      };
    }

    // Mark previous versions as not current
    await this.documentRepository.update(
      {
        userId: data.userId,
        documentType: data.documentType,
        isCurrent: true,
      },
      { isCurrent: false },
    );

    // Get next version number
    const latestVersion = await this.documentRepository.findOne({
      where: {
        userId: data.userId,
        documentType: data.documentType,
      },
      order: { version: 'DESC' },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Generate storage key
    const extension = data.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const documentId = crypto.randomUUID();
    const storageKey = `kyc/${data.userId}/${data.documentType}/${documentId}.${extension}`;

    // Create document record
    const document = this.documentRepository.create({
      id: documentId,
      userId: data.userId,
      documentType: data.documentType,
      status: DocumentStatus.PROCESSING,
      version: nextVersion,
      isCurrent: true,
      storageKey,
      originalFilename: data.originalFilename,
      mimeType: data.mimeType,
      fileSize: data.file.length,
      qualityScore: data.qualityScore,
      device: data.device,
      capturedAt: data.capturedAt,
      contentHash,
    });

    await this.documentRepository.save(document);

    // Upload file to storage (local or S3/MinIO based on config)
    const fileName = `${data.documentType}_${documentId}.${extension}`;
    const uploadResult = await this.storageService.uploadKycDocument(
      data.userId,
      fileName,
      data.file,
      { contentType: data.mimeType },
    );

    if (!uploadResult.success) {
      this.logger.error(`Failed to upload document to storage: ${uploadResult.error}`);
      throw new BadRequestException('Failed to upload document. Please try again.');
    }

    // Update storage key with actual path from storage service
    document.storageKey = uploadResult.key;
    await this.documentRepository.save(document);

    // Run preliminary validations
    const validationResults = await this.runPreliminaryValidations(document, data.file);

    // Update document status based on validations
    const hasFailures = validationResults.some(v => v.result === ValidationResult.FAIL);
    document.status = hasFailures ? DocumentStatus.IN_REVIEW : DocumentStatus.PENDING;
    await this.documentRepository.save(document);

    this.logger.log(
      `Document uploaded: userId=${data.userId.slice(0, 8)}... type=${data.documentType} version=${nextVersion}`,
    );

    return {
      success: true,
      documentId: document.id,
      version: nextVersion,
      status: document.status,
      message: 'Document uploaded successfully',
      validation: {
        quality: validationResults.find(v => v.validationType === ValidationType.QUALITY)?.result ?? 'PENDING',
        typeMatch: validationResults.find(v => v.validationType === ValidationType.TYPE_MATCH)?.result ?? 'PENDING',
      },
    };
  }

  /**
   * Get all current documents for a user
   */
  async getUserDocuments(userId: string): Promise<Document[]> {
    return this.documentRepository.find({
      where: {
        userId,
        isCurrent: true,
      },
      order: {
        documentType: 'ASC',
      },
    });
  }

  /**
   * Get a specific document by ID
   * GAP-004: Optional user parameter for role-based access control
   */
  async getDocumentById(documentId: string, user?: ICurrentUser): Promise<Document | null> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      return null;
    }

    // If user is provided, check access permissions
    if (user) {
      const canAccess = await this.canAccessDocument(user, document);
      if (!canAccess) {
        throw new ForbiddenException('You do not have access to this document');
      }
    }

    return document;
  }

  /**
   * Get document completion status for a user
   */
  async getDocumentCompletion(userId: string): Promise<{
    uploaded: DocumentType[];
    missing: DocumentType[];
    approved: DocumentType[];
    rejected: DocumentType[];
    inReview: DocumentType[];
    completionPercentage: number;
    isComplete: boolean;
    allApproved: boolean;
  }> {
    const documents = await this.getUserDocuments(userId);

    const uploaded: DocumentType[] = [];
    const approved: DocumentType[] = [];
    const rejected: DocumentType[] = [];
    const inReview: DocumentType[] = [];

    for (const doc of documents) {
      uploaded.push(doc.documentType);
      if (doc.status === DocumentStatus.APPROVED) {
        approved.push(doc.documentType);
      } else if (doc.status === DocumentStatus.REJECTED) {
        rejected.push(doc.documentType);
      } else if (
        doc.status === DocumentStatus.IN_REVIEW ||
        doc.status === DocumentStatus.PROCESSING ||
        doc.status === DocumentStatus.PENDING
      ) {
        inReview.push(doc.documentType);
      }
    }

    const missing = REQUIRED_DOCUMENTS.filter(type => !uploaded.includes(type));
    const completionPercentage = Math.round(
      (uploaded.length / REQUIRED_DOCUMENTS.length) * 100,
    );
    const isComplete = missing.length === 0;
    const allApproved = approved.length === REQUIRED_DOCUMENTS.length;

    return {
      uploaded,
      missing,
      approved,
      rejected,
      inReview,
      completionPercentage,
      isComplete,
      allApproved,
    };
  }

  /**
   * Get submission count for a document type
   */
  async getSubmissionCount(
    userId: string,
    documentType: DocumentType,
  ): Promise<number> {
    return this.documentRepository.count({
      where: {
        userId,
        documentType,
      },
    });
  }

  /**
   * Review a document (admin action)
   * GAP-004: Enforce role-based access - admins can only review documents in their scope
   */
  async reviewDocument(
    documentId: string,
    reviewer: ICurrentUser,
    status: DocumentStatus.APPROVED | DocumentStatus.REJECTED,
    rejectionReason?: string,
    reviewerNotes?: string,
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // GAP-004: Check if reviewer has access to this document
    const canAccess = await this.canAccessDocument(reviewer, document);
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to review this document');
    }

    if (document.status === DocumentStatus.APPROVED) {
      throw new ConflictException('Document is already approved');
    }

    if (status === DocumentStatus.REJECTED && !rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    document.status = status;
    document.reviewedBy = reviewer.userId;
    document.reviewedAt = new Date();
    document.reviewerNotes = reviewerNotes;

    if (status === DocumentStatus.REJECTED) {
      document.rejectionReason = rejectionReason;
    }

    await this.documentRepository.save(document);

    // Create manual validation record
    const validation = this.validationRepository.create({
      documentId: document.id,
      validationType: ValidationType.MANUAL,
      result: status === DocumentStatus.APPROVED ? ValidationResult.PASS : ValidationResult.FAIL,
      message: rejectionReason,
      isAutomated: false,
      validatedBy: reviewer.userId,
    });
    await this.validationRepository.save(validation);

    this.logger.log(
      `Document reviewed: ${documentId.slice(0, 8)}... status=${status} by=${reviewer.userId.slice(0, 8)}...`,
    );

    return document;
  }

  /**
   * Get documents pending review
   * GAP-004: Filter by user's accessible scope based on role
   */
  async getPendingDocuments(options: {
    documentType?: DocumentType;
    userId?: string;
    page?: number;
    limit?: number;
    user?: ICurrentUser;
  }): Promise<{ documents: Document[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const queryBuilder = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.status IN (:...statuses)', {
        statuses: [DocumentStatus.PENDING, DocumentStatus.IN_REVIEW],
      })
      .andWhere('doc.is_current = :isCurrent', { isCurrent: true });

    // GAP-004: Apply role-based filtering
    if (options.user) {
      const accessibleUserIds = await this.getAccessibleUserIds(options.user);
      if (accessibleUserIds !== null) {
        if (accessibleUserIds.length === 0) {
          // No accessible users - return empty
          return { documents: [], total: 0 };
        }
        queryBuilder.andWhere('doc.user_id IN (:...accessibleUserIds)', {
          accessibleUserIds,
        });
      }
      // null means full access, no filter needed
    }

    if (options.documentType) {
      queryBuilder.andWhere('doc.document_type = :documentType', {
        documentType: options.documentType,
      });
    }

    if (options.userId) {
      queryBuilder.andWhere('doc.user_id = :userId', {
        userId: options.userId,
      });
    }

    const [documents, total] = await queryBuilder
      .orderBy('doc.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { documents, total };
  }

  /**
   * Run preliminary validations on uploaded document
   */
  private async runPreliminaryValidations(
    document: Document,
    _fileBuffer: Buffer,
  ): Promise<KycValidation[]> {
    const validations: KycValidation[] = [];

    // Quality check based on client-provided score
    const qualityValidation = this.validationRepository.create({
      documentId: document.id,
      validationType: ValidationType.QUALITY,
      result:
        document.qualityScore && document.qualityScore >= 70
          ? ValidationResult.PASS
          : document.qualityScore && document.qualityScore < 50
            ? ValidationResult.FAIL
            : ValidationResult.WARNING,
      confidenceScore: document.qualityScore,
      message:
        document.qualityScore && document.qualityScore < 50
          ? 'Image quality is too low'
          : undefined,
      isAutomated: true,
    });
    validations.push(qualityValidation);

    // Type match (placeholder - would use ML model)
    const typeMatchValidation = this.validationRepository.create({
      documentId: document.id,
      validationType: ValidationType.TYPE_MATCH,
      result: ValidationResult.PENDING, // Would be determined by ML
      isAutomated: true,
    });
    validations.push(typeMatchValidation);

    // Save validations
    await this.validationRepository.save(validations);

    return validations;
  }

  /**
   * Delete a document (soft delete by marking as not current)
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status === DocumentStatus.APPROVED) {
      throw new ConflictException('Cannot delete an approved document');
    }

    document.isCurrent = false;
    await this.documentRepository.save(document);

    this.logger.log(`Document deleted: ${documentId.slice(0, 8)}...`);
  }

  /**
   * Get document type label
   */
  getDocumentTypeLabel(type: DocumentType): string {
    return DOCUMENT_TYPE_LABELS[type];
  }

  /**
   * Get queue statistics for admin dashboard
   * GAP-004: Filter stats by user's accessible scope based on role
   */
  async getQueueStats(user?: ICurrentUser): Promise<{
    pending: number;
    approvedToday: number;
    rejectedToday: number;
    averageProcessingTime: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get accessible user IDs for role-based filtering
    let accessibleUserIds: string[] | null = null;
    if (user) {
      accessibleUserIds = await this.getAccessibleUserIds(user);
      if (accessibleUserIds !== null && accessibleUserIds.length === 0) {
        // No accessible users - return zeros
        return {
          pending: 0,
          approvedToday: 0,
          rejectedToday: 0,
          averageProcessingTime: 0,
        };
      }
    }

    // Build base query for pending documents
    const pendingQuery = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.status IN (:...statuses)', {
        statuses: [DocumentStatus.PENDING, DocumentStatus.IN_REVIEW],
      })
      .andWhere('doc.is_current = :isCurrent', { isCurrent: true });

    if (accessibleUserIds !== null) {
      pendingQuery.andWhere('doc.user_id IN (:...accessibleUserIds)', { accessibleUserIds });
    }

    const pending = await pendingQuery.getCount();

    // Count approved today
    const approvedQuery = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.status = :status', { status: DocumentStatus.APPROVED })
      .andWhere('doc.reviewed_at >= :today', { today });

    if (accessibleUserIds !== null) {
      approvedQuery.andWhere('doc.user_id IN (:...accessibleUserIds)', { accessibleUserIds });
    }

    const approvedToday = await approvedQuery.getCount();

    // Count rejected today
    const rejectedQuery = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.status = :status', { status: DocumentStatus.REJECTED })
      .andWhere('doc.reviewed_at >= :today', { today });

    if (accessibleUserIds !== null) {
      rejectedQuery.andWhere('doc.user_id IN (:...accessibleUserIds)', { accessibleUserIds });
    }

    const rejectedToday = await rejectedQuery.getCount();

    // Calculate average processing time (in minutes)
    const avgQuery = this.documentRepository
      .createQueryBuilder('doc')
      .select('AVG(EXTRACT(EPOCH FROM (doc.reviewed_at - doc.created_at)) / 60)', 'avgMinutes')
      .where('doc.reviewed_at IS NOT NULL')
      .andWhere('doc.reviewed_at >= :thirtyDaysAgo', {
        thirtyDaysAgo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

    if (accessibleUserIds !== null) {
      avgQuery.andWhere('doc.user_id IN (:...accessibleUserIds)', { accessibleUserIds });
    }

    const avgResult = await avgQuery.getRawOne();
    const averageProcessingTime = Math.round(avgResult?.avgMinutes ?? 0);

    return {
      pending,
      approvedToday,
      rejectedToday,
      averageProcessingTime,
    };
  }
}
