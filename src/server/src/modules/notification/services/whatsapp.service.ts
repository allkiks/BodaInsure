import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * WhatsApp message types
 */
export enum WhatsAppMessageType {
  TEXT = 'text',
  TEMPLATE = 'template',
  DOCUMENT = 'document',
  IMAGE = 'image',
}

/**
 * WhatsApp template component
 */
export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'document' | 'image';
    text?: string;
    document?: {
      link: string;
      filename: string;
    };
    image?: {
      link: string;
    };
  }>;
}

/**
 * WhatsApp send request
 */
export interface WhatsAppSendRequest {
  to: string;
  type: WhatsAppMessageType;
  // For text messages
  text?: string;
  // For template messages
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: WhatsAppTemplateComponent[];
  // For document messages
  documentUrl?: string;
  documentFilename?: string;
  documentCaption?: string;
}

/**
 * WhatsApp send result
 */
export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  status: string;
  error?: string;
}

/**
 * WhatsApp Service
 * Integrates with Meta WhatsApp Business API
 *
 * Per module_architecture.md notification requirements
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly businessAccountId: string;
  private readonly baseUrl: string;
  private readonly enabled: boolean;
  private readonly apiVersion: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    this.businessAccountId = this.configService.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID', '');
    this.apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION', 'v18.0');
    this.enabled = this.configService.get<boolean>('WHATSAPP_ENABLED', false);

    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Send a WhatsApp message
   */
  async send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    const { to, type } = request;

    // Format phone number
    const formattedPhone = this.formatPhoneNumber(to);
    if (!formattedPhone) {
      return {
        success: false,
        status: 'InvalidPhoneNumber',
        error: 'Invalid phone number format',
      };
    }

    // Check if WhatsApp is enabled
    if (!this.enabled) {
      this.logger.warn(`WhatsApp disabled. Would send ${type} to ${formattedPhone}`);
      return {
        success: true,
        messageId: `dev-wa-${Date.now()}`,
        status: 'DevMode',
      };
    }

    try {
      const payload = this.buildPayload(formattedPhone, request);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/${this.phoneNumberId}/messages`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const messageId = response.data?.messages?.[0]?.id;

      return {
        success: true,
        messageId,
        status: 'Sent',
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(`WhatsApp send failed: ${errorMessage}`, error);

      return {
        success: false,
        status: 'SendFailed',
        error: errorMessage,
      };
    }
  }

  /**
   * Send a text message
   */
  async sendText(to: string, text: string): Promise<WhatsAppSendResult> {
    return this.send({
      to,
      type: WhatsAppMessageType.TEXT,
      text,
    });
  }

  /**
   * Send a template message
   */
  async sendTemplate(
    to: string,
    templateName: string,
    components?: WhatsAppTemplateComponent[],
    language: string = 'en',
  ): Promise<WhatsAppSendResult> {
    return this.send({
      to,
      type: WhatsAppMessageType.TEMPLATE,
      templateName,
      templateLanguage: language,
      templateComponents: components,
    });
  }

  /**
   * Send a document (e.g., policy PDF)
   */
  async sendDocument(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
  ): Promise<WhatsAppSendResult> {
    return this.send({
      to,
      type: WhatsAppMessageType.DOCUMENT,
      documentUrl,
      documentFilename: filename,
      documentCaption: caption,
    });
  }

  /**
   * Send policy document via WhatsApp
   */
  async sendPolicyDocument(
    to: string,
    policyNumber: string,
    documentUrl: string,
  ): Promise<WhatsAppSendResult> {
    return this.sendDocument(
      to,
      documentUrl,
      `BodaInsure_Policy_${policyNumber}.pdf`,
      `Your BodaInsure policy certificate (${policyNumber}). Keep this document safe!`,
    );
  }

  /**
   * Build the API payload based on message type
   */
  private buildPayload(to: string, request: WhatsAppSendRequest): Record<string, unknown> {
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
    };

    switch (request.type) {
      case WhatsAppMessageType.TEXT:
        return {
          ...base,
          type: 'text',
          text: {
            preview_url: false,
            body: request.text,
          },
        };

      case WhatsAppMessageType.TEMPLATE:
        return {
          ...base,
          type: 'template',
          template: {
            name: request.templateName,
            language: {
              code: request.templateLanguage ?? 'en',
            },
            components: request.templateComponents ?? [],
          },
        };

      case WhatsAppMessageType.DOCUMENT:
        return {
          ...base,
          type: 'document',
          document: {
            link: request.documentUrl,
            filename: request.documentFilename,
            caption: request.documentCaption,
          },
        };

      case WhatsAppMessageType.IMAGE:
        return {
          ...base,
          type: 'image',
          image: {
            link: request.documentUrl,
            caption: request.documentCaption,
          },
        };

      default:
        throw new Error(`Unknown message type: ${request.type}`);
    }
  }

  /**
   * Format phone number for WhatsApp (no + prefix, just digits)
   */
  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle various Kenyan phone formats
    if (cleaned.startsWith('254')) {
      // Already has country code
    } else if (cleaned.startsWith('0')) {
      // Local format
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      // Missing leading zero
      cleaned = '254' + cleaned;
    } else if (cleaned.length === 9) {
      // Just the subscriber number
      cleaned = '254' + cleaned;
    } else {
      return null;
    }

    // Validate length (Kenya: 254 + 9 digits = 12 digits)
    if (cleaned.length !== 12) {
      return null;
    }

    return cleaned;
  }

  /**
   * Extract error message from API error
   */
  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
      if (response?.data?.error?.message) {
        return response.data.error.message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/${this.phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${messageId}`, error);
      return false;
    }
  }

  /**
   * Get message templates
   */
  async getTemplates(): Promise<Array<{ name: string; status: string; language: string }>> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${this.businessAccountId}/message_templates`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
            },
          },
        ),
      );

      return (response.data?.data ?? []).map((template: Record<string, unknown>) => ({
        name: template.name,
        status: template.status,
        language: template.language,
      }));
    } catch (error) {
      this.logger.error('Failed to get WhatsApp templates', error);
      return [];
    }
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${this.phoneNumberId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
            },
          },
        ),
      );

      return !!response.data?.id;
    } catch (error) {
      this.logger.error('WhatsApp credentials validation failed', error);
      return false;
    }
  }

  // ============================================================
  // BodaInsure-specific template methods
  // Per GAP-007: Complete WhatsApp service integration
  // ============================================================

  /**
   * Send welcome message after registration
   */
  async sendWelcomeMessage(
    to: string,
    userName?: string,
  ): Promise<WhatsAppSendResult> {
    const name = userName ?? 'Rider';
    return this.sendTemplate(to, 'bodainsure_welcome', [
      {
        type: 'body',
        parameters: [{ type: 'text', text: name }],
      },
    ]);
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(
    to: string,
    amount: number,
    transactionId: string,
    balance: number,
    daysRemaining: number,
  ): Promise<WhatsAppSendResult> {
    return this.sendTemplate(to, 'bodainsure_payment_confirmed', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: `KES ${amount.toFixed(0)}` },
          { type: 'text', text: transactionId },
          { type: 'text', text: `KES ${balance.toFixed(0)}` },
          { type: 'text', text: `${daysRemaining}` },
        ],
      },
    ]);
  }

  /**
   * Send policy certificate with PDF attachment
   */
  async sendPolicyCertificate(
    to: string,
    policyNumber: string,
    vehicleReg: string,
    validFrom: Date,
    validTo: Date,
    pdfUrl: string,
  ): Promise<WhatsAppSendResult> {
    // First send the template message with policy details
    const templateResult = await this.sendTemplate(
      to,
      'bodainsure_policy_issued',
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: policyNumber },
            { type: 'text', text: vehicleReg },
            { type: 'text', text: validFrom.toLocaleDateString('en-KE') },
            { type: 'text', text: validTo.toLocaleDateString('en-KE') },
          ],
        },
      ],
    );

    if (!templateResult.success) {
      return templateResult;
    }

    // Then send the PDF document
    return this.sendPolicyDocument(to, policyNumber, pdfUrl);
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(
    to: string,
    daysOverdue: number,
    amount: number,
    graceDaysRemaining: number,
  ): Promise<WhatsAppSendResult> {
    return this.sendTemplate(to, 'bodainsure_payment_reminder', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: `${daysOverdue}` },
          { type: 'text', text: `KES ${amount.toFixed(0)}` },
          { type: 'text', text: `${graceDaysRemaining}` },
        ],
      },
    ]);
  }

  /**
   * Send policy expiry warning
   */
  async sendPolicyExpiryWarning(
    to: string,
    policyNumber: string,
    expiryDate: Date,
    daysUntilExpiry: number,
  ): Promise<WhatsAppSendResult> {
    return this.sendTemplate(to, 'bodainsure_policy_expiring', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: policyNumber },
          { type: 'text', text: `${daysUntilExpiry}` },
          { type: 'text', text: expiryDate.toLocaleDateString('en-KE') },
        ],
      },
    ]);
  }

  /**
   * Send coverage lapse notification
   */
  async sendCoverageLapseNotification(
    to: string,
    vehicleReg: string,
    lastActiveDate: Date,
  ): Promise<WhatsAppSendResult> {
    return this.sendTemplate(to, 'bodainsure_coverage_lapsed', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: vehicleReg },
          { type: 'text', text: lastActiveDate.toLocaleDateString('en-KE') },
        ],
      },
    ]);
  }

  /**
   * Send renewal success message
   */
  async sendRenewalSuccess(
    to: string,
    policyNumber: string,
    newValidTo: Date,
  ): Promise<WhatsAppSendResult> {
    return this.sendTemplate(to, 'bodainsure_renewal_success', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: policyNumber },
          { type: 'text', text: newValidTo.toLocaleDateString('en-KE') },
        ],
      },
    ]);
  }

  /**
   * Send refund confirmation
   */
  async sendRefundConfirmation(
    to: string,
    amount: number,
    reason: string,
    transactionId: string,
  ): Promise<WhatsAppSendResult> {
    return this.sendTemplate(to, 'bodainsure_refund_processed', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: `KES ${amount.toFixed(0)}` },
          { type: 'text', text: reason },
          { type: 'text', text: transactionId },
        ],
      },
    ]);
  }

  /**
   * Check if WhatsApp is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    enabled: boolean;
    configured: boolean;
    credentialsValid: boolean;
  }> {
    const configured = !!(this.accessToken && this.phoneNumberId);
    const credentialsValid = configured ? await this.validateCredentials() : false;

    return {
      enabled: this.enabled,
      configured,
      credentialsValid,
    };
  }
}
