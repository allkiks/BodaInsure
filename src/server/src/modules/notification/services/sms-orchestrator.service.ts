import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ISmsProvider,
  ISendSmsRequest,
  ISendSmsResponse,
  IBulkSmsRequest,
  IBulkSmsResponse,
  IProviderBalance,
} from '../interfaces/sms-provider.interface.js';
import { AdvantasmsProvider } from '../providers/advantasms.provider.js';
import { AfricasTalkingProvider } from '../providers/africastalking.provider.js';
import { maskPhone } from '../../../common/utils/phone.util.js';

/**
 * SMS send options
 */
export interface SmsSendOptions {
  priority?: 'high' | 'normal' | 'low';
  preferredProvider?: 'advantasms' | 'africastalking';
  maxRetries?: number;
  skipFailover?: boolean;
}

/**
 * SMS Orchestrator Service
 * Manages SMS sending with provider failover and retry logic
 *
 * Failover Strategy:
 * 1. Try primary provider
 * 2. On failure, retry with exponential backoff (up to maxRetries)
 * 3. After max retries, failover to secondary provider
 * 4. Repeat retry logic with secondary provider
 *
 * Per CLAUDE.md and ussd_sms_integration.md requirements
 */
@Injectable()
export class SmsOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(SmsOrchestratorService.name);

  private primaryProvider: ISmsProvider;
  private fallbackProvider: ISmsProvider;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly providers: Map<string, ISmsProvider> = new Map();

  // Track provider health for smart routing
  private providerHealth: Map<string, { healthy: boolean; lastCheck: Date }> =
    new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly advantasmsProvider: AdvantasmsProvider,
    private readonly africasTalkingProvider: AfricasTalkingProvider,
  ) {
    this.maxRetries = this.configService.get<number>('SMS_MAX_RETRIES', 3);
    this.retryDelayMs = this.configService.get<number>('SMS_RETRY_DELAY_MS', 1000);

    // Register providers
    this.providers.set('advantasms', advantasmsProvider);
    this.providers.set('africastalking', africasTalkingProvider);

    // Set primary and fallback based on config
    const primaryName = this.configService.get<string>(
      'SMS_PRIMARY_PROVIDER',
      'africastalking',
    );
    const fallbackName = this.configService.get<string>(
      'SMS_FALLBACK_PROVIDER',
      'advantasms',
    );

    this.primaryProvider =
      this.providers.get(primaryName) ?? africasTalkingProvider;
    this.fallbackProvider =
      this.providers.get(fallbackName) ?? advantasmsProvider;

    this.logger.log(
      `SMS Orchestrator initialized: primary=${primaryName}, fallback=${fallbackName}`,
    );
  }

  /**
   * Initialize health checks on module start
   */
  async onModuleInit(): Promise<void> {
    await this.checkAllProviderHealth();
  }

  /**
   * Send SMS with failover and retry logic
   */
  async send(
    request: ISendSmsRequest,
    options: SmsSendOptions = {},
  ): Promise<ISendSmsResponse> {
    const {
      priority = 'normal',
      preferredProvider,
      maxRetries = this.maxRetries,
      skipFailover = false,
    } = options;

    // Determine which provider to use first
    let provider = this.primaryProvider;
    let fallback = this.fallbackProvider;

    if (preferredProvider) {
      const preferred = this.providers.get(preferredProvider);
      if (preferred) {
        provider = preferred;
        // Set fallback to the other provider
        fallback =
          preferredProvider === 'advantasms'
            ? this.africasTalkingProvider
            : this.advantasmsProvider;
      }
    }

    // Check provider health and swap if primary is unhealthy
    const primaryHealthy = await this.isProviderHealthy(provider.name);
    if (!primaryHealthy && !skipFailover) {
      this.logger.warn(
        `Primary provider ${provider.name} unhealthy, using ${fallback.name}`,
      );
      [provider, fallback] = [fallback, provider];
    }

    // Try primary provider with retries
    let result = await this.sendWithRetry(provider, request, maxRetries);

    // If failed and failover is allowed, try fallback provider
    if (!result.success && !skipFailover) {
      this.logger.warn(
        `Primary provider ${provider.name} failed, trying ${fallback.name}`,
      );
      this.markProviderUnhealthy(provider.name);
      result = await this.sendWithRetry(fallback, request, maxRetries);
    }

    // Log audit event
    this.logSmsAudit(request, result, priority);

    return result;
  }

  /**
   * Send bulk SMS with failover
   */
  async sendBulk(
    request: IBulkSmsRequest,
    options: SmsSendOptions = {},
  ): Promise<IBulkSmsResponse> {
    const { preferredProvider, skipFailover = false } = options;

    let provider = this.primaryProvider;
    let fallback = this.fallbackProvider;

    if (preferredProvider) {
      const preferred = this.providers.get(preferredProvider);
      if (preferred) {
        provider = preferred;
        fallback =
          preferredProvider === 'advantasms'
            ? this.africasTalkingProvider
            : this.advantasmsProvider;
      }
    }

    // Check provider health
    const primaryHealthy = await this.isProviderHealthy(provider.name);
    if (!primaryHealthy && !skipFailover) {
      this.logger.warn(
        `Primary provider ${provider.name} unhealthy for bulk, using ${fallback.name}`,
      );
      [provider, fallback] = [fallback, provider];
    }

    // Try primary provider
    let result = await provider.sendBulk(request);

    // If high failure rate, try failed messages with fallback
    if (!skipFailover && result.totalFailed > result.totalSent * 0.5) {
      this.logger.warn(
        `High failure rate (${result.totalFailed}/${request.messages.length}), retrying failed with ${fallback.name}`,
      );

      const failedMessages = request.messages.filter(
        (_, idx) => !result.results[idx]?.success,
      );

      if (failedMessages.length > 0) {
        const retryResult = await fallback.sendBulk({
          messages: failedMessages,
        });

        // Merge results
        let retryIdx = 0;
        for (let i = 0; i < result.results.length; i++) {
          if (!result.results[i].success && retryIdx < retryResult.results.length) {
            result.results[i] = retryResult.results[retryIdx];
            retryIdx++;
          }
        }

        result.totalSent = result.results.filter((r) => r.success).length;
        result.totalFailed = result.results.filter((r) => !r.success).length;
        result.success = result.totalFailed === 0;
      }
    }

    this.logger.log(
      `Bulk SMS: ${result.totalSent} sent, ${result.totalFailed} failed via ${provider.name}`,
    );

    return result;
  }

  /**
   * Get combined balance from all providers
   */
  async getAllBalances(): Promise<Record<string, IProviderBalance | null>> {
    const balances: Record<string, IProviderBalance | null> = {};

    for (const [name, provider] of this.providers) {
      balances[name] = await provider.getBalance();
    }

    return balances;
  }

  /**
   * Get provider health status
   */
  async getHealthStatus(): Promise<
    Record<string, { healthy: boolean; balance: IProviderBalance | null }>
  > {
    const status: Record<
      string,
      { healthy: boolean; balance: IProviderBalance | null }
    > = {};

    for (const [name, provider] of this.providers) {
      const healthy = await provider.isHealthy();
      const balance = await provider.getBalance();
      status[name] = { healthy, balance };
    }

    return status;
  }

  /**
   * Send with retry logic using exponential backoff
   */
  private async sendWithRetry(
    provider: ISmsProvider,
    request: ISendSmsRequest,
    maxRetries: number,
  ): Promise<ISendSmsResponse> {
    let lastResult: ISendSmsResponse | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        this.logger.debug(
          `Retry attempt ${attempt}/${maxRetries} for ${maskPhone(request.to)} after ${delay}ms`,
        );
        await this.delay(delay);
      }

      const result = await provider.send(request);
      lastResult = result;

      if (result.success) {
        if (attempt > 0) {
          this.logger.log(
            `SMS succeeded on retry ${attempt} via ${provider.name}`,
          );
        }
        return result;
      }

      // Check if error is retryable
      if (!this.isRetryableError(result.error)) {
        this.logger.debug(`Non-retryable error: ${result.error}`);
        break;
      }
    }

    return (
      lastResult ?? {
        success: false,
        provider: provider.name,
        error: 'Max retries exceeded',
      }
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error?: string): boolean {
    if (!error) return true;

    // Non-retryable errors
    const nonRetryable = [
      'Invalid phone number',
      'InvalidPhoneNumber',
      'Invalid sender',
      'InvalidSenderId',
      'Blocked',
      'Blacklisted',
    ];

    return !nonRetryable.some((e) =>
      error.toLowerCase().includes(e.toLowerCase()),
    );
  }

  /**
   * Check if provider is healthy (with caching)
   */
  private async isProviderHealthy(providerName: string): Promise<boolean> {
    const cached = this.providerHealth.get(providerName);
    const cacheExpiry = 60000; // 1 minute cache

    if (cached && Date.now() - cached.lastCheck.getTime() < cacheExpiry) {
      return cached.healthy;
    }

    const provider = this.providers.get(providerName);
    if (!provider) return false;

    const healthy = await provider.isHealthy();
    this.providerHealth.set(providerName, {
      healthy,
      lastCheck: new Date(),
    });

    return healthy;
  }

  /**
   * Mark provider as unhealthy
   */
  private markProviderUnhealthy(providerName: string): void {
    this.providerHealth.set(providerName, {
      healthy: false,
      lastCheck: new Date(),
    });
  }

  /**
   * Check health of all providers
   */
  private async checkAllProviderHealth(): Promise<void> {
    for (const [name, provider] of this.providers) {
      const healthy = await provider.isHealthy();
      this.providerHealth.set(name, {
        healthy,
        lastCheck: new Date(),
      });
      this.logger.log(`Provider ${name} health: ${healthy ? 'OK' : 'UNHEALTHY'}`);
    }
  }

  /**
   * Log SMS audit event
   */
  private logSmsAudit(
    request: ISendSmsRequest,
    result: ISendSmsResponse,
    priority: string,
  ): void {
    // In production, this would emit to the audit service
    this.logger.debug(
      JSON.stringify({
        type: 'SMS_SEND',
        to: maskPhone(request.to),
        provider: result.provider,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        priority,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convenience method for sending SMS (used by queue processor)
   * Per GAP-020: Simplified interface for queue-based SMS delivery
   */
  async sendSms(
    phone: string,
    message: string,
    preferredProvider?: string,
  ): Promise<{ messageId: string; success: boolean; error?: string }> {
    const result = await this.send(
      {
        to: phone,
        message,
      },
      {
        preferredProvider: preferredProvider as 'advantasms' | 'africastalking' | undefined,
      },
    );

    return {
      messageId: result.messageId ?? `sms-${Date.now()}`,
      success: result.success,
      error: result.error,
    };
  }
}
