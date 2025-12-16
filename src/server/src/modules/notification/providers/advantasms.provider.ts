import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
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
 * Advantasms Error Codes
 * Per Advantasms API documentation
 */
const ADVANTASMS_ERROR_CODES: Record<number, string> = {
  200: 'Success',
  1001: 'Invalid sender ID',
  1002: 'Network not allowed',
  1003: 'Invalid mobile number',
  1004: 'Low bulk credits',
  1005: 'Failed, try again',
  1006: 'Invalid credentials',
  1007: 'Database connection failed',
  1008: 'Database connection failed',
  1009: 'Route not defined',
  1010: 'Duplicate number',
  4090: 'Internal error',
  4091: 'No response',
  4092: 'Service temporarily unavailable',
  4093: 'Timeout',
};

/**
 * Advantasms SMS Provider
 * Integrates with Advantasms SMS gateway for Kenya
 *
 * API Documentation: https://advantasms.com/api
 *
 * Per CLAUDE.md and ussd_sms_integration.md requirements
 */
@Injectable()
export class AdvantasmsProvider implements ISmsProvider {
  private readonly logger = new Logger(AdvantasmsProvider.name);
  readonly name = 'advantasms';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly partnerId: string;
  private readonly senderId: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'ADVANTASMS_BASE_URL',
      'https://quicksms.advantasms.com/api/services',
    );
    this.apiKey = this.configService.get<string>('ADVANTASMS_API_KEY', '');
    this.partnerId = this.configService.get<string>('ADVANTASMS_PARTNER_ID', '');
    this.senderId = this.configService.get<string>('ADVANTASMS_SENDER_ID', 'BodaInsure');
    this.enabled = this.configService.get<boolean>('ADVANTASMS_ENABLED', false);
  }

  /**
   * Send a single SMS via Advantasms
   */
  async send(request: ISendSmsRequest): Promise<ISendSmsResponse> {
    const { to, message, senderId, scheduleTime } = request;

    // Format phone number for Advantasms (254XXXXXXXXX without + prefix)
    const formattedPhone = this.formatPhoneNumber(to);
    if (!formattedPhone) {
      return {
        success: false,
        provider: this.name,
        error: 'Invalid phone number format',
      };
    }

    // Check if enabled
    if (!this.enabled) {
      this.logger.warn(`Advantasms disabled. Would send to ${maskPhone(to)}: ${message.substring(0, 30)}...`);
      return {
        success: true,
        messageId: `dev-adv-${Date.now()}`,
        provider: this.name,
      };
    }

    try {
      const payload: Record<string, unknown> = {
        apikey: this.apiKey,
        partnerID: this.partnerId,
        message,
        shortcode: senderId ?? this.senderId,
        mobile: formattedPhone,
      };

      // Add scheduled time if provided (format: YYYY-MM-DD HH:MM)
      if (scheduleTime) {
        payload.timeToSend = this.formatScheduleTime(scheduleTime);
      }

      this.logger.debug(`Sending SMS via Advantasms to ${maskPhone(to)}`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/sendsms/`, payload, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );

      const result = response.data?.responses?.[0];

      // IMPORTANT: Advantasms API has a typo - "respose-code" instead of "response-code"
      const responseCode = result?.['respose-code'] ?? result?.['response-code'];

      if (responseCode === 200) {
        this.logger.log(
          `SMS sent via Advantasms to ${maskPhone(to)} messageId=${result.messageid}`,
        );

        return {
          success: true,
          messageId: String(result.messageid),
          provider: this.name,
        };
      } else {
        const errorDesc =
          result?.['response-description'] ??
          ADVANTASMS_ERROR_CODES[responseCode] ??
          'Unknown error';

        this.logger.warn(
          `Advantasms SMS failed to ${maskPhone(to)}: ${responseCode} - ${errorDesc}`,
        );

        return {
          success: false,
          provider: this.name,
          error: `${responseCode}: ${errorDesc}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Advantasms SMS exception to ${maskPhone(to)}: ${errorMessage}`);

      return {
        success: false,
        provider: this.name,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk SMS via Advantasms
   * Advantasms supports max 20 messages per bulk request
   */
  async sendBulk(request: IBulkSmsRequest): Promise<IBulkSmsResponse> {
    const results: ISendSmsResponse[] = [];
    const MAX_BATCH_SIZE = 20;

    // Check if enabled
    if (!this.enabled) {
      for (const _msg of request.messages) {
        results.push({
          success: true,
          messageId: `dev-adv-${Date.now()}-${results.length}`,
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

    // Split into batches of 20
    const batches = this.chunkArray(request.messages, MAX_BATCH_SIZE);

    for (const batch of batches) {
      try {
        const smslist = batch.map((msg, idx) => ({
          partnerID: this.partnerId,
          apikey: this.apiKey,
          pass_type: 'plain',
          clientsmsid: msg.clientId ?? `${Date.now()}_${idx}`,
          mobile: this.formatPhoneNumber(msg.to),
          message: msg.message,
          shortcode: msg.senderId ?? this.senderId,
        }));

        const response = await firstValueFrom(
          this.httpService.post(
            `${this.baseUrl}/sendbulk/`,
            {
              count: smslist.length,
              smslist,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
            },
          ),
        );

        for (const result of response.data?.responses ?? []) {
          const responseCode = result['respose-code'] ?? result['response-code'];
          results.push({
            success: responseCode === 200,
            messageId: result.messageid ? String(result.messageid) : undefined,
            provider: this.name,
            error: responseCode !== 200 ? result['response-description'] : undefined,
          });
        }
      } catch (error) {
        // Mark all messages in failed batch as failed
        for (const _msg of batch) {
          results.push({
            success: false,
            provider: this.name,
            error: error instanceof Error ? error.message : 'Batch send failed',
          });
        }
      }

      // Small delay between batches to avoid rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(100);
      }
    }

    const totalSent = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    this.logger.log(`Advantasms bulk send: ${totalSent} sent, ${totalFailed} failed`);

    return {
      success: totalFailed === 0,
      results,
      provider: this.name,
      totalSent,
      totalFailed,
    };
  }

  /**
   * Get delivery report for a message
   */
  async getDeliveryReport(messageId: string): Promise<IDeliveryReport | null> {
    if (!this.enabled) {
      return {
        messageId,
        status: 'Delivered',
      };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/getdlr/`,
          {
            apikey: this.apiKey,
            partnerID: this.partnerId,
            messageID: messageId,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      const data = response.data;
      const status = this.mapDeliveryStatus(data?.status);

      return {
        messageId,
        status,
        deliveredAt: data?.deliveryTime ? new Date(data.deliveryTime) : undefined,
        failureReason: status === 'Failed' ? data?.failureReason : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get delivery report for ${messageId}`, error);
      return null;
    }
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
        this.httpService.post(
          `${this.baseUrl}/getbalance/`,
          {
            apikey: this.apiKey,
            partnerID: this.partnerId,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      const balance = parseFloat(response.data?.balance ?? '0');

      return {
        balance,
        currency: 'KES',
      };
    } catch (error) {
      this.logger.error('Failed to get Advantasms balance', error);
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
   * Format phone number for Advantasms (254XXXXXXXXX without + prefix)
   */
  private formatPhoneNumber(phone: string): string | null {
    let cleaned = phone.replace(/\D/g, '');

    // Handle various formats
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    } else if (!cleaned.startsWith('254')) {
      // Try to add country code if it looks like a subscriber number
      if (cleaned.length === 9) {
        cleaned = '254' + cleaned;
      }
    }

    // Validate length (254 + 9 digits = 12)
    if (cleaned.length !== 12) {
      return null;
    }

    return cleaned;
  }

  /**
   * Format schedule time for Advantasms (YYYY-MM-DD HH:MM)
   */
  private formatScheduleTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /**
   * Map delivery status from Advantasms to standard format
   */
  private mapDeliveryStatus(
    status: string | undefined,
  ): IDeliveryReport['status'] {
    if (!status) return 'Unknown';

    const statusMap: Record<string, IDeliveryReport['status']> = {
      DELIVRD: 'Delivered',
      SENT: 'Sent',
      FAILED: 'Failed',
      REJECTED: 'Rejected',
      EXPIRED: 'Expired',
    };

    return statusMap[status.toUpperCase()] ?? 'Unknown';
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
