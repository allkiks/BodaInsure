import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * M-Pesa Error Codes
 *
 * Standard error codes returned by M-Pesa Daraja API
 * Per P1-005 in mpesa_remediation.md
 */
export enum MpesaErrorCode {
  // Success
  SUCCESS = '0',

  // User-side errors (1xxx)
  CANCELLED_BY_USER = '1032',
  INSUFFICIENT_BALANCE = '1',
  WRONG_PIN = '2001',
  DAILY_LIMIT_EXCEEDED = '1025',
  DUPLICATE_TRANSACTION = '1037',
  TRANSACTION_TIMEOUT = '1036',

  // System errors (5xx/service)
  SERVICE_UNAVAILABLE = '503',
  INTERNAL_ERROR = '500',
  BAD_REQUEST = '400',

  // Authentication errors
  INVALID_CREDENTIALS = '401',
  TOKEN_EXPIRED = '40001',
}

/**
 * M-Pesa error messages for user-friendly display
 */
export const MPESA_ERROR_MESSAGES: Record<string, string> = {
  [MpesaErrorCode.SUCCESS]: 'Transaction completed successfully',
  [MpesaErrorCode.CANCELLED_BY_USER]: 'You cancelled the payment request',
  [MpesaErrorCode.INSUFFICIENT_BALANCE]: 'Your M-Pesa balance is insufficient',
  [MpesaErrorCode.WRONG_PIN]: 'Wrong M-Pesa PIN entered',
  [MpesaErrorCode.DAILY_LIMIT_EXCEEDED]: 'Your daily M-Pesa limit has been exceeded',
  [MpesaErrorCode.DUPLICATE_TRANSACTION]: 'A similar transaction is already being processed',
  [MpesaErrorCode.TRANSACTION_TIMEOUT]: 'The payment request timed out. Please try again',
  [MpesaErrorCode.SERVICE_UNAVAILABLE]: 'M-Pesa service is temporarily unavailable',
  [MpesaErrorCode.INTERNAL_ERROR]: 'An error occurred with M-Pesa. Please try again',
  [MpesaErrorCode.BAD_REQUEST]: 'Invalid payment request',
  [MpesaErrorCode.INVALID_CREDENTIALS]: 'Payment service authentication failed',
  [MpesaErrorCode.TOKEN_EXPIRED]: 'Payment service session expired',
};

/**
 * Get user-friendly error message from M-Pesa error code
 */
export function getMpesaErrorMessage(resultCode: string | number): string {
  const code = String(resultCode);
  return MPESA_ERROR_MESSAGES[code] ?? 'Payment could not be completed. Please try again';
}

/**
 * Check if the error is a user-side error (not system fault)
 */
export function isUserError(resultCode: string | number): boolean {
  const code = String(resultCode);
  return [
    MpesaErrorCode.CANCELLED_BY_USER,
    MpesaErrorCode.INSUFFICIENT_BALANCE,
    MpesaErrorCode.WRONG_PIN,
    MpesaErrorCode.DAILY_LIMIT_EXCEEDED,
  ].includes(code as MpesaErrorCode);
}

/**
 * Check if the error is retryable
 */
export function isRetryableError(resultCode: string | number): boolean {
  const code = String(resultCode);
  return [
    MpesaErrorCode.TRANSACTION_TIMEOUT,
    MpesaErrorCode.SERVICE_UNAVAILABLE,
    MpesaErrorCode.INTERNAL_ERROR,
    MpesaErrorCode.TOKEN_EXPIRED,
  ].includes(code as MpesaErrorCode);
}

/**
 * Base M-Pesa Exception
 */
export class MpesaException extends HttpException {
  constructor(
    public readonly mpesaErrorCode: string,
    public readonly mpesaMessage: string,
    httpStatus: HttpStatus = HttpStatus.BAD_GATEWAY,
  ) {
    super(
      {
        error: 'MPESA_ERROR',
        code: mpesaErrorCode,
        message: getMpesaErrorMessage(mpesaErrorCode),
        originalMessage: mpesaMessage,
      },
      httpStatus,
    );
  }
}

/**
 * M-Pesa Authentication Exception
 */
export class MpesaAuthException extends MpesaException {
  constructor(message: string = 'Failed to authenticate with M-Pesa') {
    super(MpesaErrorCode.INVALID_CREDENTIALS, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/**
 * M-Pesa Service Unavailable Exception
 */
export class MpesaServiceUnavailableException extends MpesaException {
  constructor(message: string = 'M-Pesa service is temporarily unavailable') {
    super(MpesaErrorCode.SERVICE_UNAVAILABLE, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/**
 * M-Pesa Timeout Exception
 */
export class MpesaTimeoutException extends MpesaException {
  constructor(message: string = 'M-Pesa request timed out') {
    super(MpesaErrorCode.TRANSACTION_TIMEOUT, message, HttpStatus.GATEWAY_TIMEOUT);
  }
}

/**
 * M-Pesa Insufficient Balance Exception
 */
export class MpesaInsufficientBalanceException extends MpesaException {
  constructor(message: string = 'Insufficient M-Pesa balance') {
    super(MpesaErrorCode.INSUFFICIENT_BALANCE, message, HttpStatus.PAYMENT_REQUIRED);
  }
}

/**
 * PII Masking Utilities
 *
 * Per P1-005: Never log full PII in plaintext
 */
export const PiiMasker = {
  /**
   * Mask phone number: +254712345678 -> +254***5678
   */
  maskPhone(phone: string | undefined | null): string {
    if (!phone) return '***';
    if (phone.length < 6) return '***';
    return phone.slice(0, 4) + '***' + phone.slice(-4);
  },

  /**
   * Mask national ID: 12345678 -> ****5678
   */
  maskNationalId(id: string | undefined | null): string {
    if (!id) return '***';
    if (id.length < 4) return '***';
    return '****' + id.slice(-4);
  },

  /**
   * Mask M-Pesa receipt: ABC123XYZ -> ABC***XYZ
   */
  maskReceipt(receipt: string | undefined | null): string {
    if (!receipt) return '***';
    if (receipt.length < 6) return receipt;
    return receipt.slice(0, 3) + '***' + receipt.slice(-3);
  },

  /**
   * Mask checkout request ID: ws_CO_123456789_abc -> ws_CO_***_abc
   */
  maskCheckoutId(id: string | undefined | null): string {
    if (!id) return '***';
    if (id.length < 10) return id.slice(0, 5) + '***';
    return id.slice(0, 6) + '***' + id.slice(-4);
  },

  /**
   * Create a safe log context object with masked PII
   */
  createSafeLogContext(context: {
    phone?: string;
    nationalId?: string;
    receipt?: string;
    checkoutRequestId?: string;
    amount?: number;
    [key: string]: unknown;
  }): Record<string, unknown> {
    const safe: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      switch (key) {
        case 'phone':
        case 'phoneNumber':
          safe[key] = PiiMasker.maskPhone(value as string);
          break;
        case 'nationalId':
        case 'national_id':
          safe[key] = PiiMasker.maskNationalId(value as string);
          break;
        case 'receipt':
        case 'mpesaReceiptNumber':
          safe[key] = PiiMasker.maskReceipt(value as string);
          break;
        case 'checkoutRequestId':
        case 'checkout_request_id':
          safe[key] = PiiMasker.maskCheckoutId(value as string);
          break;
        default:
          safe[key] = value;
      }
    }

    return safe;
  },
};

/**
 * Format error for logging (with PII masking)
 */
export function formatMpesaLogError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): { message: string; details: Record<string, unknown> } {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const safeContext = context ? PiiMasker.createSafeLogContext(context) : {};

  return {
    message: `M-Pesa ${operation} failed: ${errorMessage}`,
    details: {
      ...safeContext,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString(),
    },
  };
}
