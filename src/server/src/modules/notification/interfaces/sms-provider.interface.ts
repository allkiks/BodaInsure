/**
 * SMS Provider Interface
 * Abstraction layer for SMS providers (Advantasms, Africa's Talking)
 *
 * Per CLAUDE.md notification requirements and provider failover strategy
 */

/**
 * SMS send request
 */
export interface ISendSmsRequest {
  to: string;
  message: string;
  senderId?: string;
  scheduleTime?: Date;
  clientId?: string;
}

/**
 * SMS send response
 */
export interface ISendSmsResponse {
  success: boolean;
  messageId?: string;
  provider: string;
  cost?: string;
  error?: string;
}

/**
 * Bulk SMS request
 */
export interface IBulkSmsRequest {
  messages: ISendSmsRequest[];
}

/**
 * Bulk SMS response
 */
export interface IBulkSmsResponse {
  success: boolean;
  results: ISendSmsResponse[];
  provider: string;
  totalSent: number;
  totalFailed: number;
}

/**
 * Delivery report
 */
export interface IDeliveryReport {
  messageId: string;
  status: 'Sent' | 'Delivered' | 'Failed' | 'Rejected' | 'Expired' | 'Unknown';
  deliveredAt?: Date;
  failureReason?: string;
}

/**
 * Provider balance
 */
export interface IProviderBalance {
  balance: number;
  currency: string;
}

/**
 * SMS Provider Interface
 * All SMS providers must implement this interface
 */
export interface ISmsProvider {
  /**
   * Provider name identifier
   */
  readonly name: string;

  /**
   * Send a single SMS
   */
  send(request: ISendSmsRequest): Promise<ISendSmsResponse>;

  /**
   * Send bulk SMS messages
   */
  sendBulk(request: IBulkSmsRequest): Promise<IBulkSmsResponse>;

  /**
   * Get delivery report for a message
   */
  getDeliveryReport(messageId: string): Promise<IDeliveryReport | null>;

  /**
   * Get provider balance
   */
  getBalance(): Promise<IProviderBalance | null>;

  /**
   * Validate provider credentials
   */
  validateCredentials(): Promise<boolean>;

  /**
   * Check if provider is healthy/available
   */
  isHealthy(): Promise<boolean>;
}

/**
 * SMS Provider token for dependency injection
 */
export const SMS_PROVIDER_TOKEN = 'SMS_PROVIDER';

/**
 * Primary SMS Provider token
 */
export const PRIMARY_SMS_PROVIDER = 'PRIMARY_SMS_PROVIDER';

/**
 * Fallback SMS Provider token
 */
export const FALLBACK_SMS_PROVIDER = 'FALLBACK_SMS_PROVIDER';
