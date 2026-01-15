import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PartnerSettlement, PartnerType } from '../entities/partner-settlement.entity.js';

/**
 * Partner contact information for notifications
 */
const PARTNER_CONTACTS: Record<PartnerType, { name: string; email: string }> = {
  [PartnerType.KBA]: {
    name: 'Kenya Bodaboda Association',
    email: 'finance@kba.or.ke',
  },
  [PartnerType.ROBS_INSURANCE]: {
    name: 'Robs Insurance Agency',
    email: 'accounts@robsinsurance.co.ke',
  },
  [PartnerType.DEFINITE_ASSURANCE]: {
    name: 'Definite Assurance',
    email: 'premiums@definiteassurance.co.ke',
  },
  [PartnerType.ATRONACH]: {
    name: 'Atronach K Ltd',
    email: 'finance@atronach.co.ke',
  },
};

/**
 * Admin contacts for internal notifications
 */
const ADMIN_EMAILS = [
  'finance@bodainsure.co.ke',
  'admin@bodainsure.co.ke',
];

/**
 * Settlement Notification Service
 *
 * Sends email notifications for settlement workflow events.
 */
@Injectable()
export class SettlementNotificationService {
  private readonly logger = new Logger(SettlementNotificationService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('SMTP transporter initialized');
    } else {
      this.logger.warn('SMTP not configured - email notifications disabled');
    }
  }

  /**
   * Send notification when a settlement is created
   */
  async notifySettlementCreated(settlement: PartnerSettlement): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email notifications disabled - skipping settlement created notification');
      return;
    }

    const partnerContact = PARTNER_CONTACTS[settlement.partnerType];
    const amount = (Number(settlement.totalAmount) / 100).toLocaleString('en-KE', {
      style: 'currency',
      currency: 'KES',
    });

    // Notify admins
    await this.sendEmail({
      to: ADMIN_EMAILS,
      subject: `[BodaInsure] New Settlement Created - ${settlement.settlementNumber}`,
      html: `
        <h2>New Settlement Pending Approval</h2>
        <p>A new settlement has been created and is awaiting approval.</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Settlement Number</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.settlementNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Partner</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${partnerContact.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Type</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.settlementType.replace('_', ' ')}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Amount</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 16px; color: #1976D2;">${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Period</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.periodStart.toISOString().split('T')[0]} to ${settlement.periodEnd.toISOString().split('T')[0]}</td>
          </tr>
        </table>

        <p style="margin-top: 20px;">
          <a href="${this.getSettlementUrl(settlement.id)}" style="background-color: #1976D2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Review Settlement
          </a>
        </p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated notification from BodaInsure Accounting System.
        </p>
      `,
    });

    this.logger.log(`Settlement created notification sent for ${settlement.settlementNumber}`);
  }

  /**
   * Send notification when a settlement is approved
   */
  async notifySettlementApproved(settlement: PartnerSettlement): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email notifications disabled - skipping settlement approved notification');
      return;
    }

    const partnerContact = PARTNER_CONTACTS[settlement.partnerType];
    const amount = (Number(settlement.totalAmount) / 100).toLocaleString('en-KE', {
      style: 'currency',
      currency: 'KES',
    });

    // Notify partner
    await this.sendEmail({
      to: [partnerContact.email],
      subject: `[BodaInsure] Settlement Approved - ${settlement.settlementNumber}`,
      html: `
        <h2>Settlement Approved</h2>
        <p>Dear ${partnerContact.name},</p>
        <p>Your settlement has been approved and is being processed for payment.</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Settlement Number</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.settlementNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Type</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.settlementType.replace('_', ' ')}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Amount</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 18px; color: #2E7D32; font-weight: bold;">${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Period</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.periodStart.toISOString().split('T')[0]} to ${settlement.periodEnd.toISOString().split('T')[0]}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Approved By</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.approvedBy || 'System'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Approved At</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.approvedAt?.toISOString() || '-'}</td>
          </tr>
        </table>

        <p style="margin-top: 20px; color: #666;">
          Payment will be processed within 2-3 business days.
        </p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated notification from BodaInsure.<br>
          If you have questions, please contact finance@bodainsure.co.ke
        </p>
      `,
    });

    // Also notify admins
    await this.sendEmail({
      to: ADMIN_EMAILS,
      subject: `[BodaInsure] Settlement Approved - ${settlement.settlementNumber}`,
      html: `
        <h2>Settlement Approved - Ready for Processing</h2>
        <p>Settlement ${settlement.settlementNumber} has been approved and is ready for bank transfer.</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Partner</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${partnerContact.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Amount</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #2E7D32; font-weight: bold;">${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Approved By</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.approvedBy || 'System'}</td>
          </tr>
        </table>

        <p style="margin-top: 20px;">
          <a href="${this.getSettlementUrl(settlement.id)}" style="background-color: #2E7D32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Process Settlement
          </a>
        </p>
      `,
    });

    this.logger.log(`Settlement approved notification sent for ${settlement.settlementNumber}`);
  }

  /**
   * Send notification when a settlement is processed (payment made)
   */
  async notifySettlementProcessed(settlement: PartnerSettlement): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email notifications disabled - skipping settlement processed notification');
      return;
    }

    const partnerContact = PARTNER_CONTACTS[settlement.partnerType];
    const amount = (Number(settlement.totalAmount) / 100).toLocaleString('en-KE', {
      style: 'currency',
      currency: 'KES',
    });

    // Notify partner
    await this.sendEmail({
      to: [partnerContact.email],
      subject: `[BodaInsure] Payment Completed - ${settlement.settlementNumber}`,
      html: `
        <h2>Payment Completed</h2>
        <p>Dear ${partnerContact.name},</p>
        <p>Your settlement payment has been processed successfully.</p>

        <div style="background-color: #E8F5E9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">Amount Transferred</p>
          <p style="margin: 5px 0 0 0; font-size: 28px; color: #2E7D32; font-weight: bold;">${amount}</p>
        </div>

        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Settlement Number</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.settlementNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Bank Reference</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.bankReference || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Bank Account</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.bankAccount || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Settled At</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.settledAt?.toISOString() || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Period</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${settlement.periodStart.toISOString().split('T')[0]} to ${settlement.periodEnd.toISOString().split('T')[0]}</td>
          </tr>
        </table>

        <p style="margin-top: 20px; color: #666;">
          Please allow 1-2 business days for the funds to reflect in your account.
        </p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated notification from BodaInsure.<br>
          If you have questions, please contact finance@bodainsure.co.ke
        </p>
      `,
    });

    this.logger.log(`Settlement processed notification sent for ${settlement.settlementNumber}`);
  }

  /**
   * Send escrow balance alert when balance is low or high
   */
  async notifyEscrowBalanceAlert(
    currentBalance: number,
    threshold: number,
    type: 'LOW' | 'HIGH',
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email notifications disabled - skipping escrow balance alert');
      return;
    }

    const balanceFormatted = (currentBalance / 100).toLocaleString('en-KE', {
      style: 'currency',
      currency: 'KES',
    });
    const thresholdFormatted = (threshold / 100).toLocaleString('en-KE', {
      style: 'currency',
      currency: 'KES',
    });

    const color = type === 'LOW' ? '#C62828' : '#FF8F00';
    const bgColor = type === 'LOW' ? '#FFEBEE' : '#FFF8E1';

    await this.sendEmail({
      to: ADMIN_EMAILS,
      subject: `[BodaInsure] ⚠️ Escrow Balance ${type} Alert`,
      html: `
        <h2 style="color: ${color};">⚠️ Escrow Balance ${type} Alert</h2>
        <p>The escrow account balance has ${type === 'LOW' ? 'fallen below' : 'exceeded'} the threshold.</p>

        <div style="background-color: ${bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
          <p style="margin: 0; font-size: 14px; color: #666;">Current Escrow Balance</p>
          <p style="margin: 5px 0 0 0; font-size: 28px; color: ${color}; font-weight: bold;">${balanceFormatted}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Threshold: ${thresholdFormatted}</p>
        </div>

        <p style="margin-top: 20px;">
          ${type === 'LOW'
            ? 'Please review pending settlements and ensure adequate funds are available for upcoming payments.'
            : 'Consider processing pending settlements or remittances to reduce the balance.'
          }
        </p>

        <p style="margin-top: 20px;">
          <a href="${this.getDashboardUrl()}" style="background-color: ${color}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Dashboard
          </a>
        </p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated alert from BodaInsure Accounting System.
        </p>
      `,
    });

    this.logger.log(`Escrow balance ${type} alert sent - Balance: ${currentBalance}`);
  }

  /**
   * Send daily settlement summary
   */
  async sendDailySettlementSummary(summary: {
    date: Date;
    pendingCount: number;
    pendingAmount: number;
    approvedCount: number;
    approvedAmount: number;
    processedCount: number;
    processedAmount: number;
    escrowBalance: number;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email notifications disabled - skipping daily summary');
      return;
    }

    const formatAmount = (amount: number) => (amount / 100).toLocaleString('en-KE', {
      style: 'currency',
      currency: 'KES',
    });

    await this.sendEmail({
      to: ADMIN_EMAILS,
      subject: `[BodaInsure] Daily Settlement Summary - ${summary.date.toISOString().split('T')[0]}`,
      html: `
        <h2>Daily Settlement Summary</h2>
        <p>Summary for ${summary.date.toISOString().split('T')[0]}</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr style="background-color: #FFF8E1;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Pending Settlements</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${summary.pendingCount}</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #FF8F00;">${formatAmount(summary.pendingAmount)}</td>
          </tr>
          <tr style="background-color: #E3F2FD;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Approved (Ready for Processing)</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${summary.approvedCount}</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #1976D2;">${formatAmount(summary.approvedAmount)}</td>
          </tr>
          <tr style="background-color: #E8F5E9;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Processed Today</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${summary.processedCount}</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #2E7D32;">${formatAmount(summary.processedAmount)}</td>
          </tr>
        </table>

        <div style="background-color: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">Current Escrow Balance</p>
          <p style="margin: 5px 0 0 0; font-size: 28px; color: #1976D2; font-weight: bold;">${formatAmount(summary.escrowBalance)}</p>
        </div>

        <p style="margin-top: 20px;">
          <a href="${this.getDashboardUrl()}" style="background-color: #1976D2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Dashboard
          </a>
        </p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated daily summary from BodaInsure Accounting System.
        </p>
      `,
    });

    this.logger.log('Daily settlement summary sent');
  }

  // ===========================
  // Helper Methods
  // ===========================

  private async sendEmail(options: {
    to: string[];
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', 'noreply@bodainsure.co.ke'),
        to: options.to.join(', '),
        subject: options.subject,
        html: options.html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
    }
  }

  private getSettlementUrl(settlementId: string): string {
    const baseUrl = this.configService.get<string>('APP_URL', 'https://admin.bodainsure.co.ke');
    return `${baseUrl}/accounting/settlements/${settlementId}`;
  }

  private getDashboardUrl(): string {
    const baseUrl = this.configService.get<string>('APP_URL', 'https://admin.bodainsure.co.ke');
    return `${baseUrl}/accounting/dashboard`;
  }
}
