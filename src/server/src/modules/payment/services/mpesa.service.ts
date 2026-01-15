import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { RedisService } from '../../../common/services/redis.service.js';
import {
  MpesaAuthException,
  MpesaServiceUnavailableException,
  MpesaTimeoutException,
  formatMpesaLogError,
} from '../errors/mpesa.errors.js';

/**
 * M-Pesa Daraja API endpoints
 */
const MPESA_ENDPOINTS = {
  sandbox: {
    auth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
    b2c: 'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
    b2cQuery: 'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query',
  },
  production: {
    auth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query',
    b2c: 'https://api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
    b2cQuery: 'https://api.safaricom.co.ke/mpesa/transactionstatus/v1/query',
  },
};

/**
 * STK Push request interface
 */
export interface StkPushRequest {
  phone: string;          // Phone number in format 254712345678
  amount: number;         // Amount in KES (whole numbers)
  accountReference: string; // Account reference (max 12 chars)
  transactionDesc: string;  // Transaction description (max 13 chars)
  callbackUrl?: string;   // Optional override for callback URL
}

/**
 * STK Push response interface
 */
export interface StkPushResponse {
  success: boolean;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * STK Query response interface
 */
export interface StkQueryResponse {
  success: boolean;
  resultCode?: string;
  resultDesc?: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
  amount?: number;
  errorMessage?: string;
}

/**
 * M-Pesa callback item interface
 */
export interface MpesaCallbackItem {
  Name: string;
  Value?: string | number;
}

/**
 * M-Pesa callback body interface
 */
export interface MpesaCallbackBody {
  stkCallback: {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResultCode: number;
    ResultDesc: string;
    CallbackMetadata?: {
      Item: MpesaCallbackItem[];
    };
  };
}

/**
 * Parsed callback data
 */
export interface ParsedCallbackData {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  isSuccessful: boolean;
  mpesaReceiptNumber?: string;
  amount?: number;
  transactionDate?: string;
  phoneNumber?: string;
}

/**
 * Redis cache keys for M-Pesa token management
 * Per P0-003 in mpesa_remediation.md
 */
const MPESA_TOKEN_CACHE_KEY = 'mpesa:oauth:access_token';
const MPESA_TOKEN_LOCK_KEY = 'mpesa:oauth:refresh';
const MPESA_TOKEN_CACHE_TTL_SECONDS = 55 * 60; // 55 minutes (token expires at 60)
const MPESA_TOKEN_LOCK_TTL_SECONDS = 15; // 15 seconds max to fetch token

/**
 * M-Pesa Daraja API Service
 * Handles all M-Pesa API interactions
 *
 * Per FEAT-PAY-001 and FEAT-PAY-002
 *
 * Token Caching (P0-003):
 * Uses Redis for distributed token caching to prevent token invalidation
 * in clustered deployments. Per Safaricom documentation, each new token
 * request invalidates all previous tokens.
 */
@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private readonly httpClient: AxiosInstance;
  private readonly environment: 'sandbox' | 'production';
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly shortcode: string;
  private readonly passkey: string;
  private readonly callbackUrl: string;
  private readonly useMock: boolean;

  // In-memory fallback for when Redis is unavailable
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.environment = this.configService.get<string>('MPESA_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production';
    this.consumerKey = this.configService.get<string>('MPESA_CONSUMER_KEY', '');
    this.consumerSecret = this.configService.get<string>('MPESA_CONSUMER_SECRET', '');
    this.shortcode = this.configService.get<string>('MPESA_SHORTCODE', '');
    this.passkey = this.configService.get<string>('MPESA_PASSKEY', '');
    this.callbackUrl = this.configService.get<string>('MPESA_CALLBACK_URL', '');

    // Enable mock mode via environment variable or if shortcode is not a valid number
    const mockEnv = this.configService.get<string>('MPESA_USE_MOCK', 'false');
    this.useMock = mockEnv === 'true' || !this.shortcode || this.shortcode === 'NA' || !/^\d+$/.test(this.shortcode);

    this.httpClient = axios.create({
      timeout: 30000, // 30 seconds timeout
    });

    // P1-003: Startup configuration validation
    this.validateConfiguration();
  }

  /**
   * Validate M-Pesa configuration on startup
   *
   * Per P1-003 in mpesa_remediation.md
   *
   * In production, missing required configuration will cause the application to fail fast
   * with a clear error message rather than silently failing during payment operations.
   */
  private validateConfiguration(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const mpesaEnabled = this.configService.get<string>('MPESA_ENABLED', 'false') === 'true';

    // In mock mode, skip validation
    if (this.useMock) {
      this.logger.warn('M-Pesa running in MOCK mode. Payments will be simulated.');
      return;
    }

    // Check if M-Pesa is enabled
    if (!mpesaEnabled) {
      this.logger.warn('M-Pesa is disabled (MPESA_ENABLED=false). Payment features will be unavailable.');
      return;
    }

    // Required configuration for production
    const required: { key: string; value: string; sensitive?: boolean }[] = [
      { key: 'MPESA_CONSUMER_KEY', value: this.consumerKey, sensitive: true },
      { key: 'MPESA_CONSUMER_SECRET', value: this.consumerSecret, sensitive: true },
      { key: 'MPESA_SHORTCODE', value: this.shortcode },
      { key: 'MPESA_PASSKEY', value: this.passkey, sensitive: true },
      { key: 'MPESA_CALLBACK_URL', value: this.callbackUrl },
    ];

    const missing = required.filter(({ value }) => !value);

    if (missing.length > 0) {
      const missingKeys = missing.map(({ key }) => key).join(', ');

      if (nodeEnv === 'production') {
        // In production, fail fast with clear error
        throw new Error(
          `Missing required M-Pesa configuration: ${missingKeys}. ` +
          `Service cannot start in production without these values. ` +
          `Either provide these values or set MPESA_ENABLED=false.`
        );
      } else {
        // In development, warn but continue
        this.logger.warn(
          `M-Pesa credentials not fully configured (missing: ${missingKeys}). ` +
          `Payment features will be unavailable.`
        );
        return;
      }
    }

    // Validate environment matches expectation
    if (nodeEnv === 'production' && this.environment !== 'production') {
      this.logger.warn(
        `WARNING: NODE_ENV is "production" but MPESA_ENVIRONMENT is "${this.environment}". ` +
        `This means you are running in production mode against the M-Pesa sandbox. ` +
        `Set MPESA_ENVIRONMENT=production for real payments.`
      );
    }

    // Validate callback URL is HTTPS in production
    if (nodeEnv === 'production' && this.callbackUrl && !this.callbackUrl.startsWith('https://')) {
      throw new Error(
        `MPESA_CALLBACK_URL must use HTTPS in production. ` +
        `Current value: ${this.callbackUrl}`
      );
    }

    // Validate callback URL doesn't contain discouraged keywords (per Safaricom docs)
    if (this.callbackUrl) {
      const discouragedKeywords = ['mpesa', 'safaricom', 'daraja'];
      const lowerUrl = this.callbackUrl.toLowerCase();
      const foundKeywords = discouragedKeywords.filter(kw => lowerUrl.includes(kw));

      if (foundKeywords.length > 0 && nodeEnv === 'production') {
        this.logger.warn(
          `MPESA_CALLBACK_URL contains discouraged keywords: ${foundKeywords.join(', ')}. ` +
          `Safaricom recommends avoiding these keywords in callback URLs.`
        );
      }
    }

    this.logger.log(
      `M-Pesa configured: environment=${this.environment}, shortcode=${this.shortcode}, ` +
      `callback=${this.callbackUrl.substring(0, 50)}...`
    );
  }

  /**
   * Get OAuth access token from M-Pesa
   *
   * Implementation uses distributed locking per P0-003 in mpesa_remediation.md
   * to prevent token invalidation in clustered deployments.
   *
   * Flow:
   * 1. Check Redis cache for existing token
   * 2. If not found, acquire distributed lock
   * 3. Double-check cache after lock (another pod may have refreshed)
   * 4. Fetch new token from Safaricom
   * 5. Store in Redis cache for all pods
   * 6. Release lock
   *
   * CRITICAL: Per Safaricom docs, each token request invalidates previous tokens.
   * This means only ONE pod should ever fetch a token at a time.
   */
  async getAccessToken(): Promise<string> {
    // 1. Try Redis cache first (fast path - shared across all pods)
    if (this.redisService.isAvailable()) {
      const cachedToken = await this.redisService.get(MPESA_TOKEN_CACHE_KEY);
      if (cachedToken) {
        this.logger.debug('Using cached M-Pesa access token from Redis');
        return cachedToken;
      }
    } else {
      // Fallback to in-memory cache if Redis unavailable
      if (this.accessToken && this.tokenExpiry && new Date() < new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000)) {
        this.logger.debug('Using in-memory cached M-Pesa access token (Redis unavailable)');
        return this.accessToken;
      }
    }

    // 2. Need to refresh - acquire distributed lock
    // This ensures ONLY ONE pod refreshes the token at a time
    const lockValue = await this.redisService.acquireLock(
      MPESA_TOKEN_LOCK_KEY,
      MPESA_TOKEN_LOCK_TTL_SECONDS,
      10, // retries
      200, // retry delay ms
    );

    if (!lockValue && this.redisService.isAvailable()) {
      // Couldn't get lock, another pod is refreshing
      // Wait a bit and try cache again
      this.logger.debug('Lock not acquired, waiting for another pod to refresh token');
      await new Promise(resolve => setTimeout(resolve, 500));

      const cachedAfterWait = await this.redisService.get(MPESA_TOKEN_CACHE_KEY);
      if (cachedAfterWait) {
        return cachedAfterWait;
      }

      // Still no token, try one more time
      throw new HttpException(
        'Failed to get M-Pesa access token - concurrent refresh timeout',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      // 3. Double-check cache after acquiring lock (another pod may have just refreshed)
      if (this.redisService.isAvailable()) {
        const cachedAfterLock = await this.redisService.get(MPESA_TOKEN_CACHE_KEY);
        if (cachedAfterLock) {
          this.logger.debug('Token was refreshed by another pod while waiting for lock');
          return cachedAfterLock;
        }
      }

      // 4. Actually fetch new token from Safaricom
      const token = await this.fetchTokenFromSafaricom();

      // 5. Store in Redis cache for all pods to use
      if (this.redisService.isAvailable()) {
        await this.redisService.set(MPESA_TOKEN_CACHE_KEY, token, MPESA_TOKEN_CACHE_TTL_SECONDS);
        this.logger.log('M-Pesa access token refreshed and cached in Redis');
      } else {
        // Fallback: store in memory
        this.accessToken = token;
        this.tokenExpiry = new Date(Date.now() + MPESA_TOKEN_CACHE_TTL_SECONDS * 1000);
        this.logger.log('M-Pesa access token refreshed (in-memory only - Redis unavailable)');
      }

      return token;
    } finally {
      // 6. Release lock
      if (lockValue) {
        await this.redisService.releaseLock(MPESA_TOKEN_LOCK_KEY, lockValue);
      }
    }
  }

  /**
   * Fetch access token from Safaricom OAuth endpoint
   *
   * Per P1-005: Enhanced error handling with specific exception types
   * @private
   */
  private async fetchTokenFromSafaricom(): Promise<string> {
    const endpoints = MPESA_ENDPOINTS[this.environment];
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

    try {
      const response = await this.httpClient.get(endpoints.auth, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        timeout: 15000, // 15 second timeout for auth
      });

      const token = response.data.access_token;
      if (!token) {
        throw new MpesaAuthException('No access_token in OAuth response');
      }

      return token;
    } catch (error) {
      // Handle Axios errors with specific types
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Timeout
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          const logError = formatMpesaLogError('OAuth token fetch', error, {
            environment: this.environment,
          });
          this.logger.error(logError.message, logError.details);
          throw new MpesaTimeoutException('M-Pesa OAuth request timed out');
        }

        // Connection refused / network error
        if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
          const logError = formatMpesaLogError('OAuth token fetch', error, {
            environment: this.environment,
          });
          this.logger.error(logError.message, logError.details);
          throw new MpesaServiceUnavailableException('Cannot connect to M-Pesa service');
        }

        // HTTP error responses
        if (axiosError.response) {
          const status = axiosError.response.status;
          const logError = formatMpesaLogError('OAuth token fetch', error, {
            environment: this.environment,
            httpStatus: status,
          });
          this.logger.error(logError.message, logError.details);

          if (status === 401 || status === 403) {
            throw new MpesaAuthException('Invalid M-Pesa credentials');
          }
          if (status >= 500) {
            throw new MpesaServiceUnavailableException('M-Pesa service error');
          }
        }
      }

      // If it's already one of our exceptions, rethrow
      if (error instanceof MpesaAuthException ||
          error instanceof MpesaServiceUnavailableException ||
          error instanceof MpesaTimeoutException) {
        throw error;
      }

      // Generic error
      const logError = formatMpesaLogError('OAuth token fetch', error, {
        environment: this.environment,
      });
      this.logger.error(logError.message, logError.details);
      throw new MpesaAuthException('Failed to authenticate with M-Pesa');
    }
  }

  /**
   * Generate password for STK Push
   * Password = Base64(Shortcode + Passkey + Timestamp)
   */
  private generatePassword(timestamp: string): string {
    const dataToEncode = `${this.shortcode}${this.passkey}${timestamp}`;
    return Buffer.from(dataToEncode).toString('base64');
  }

  /**
   * Generate timestamp in format YYYYMMDDHHmmss
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Format phone number for M-Pesa (254XXXXXXXXX)
   */
  formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('+254')) {
      cleaned = cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }

    return cleaned;
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   */
  async initiateSTKPush(request: StkPushRequest): Promise<StkPushResponse> {
    if (this.useMock) {
      this.logger.warn('M-Pesa in MOCK mode - simulating STK Push');
      return this.simulateStkPush(request);
    }

    try {
      const accessToken = await this.getAccessToken();
      const endpoints = MPESA_ENDPOINTS[this.environment];
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);
      const formattedPhone = this.formatPhoneNumber(request.phone);
      const callbackUrl = request.callbackUrl ?? this.callbackUrl;

      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount), // Must be whole number
        PartyA: formattedPhone,
        PartyB: this.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: request.accountReference.substring(0, 12),
        TransactionDesc: request.transactionDesc.substring(0, 13),
      };

      this.logger.log(
        `Initiating STK Push: phone=${formattedPhone.slice(-4)} amount=${request.amount}`,
      );

      const response = await this.httpClient.post(endpoints.stkPush, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;

      if (data.ResponseCode === '0') {
        this.logger.log(
          `STK Push initiated: checkoutRequestId=${data.CheckoutRequestID}`,
        );
        return {
          success: true,
          merchantRequestId: data.MerchantRequestID,
          checkoutRequestId: data.CheckoutRequestID,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
          customerMessage: data.CustomerMessage,
        };
      } else {
        this.logger.warn(
          `STK Push failed: code=${data.ResponseCode} desc=${data.ResponseDescription}`,
        );
        return {
          success: false,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
          errorMessage: data.errorMessage ?? data.ResponseDescription,
        };
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { errorMessage?: string; errorCode?: string } }; message?: string };
      this.logger.error('STK Push error', error);
      return {
        success: false,
        errorMessage: axiosError.response?.data?.errorMessage ?? axiosError.message ?? 'STK Push failed',
        errorCode: axiosError.response?.data?.errorCode,
      };
    }
  }

  /**
   * Query STK Push transaction status
   */
  async querySTKStatus(checkoutRequestId: string): Promise<StkQueryResponse> {
    if (!this.consumerKey || !this.consumerSecret) {
      this.logger.warn('M-Pesa not configured - cannot query status');
      return {
        success: false,
        errorMessage: 'M-Pesa not configured',
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const endpoints = MPESA_ENDPOINTS[this.environment];
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      const response = await this.httpClient.post(endpoints.stkQuery, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;

      return {
        success: data.ResultCode === '0',
        resultCode: data.ResultCode,
        resultDesc: data.ResultDesc,
        merchantRequestId: data.MerchantRequestID,
        checkoutRequestId: data.CheckoutRequestID,
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { errorMessage?: string } }; message?: string };
      this.logger.error('STK Query error', error);
      return {
        success: false,
        errorMessage: axiosError.response?.data?.errorMessage ?? axiosError.message ?? 'Query failed',
      };
    }
  }

  /**
   * Parse M-Pesa callback data
   */
  parseCallback(body: MpesaCallbackBody): ParsedCallbackData {
    const { stkCallback } = body;
    const result: ParsedCallbackData = {
      merchantRequestId: stkCallback.MerchantRequestID,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
      isSuccessful: stkCallback.ResultCode === 0,
    };

    // Extract metadata if payment was successful
    if (stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'MpesaReceiptNumber':
            result.mpesaReceiptNumber = String(item.Value);
            break;
          case 'Amount':
            result.amount = Number(item.Value);
            break;
          case 'TransactionDate':
            result.transactionDate = String(item.Value);
            break;
          case 'PhoneNumber':
            result.phoneNumber = String(item.Value);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Simulate STK Push for development/testing
   *
   * In mock mode, this also schedules a simulated callback to be sent
   * to the callback URL after a short delay, mimicking M-Pesa's actual behavior.
   */
  private simulateStkPush(request: StkPushRequest): StkPushResponse {
    const mockCheckoutRequestId = `ws_CO_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const mockMerchantRequestId = `${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    const formattedPhone = this.formatPhoneNumber(request.phone);

    this.logger.log(
      `[MOCK] Simulated STK Push: phone=${request.phone.slice(-4)} amount=${request.amount}`,
    );

    // Schedule simulated callback after delay (mimics M-Pesa callback timing)
    const mockDelayMs = this.configService.get<number>('MPESA_MOCK_CALLBACK_DELAY_MS', 5000);
    const shouldSimulateSuccess = this.configService.get<string>('MPESA_MOCK_SIMULATE_FAILURE', 'false') !== 'true';

    this.scheduleSimulatedCallback(
      mockMerchantRequestId,
      mockCheckoutRequestId,
      formattedPhone,
      request.amount,
      mockDelayMs,
      shouldSimulateSuccess,
    );

    return {
      success: true,
      merchantRequestId: mockMerchantRequestId,
      checkoutRequestId: mockCheckoutRequestId,
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Success. Request accepted for processing',
    };
  }

  /**
   * Schedule a simulated M-Pesa callback for mock mode
   *
   * This mimics what M-Pesa does in production - after the user "confirms"
   * on their phone, M-Pesa sends a callback to our endpoint.
   */
  private scheduleSimulatedCallback(
    merchantRequestId: string,
    checkoutRequestId: string,
    phone: string,
    amount: number,
    delayMs: number,
    shouldSucceed: boolean,
  ): void {
    const callbackUrl = this.callbackUrl;

    if (!callbackUrl) {
      this.logger.warn('[MOCK] No callback URL configured - skipping callback simulation');
      return;
    }

    this.logger.log(`[MOCK] Scheduling simulated callback in ${delayMs}ms to ${callbackUrl}`);

    setTimeout(async () => {
      try {
        const mockReceiptNumber = `MOCK${Date.now().toString().slice(-10)}`;
        const transactionDate = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

        // Build callback body matching M-Pesa's exact format
        const callbackBody: MpesaCallbackBody = {
          stkCallback: {
            MerchantRequestID: merchantRequestId,
            CheckoutRequestID: checkoutRequestId,
            ResultCode: shouldSucceed ? 0 : 1032, // 1032 = Request cancelled by user
            ResultDesc: shouldSucceed
              ? 'The service request is processed successfully.'
              : 'Request cancelled by user.',
            ...(shouldSucceed && {
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: amount },
                  { Name: 'MpesaReceiptNumber', Value: mockReceiptNumber },
                  { Name: 'TransactionDate', Value: transactionDate },
                  { Name: 'PhoneNumber', Value: phone },
                ],
              },
            }),
          },
        };

        this.logger.log(
          `[MOCK] Sending simulated ${shouldSucceed ? 'SUCCESS' : 'FAILURE'} callback: ` +
          `checkoutRequestId=${checkoutRequestId}, receipt=${mockReceiptNumber}`,
        );

        // POST to our own callback endpoint
        await this.httpClient.post(callbackUrl, callbackBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });

        this.logger.log(`[MOCK] Simulated callback delivered successfully`);
      } catch (error) {
        this.logger.error(`[MOCK] Failed to deliver simulated callback: ${error}`);
      }
    }, delayMs);
  }

  /**
   * Check if M-Pesa is configured
   */
  isConfigured(): boolean {
    return !!(this.consumerKey && this.consumerSecret && this.shortcode && this.passkey);
  }

  // ============================================================
  // B2C (Business to Customer) Methods - Per GAP-009
  // Used for refunds and disbursements
  // ============================================================

  /**
   * Initiate B2C payment (refund to customer)
   * @param request - B2C request details
   */
  async initiateB2C(request: B2cRequest): Promise<B2cResponse> {
    const b2cShortcode = this.configService.get<string>('MPESA_B2C_SHORTCODE', this.shortcode);
    const initiatorName = this.configService.get<string>('MPESA_B2C_INITIATOR_NAME', '');
    const securityCredential = this.configService.get<string>('MPESA_B2C_SECURITY_CREDENTIAL', '');
    const b2cResultUrl = this.configService.get<string>('MPESA_B2C_RESULT_URL', '');
    const b2cTimeoutUrl = this.configService.get<string>('MPESA_B2C_TIMEOUT_URL', '');

    if (!initiatorName || !securityCredential) {
      this.logger.warn('B2C not configured - simulating B2C payment');
      return this.simulateB2c(request);
    }

    try {
      const accessToken = await this.getAccessToken();
      const endpoints = MPESA_ENDPOINTS[this.environment];
      const formattedPhone = this.formatPhoneNumber(request.phone);

      const payload = {
        OriginatorConversationID: request.originatorConversationId ?? `refund_${Date.now()}`,
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: request.commandId ?? 'BusinessPayment', // BusinessPayment, SalaryPayment, PromotionPayment
        Amount: Math.round(request.amount),
        PartyA: b2cShortcode,
        PartyB: formattedPhone,
        Remarks: request.remarks?.substring(0, 100) ?? 'BodaInsure Refund',
        QueueTimeOutURL: request.timeoutUrl ?? b2cTimeoutUrl,
        ResultURL: request.resultUrl ?? b2cResultUrl,
        Occasion: request.occasion?.substring(0, 100) ?? 'Refund',
      };

      this.logger.log(
        `Initiating B2C: phone=${formattedPhone.slice(-4)} amount=${request.amount} reason=${request.remarks}`,
      );

      const response = await this.httpClient.post(endpoints.b2c, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;

      if (data.ResponseCode === '0') {
        this.logger.log(
          `B2C initiated: conversationId=${data.ConversationID}`,
        );
        return {
          success: true,
          conversationId: data.ConversationID,
          originatorConversationId: data.OriginatorConversationID,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
        };
      } else {
        this.logger.warn(
          `B2C failed: code=${data.ResponseCode} desc=${data.ResponseDescription}`,
        );
        return {
          success: false,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
          errorMessage: data.errorMessage ?? data.ResponseDescription,
        };
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { errorMessage?: string; errorCode?: string } }; message?: string };
      this.logger.error('B2C error', error);
      return {
        success: false,
        errorMessage: axiosError.response?.data?.errorMessage ?? axiosError.message ?? 'B2C payment failed',
        errorCode: axiosError.response?.data?.errorCode,
      };
    }
  }

  /**
   * Process refund to customer
   * Wrapper around B2C for clearer semantics
   */
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    const b2cResult = await this.initiateB2C({
      phone: request.phone,
      amount: request.amount,
      remarks: `Refund: ${request.reason}`,
      occasion: request.transactionRef ?? 'Policy Refund',
      originatorConversationId: `refund_${request.transactionRef ?? Date.now()}`,
      commandId: 'BusinessPayment',
    });

    return {
      success: b2cResult.success,
      refundId: b2cResult.conversationId,
      conversationId: b2cResult.conversationId,
      originatorConversationId: b2cResult.originatorConversationId,
      responseCode: b2cResult.responseCode,
      responseDescription: b2cResult.responseDescription,
      errorMessage: b2cResult.errorMessage,
      errorCode: b2cResult.errorCode,
    };
  }

  /**
   * Parse B2C callback data
   */
  parseB2cCallback(body: B2cCallbackBody): ParsedB2cCallbackData {
    const { Result } = body;
    const result: ParsedB2cCallbackData = {
      conversationId: Result.ConversationID,
      originatorConversationId: Result.OriginatorConversationID,
      resultCode: Result.ResultCode,
      resultDesc: Result.ResultDesc,
      isSuccessful: Result.ResultCode === 0,
      transactionId: Result.TransactionID,
    };

    // Extract result parameters if available
    if (Result.ResultParameters?.ResultParameter) {
      for (const param of Result.ResultParameters.ResultParameter) {
        switch (param.Key) {
          case 'TransactionReceipt':
            result.transactionReceipt = String(param.Value);
            break;
          case 'TransactionAmount':
            result.amount = Number(param.Value);
            break;
          case 'B2CWorkingAccountAvailableFunds':
            result.workingAccountBalance = Number(param.Value);
            break;
          case 'B2CUtilityAccountAvailableFunds':
            result.utilityAccountBalance = Number(param.Value);
            break;
          case 'TransactionCompletedDateTime':
            result.completedAt = String(param.Value);
            break;
          case 'ReceiverPartyPublicName':
            result.receiverName = String(param.Value);
            break;
          case 'B2CChargesPaidAccountAvailableFunds':
            result.chargesPaidBalance = Number(param.Value);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Simulate B2C for development/testing
   */
  private simulateB2c(request: B2cRequest): B2cResponse {
    const mockConversationId = `AG_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const mockOriginatorConversationId = request.originatorConversationId ?? `refund_${Date.now()}`;

    this.logger.log(
      `[DEV] Simulated B2C: phone=${request.phone.slice(-4)} amount=${request.amount}`,
    );

    return {
      success: true,
      conversationId: mockConversationId,
      originatorConversationId: mockOriginatorConversationId,
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.',
    };
  }

  /**
   * Check B2C configuration status
   */
  isB2cConfigured(): boolean {
    const initiatorName = this.configService.get<string>('MPESA_B2C_INITIATOR_NAME', '');
    const securityCredential = this.configService.get<string>('MPESA_B2C_SECURITY_CREDENTIAL', '');
    return !!(initiatorName && securityCredential);
  }
}

// ============================================================
// B2C Interfaces - Per GAP-009
// ============================================================

/**
 * B2C request interface
 */
export interface B2cRequest {
  phone: string;
  amount: number;
  remarks?: string;
  occasion?: string;
  originatorConversationId?: string;
  commandId?: 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';
  resultUrl?: string;
  timeoutUrl?: string;
}

/**
 * B2C response interface
 */
export interface B2cResponse {
  success: boolean;
  conversationId?: string;
  originatorConversationId?: string;
  responseCode?: string;
  responseDescription?: string;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Refund request interface (wrapper for B2C)
 */
export interface RefundRequest {
  phone: string;
  amount: number;
  reason: string;
  transactionRef?: string;
}

/**
 * Refund response interface
 */
export interface RefundResponse {
  success: boolean;
  refundId?: string;
  conversationId?: string;
  originatorConversationId?: string;
  responseCode?: string;
  responseDescription?: string;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * B2C callback result parameter
 */
export interface B2cResultParameter {
  Key: string;
  Value: string | number;
}

/**
 * B2C callback body interface
 */
export interface B2cCallbackBody {
  Result: {
    ResultType: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID: string;
    ResultParameters?: {
      ResultParameter: B2cResultParameter[];
    };
  };
}

/**
 * Parsed B2C callback data
 */
export interface ParsedB2cCallbackData {
  conversationId: string;
  originatorConversationId: string;
  resultCode: number;
  resultDesc: string;
  isSuccessful: boolean;
  transactionId?: string;
  transactionReceipt?: string;
  amount?: number;
  workingAccountBalance?: number;
  utilityAccountBalance?: number;
  chargesPaidBalance?: number;
  completedAt?: string;
  receiverName?: string;
}
