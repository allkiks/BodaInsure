import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, KycStatus } from '../../identity/entities/user.entity.js';
import { DocumentService } from './document.service.js';
import {
  DocumentStatus,
  REQUIRED_DOCUMENTS,
  DOCUMENT_TYPE_LABELS,
} from '../entities/document.entity.js';
import { KycStatusResponseDto, DocumentStatusDto } from '../dto/kyc-status.dto.js';
import { NotificationService } from '../../notification/services/notification.service.js';

/**
 * Number of rejections that triggers manual review flag
 * Per BR-004 from FEAT-KYC-003
 */
const REJECTION_THRESHOLD = 3;

/**
 * KYC Service
 * Orchestrates KYC verification process
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly documentService: DocumentService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Get KYC status for a user
   * Per FEAT-KYC-003
   */
  async getKycStatus(userId: string): Promise<KycStatusResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const documents = await this.documentService.getUserDocuments(userId);
    const completion = await this.documentService.getDocumentCompletion(userId);

    // Build document status list
    const documentStatuses: DocumentStatusDto[] = REQUIRED_DOCUMENTS.map(type => {
      const doc = documents.find(d => d.documentType === type);
      return {
        type,
        status: doc?.status ?? DocumentStatus.PENDING,
        reason: doc?.rejectionReason,
        version: doc?.version,
        uploaded: !!doc,
        label: DOCUMENT_TYPE_LABELS[type],
      };
    });

    // Determine next action
    let nextAction: string | undefined;
    if (completion.missing.length > 0) {
      const missingLabels = completion.missing.map(t => DOCUMENT_TYPE_LABELS[t]);
      nextAction = `Please upload: ${missingLabels.join(', ')}`;
    } else if (completion.rejected.length > 0) {
      nextAction = `Please re-upload rejected documents`;
    } else if (completion.inReview.length > 0) {
      nextAction = `We're reviewing your documents. This usually takes 1-2 hours.`;
    } else if (completion.allApproved) {
      nextAction = `All documents verified. You can proceed to payment.`;
    }

    return {
      status: user.kycStatus,
      updatedAt: user.updatedAt,
      documents: documentStatuses,
      documentsUploaded: completion.uploaded.length,
      documentsRequired: REQUIRED_DOCUMENTS.length,
      completionPercentage: completion.completionPercentage,
      canProceedToPayment: user.kycStatus === KycStatus.APPROVED,
      nextAction,
    };
  }

  /**
   * Update overall KYC status based on document statuses
   * Called after document review
   */
  async updateKycStatus(userId: string): Promise<KycStatus> {
    const completion = await this.documentService.getDocumentCompletion(userId);
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    let newStatus: KycStatus;

    if (completion.allApproved) {
      // All documents approved
      newStatus = KycStatus.APPROVED;
    } else if (completion.rejected.length > 0) {
      // Some documents rejected
      newStatus = KycStatus.REJECTED;
    } else if (completion.missing.length > 0) {
      // Documents still missing
      newStatus = KycStatus.PENDING;
    } else if (completion.inReview.length > 0) {
      // All documents uploaded but some still in review
      newStatus = KycStatus.IN_REVIEW;
    } else {
      newStatus = KycStatus.PENDING;
    }

    // Only update if status changed
    if (user.kycStatus !== newStatus) {
      const previousStatus = user.kycStatus;
      user.kycStatus = newStatus;
      await this.userRepository.save(user);

      this.logger.log(
        `KYC status updated: userId=${userId.slice(0, 8)}... status=${newStatus}`,
      );

      // Send notification on status change
      try {
        if (newStatus === KycStatus.APPROVED) {
          await this.notificationService.sendKycApproved(
            userId,
            user.phone,
            user.fullName ?? 'Customer',
          );
          this.logger.log(`KYC approval notification sent for user ${userId.slice(0, 8)}...`);
        } else if (newStatus === KycStatus.REJECTED && previousStatus !== KycStatus.REJECTED) {
          // Get rejection reasons from documents
          const documents = await this.documentService.getUserDocuments(userId);
          const rejectedDocs = documents.filter(d => d.status === DocumentStatus.REJECTED);
          const firstRejectedDoc = rejectedDocs[0];
          const rejectionReason = firstRejectedDoc
            ? firstRejectedDoc.rejectionReason ?? 'Document quality issues'
            : 'Document quality issues';

          await this.notificationService.sendKycRejected(
            userId,
            user.phone,
            user.fullName ?? 'Customer',
            rejectionReason,
          );
          this.logger.log(`KYC rejection notification sent for user ${userId.slice(0, 8)}...`);
        }
      } catch (notificationError) {
        // Log but don't fail the KYC update if notification fails
        this.logger.error(
          `Failed to send KYC status notification for user ${userId.slice(0, 8)}...`,
          notificationError,
        );
      }
    }

    return newStatus;
  }

  /**
   * Check if user has met rejection threshold for manual review
   */
  async checkRejectionThreshold(userId: string): Promise<boolean> {
    const documents = await this.documentService.getUserDocuments(userId);
    const rejectedCount = documents.filter(
      d => d.status === DocumentStatus.REJECTED,
    ).length;

    if (rejectedCount >= REJECTION_THRESHOLD) {
      this.logger.warn(
        `User ${userId.slice(0, 8)}... has ${rejectedCount} rejected documents - flagging for manual review`,
      );
      // TODO: Flag user for manual review in admin dashboard
      return true;
    }

    return false;
  }

  /**
   * Submit KYC for review after all documents uploaded
   */
  async submitForReview(userId: string): Promise<{
    success: boolean;
    message: string;
    kycStatus: KycStatus;
  }> {
    const completion = await this.documentService.getDocumentCompletion(userId);

    if (completion.missing.length > 0) {
      const missingLabels = completion.missing.map(t => DOCUMENT_TYPE_LABELS[t]);
      return {
        success: false,
        message: `Missing documents: ${missingLabels.join(', ')}`,
        kycStatus: KycStatus.PENDING,
      };
    }

    if (completion.rejected.length > 0) {
      return {
        success: false,
        message: 'Please re-upload rejected documents before submitting',
        kycStatus: KycStatus.REJECTED,
      };
    }

    // Update status to IN_REVIEW
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.kycStatus = KycStatus.IN_REVIEW;
    await this.userRepository.save(user);

    this.logger.log(`KYC submitted for review: userId=${userId.slice(0, 8)}...`);

    return {
      success: true,
      message: "Your documents have been submitted for review. We'll notify you when complete.",
      kycStatus: KycStatus.IN_REVIEW,
    };
  }

  /**
   * Get KYC summary for dashboard
   */
  async getKycSummary(userId: string): Promise<{
    status: KycStatus;
    completionPercentage: number;
    documentsUploaded: number;
    documentsRequired: number;
    actionRequired: boolean;
    rejectedCount: number;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const completion = await this.documentService.getDocumentCompletion(userId);

    return {
      status: user.kycStatus,
      completionPercentage: completion.completionPercentage,
      documentsUploaded: completion.uploaded.length,
      documentsRequired: REQUIRED_DOCUMENTS.length,
      actionRequired:
        completion.missing.length > 0 || completion.rejected.length > 0,
      rejectedCount: completion.rejected.length,
    };
  }

  /**
   * Can user proceed to payment?
   * Per BR-001: KYC must be APPROVED before payment allowed
   */
  async canProceedToPayment(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    return user?.kycStatus === KycStatus.APPROVED;
  }
}
