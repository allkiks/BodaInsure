import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * SMS send request
 */
export interface SmsSendRequest {
  to: string;
  message: string;
  from?: string;
}

/**
 * SMS send result
 */
export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  status: string;
  cost?: number;
  error?: string;
}

/**
 * SMS delivery status
 */
export interface SmsDeliveryStatus {
  messageId: string;
  status: 'Sent' | 'Submitted' | 'Buffered' | 'Rejected' | 'Success' | 'Failed';
  failureReason?: string;
}

/**
 * SMS Service
 * Integrates with Africa's Talking SMS gateway (popular in Kenya)
 *
 * Per module_architecture.md notification requirements
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
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
    this.enabled = this.configService.get<boolean>('SMS_ENABLED', false);

    // Use sandbox URL for testing, production URL otherwise
    const isSandbox = this.username === 'sandbox';
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com/version1'
      : 'https://api.africastalking.com/version1';
  }

  /**
   * Send an SMS message
   */
  async send(request: SmsSendRequest): Promise<SmsSendResult> {
    const { to, message, from } = request;

    // Validate phone number format
    const formattedPhone = this.formatPhoneNumber(to);
    if (!formattedPhone) {
      return {
        success: false,
        status: 'InvalidPhoneNumber',
        error: 'Invalid phone number format',
      };
    }

    // Check if SMS is enabled
    if (!this.enabled) {
      this.logger.warn(`SMS disabled. Would send to ${formattedPhone}: ${message.substring(0, 50)}...`);
      return {
        success: true,
        messageId: `dev-${Date.now()}`,
        status: 'DevMode',
      };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/messaging`,
          new URLSearchParams({
            username: this.username,
            to: formattedPhone,
            message,
            from: from ?? this.senderId,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'apiKey': this.apiKey,
              'Accept': 'application/json',
            },
          },
        ),
      );

      const data = response.data;
      const recipient = data.SMSMessageData?.Recipients?.[0];

      if (recipient) {
        const success = recipient.status === 'Success' || recipient.statusCode === 101;
        return {
          success,
          messageId: recipient.messageId,
          status: recipient.status,
          cost: this.parseCost(recipient.cost),
          error: success ? undefined : recipient.status,
        };
      }

      return {
        success: false,
        status: 'UnknownError',
        error: 'No recipient data in response',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SMS send failed: ${errorMessage}`, error);

      return {
        success: false,
        status: 'SendFailed',
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulk(requests: SmsSendRequest[]): Promise<SmsSendResult[]> {
    // Africa's Talking supports bulk sending with comma-separated numbers
    // For now, we'll send individually to track each result
    const results: SmsSendResult[] = [];

    for (const request of requests) {
      const result = await this.send(request);
      results.push(result);

      // Small delay to avoid rate limiting
      await this.delay(50);
    }

    return results;
  }

  /**
   * Check delivery status of a message
   */
  async getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus | null> {
    if (!this.enabled) {
      return {
        messageId,
        status: 'Success',
      };
    }

    // Africa's Talking uses delivery callbacks rather than polling
    // This method would be used if we implement status polling
    this.logger.debug(`Checking delivery status for ${messageId}`);

    return null;
  }

  /**
   * Format phone number to E.164 format for Kenya
   */
  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle various Kenyan phone formats
    if (cleaned.startsWith('254')) {
      // Already has country code
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      // Local format (07xxxxxxxx or 01xxxxxxxx)
      cleaned = '+254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      // Missing leading zero
      cleaned = '+254' + cleaned;
    } else if (cleaned.length === 9) {
      // Just the subscriber number
      cleaned = '+254' + cleaned;
    } else {
      return null;
    }

    // Validate length (Kenya numbers are +254 followed by 9 digits)
    if (cleaned.length !== 13) {
      return null;
    }

    return cleaned;
  }

  /**
   * Parse cost string to cents
   */
  private parseCost(costString?: string): number | undefined {
    if (!costString) return undefined;

    // Format: "KES 0.8000"
    const match = costString.match(/[\d.]+/);
    if (match) {
      return Math.round(parseFloat(match[0]) * 100);
    }

    return undefined;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get remaining SMS balance
   */
  async getBalance(): Promise<{ balance: string; currency: string } | null> {
    if (!this.enabled) {
      return { balance: 'N/A', currency: 'KES' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/user?username=${this.username}`,
          {
            headers: {
              'apiKey': this.apiKey,
              'Accept': 'application/json',
            },
          },
        ),
      );

      const userData = response.data?.UserData;
      if (userData?.balance) {
        // Parse "KES 1000.00" format
        const match = userData.balance.match(/([A-Z]+)\s+([\d.]+)/);
        if (match) {
          return {
            currency: match[1],
            balance: match[2],
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get SMS balance', error);
      return null;
    }
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    const balance = await this.getBalance();
    return balance !== null;
  }
}
