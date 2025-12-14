import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';

/**
 * User data export structure
 * Per CR-DPA-002 and Data Protection Act 2019 (Kenya)
 */
export interface UserDataExport {
  /** Export metadata */
  exportInfo: {
    exportedAt: string;
    requestedBy: string;
    format: 'json';
    version: '1.0';
    dataController: string;
  };

  /** Personal information */
  personalData: {
    phone: string;
    fullName: string | null;
    email: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    language: string;
    registeredAt: string;
    lastLoginAt: string | null;
  };

  /** Account information (excluding sensitive data) */
  accountData: {
    accountStatus: string;
    kycStatus: string;
    organizationId: string | null;
    termsAcceptedAt: string | null;
    consentGivenAt: string | null;
  };

  /** Data processing summary */
  dataProcessing: {
    purposes: string[];
    legalBasis: string;
    retentionPeriod: string;
    thirdPartySharing: string[];
  };

  /** User rights information */
  userRights: {
    rightToAccess: string;
    rightToRectification: string;
    rightToErasure: string;
    rightToRestriction: string;
    rightToPortability: string;
    rightToObject: string;
    contactDetails: string;
  };
}

/**
 * Data Export Service
 * Implements user data export for DPA compliance
 *
 * Per CLAUDE.md Section 6.3 - Data Protection Act 2019 (Kenya):
 * - Right to Access: API endpoint for user to download all their data
 * - Right to Correction: API endpoint for user to update profile
 * - Right to Deletion: Soft delete with 30-day grace, then hard delete
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Export all user data
   * Per CR-DPA-002: Right to Access
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Data export requested: userId=${userId.slice(0, 8)}...`);

    const exportData: UserDataExport = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        requestedBy: userId,
        format: 'json',
        version: '1.0',
        dataController: 'Atronach K Ltd (BodaInsure)',
      },

      personalData: {
        phone: this.maskPhone(user.phone),
        fullName: user.fullName ?? null,
        email: user.email ?? null,
        dateOfBirth: user.dateOfBirth?.toISOString().split('T')[0] ?? null,
        gender: user.gender ?? null,
        language: user.language,
        registeredAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },

      accountData: {
        accountStatus: user.status,
        kycStatus: user.kycStatus,
        organizationId: user.organizationId ?? null,
        termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
        consentGivenAt: user.consentGivenAt?.toISOString() ?? null,
      },

      dataProcessing: {
        purposes: [
          'Provision of insurance services',
          'KYC verification as required by law',
          'Payment processing',
          'Communication about your policy',
          'Compliance with legal obligations',
        ],
        legalBasis: 'Contract performance, Legal obligation, Consent',
        retentionPeriod: '7 years after account closure (per insurance regulations)',
        thirdPartySharing: [
          'Definite Assurance Co. Ltd (Insurance underwriter)',
          'Safaricom M-Pesa (Payment processing)',
          'Africa\'s Talking (SMS notifications)',
        ],
      },

      userRights: {
        rightToAccess: 'You have the right to request a copy of your personal data at any time.',
        rightToRectification: 'You can update your profile information through the app or by contacting support.',
        rightToErasure: 'You can request deletion of your account. A 30-day grace period applies.',
        rightToRestriction: 'You can request restriction of processing in certain circumstances.',
        rightToPortability: 'You can request your data in a machine-readable format.',
        rightToObject: 'You can object to certain types of processing, such as marketing.',
        contactDetails: 'Data Protection Officer: dpo@bodainsure.co.ke',
      },
    };

    return exportData;
  }

  /**
   * Get data processing consent status
   * Per CR-DPA-001
   */
  async getConsentStatus(userId: string): Promise<{
    hasConsent: boolean;
    consentGivenAt: Date | null;
    termsAcceptedAt: Date | null;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'consentGivenAt', 'termsAcceptedAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      hasConsent: !!(user.consentGivenAt && user.termsAcceptedAt),
      consentGivenAt: user.consentGivenAt ?? null,
      termsAcceptedAt: user.termsAcceptedAt ?? null,
    };
  }

  /**
   * Request account deletion
   * Per CR-DPA-002: Right to Erasure
   * Implements soft delete with 30-day grace period per CLAUDE.md
   */
  async requestAccountDeletion(userId: string, reason?: string): Promise<{
    success: boolean;
    scheduledDeletionDate: Date;
    message: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate deletion date (30-day grace period)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Mark user for deletion (soft delete)
    user.deletedAt = deletionDate;
    // Store deletion reason in metadata or separate field
    await this.userRepository.save(user);

    this.logger.log(
      `Account deletion requested: userId=${userId.slice(0, 8)}... ` +
      `scheduledFor=${deletionDate.toISOString()} reason=${reason ?? 'not specified'}`
    );

    return {
      success: true,
      scheduledDeletionDate: deletionDate,
      message: `Your account is scheduled for deletion on ${deletionDate.toLocaleDateString()}. ` +
        'You can cancel this request by logging in within 30 days.',
    };
  }

  /**
   * Cancel account deletion request
   * Per CR-DPA-002
   */
  async cancelAccountDeletion(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.deletedAt) {
      return {
        success: false,
        message: 'No pending deletion request found.',
      };
    }

    // Cancel deletion
    user.deletedAt = undefined;
    await this.userRepository.save(user);

    this.logger.log(`Account deletion cancelled: userId=${userId.slice(0, 8)}...`);

    return {
      success: true,
      message: 'Account deletion has been cancelled. Your account will remain active.',
    };
  }

  /**
   * Mask phone number for export (show only last 4 digits)
   * Per CLAUDE.md Section 6.2: Masking in Logs
   */
  private maskPhone(phone: string): string {
    if (phone.length <= 4) return phone;
    return '*'.repeat(phone.length - 4) + phone.slice(-4);
  }
}
