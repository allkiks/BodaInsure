import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import {
  ISmsProvider,
  ISendSmsRequest,
  ISendSmsResponse,
  IBulkSmsRequest,
  IBulkSmsResponse,
  IDeliveryReport,
  IProviderBalance,
} from '../interfaces/sms-provider.interface.js';
import { maskPhone } from '../../../common/utils/phone.util.js';

/**
 * Africa's Talking Status Codes
 * Per AT API documentation: https://developers.africastalking.com/docs/sms/sending
 */
export const AT_STATUS_CODES: Record<number, { status: string; retryable: boolean; description: string }> = {
  100: { status: 'Processed', retryable: false, description: 'Request accepted for processing' },
  101: { status: 'Sent', retryable: false, description: 'Message sent successfully' },
  102: { status: 'Queued', retryable: false, description: 'Message queued for delivery' },
  401: { status: 'RiskHold', retryable: true, description: 'Message held for risk analysis' },
  402: { status: 'InvalidSenderId', retryable: false, description: 'Invalid sender ID' },
  403: { status: 'InvalidPhoneNumber', retryable: false, description: 'Invalid phone number format' },
  404: { status: 'UnsupportedNumberType', retryable: false, description: 'Number type not supported' },
  405: { status: 'InsufficientBalance', retryable: true, description: 'Insufficient account balance' },
  406: { status: 'UserInBlacklist', retryable: false, description: 'User is blacklisted' },
  407: { status: 'CouldNotRoute', retryable: true, description: 'Could not route message to carrier' },
  500: { status: 'InternalServerError', retryable: true, description: 'AT internal server error' },
  501: { status: 'GatewayError', retryable: true, description: 'Gateway error' },
  502: { status: 'RejectedByGateway', retryable: false, description: 'Message rejected by carrier' },
};

/**
 * Non-retryable AT error strings
 */
const NON_RETRYABLE_ERRORS = [
  'InvalidPhoneNumber',
  'InvalidSenderId',
  'UnsupportedNumberType',
  'UserInBlacklist',
  'RejectedByGateway',
  'Blacklisted',
  'Invalid',
];

/**
 * Africa's Talking SMS Provider
 * Integrates with Africa's Talking SMS gateway (popular in Kenya)
 *
 * API Documentation: https://developers.africastalking.com/
 *
 * Per CLAUDE.md and ussd_sms_integration.md requirements
 *
 * Key Features:
 * - Graceful exception handling (never throws, always returns error response)
 * - AT-specific error code handling
 * - Audit logging for failures
 * - Timeout handling for HTTP requests
 */
@Injectable()
export class AfricasTalkingProvider implements ISmsProvider {
  private readonly logger = new Logger(AfricasTalkingProvider.name);
  readonly name = 'africastalking';

  private readonly apiKey: string;
  private readonly username: string;
  private readonly senderId: string;
  private readonly baseUrl: string;
  private readonly enabled: boolean;
  private readonly requestTimeout: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('AT_API_KEY', '');
    this.username = this.configService.get<string>('AT_USERNAME', 'sandbox');
    this.senderId = this.configService.get<string>('AT_SENDER_ID', 'BodaInsure');
    this.enabled = this.configService.get<boolean>('AT_ENABLED', false);
    this.requestTimeout = this.configService.get<number>('AT_REQUEST_TIMEOUT', 30000);

    // Use sandbox URL for testing, production URL otherwise
    const isSandbox = this.username === 'sandbox';
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com/version1'
      : 'https://api.africastalking.com/version1';

    this.logger.log(`Africa's Talking provider initialized: enabled=${this.enabled}, sandbox=${isSandbox}`);
  }

  /**
   * Send a single SMS via Africa's Talking
   *
   * IMPORTANT: This method NEVER throws exceptions.
   * All errors are caught and returned as error responses.
   * This ensures graceful degradation without breaking the application.
   */
  async send(request: ISendSmsRequest): Promise<ISendSmsResponse> {
    const { to, message, senderId } = request;

    // Format phone number for AT (+254XXXXXXXXX)
    const formattedPhone = this.formatPhoneNumber(to);
    if (!formattedPhone) {
      this.logAuditError('SMS_VALIDATION_FAILED', to, 'Invalid phone number format');
      return {
        success: false,
        provider: this.name,
        error: 'Invalid phone number format',
      };
    }

    // Check if enabled (dev mode)
    if (!this.enabled) {
      this.logger.warn(
        `Africa's Talking disabled. Would send to ${maskPhone(to)}: ${message.substring(0, 30)}...`,
      );
      return {
        success: true,
        messageId: `dev-at-${Date.now()}`,
        provider: this.name,
      };
    }

    try {
      this.logger.debug(`Sending SMS via Africa's Talking to ${maskPhone(to)}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/messaging`,
          new URLSearchParams({
            username: this.username,
            to: formattedPhone,
            message,
            from: senderId ?? this.senderId,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              apiKey: this.apiKey,
              Accept: 'application/json',
            },
            timeout: this.requestTimeout,
          },
        ).pipe(
          timeout(this.requestTimeout),
          catchError((err) => {
            // Return a wrapped error response instead of throwing
            return of({ data: null, error: err });
          }),
        ),
      );

      // Handle timeout/network errors caught by catchError
      if ('error' in response && response.error) {
        const error = response.error;
        const errorMessage = this.categorizeError(error);
        this.logAuditError('SMS_SEND_FAILED', to, errorMessage, { originalError: error.message });
        return {
          success: false,
          provider: this.name,
          error: errorMessage,
        };
      }

      const recipient = response.data?.SMSMessageData?.Recipients?.[0];

      if (recipient) {
        const statusCode = recipient.statusCode;
        const statusInfo = AT_STATUS_CODES[statusCode];
        const success = statusCode === 101 || statusCode === 100 || statusCode === 102 || recipient.status === 'Success';

        if (success) {
          this.logger.log(
            `SMS sent via Africa's Talking to ${maskPhone(to)} messageId=${recipient.messageId} cost=${recipient.cost}`,
          );
        } else {
          const errorDescription = statusInfo?.description ?? recipient.status ?? 'Unknown error';
          this.logAuditError('SMS_DELIVERY_FAILED', to, errorDescription, {
            statusCode,
            status: recipient.status,
            messageId: recipient.messageId,
          });
        }

        return {
          success,
          messageId: recipient.messageId,
          provider: this.name,
          cost: recipient.cost,
          error: success ? undefined : (statusInfo?.status ?? recipient.status),
        };
      }

      // No recipient in response - unusual but handle gracefully
      this.logAuditError('SMS_SEND_FAILED', to, 'No recipient data in AT response', {
        responseData: response.data,
      });

      return {
        success: false,
        provider: this.name,
        error: 'No recipient data in response',
      };

    } catch (error) {
      // Catch-all for any unexpected errors
      // This ensures the application NEVER crashes due to AT failures
      const errorMessage = this.categorizeError(error);

      this.logAuditError('SMS_EXCEPTION', to, errorMessage, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        provider: this.name,
        error: errorMessage,
      };
    }
  }

  /**
   * Categorize error for better error messages and retry decisions
   */
  private categorizeError(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'Request timeout - AT service not responding';
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors
      if (message.includes('econnrefused') || message.includes('enotfound')) {
        return 'Network error - Cannot reach AT service';
      }
      if (message.includes('etimedout') || message.includes('timeout')) {
        return 'Request timeout - AT service not responding';
      }
      if (message.includes('econnreset')) {
        return 'Connection reset - AT service disconnected';
      }

      // HTTP 409 conflict (time sync issue per AT docs)
      if (message.includes('409') || message.includes('conflict')) {
        return 'Time conflict (HTTP 409) - Retryable';
      }

      // Auth errors
      if (message.includes('401') || message.includes('unauthorized')) {
        return 'Authentication failed - Invalid API credentials';
      }

      // Rate limiting
      if (message.includes('429') || message.includes('rate limit')) {
        return 'Rate limited - Too many requests';
      }

      return error.message;
    }

    return 'Unknown error occurred';
  }

  /**
   * Log error to audit log
   * Per CLAUDE.md requirement: Log failures to audit log
   */
  private logAuditError(
    eventType: string,
    phone: string,
    errorMessage: string,
    details?: Record<string, unknown>,
  ): void {
    // Log structured audit event for monitoring and compliance
    this.logger.error(
      JSON.stringify({
        audit: true,
        eventType,
        provider: this.name,
        phone: maskPhone(phone),
        error: errorMessage,
        details,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Check if an error is retryable based on AT status codes
   */
  isRetryableError(error?: string): boolean {
    if (!error) return true;

    // Check against known non-retryable errors
    const isNonRetryable = NON_RETRYABLE_ERRORS.some(
      (e) => error.toLowerCase().includes(e.toLowerCase()),
    );

    if (isNonRetryable) return false;

    // Check against AT status codes
    for (const [_code, info] of Object.entries(AT_STATUS_CODES)) {
      if (error.includes(info.status) && !info.retryable) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send bulk SMS via Africa's Talking
   * Uses enqueue: true for large batches
   */
  async sendBulk(request: IBulkSmsRequest): Promise<IBulkSmsResponse> {
    const results: ISendSmsResponse[] = [];

    // Check if enabled
    if (!this.enabled) {
      for (const _msg of request.messages) {
        results.push({
          success: true,
          messageId: `dev-at-${Date.now()}-${results.length}`,
          provider: this.name,
        });
      }
      return {
        success: true,
        results,
        provider: this.name,
        totalSent: results.length,
        totalFailed: 0,
      };
    }

    // Group messages by content for efficiency
    const messageGroups = this.groupByMessage(request.messages);

    for (const [message, recipients] of Object.entries(messageGroups)) {
      try {
        const phones = recipients
          .map((r) => this.formatPhoneNumber(r.to))
          .filter((p): p is string => p !== null);

        if (phones.length === 0) continue;

        const response = await firstValueFrom(
          this.httpService.post(
            `${this.baseUrl}/messaging`,
            new URLSearchParams({
              username: this.username,
              to: phones.join(','),
              message,
              from: this.senderId,
              // Use enqueue for bulk to avoid timeouts
              enqueue: phones.length > 10 ? '1' : '0',
            }).toString(),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                apiKey: this.apiKey,
                Accept: 'application/json',
              },
            },
          ),
        );

        for (const recipient of response.data?.SMSMessageData?.Recipients ?? []) {
          const success = recipient.statusCode === 101 || recipient.status === 'Success';
          results.push({
            success,
            messageId: recipient.messageId,
            provider: this.name,
            cost: recipient.cost,
            error: success ? undefined : recipient.status,
          });
        }
      } catch (error) {
        // Mark all recipients in failed group as failed
        for (const _recipient of recipients) {
          results.push({
            success: false,
            provider: this.name,
            error: error instanceof Error ? error.message : 'Bulk send failed',
          });
        }
      }
    }

    const totalSent = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    this.logger.log(`Africa's Talking bulk send: ${totalSent} sent, ${totalFailed} failed`);

    return {
      success: totalFailed === 0,
      results,
      provider: this.name,
      totalSent,
      totalFailed,
    };
  }

  /**
   * Get delivery report (AT uses callbacks, this is for manual checks)
   */
  async getDeliveryReport(messageId: string): Promise<IDeliveryReport | null> {
    if (!this.enabled) {
      return {
        messageId,
        status: 'Delivered',
      };
    }

    // Africa's Talking uses delivery callbacks rather than polling
    // This would require checking a database for stored callback data
    this.logger.debug(`Delivery report check for ${messageId} - AT uses callbacks`);
    return null;
  }

  /**
   * Get provider balance
   */
  async getBalance(): Promise<IProviderBalance | null> {
    if (!this.enabled) {
      return { balance: 0, currency: 'KES' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/user?username=${this.username}`, {
          headers: {
            apiKey: this.apiKey,
            Accept: 'application/json',
          },
        }),
      );

      const userData = response.data?.UserData;
      if (userData?.balance) {
        // Parse "KES 1000.00" format
        const match = userData.balance.match(/([A-Z]+)\s+([\d.]+)/);
        if (match) {
          return {
            currency: match[1],
            balance: parseFloat(match[2]),
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get Africa\'s Talking balance', error);
      return null;
    }
  }

  /**
   * Validate provider credentials
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    const balance = await this.getBalance();
    return balance !== null;
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      const balance = await this.getBalance();
      return balance !== null && balance.balance > 0;
    } catch {
      return false;
    }
  }

  /**
   * Format phone number for Africa's Talking (+254XXXXXXXXX)
   */
  private formatPhoneNumber(phone: string): string | null {
    let cleaned = phone.replace(/\D/g, '');

    // Handle various formats
    if (cleaned.startsWith('254')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      cleaned = '+254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '+254' + cleaned;
    } else if (cleaned.length === 9) {
      cleaned = '+254' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    // Validate length (+254 + 9 digits = 13)
    if (cleaned.length !== 13) {
      return null;
    }

    return cleaned;
  }

  /**
   * Group messages by content for efficient bulk sending
   */
  private groupByMessage(
    messages: ISendSmsRequest[],
  ): Record<string, ISendSmsRequest[]> {
    return messages.reduce(
      (acc, msg) => {
        const key = msg.message;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key]!.push(msg);
        return acc;
      },
      {} as Record<string, ISendSmsRequest[]>,
    );
  }
}
