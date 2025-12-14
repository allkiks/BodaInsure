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
 * Africa's Talking SMS Provider
 * Integrates with Africa's Talking SMS gateway (popular in Kenya)
 *
 * API Documentation: https://developers.africastalking.com/
 *
 * Per CLAUDE.md and ussd_sms_integration.md requirements
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

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('AT_API_KEY', '');
    this.username = this.configService.get<string>('AT_USERNAME', 'sandbox');
    this.senderId = this.configService.get<string>('AT_SENDER_ID', 'BodaInsure');
    this.enabled = this.configService.get<boolean>('AT_ENABLED', false);

    // Use sandbox URL for testing, production URL otherwise
    const isSandbox = this.username === 'sandbox';
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com/version1'
      : 'https://api.africastalking.com/version1';
  }

  /**
   * Send a single SMS via Africa's Talking
   */
  async send(request: ISendSmsRequest): Promise<ISendSmsResponse> {
    const { to, message, senderId } = request;

    // Format phone number for AT (+254XXXXXXXXX)
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
          },
        ),
      );

      const recipient = response.data?.SMSMessageData?.Recipients?.[0];

      if (recipient) {
        const success = recipient.status === 'Success' || recipient.statusCode === 101;

        if (success) {
          this.logger.log(
            `SMS sent via Africa's Talking to ${maskPhone(to)} messageId=${recipient.messageId} cost=${recipient.cost}`,
          );
        } else {
          this.logger.warn(
            `Africa's Talking SMS failed to ${maskPhone(to)}: ${recipient.status}`,
          );
        }

        return {
          success,
          messageId: recipient.messageId,
          provider: this.name,
          cost: recipient.cost,
          error: success ? undefined : recipient.status,
        };
      }

      return {
        success: false,
        provider: this.name,
        error: 'No recipient data in response',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Africa's Talking SMS exception to ${maskPhone(to)}: ${errorMessage}`);

      return {
        success: false,
        provider: this.name,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk SMS via Africa's Talking
   * Uses enqueue: true for large batches
   */
  async sendBulk(request: IBulkSmsRequest): Promise<IBulkSmsResponse> {
    const results: ISendSmsResponse[] = [];

    // Check if enabled
    if (!this.enabled) {
      for (const msg of request.messages) {
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
        if (!acc[msg.message]) {
          acc[msg.message] = [];
        }
        acc[msg.message].push(msg);
        return acc;
      },
      {} as Record<string, ISendSmsRequest[]>,
    );
  }
}
